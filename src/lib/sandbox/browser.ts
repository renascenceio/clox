/**
 * Browser sandbox — one headless Chrome per chat, driven by the
 * agent-browser CLI, in its OWN Vercel Sandbox.
 *
 * Why a second VM instead of reusing the code sandbox: the browser needs
 * the open web, while the code sandbox holds the user's uploads behind a
 * short allow-list. Keeping them apart means a page the model visits can
 * never read or send those files.
 *
 * The browser (tabs, cookies, history) lives as long as the VM: 30 min
 * after the last action, extended on every call.
 */
import { Sandbox } from '@vercel/sandbox'
import { AGENT_BROWSER_VERSION, BROWSER_DNF_PACKAGES } from './browser-setup'

const TIMEOUT_MS = 30 * 60 * 1000
const COMMAND_TIMEOUT_MS = 45_000
export const VIEWPORT = { width: 1280, height: 800 }

/** The open web, minus private and link-local ranges (cloud metadata,
 *  anything inside the provider's network). */
const BROWSER_NETWORK = {
  allow: { '*': [] },
  subnets: {
    deny: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16', '127.0.0.0/8', '100.64.0.0/10'],
  },
}

const SNAPSHOT_ID = process.env.BROWSER_SNAPSHOT_ID
let snapshotUnavailable = false

export type BrowserProgress =
  | { phase: 'browser-booting' }
  | { phase: 'browser-installing' }
  | { phase: 'browser-ready'; durationMs: number }
  | { phase: 'browser-failed'; error: string }

interface BrowserRecord {
  sandbox: Sandbox
  ready: Promise<void>
  /** Viewport is applied once per browser launch. */
  configured: boolean
  shots: number
}

const REGISTRY = new Map<string, BrowserRecord>()

async function install(sandbox: Sandbox): Promise<void> {
  const steps: { cmd: string; args: string[]; sudo?: boolean }[] = [
    { cmd: 'dnf', args: ['install', '-y', '--setopt=install_weak_deps=False', ...BROWSER_DNF_PACKAGES], sudo: true },
    { cmd: 'npm', args: ['install', '-g', `agent-browser@${AGENT_BROWSER_VERSION}`] },
    { cmd: 'agent-browser', args: ['install'] },
  ]
  for (const s of steps) {
    const r = await sandbox.runCommand({ ...s, signal: AbortSignal.timeout(4 * 60 * 1000) })
    if (r.exitCode !== 0) {
      throw new Error(`${s.cmd} ${s.args[0]} failed: ${(await r.stderr()).slice(-300)}`)
    }
  }
}

async function boot(onProgress?: (e: BrowserProgress) => void): Promise<{ sandbox: Sandbox; installed: Promise<void> }> {
  if (SNAPSHOT_ID && !snapshotUnavailable) {
    try {
      const sandbox = await Sandbox.create({
        timeout: TIMEOUT_MS,
        networkPolicy: BROWSER_NETWORK,
        source: { type: 'snapshot' as const, snapshotId: SNAPSHOT_ID },
      })
      return { sandbox, installed: Promise.resolve() }
    } catch (e) {
      const text = `${(e as Error).message ?? ''} ${(e as { text?: string }).text ?? ''}`
      if (!/not.?found|404/i.test(text)) throw e
      snapshotUnavailable = true
      console.error(`[v0] browser: snapshot ${SNAPSHOT_ID} not found — installing on boot. Rebuild with scripts/build-browser-snapshot.ts`)
    }
  }
  const sandbox = await Sandbox.create({ runtime: 'node24', timeout: TIMEOUT_MS, networkPolicy: BROWSER_NETWORK })
  onProgress?.({ phase: 'browser-installing' })
  return { sandbox, installed: install(sandbox) }
}

async function getBrowser(chatId: string, onProgress?: (e: BrowserProgress) => void): Promise<BrowserRecord> {
  const existing = REGISTRY.get(chatId)
  if (existing && !existing.sandbox) {
    await existing.ready
    return existing
  }
  if (existing && (existing.sandbox.status === 'running' || existing.sandbox.status === 'pending')) {
    existing.sandbox.extendTimeout(TIMEOUT_MS).catch(() => {})
    await existing.ready
    return existing
  }
  REGISTRY.delete(chatId)
  onProgress?.({ phase: 'browser-booting' })
  const started = Date.now()
  const pending = boot(onProgress)
  const record: BrowserRecord = {
    sandbox: null as unknown as Sandbox,
    configured: false,
    shots: 0,
    ready: pending.then(async ({ sandbox, installed }) => {
      record.sandbox = sandbox
      await installed
    }),
  }
  // Register before awaiting so parallel calls share one boot.
  REGISTRY.set(chatId, record)
  try {
    await record.ready
  } catch (e) {
    REGISTRY.delete(chatId)
    onProgress?.({ phase: 'browser-failed', error: (e as Error).message })
    throw e
  }
  onProgress?.({ phase: 'browser-ready', durationMs: Date.now() - started })
  return record
}

export interface RunResult {
  ok: boolean
  out: string
}

async function ab(record: BrowserRecord, args: string[], timeoutMs = COMMAND_TIMEOUT_MS): Promise<RunResult> {
  try {
    const r = await record.sandbox.runCommand({ cmd: 'agent-browser', args, signal: AbortSignal.timeout(timeoutMs) })
    const [out, err] = await Promise.all([r.stdout(), r.stderr()])
    const text = `${out}${err ? `\n${err}` : ''}`.replace(/\u001b\[[0-9;]*m/g, '').trim()
    return { ok: r.exitCode === 0, out: text }
  } catch (e) {
    return { ok: false, out: (e as Error).message ?? String(e) }
  }
}

export type BrowserAction =
  | { action: 'open'; url: string }
  | { action: 'click'; ref: string }
  | { action: 'type'; ref: string; text: string; submit?: boolean }
  | { action: 'press'; key: string }
  | { action: 'select'; ref: string; value: string }
  | { action: 'scroll'; direction: 'up' | 'down'; amount?: number }
  | { action: 'back' }
  | { action: 'read'; ref?: string }
  | { action: 'look' }

export interface BrowserStep {
  ok: boolean
  /** What happened, in the CLI's words (errors included). */
  message: string
  url: string
  title: string
  /** Interactive elements with refs (@e1…), for the next action. */
  elements: string
  /** Page text, only for `read`. */
  text?: string
  /** PNG of the viewport after the action. */
  screenshot: Buffer | null
}

const ELEMENTS_CAP = 6_000
const TEXT_CAP = 14_000

function cap(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}\n…[truncated — scroll or read a smaller part]` : s
}

/** Unnamed links and table cells carry no meaning for the model; form
 *  controls stay even without a name because they can still be filled. */
const FORM_ROLES = /^\s*- (textbox|searchbox|combobox|checkbox|radio|button|slider|switch|spinbutton|listbox)\b/
function tidyElements(snapshot: string): string {
  return snapshot
    .split('\n')
    .filter(l => l.includes('"') || FORM_ROLES.test(l))
    .map(l => l.replace(/^(\s*)- /, '$1'))
    .join('\n')
}

function normaliseRef(ref: string): string {
  const r = ref.trim()
  return /^e\d+$/.test(r) ? `@${r}` : r
}

/** Run one browser action and capture the page state after it. */
export async function browse(
  chatId: string,
  step: BrowserAction,
  onProgress?: (e: BrowserProgress) => void,
): Promise<BrowserStep> {
  const record = await getBrowser(chatId, onProgress)
  let result: RunResult
  switch (step.action) {
    case 'open': {
      const url = /^[a-z]+:\/\//i.test(step.url) ? step.url : `https://${step.url}`
      if (!/^https?:\/\//i.test(url)) {
        result = { ok: false, out: 'Only http(s) pages can be opened.' }
        break
      }
      result = await ab(record, ['open', url])
      if (result.ok && !record.configured) {
        await ab(record, ['set', 'viewport', String(VIEWPORT.width), String(VIEWPORT.height)])
        record.configured = true
      }
      break
    }
    case 'click':
      result = await ab(record, ['click', normaliseRef(step.ref)])
      break
    case 'type':
      result = await ab(record, ['fill', normaliseRef(step.ref), step.text])
      if (result.ok && step.submit) result = await ab(record, ['press', 'Enter'])
      break
    case 'press':
      result = await ab(record, ['press', step.key])
      break
    case 'select':
      result = await ab(record, ['select', normaliseRef(step.ref), step.value])
      break
    case 'scroll':
      result = await ab(record, ['scroll', step.direction, String(step.amount ?? 700)])
      break
    case 'back':
      result = await ab(record, ['back'])
      break
    default:
      result = { ok: true, out: '' }
  }
  // Let navigations and late renders settle; never fail the step on it.
  if (result.ok && step.action !== 'read' && step.action !== 'look') {
    await ab(record, ['wait', '--load', 'networkidle'], 8_000)
  }

  const shotPath = `/tmp/shots/${++record.shots}.png`
  const [url, title, elements, text, shot] = await Promise.all([
    ab(record, ['get', 'url']),
    ab(record, ['get', 'title']),
    ab(record, ['snapshot', '-i', '-c']),
    step.action === 'read' ? ab(record, ['get', 'text', step.ref ? normaliseRef(step.ref) : 'body']) : Promise.resolve(null),
    (async () => {
      await record.sandbox.runCommand('mkdir', ['-p', '/tmp/shots'])
      const r = await ab(record, ['screenshot', shotPath])
      return r.ok ? record.sandbox.readFileToBuffer({ path: shotPath }).catch(() => null) : null
    })(),
  ])
  const noPage = /no (page|browser)|not (open|launched)/i
  return {
    ok: result.ok,
    message: cap(result.out, 1_500),
    url: url.ok ? url.out.split('\n')[0] : '',
    title: title.ok ? title.out.split('\n')[0] : '',
    elements: elements.ok ? cap(tidyElements(elements.out), ELEMENTS_CAP) : noPage.test(elements.out) ? 'No page open yet — use action "open".' : cap(elements.out, 500),
    text: text ? cap(text.out, TEXT_CAP) : undefined,
    screenshot: shot ?? null,
  }
}

export async function closeBrowser(chatId: string): Promise<void> {
  const record = REGISTRY.get(chatId)
  REGISTRY.delete(chatId)
  await record?.sandbox?.stop().catch(() => {})
}

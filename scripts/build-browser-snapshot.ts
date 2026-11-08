/**
 * Browser snapshot bootstrap — run once (and after bumping the
 * agent-browser version) with:
 *
 *   set -a; . /vercel/share/.env.project; set +a
 *   pnpm exec tsx scripts/build-browser-snapshot.ts
 *
 * Boots a node24 sandbox, installs Chromium's system libraries (dnf),
 * agent-browser and Chrome, smoke-tests a page, then snapshots the VM.
 * Put the printed id in BROWSER_SNAPSHOT_ID (all environments). Without
 * it the chat's browser installs the same things on first use (~60 s).
 */
import { writeFileSync } from 'node:fs'
import { Sandbox } from '@vercel/sandbox'
import { BROWSER_DNF_PACKAGES, AGENT_BROWSER_VERSION } from '../src/lib/sandbox/browser-setup'

const log: string[] = []
const say = (s: string) => { log.push(s); writeFileSync('/tmp/browser-snapshot.log', log.join('\n')) }

async function run(sandbox: Sandbox, label: string, cmd: string, args: string[], sudo = false) {
  const started = Date.now()
  const r = await sandbox.runCommand({ cmd, args, sudo })
  const out = (await r.stdout()).slice(-1500)
  const err = (await r.stderr()).slice(-1500)
  say(`${r.exitCode === 0 ? '✓' : '✗'} ${label} (${Date.now() - started} ms)\n${out}\n${err}`)
  if (r.exitCode !== 0) throw new Error(`${label} failed`)
  return out
}

async function main() {
  const sandbox = await Sandbox.create({ runtime: 'node24', timeout: 20 * 60 * 1000 })
  say(`sandbox ${sandbox.sandboxId}`)
  try {
    await run(sandbox, 'dnf', 'dnf', ['install', '-y', '--setopt=install_weak_deps=False', ...BROWSER_DNF_PACKAGES], true)
    await run(sandbox, 'agent-browser', 'npm', ['install', '-g', `agent-browser@${AGENT_BROWSER_VERSION}`])
    await run(sandbox, 'chrome', 'agent-browser', ['install'])
    await run(sandbox, 'open', 'agent-browser', ['open', 'https://example.com'])
    await run(sandbox, 'snapshot', 'agent-browser', ['snapshot', '-i', '-c'])
    await run(sandbox, 'help', 'agent-browser', ['--help'])
    await run(sandbox, 'close', 'agent-browser', ['close'])
    const snap = await sandbox.snapshot({ expiration: 0 })
    say(`BROWSER_SNAPSHOT_ID=${snap.snapshotId}`)
  } catch (e) {
    say(`failed: ${(e as Error).message}`)
    await sandbox.stop().catch(() => {})
    process.exitCode = 1
  }
}

void main()

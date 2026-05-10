/**
 * Sandbox manager — keeps one Vercel `Sandbox` microVM alive per chat
 * and brokers the file-mounting / output-collecting plumbing so the
 * route handler doesn't have to know any of that.
 *
 * Lifecycle:
 *   First tool call in a chat  →  manager creates a sandbox
 *   Subsequent tool calls      →  manager reuses the same sandbox
 *   30 min of idle             →  sandbox auto-stops (Sandbox's own timeout)
 *   Process recycles           →  in-memory map is lost; next call
 *                                  creates a fresh sandbox
 *
 * Persistence: deliberately none. The plan considered a `chats` table
 * with a `sandbox_id` column, but Clox stores chats client-side
 * (localStorage in `lib/chat-store.ts`). Adding a server-side chat
 * registry just for sandbox tracking would be overkill, so we accept
 * the cold-start cost: a fresh sandbox after deploy or process
 * recycle. Snapshots make this <5s.
 *
 * Concurrency: serverless functions run as multiple instances. Two
 * concurrent requests for the same chat could spawn TWO sandboxes —
 * acceptable for v1 since each one auto-cleans on idle. If this
 * becomes a real cost issue, we'd hold an advisory lock in Postgres.
 *
 * OIDC: the SDK reads `VERCEL_OIDC_TOKEN` from env automatically. In
 * production that token is provisioned by the platform; locally
 * `vercel env pull` populates it.
 */

import { Sandbox } from '@vercel/sandbox'

/** What the manager tracks per chat. We store the live `Sandbox`
 *  reference (not just the id) so we can reuse the same in-process
 *  command pipe and avoid a `Sandbox.get()` round trip on every tool
 *  call. */
interface SandboxRecord {
  sandbox: Sandbox
  /** Wall-clock timestamp of the last tool call. Used by the idle
   *  reaper if we ever add one — for now the sandbox's own timeout
   *  handles this. */
  lastUsedAt: number
  /** Filenames already mounted into `/mnt/user-data/uploads/`. We mount
   *  by `name + size + first-32-bytes-hash` to avoid re-uploading the
   *  same PDF on every turn of a long conversation. */
  mountedKeys: Set<string>
  /** Files we've already collected from `/mnt/user-data/outputs/` on a
   *  previous turn, so we only surface NEW outputs in each round-trip. */
  collectedKeys: Set<string>
}

/** In-process map. Module scope means it survives across requests
 *  hitting the same lambda instance. */
const REGISTRY = new Map<string, SandboxRecord>()

/** Initial sandbox lifetime. The Sandbox SDK ticks this down; each
 *  tool call extends it by another 30 min. */
const INITIAL_TIMEOUT_MS = 30 * 60 * 1000
const EXTEND_TIMEOUT_MS  = 30 * 60 * 1000

/** Network allow-list. The default is `deny-all`; we open up just
 *  enough for `pip install` (PyPI), git clones (GitHub), and the AI
 *  Gateway in case a future skill calls back through it. We never
 *  allow generic outbound HTTP. */
const NETWORK_POLICY = {
  allow: [
    'pypi.org',
    'files.pythonhosted.org',
    'github.com',
    'raw.githubusercontent.com',
    'codeload.github.com',
    'objects.githubusercontent.com',
    'ai-gateway.vercel.sh',
  ],
} as const

/** Optional snapshot containing the cloned `anthropics/skills` repo +
 *  pre-installed Python deps (built once via
 *  `scripts/build-skills-snapshot.ts`). When set we boot from the
 *  snapshot in <5s; when unset we boot a blank python3.13 sandbox so
 *  the route still works in dev — skill bundles just won't be present
 *  at `/mnt/skills/`. */
const SKILLS_SNAPSHOT_ID = process.env.SANDBOX_SKILLS_SNAPSHOT_ID

/** Spin up a fresh sandbox seeded for chat use.
 *
 *  Invariants the rest of the manager relies on:
 *    - `/mnt/user-data/uploads/`  exists  (writable by Python)
 *    - `/mnt/user-data/outputs/`  exists  (Python writes deliverables here)
 *    - When a snapshot is set, `/mnt/skills/` already contains the
 *      cloned Anthropic skills repo. */
async function createSandbox(): Promise<Sandbox> {
  const sandbox = await Sandbox.create({
    runtime: 'python3.13',
    timeout: INITIAL_TIMEOUT_MS,
    networkPolicy: NETWORK_POLICY,
    ...(SKILLS_SNAPSHOT_ID
      ? { source: { type: 'snapshot' as const, snapshotId: SKILLS_SNAPSHOT_ID } }
      : {}),
  })

  // Make sure the conventional folders exist even if the snapshot is
  // out of date. `mkdir -p` is idempotent so we can run it on every
  // boot without checking first.
  await sandbox.runCommand('mkdir', ['-p', '/mnt/user-data/uploads', '/mnt/user-data/outputs'])

  return sandbox
}

export async function getOrCreateSandboxForChat(chatId: string): Promise<Sandbox> {
  const existing = REGISTRY.get(chatId)
  if (existing) {
    // Best-effort liveness check. If the sandbox auto-stopped between
    // turns, we drop it and create a fresh one. We don't `Sandbox.get`
    // because that adds a round trip; we trust the in-memory `status`
    // accessor and let the next runCommand fail loudly if the SDK
    // disagrees.
    if (existing.sandbox.status === 'running' || existing.sandbox.status === 'pending') {
      existing.lastUsedAt = Date.now()
      try {
        await existing.sandbox.extendTimeout(EXTEND_TIMEOUT_MS)
      } catch {
        // Timeout extension is best-effort. If it fails the sandbox
        // will hit its existing deadline on its own; we don't want
        // the user-facing tool call to abort because of a refresh
        // hiccup.
      }
      return existing.sandbox
    }
    REGISTRY.delete(chatId)
  }

  const sandbox = await createSandbox()
  REGISTRY.set(chatId, {
    sandbox,
    lastUsedAt: Date.now(),
    mountedKeys: new Set(),
    collectedKeys: new Set(),
  })
  return sandbox
}

export interface AttachmentToMount {
  /** Original upload filename. */
  name: string
  /** Mime type for hint purposes; not used to filter. */
  contentType?: string
  /** Raw bytes. */
  content: Buffer
}

/** Mount fresh attachments into `/mnt/user-data/uploads/` so the model
 *  can read them via `bash` / `python`. Idempotent: each `(name,size)`
 *  pair is only uploaded once per chat. */
export async function mountAttachments(
  chatId: string,
  attachments: AttachmentToMount[],
): Promise<void> {
  if (attachments.length === 0) return
  const record = REGISTRY.get(chatId)
  if (!record) return

  const fresh: AttachmentToMount[] = []
  for (const a of attachments) {
    const key = `${a.name}::${a.content.byteLength}`
    if (record.mountedKeys.has(key)) continue
    record.mountedKeys.add(key)
    fresh.push(a)
  }
  if (fresh.length === 0) return

  await record.sandbox.writeFiles(
    fresh.map(a => ({
      path:    `/mnt/user-data/uploads/${a.name}`,
      content: a.content,
    })),
  )
}

export interface CollectedOutput {
  filename: string
  content: Buffer
  /** Best-guess mime from the filename extension; the route forwards
   *  this on to Supabase Storage. */
  mime: string
}

const MIME_BY_EXT: Record<string, string> = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv:  'text/csv',
  json: 'application/json',
  md:   'text/markdown',
  txt:  'text/plain',
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  gif:  'image/gif',
  svg:  'image/svg+xml',
  zip:  'application/zip',
  html: 'text/html',
}

function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

/** Diff `/mnt/user-data/outputs/` against `collectedKeys` and pull every
 *  new file's bytes back. Each file is keyed by `name + mtime + size`
 *  so the model overwriting an existing output in a later turn still
 *  surfaces the new version. */
export async function collectOutputs(chatId: string): Promise<CollectedOutput[]> {
  const record = REGISTRY.get(chatId)
  if (!record) return []

  // List files with size + mtime. Using `stat` keeps the parsing
  // simple — one line per file, tab-separated. We restrict to plain
  // files (skip dirs / symlinks) to avoid pulling weird kernel pseudo
  // files into Supabase Storage.
  const listing = await record.sandbox.runCommand({
    cmd: 'sh',
    args: [
      '-lc',
      // %n=name %s=size %Y=mtime epoch
      `find /mnt/user-data/outputs -maxdepth 5 -type f -printf '%f\\t%s\\t%T@\\n' 2>/dev/null || true`,
    ],
  })
  const stdout = await listing.stdout()
  const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean)

  const fresh: { name: string; key: string; relPath: string }[] = []
  for (const line of lines) {
    const [name, sizeStr, mtimeStr] = line.split('\t')
    if (!name) continue
    // Resolve to absolute path inside the sandbox. `find -printf %f`
    // strips directories, so we always read from the outputs root.
    // (Nested output directories aren't part of the contract.)
    const key = `${name}::${sizeStr}::${Math.floor(Number(mtimeStr ?? '0'))}`
    if (record.collectedKeys.has(key)) continue
    record.collectedKeys.add(key)
    fresh.push({ name, key, relPath: `/mnt/user-data/outputs/${name}` })
  }
  if (fresh.length === 0) return []

  // Pull bytes in parallel — most outputs are small (a few hundred KB)
  // so parallelism doesn't hurt and makes long lists snappy.
  const buffers = await Promise.all(
    fresh.map(async f => {
      try {
        const buf = await record.sandbox.readFileToBuffer({ path: f.relPath })
        return buf ? { name: f.name, buf } : null
      } catch {
        return null
      }
    }),
  )

  const out: CollectedOutput[] = []
  for (const b of buffers) {
    if (!b) continue
    out.push({
      filename: b.name,
      content:  b.buf,
      mime:     mimeFromName(b.name),
    })
  }
  return out
}

/** Manually retire a sandbox — used by tests and by a hypothetical
 *  "stop sandbox" UI affordance. Production flow relies on the
 *  sandbox's own timeout. */
export async function releaseSandbox(chatId: string): Promise<void> {
  const record = REGISTRY.get(chatId)
  if (!record) return
  REGISTRY.delete(chatId)
  try {
    await record.sandbox.stop()
  } catch {
    /* already gone */
  }
}

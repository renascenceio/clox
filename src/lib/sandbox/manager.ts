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

/** Progress events the manager can emit while booting a sandbox or
 *  installing the canonical Python package set. The route subscribes
 *  to these and writes them as message annotations on the in-flight
 *  assistant turn so the user sees friendly status text ("Starting
 *  Python sandbox", "Installing python deps (~30-40s)") instead of
 *  staring at a blank chat while the cold start runs.
 *
 *  Events are best-effort and idempotent in spirit: if a route
 *  swallows them or the dataStream has already closed, nothing
 *  breaks — they're cosmetic. The lifecycle still works without any
 *  callback at all (early callsites pass `undefined`). */
export type SandboxProgressEvent =
  | { phase: 'sandbox-booting' }
  | { phase: 'sandbox-ready'; durationMs: number }
  | { phase: 'sandbox-failed'; error: string }
  | { phase: 'deps-installing' }
  | { phase: 'deps-ready'; durationMs: number }
  | { phase: 'deps-failed'; error: string; durationMs: number }
  | { phase: 'snippet-running'; tool: 'python' | 'bash'; preview: string }
  | { phase: 'snippet-done';    tool: 'python' | 'bash'; ok: boolean; durationMs: number }
  | { phase: 'snippet-timeout'; tool: 'python' | 'bash'; durationMs: number }

export type SandboxProgressCallback = (event: SandboxProgressEvent) => void

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
  /** Memoised Promise resolved once the canonical Python package set
   *  is installed in this sandbox. The python tool awaits this before
   *  running each snippet so a model writing `from pptx import …` on
   *  the first call doesn't hit ModuleNotFoundError. Reusing the same
   *  Promise across concurrent calls collapses a thundering herd into
   *  a single install pass. Snapshot-backed sandboxes resolve to
   *  `null` immediately because packages are already baked in. */
  packagesReady: Promise<void>
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
  // The SDK types this as `string[]` (mutable). Keeping it as a plain
  // array literal — `as const` would widen it to a readonly tuple and
  // the `Sandbox.create` overload rejects that.
  allow: [
    'pypi.org',
    'files.pythonhosted.org',
    'github.com',
    'raw.githubusercontent.com',
    'codeload.github.com',
    'objects.githubusercontent.com',
    'ai-gateway.vercel.sh',
  ] as string[],
}

/** Optional snapshot containing the cloned `anthropics/skills` repo +
 *  pre-installed Python deps (built once via
 *  `scripts/build-skills-snapshot.ts`). When set we boot from the
 *  snapshot in <5s; when unset we boot a blank python3.13 sandbox and
 *  install the canonical package set on first boot so the python tool
 *  description ("python-pptx, pypdf, openpyxl … pre-installed") is
 *  actually true. */
const SKILLS_SNAPSHOT_ID = process.env.SANDBOX_SKILLS_SNAPSHOT_ID

/** Canonical Python package set the document-handling skills depend
 *  on. Trimmed to "things wheels exist for on PyPI" so `--prefer-binary`
 *  always wins and we never block on a C-extension build. The split is:
 *
 *    Tier 1 — installed eagerly on first sandbox boot (this list).
 *    Tier 2 — install on demand via `bash pip install <pkg>` when a
 *             skill asks for it (weasyprint, ocrmypdf, etc.).
 *
 *  Why not put EVERYTHING in tier 1? pandas+numpy alone are ~25MB of
 *  wheels and would push first-boot install past 60s on a cold cache.
 *  Most chat sessions never need them — skip until needed.
 *
 *  Order matters: largest wheels first means pip starts the slowest
 *  downloads earliest, so the parallel download phase finishes sooner. */
const FALLBACK_PYTHON_PACKAGES: string[] = [
  // PPTX skill (most common ask, must be present for "make me a deck").
  'python-pptx>=1.0',
  // Image handling — used by pptx for chart images, by canvas-design,
  // by file-reading for thumbnails. Big wheel (~10MB).
  'pillow>=10',
  // PDF read/write (PDF skill family).
  'pypdf>=4.0',
  'reportlab>=4.0',
  // Office docs.
  'python-docx>=1.1',
  'openpyxl>=3.1',
  // Markdown / HTML pipelines (doc co-author, pdf creation).
  'markdownify>=0.13',
]

/** First-boot pip-install timeout. With `--prefer-binary` and only
 *  wheel-shipping packages we expect ~20-40s on a cold cache. Cap at
 *  4 minutes so a wedged install doesn't pin the manager forever. */
const PIP_INSTALL_TIMEOUT_MS = 4 * 60 * 1000

/** Spin up a fresh sandbox seeded for chat use.
 *
 *  Invariants the rest of the manager relies on:
 *    - `/mnt/user-data/uploads/`  exists  (writable by Python)
 *    - `/mnt/user-data/outputs/`  exists  (Python writes deliverables here)
 *    - When a snapshot is set, `/mnt/skills/` already contains the
 *      cloned Anthropic skills repo. */
async function createSandbox(): Promise<Sandbox> {
  // The SDK splits `CreateSandboxParams` into two variants: one with
  // `runtime` (no `source`, or `source: git | tarball`) and one with
  // `source: { type: 'snapshot', snapshotId }` (which OMITS `runtime`
  // because the runtime is baked into the snapshot). We can't share
  // a single options object between the two — pick the right shape.
  const sandbox = SKILLS_SNAPSHOT_ID
    ? await Sandbox.create({
        timeout: INITIAL_TIMEOUT_MS,
        networkPolicy: NETWORK_POLICY,
        source: { type: 'snapshot' as const, snapshotId: SKILLS_SNAPSHOT_ID },
      })
    : await Sandbox.create({
        runtime: 'python3.13',
        timeout: INITIAL_TIMEOUT_MS,
        networkPolicy: NETWORK_POLICY,
      })

  // Make sure the conventional folders exist even if the snapshot is
  // out of date. `mkdir -p` is idempotent so we can run it on every
  // boot without checking first.
  await sandbox.runCommand('mkdir', ['-p', '/mnt/user-data/uploads', '/mnt/user-data/outputs'])

  return sandbox
}

/** Install the fallback Python package set in a freshly-created blank
 *  sandbox. No-op when the snapshot is in use because the packages
 *  are already baked in.
 *
 *  We pip-install in one pass with `--prefer-binary` so the resolver
 *  only considers wheels. lxml/numpy etc. would otherwise download
 *  source tarballs and burn 30-60s on C-extension compilation, which
 *  is incompatible with the 5-minute end-to-end budget for "make me
 *  a PPT" requests.
 *
 *  Errors are swallowed and logged — a failed install means the python
 *  tool will still work for snippets that don't need the heavy deps,
 *  and the model will get a real ModuleNotFoundError when it tries to
 *  import something missing. That's better than failing the whole
 *  sandbox boot. */
async function installFallbackPackages(
  sandbox: Sandbox,
  onProgress?: SandboxProgressCallback,
): Promise<void> {
  if (SKILLS_SNAPSHOT_ID) return // Snapshot already has them baked in.
  const startedAt = Date.now()
  console.log('[v0] sandbox: installing python deps (cold start, expect ~30-40s)…')
  onProgress?.({ phase: 'deps-installing' })
  try {
    const result = await sandbox.runCommand({
      cmd:  'sh',
      args: [
        '-lc',
        // `--prefer-binary` forces wheel use (no source builds).
        // `--no-cache-dir`  keeps the sandbox image lean.
        // `--quiet`         cuts the multi-screen pip progress noise.
        // We do NOT upgrade pip; the bundled pip on python3.13 is
        // recent enough and adds ~5s overhead per upgrade hop.
        `python3 -m pip install --prefer-binary --no-cache-dir --quiet ${FALLBACK_PYTHON_PACKAGES
          .map(p => `'${p}'`)
          .join(' ')}`,
      ],
      signal: AbortSignal.timeout(PIP_INSTALL_TIMEOUT_MS),
    })
    const elapsed = Date.now() - startedAt
    if (result.exitCode === 0) {
      console.log(`[v0] sandbox: deps installed in ${elapsed}ms`)
      onProgress?.({ phase: 'deps-ready', durationMs: elapsed })
    } else {
      const stderr = await result.stderr().catch(() => '')
      console.error(
        `[v0] sandbox: pip install exited ${result.exitCode} after ${elapsed}ms`,
        stderr.slice(0, 500),
      )
      onProgress?.({
        phase: 'deps-failed',
        error: `pip exit ${result.exitCode}: ${stderr.slice(0, 160)}`,
        durationMs: elapsed,
      })
    }
  } catch (e) {
    const elapsed = Date.now() - startedAt
    const message = (e as Error).message ?? String(e)
    console.error(`[v0] sandbox: pip install threw after ${elapsed}ms:`, message)
    onProgress?.({ phase: 'deps-failed', error: message.slice(0, 160), durationMs: elapsed })
  }
}

export async function getOrCreateSandboxForChat(
  chatId: string,
  onProgress?: SandboxProgressCallback,
): Promise<Sandbox> {
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

  // Cold path — emit boot progress so the user sees something is
  // happening during the ~5-10s sandbox spin-up.
  onProgress?.({ phase: 'sandbox-booting' })
  const bootStartedAt = Date.now()
  let sandbox: Sandbox
  try {
    sandbox = await createSandbox()
  } catch (e) {
    onProgress?.({ phase: 'sandbox-failed', error: (e as Error).message ?? String(e) })
    throw e
  }
  onProgress?.({ phase: 'sandbox-ready', durationMs: Date.now() - bootStartedAt })

  // Kick off pip-install in the background. We do NOT await it here so
  // route handlers calling `getOrCreateSandboxForChat` for non-python
  // reasons (e.g. mounting attachments early in the request) don't
  // block on a 30-40s install they may never need. The python tool
  // gates on this Promise via `waitForPackages` before each snippet.
  const record: SandboxRecord = {
    sandbox,
    lastUsedAt: Date.now(),
    mountedKeys: new Set(),
    collectedKeys: new Set(),
    packagesReady: installFallbackPackages(sandbox, onProgress),
  }
  REGISTRY.set(chatId, record)
  return sandbox
}

/** Block until the canonical Python deps are installed in this chat's
 *  sandbox. The python tool calls this before executing each snippet
 *  so first-call imports of `pptx` / `pypdf` / etc. just work.
 *
 *  Returns immediately on subsequent calls — the install Promise is
 *  memoised on the record. Returns immediately when no record exists
 *  yet (e.g. a python tool call ahead of any sandbox boot, which
 *  shouldn't actually happen because the tool's `execute` calls
 *  `getOrCreateSandboxForChat` first). */
export async function waitForPackages(chatId: string): Promise<void> {
  const record = REGISTRY.get(chatId)
  if (!record) return
  await record.packagesReady
}

/** Pre-warm the sandbox + start the package install for a chat
 *  without waiting on either. Call this from the route handler the
 *  moment we know the user's request will need the python tool, so
 *  the cold-boot + install latency overlaps with model token
 *  generation instead of stacking on top of the first tool call.
 *
 *  Errors are swallowed: pre-warm is best-effort — if it fails, the
 *  on-demand path in `getOrCreateSandboxForChat` will retry on the
 *  first real tool call. */
export function prewarmSandbox(
  chatId: string,
  onProgress?: SandboxProgressCallback,
): void {
  // Fire-and-forget. The promise reference is tracked inside
  // REGISTRY via the `packagesReady` field once create finishes.
  // The progress callback is the only path the route has into the
  // boot/install lifecycle once it's running asynchronously, so this
  // is what makes "Starting sandbox…" / "Installing python deps…"
  // chips visible to the user.
  void getOrCreateSandboxForChat(chatId, onProgress).catch(e => {
    console.error('[v0] sandbox prewarm failed:', (e as Error).message)
  })
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

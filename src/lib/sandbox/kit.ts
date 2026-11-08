/**
 * clox_kit — the Python design library (themes, fonts, decks, reports,
 * workbooks, data helpers) that the document skills build on.
 *
 * Source lives in `sandbox-kit/clox_kit/` at the repo root. It is copied
 * into every sandbox at boot (~1.3 MB, one writeFiles call) and made
 * importable from any python3 process via a `.pth` file, so both the
 * `python` and `bash` tools can `from clox_kit import Deck`.
 *
 * `next.config.mjs` → `experimental.outputFileTracingIncludes` ships the
 * folder with the chat function.
 */
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Sandbox } from '@vercel/sandbox'

/** Where the package lands inside the sandbox. /tmp is writable by the
 *  sandbox user on every image (snapshot or blank). */
export const KIT_ROOT = '/tmp/clox'

const KIT_SOURCE = path.join(process.cwd(), 'sandbox-kit', 'clox_kit')

type KitFile = { path: string; content: Buffer }

let kitFiles: Promise<KitFile[]> | null = null

async function walk(dir: string, rel: string): Promise<KitFile[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const out: KitFile[] = []
  for (const e of entries) {
    if (e.name === '__pycache__' || e.name.startsWith('.')) continue
    const abs = path.join(dir, e.name)
    const relPath = `${rel}/${e.name}`
    if (e.isDirectory()) out.push(...(await walk(abs, relPath)))
    else if (/\.(py|ttf|txt)$/.test(e.name)) out.push({ path: `${KIT_ROOT}/${relPath}`, content: await readFile(abs) })
  }
  return out
}

function loadKit(): Promise<KitFile[]> {
  // In dev the kit is edited while the server runs; re-read it each boot
  // so a running dev server never ships a stale copy into new sandboxes.
  if (!kitFiles || process.env.NODE_ENV !== 'production') {
    kitFiles = walk(KIT_SOURCE, 'clox_kit').catch(e => {
      kitFiles = null
      throw e
    })
  }
  return kitFiles
}

/** Content hash of the kit. The manager compares it with what a running
 *  sandbox was given and re-installs when the kit changed. */
export async function kitVersion(): Promise<string> {
  try {
    const files = await loadKit()
    const h = createHash('sha1')
    for (const f of files) h.update(f.path).update(f.content)
    return h.digest('hex').slice(0, 12)
  } catch {
    return 'none'
  }
}

/** Writes a .pth into whichever site-packages this interpreter can write
 *  (venv / runtime site first, then the user site). */
const REGISTER_PTH = [
  'import os, site, sys',
  `line = ${JSON.stringify(KIT_ROOT)} + "\\n"`,
  'dirs = list(site.getsitepackages()) + [site.getusersitepackages()]',
  'done = []',
  'for d in dirs:',
  '    try:',
  '        os.makedirs(d, exist_ok=True)',
  '        open(os.path.join(d, "clox_kit.pth"), "w").write(line)',
  '        done.append(d)',
  '        break',
  '    except OSError:',
  '        pass',
  'print("clox_kit registered in", done[0] if done else "nowhere")',
].join('\n')

/** Copy the kit into the sandbox and make it importable. Never throws —
 *  a missing kit only means the model falls back to raw python-pptx. */
export async function installKit(sandbox: Sandbox): Promise<boolean> {
  const startedAt = Date.now()
  try {
    const files = await loadKit()
    if (files.length === 0) return false
    await sandbox.writeFiles([
      ...files,
      { path: `${KIT_ROOT}/register.py`, content: Buffer.from(REGISTER_PTH, 'utf8') },
    ])
    const r = await sandbox.runCommand({ cmd: 'python3', args: [`${KIT_ROOT}/register.py`] })
    const ok = r.exitCode === 0
    console.log(`[v0] sandbox: clox_kit ${ok ? 'installed' : 'register failed'} (${files.length} files, ${Date.now() - startedAt}ms)`)
    return ok
  } catch (e) {
    console.error('[v0] sandbox: clox_kit install failed:', (e as Error).message)
    return false
  }
}

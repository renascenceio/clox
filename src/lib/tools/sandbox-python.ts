/**
 * `python` tool — runs a Python snippet inside the per-chat Vercel
 * Sandbox microVM. Companion to the `bash` tool; together they let
 * the model execute the full Anthropic-style document-handling
 * recipes (pypdf merge, openpyxl read, python-pptx generate, etc.)
 * with the bundled skills repo at `/mnt/skills/`.
 *
 * Implementation:
 *   - Snippet bytes are written to a temp file (`/tmp/snippet-<rand>.py`)
 *     so we can hand the model a multi-line script without worrying
 *     about shell quoting. `python -c '...'` would either need
 *     base64-encoding or aggressive escaping; a tempfile is
 *     simpler and the sandbox is throwaway anyway.
 *   - We use `python3` explicitly because the runtime is `python3.13`.
 *
 *   - Network: same deny-all-with-allowlist as bash.
 *   - Timeout: 180s per call (heavier than bash because PDF
 *     rasterisation, xlsx-with-formulas, and large pptx assembly
 *     can legitimately take a while; 90s was hitting the ceiling on
 *     10+ slide decks with chart rendering).
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getOrCreateSandboxForChat, waitForPackages } from '@/lib/sandbox/manager'
import { randomBytes } from 'node:crypto'

/** Wall-clock cap per python call. Trivial snippets (`from pptx
 *  import Presentation; print("ok")`) finish in <1s. The reason this
 *  cap is generous is the realistic worst case: a 10+ slide deck
 *  with chart rendering through pillow + reportlab + a couple of
 *  base64 image inserts can legitimately push 60-90s on a cold
 *  sandbox where the Python interpreter is still warming caches. The
 *  previous 90s cap was hitting that ceiling and aborting the snippet
 *  mid-render. 180s leaves headroom while still bounding worst-case
 *  cost; the outer chat function maxDuration (300s) is the real
 *  ceiling. */
const PYTHON_TIMEOUT_MS = 180_000

/** Same cap as bash for stdout/stderr in the response envelope. */
const STREAM_CAP_BYTES = 16 * 1024

function capText(s: string): { text: string; truncated: boolean } {
  if (Buffer.byteLength(s) <= STREAM_CAP_BYTES) return { text: s, truncated: false }
  return {
    text: s.slice(0, STREAM_CAP_BYTES) + '\n…[truncated]',
    truncated: true,
  }
}

export function makePythonTool(chatId: string) {
  return tool({
    description: [
      'Run a Python 3.13 snippet inside the conversation-scoped Linux microVM.',
      'Pre-installed packages: python-pptx, pillow, pypdf, reportlab,',
      'python-docx, openpyxl, markdownify. If you need a package not on',
      'this list (pdfplumber, numpy, pandas, weasyprint, pytesseract,',
      'imageio, etc.) install it FIRST via the bash tool with',
      '`pip install --prefer-binary <pkg>` — usually <15s for wheel-shipping',
      'packages. Uploads are at /mnt/user-data/uploads/; write deliverables',
      'to /mnt/user-data/outputs/. Bundled Anthropic skill assets live at',
      '/mnt/skills/<skill-name>/ when the snapshot is enabled. Hard timeout',
      'per call: 180 seconds.',
    ].join(' '),
    parameters: z.object({
      code: z
        .string()
        .min(1)
        .max(40_000)
        .describe(
          'A complete Python snippet. Will be written to a temp file ' +
            'and executed with `python3 <file>`. Use `print(...)` for ' +
            'output you want to surface.',
        ),
    }),
    execute: async ({ code }) => {
      try {
        const sandbox = await getOrCreateSandboxForChat(chatId)
        // Gate on the canonical Python package set being installed
        // before we run the snippet. On a sandbox that's been around
        // for a few turns this is an instant no-op (the install
        // Promise resolved long ago, or the snapshot already had the
        // packages baked in). On a freshly-booted no-snapshot sandbox
        // this awaits the 30-40s pip install kicked off at create
        // time. Doing it BEFORE we execute is the right order — a
        // snippet that does `from pptx import Presentation` would
        // crash with ModuleNotFoundError otherwise. The Promise is
        // memoised in the manager so two concurrent python calls
        // collapse into one install.
        await waitForPackages(chatId)
        // Generate a unique tempfile name so concurrent tool calls in
        // the same sandbox don't trample each other.
        const stamp = randomBytes(6).toString('hex')
        const path  = `/tmp/snippet-${stamp}.py`
        await sandbox.writeFiles([{ path, content: Buffer.from(code, 'utf8') }])
        const result = await sandbox.runCommand({
          cmd:  'python3',
          args: [path],
          signal: AbortSignal.timeout(PYTHON_TIMEOUT_MS),
        })
        const stdout = await result.stdout()
        const stderr = await result.stderr()
        const out = capText(stdout)
        const err = capText(stderr)
        return {
          ok: result.exitCode === 0,
          exitCode: result.exitCode,
          stdout: out.text,
          stderr: err.text,
          truncated: out.truncated || err.truncated,
        }
      } catch (e) {
        const err = e as Error
        const isTimeout = /aborted|timeout/i.test(err.message ?? '')
        return {
          ok: false,
          exitCode: -1,
          stdout: '',
          stderr: err.message ?? String(err),
          kind: isTimeout ? 'timeout' : 'runtime',
        }
      }
    },
  })
}

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
 *   - Timeout: 90s per call (heavier than bash because PDF
 *     rasterisation, xlsx-with-formulas, and large pptx assembly
 *     can legitimately take a while).
 */

import { tool } from 'ai'
import { z } from 'zod'
import { getOrCreateSandboxForChat } from '@/lib/sandbox/manager'
import { randomBytes } from 'node:crypto'

/** Wall-clock cap per python call. */
const PYTHON_TIMEOUT_MS = 90_000

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
      'Pre-installed packages: pypdf, pdfplumber, openpyxl, python-pptx,',
      'reportlab, pillow, imageio, python-docx, markdownify, weasyprint,',
      'pytesseract, numpy, pandas. Uploads are at /mnt/user-data/uploads/;',
      'write deliverables to /mnt/user-data/outputs/. Bundled Anthropic',
      'skill assets (with helper scripts and references) live at',
      '/mnt/skills/<skill-name>/. Use this for the heavy work in the',
      'pdf, docx, xlsx, pptx, pdf-reading, file-reading, canvas-design,',
      'algorithmic-art, and slack-gif-creator skills.',
      'Hard timeout per call: 90 seconds.',
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

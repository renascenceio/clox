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
import {
  getOrCreateSandboxForChat,
  waitForPackages,
  type SandboxProgressCallback,
} from '@/lib/sandbox/manager'
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

/** Build the `python` tool. `onProgress` is forwarded to the manager
 *  so sandbox-boot and dep-install events fan out to the same chat
 *  dataStream that this tool will emit its own snippet-running /
 *  snippet-done / snippet-timeout events into. */
export function makePythonTool(chatId: string, onProgress?: SandboxProgressCallback) {
  return tool({
    // Description compressed late 2026 from ~3.5 KB to ~900 B. Every
    // tool description ships on every request (and on cache miss
    // counts fully against per-minute input quota). Keep the
    // BEHAVIORAL contract here — paths, deps, save-incrementally —
    // and let the document skills carry deep how-to recipes.
    description: [
      'Run a Python 3.13 snippet inside the per-chat Linux microVM.',
      '',
      'Pre-installed: python-pptx, pillow, pypdf, reportlab, python-docx,',
      'openpyxl, markdownify. For anything else (numpy, pandas, pdfplumber,',
      'weasyprint, pytesseract …) `pip install --prefer-binary <pkg>` via',
      'the bash tool first (<15s on wheel-shipping packages).',
      '',
      'Paths:',
      '  /mnt/user-data/uploads/  — user attachments (read).',
      '  /mnt/user-data/outputs/  — write deliverables here; auto-collected',
      '                             and shown to the user as artifacts. No',
      '                             need to base64 bytes back into output.',
      '  /mnt/skills/skills/<n>/  — bundled skills (pptx, pdf, xlsx, docx,',
      '                             theme-factory, web-artifacts-builder…).',
      '                             For richly-formatted docs, FIRST `cat`',
      '                             the skill\'s SKILL.md (+ sub-files it',
      '                             references) before writing code — they',
      '                             have tested recipes for the API.',
      '',
      'CRITICAL — INCREMENTAL BUILDS ONLY. Do NOT write "one clean run"',
      'snippets for multi-unit deliverables. One snippet = ONE unit of',
      'work (one slide / page / sheet / chart). After each unit: SAVE to',
      '/mnt/user-data/outputs/, print "N/M saved", return. The next call',
      'OPENS the saved file and adds the next unit. Sandbox filesystem',
      'persists across all tool calls in this chat, so state survives.',
      '',
      'Why this matters:',
      '  - 180s wall-clock cap per call. A "build all 10 slides" snippet',
      '    hits the cap and loses ALL in-memory state.',
      '  - The model has a per-turn output-token cap. Inlining all of',
      '    the source code in one snippet consumes 20-30k output tokens',
      '    just on the code itself, blowing the cap mid-emission.',
      '  - When the cap is hit mid-snippet, the tool argument is malformed',
      '    JSON (a string literal cut off mid-line). The AI SDK cannot',
      '    resume a partial tool argument — "Continue" then produces a',
      '    NEW python file that doesn\'t know about prior units, and the',
      '    next save overwrites the partial deck on disk. The user has',
      '    no recovery path; they lose the turn AND the credits spent.',
      '  - Incremental-on-disk is the ONLY pattern that survives both',
      '    caps: each snippet is short enough to never truncate, and',
      '    each save persists progress in case the NEXT snippet fails.',
      '',
      'Pattern (10-slide deck with python-pptx):',
      '  call 1:  from pptx import Presentation; p = Presentation();',
      '           # build slide 1; p.save("/mnt/user-data/outputs/deck.pptx");',
      '           print("1/10 saved")',
      '  call 2:  from pptx import Presentation;',
      '           p = Presentation("/mnt/user-data/outputs/deck.pptx");',
      '           # build slide 2; p.save("…/deck.pptx"); print("2/10 saved")',
      '  …',
      '',
      'Snippet size budget: <150 lines of Python per call. If a snippet',
      'is about to exceed that, STOP and split into two calls.',
      '',
      'When NOT to use this tool: trivial single-shot artifacts the chat',
      'can render natively — small HTML pages, single-page reports, short',
      'markdown docs, single-sheet CSVs. Use the matching fenced block',
      '(```html / ```pdf / ```docx / ```csv) for those. Reach for python',
      'only when you need stateful, multi-step document construction or',
      'data processing.',
    ].join('\n'),
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
      // Pull a one-line preview of what we're about to run so the
      // client can render "Running Python: <preview>" in the progress
      // strip. We strip leading comments and blank lines to get to
      // the real first action — a model that opens with `# Step 1:
      // build the deck` is more useful with the next-line preview.
      const preview = code
        .split('\n')
        .map(l => l.trim())
        .find(l => l.length > 0 && !l.startsWith('#')) ?? ''
      try {
        const sandbox = await getOrCreateSandboxForChat(chatId, onProgress)
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
        const startedAt = Date.now()
        onProgress?.({ phase: 'snippet-running', tool: 'python', preview: preview.slice(0, 80) })
        const result = await sandbox.runCommand({
          cmd:  'python3',
          args: [path],
          signal: AbortSignal.timeout(PYTHON_TIMEOUT_MS),
        })
        const stdout = await result.stdout()
        const stderr = await result.stderr()
        const out = capText(stdout)
        const err = capText(stderr)
        const durationMs = Date.now() - startedAt
        onProgress?.({
          phase: 'snippet-done',
          tool: 'python',
          ok: result.exitCode === 0,
          durationMs,
        })
        return {
          ok: result.exitCode === 0,
          exitCode: result.exitCode,
          stdout: out.text,
          stderr: err.text,
          truncated: out.truncated || err.truncated,
          durationMs,
        }
      } catch (e) {
        const err = e as Error
        const isTimeout = /aborted|timeout/i.test(err.message ?? '')
        if (isTimeout) {
          onProgress?.({
            phase: 'snippet-timeout',
            tool: 'python',
            durationMs: PYTHON_TIMEOUT_MS,
          })
          // Hand the model a structured timeout result so it knows
          // exactly what happened and what to do next. The
          // `suggestion` field is read by both the model (it's the
          // most prominent field) AND the client UI, which surfaces
          // a "Continue generation" button on this result that lets
          // the user re-issue with the suggestion baked in.
          return {
            ok: false,
            exitCode: -1,
            stdout: '',
            stderr:
              'TIMEOUT: snippet exceeded the 180s wall-clock cap and was aborted ' +
              'mid-execution. Anything written to /mnt/user-data/outputs/ BEFORE the ' +
              'abort is still there (run `ls -la /mnt/user-data/outputs/` to see), but ' +
              'in-memory state (objects, variables, partially-built Presentation/' +
              'Document/Workbook objects) is gone.',
            kind: 'timeout',
            durationMs: PYTHON_TIMEOUT_MS,
            suggestion:
              'DO NOT retry the same snippet. Instead: ' +
              '(1) Check what survived: `ls -la /mnt/user-data/outputs/`. ' +
              '(2) If a partial file exists, reopen it and add ONE more unit ' +
              '(one slide / one sheet / one page) per snippet, saving after each. ' +
              '(3) If nothing survived, write a NEW snippet that builds only the ' +
              'FIRST unit (max ~80 lines of Python) and saves it. Then continue in ' +
              'subsequent calls. ' +
              'NEVER try to render the whole document in one snippet — that\'s what ' +
              'just failed. Aim for <150 lines per call.',
          }
        }
        return {
          ok: false,
          exitCode: -1,
          stdout: '',
          stderr: err.message ?? String(err),
          kind: 'runtime',
        }
      }
    },
  })
}

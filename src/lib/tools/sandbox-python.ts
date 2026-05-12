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
    description: [
      'Run a Python 3.13 snippet inside the conversation-scoped Linux microVM.',
      '',
      'Pre-installed packages: python-pptx, pillow, pypdf, reportlab,',
      'python-docx, openpyxl, markdownify. If you need a package not on',
      'this list (pdfplumber, numpy, pandas, weasyprint, pytesseract,',
      'imageio, etc.) install it FIRST via the bash tool with',
      '`pip install --prefer-binary <pkg>` — usually <15s for wheel-shipping packages.',
      '',
      'FILESYSTEM CONVENTIONS:',
      '  • /mnt/user-data/uploads/  — user attachments, read here.',
      '  • /mnt/user-data/outputs/  — write deliverables here. Anything you',
      '    save under this path is auto-collected at the end of your tool',
      '    call and surfaced to the user as a downloadable artifact in chat.',
      '    You do NOT need to base64 the bytes back into your response —',
      '    just save the file and mention the filename.',
      '  • /mnt/skills/skills/<skill-name>/  — the Anthropic skills bundle.',
      '    When the user asks for a richly-formatted document, ALWAYS start',
      '    by reading the skill\'s SKILL.md (the index) AND any sub-files it',
      '    references before writing code. Available skills:',
      '      pptx → /mnt/skills/skills/pptx/SKILL.md',
      '             - editing.md     (python-pptx recipes for modifying',
      '                               existing decks: unpack/edit/pack)',
      '             - pptxgenjs.md   (the RECOMMENDED engine for creating',
      '                               decks from scratch — see "ENGINE" below)',
      '             - scripts/       (runnable helpers: thumbnail.py,',
      '                               office/unpack.py, office/pack.py)',
      '      pdf  → /mnt/skills/skills/pdf/SKILL.md',
      '      xlsx → /mnt/skills/skills/xlsx/SKILL.md',
      '      theme-factory, web-artifacts-builder, slack-gif-creator,',
      '      webapp-testing, skill-creator, mcp-builder — `ls /mnt/skills/',
      '      skills/` to discover.',
      '    DO NOT reinvent the python-pptx / python-docx APIs from memory',
      '    when the bundled skill has a tested recipe — read the SKILL.md',
      '    AND its referenced sub-files first. The first call of any',
      '    document task should be `cat` on the SKILL.md, NOT writing code.',
      '',
      // Detailed PPTX engine selection (pptxgenjs vs python-pptx)
      // used to live here, but it belongs to the PPTX skill primer
      // now — pushing it down into the format-specific primer means
      // we don't leak PPTX-specific guidance into every python call
      // (XLSX/PDF/DOCX work didn't need it), and the primer carries
      // the full visual quality charter that produces the
      // "Claude-quality" output. See scripts/skill-rewrites/pptx.ts.
      // The snapshot pre-installs pptxgenjs at /opt/pptxgenjs so
      // `require("/opt/pptxgenjs")` is zero-config from Node.
      'INCREMENTAL BUILDS — THIS IS HOW YOU AVOID "STOPS MID-TASK":',
      '',
      'Each python call is capped at 180s wall-clock AND the surrounding',
      'turn is capped at 50 sequential tool calls. Both caps are real —',
      'when a single snippet tries to do too much, the user sees',
      '"the script stopped" and ALL progress in that snippet is lost.',
      '',
      'The single most important rule: SAVE AFTER EVERY UNIT OF WORK,',
      'and keep snippets SHORT. A "unit" is one slide, one page, one',
      'sheet, one chart, NOT one document. The sandbox filesystem',
      'persists between calls in the same chat, so the next snippet',
      'can reopen and continue.',
      '',
      'CORRECT pattern for a 10-slide deck:',
      '  call 1: create deck, slide 1 (title), save, print "1/10 saved".',
      '  call 2: open deck, slide 2 (agenda), save, print "2/10 saved".',
      '  ...',
      '  call 10: open deck, slide 10 (CTA), save, print "10/10 done".',
      '',
      'WRONG pattern (this is what causes "stops"):',
      '  call 1: 600-line snippet that builds all 10 slides, charts,',
      '          tables, palette, and master layout in one go.',
      '          Hits 180s, ENTIRE deck is lost, model has to restart.',
      '',
      'Snippet size budget: aim for under 150 lines of Python. If you',
      'find yourself writing more, you are about to lose work — STOP,',
      'save partial progress, and continue in the next call.',
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

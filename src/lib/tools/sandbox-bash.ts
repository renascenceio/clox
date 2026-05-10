/**
 * `bash` tool — runs a shell command inside the per-chat Vercel
 * Sandbox microVM. Pairs with the `python` tool for the agentic
 * Anthropic-style workflow: `bash` for filesystem ops, `python` for
 * the heavy document-processing recipes.
 *
 * Why a separate `bash` tool instead of just calling `runCommand`
 * inline:
 *   - The model already has fluent muscle memory for `bash` — the
 *     Anthropic skills literally say "run `pdfinfo input.pdf`" and
 *     expect a shell.
 *   - Streaming a single command's stdout/stderr back as a tool
 *     result gives us a clean structured envelope for the UI to
 *     render the command preview + exit code.
 *
 * Sandbox scope:
 *   - Network: deny-all with allow-list (PyPI, GitHub, AI Gateway).
 *     A `curl https://example.com` will fail closed.
 *   - Filesystem: persistent within the chat — files written by one
 *     `bash` call are visible to a later `python` call and vice versa.
 *   - Timeout: 60s per command. Long-running servers should not be
 *     spun up via this tool; we kill anything that runs past the cap.
 */

import { tool } from 'ai'
import { z } from 'zod'
import {
  getOrCreateSandboxForChat,
  type SandboxProgressCallback,
} from '@/lib/sandbox/manager'

/** Per-command wall-clock cap. Most file-handling commands (`ls`,
 *  `pdfinfo`, `file`, `head`, `unzip`) finish in well under a second.
 *  The reason this cap is generous is `pip install <pkg>` calls — the
 *  python tool's description tells the model to install on-demand
 *  packages (pdfplumber, pandas, numpy, weasyprint, …) via this tool.
 *  A cold install of pandas+numpy with `--prefer-binary` is ~30-50s,
 *  weasyprint is ~20s. 60s was too tight and the bash command would
 *  abort mid-install, leaving the model without the package it needs.
 *  180s gives comfortable headroom for the worst single-package case. */
const COMMAND_TIMEOUT_MS = 180_000

/** Cap on the size of stdout/stderr we forward back to the model.
 *  Excessive output costs tokens AND distracts from the actual signal.
 *  16KB ≈ 4000 tokens, plenty for the kind of summaries our skills
 *  emit. We mark truncation in the response so the model can ask for
 *  a tail / head if it needs to. */
const STREAM_CAP_BYTES = 16 * 1024

function capText(s: string): { text: string; truncated: boolean } {
  if (Buffer.byteLength(s) <= STREAM_CAP_BYTES) return { text: s, truncated: false }
  return {
    text: s.slice(0, STREAM_CAP_BYTES) + '\n…[truncated]',
    truncated: true,
  }
}

/** Pretty-print a shell command for the progress strip. We do a few
 *  cheap heuristic rewrites so common operations read as English
 *  instead of as a raw shell line — `pip install pandas pillow`
 *  becomes "Installing pandas, pillow", and `ls /mnt/...` becomes
 *  "Listing files". Falls back to the first non-empty line of the
 *  command for everything else. */
function previewBashCommand(command: string): string {
  const firstLine = command.split('\n').map(l => l.trim()).find(l => l.length > 0) ?? ''

  // pip install <packages…>
  const pipMatch = firstLine.match(/\bpip(?:3)?\s+install\s+([^|;&]+?)(?:\s*$)/)
  if (pipMatch) {
    const pkgs = pipMatch[1]
      .split(/\s+/)
      .filter(p => p && !p.startsWith('-'))     // drop flags like --prefer-binary
      .map(p => p.replace(/['"]/g, '').replace(/[<>=!~].*/, '')) // drop version specifiers
    if (pkgs.length > 0) return `Installing ${pkgs.slice(0, 3).join(', ')}${pkgs.length > 3 ? '…' : ''}`
  }

  // ls / find — listing files
  if (/^ls(\s|$)|^find(\s|$)/.test(firstLine)) return 'Listing files'

  // pdf info / extract
  if (/^pdfinfo(\s|$)/.test(firstLine)) return 'Reading PDF metadata'
  if (/^pdftotext(\s|$)/.test(firstLine)) return 'Extracting PDF text'

  // file inspection
  if (/^(file|head|tail|cat)(\s|$)/.test(firstLine)) return 'Inspecting file'

  // unzip / archive
  if (/^(unzip|tar|zip)(\s|$)/.test(firstLine)) return 'Unpacking archive'

  // Fallback — terse first-80-chars preview.
  return firstLine.slice(0, 80)
}

/** Build the `bash` tool, parameterised by the chat id so each tool
 *  invocation can find its own sandbox. `onProgress` is forwarded to
 *  the manager (for sandbox boot / dep-install phase events) AND
 *  fired locally for shell-running / shell-done events.
 *
 *  Accepting the chat id at build time (rather than reading it from
 *  the model's args) is intentional — the model has no business
 *  picking which chat's sandbox to drive. */
export function makeBashTool(chatId: string, onProgress?: SandboxProgressCallback) {
  return tool({
    description: [
      'Run a shell command inside the conversation-scoped Linux microVM.',
      'Use this for filesystem operations, listing files, examining',
      'uploads, running CLI utilities (pdfinfo, pdftotext, qpdf, file,',
      'unzip, ls, cat, head, tail, grep, sed, awk, find), and for',
      'installing on-demand Python packages with',
      '`pip install --prefer-binary <pkg>` when the python tool tells',
      'you a needed package is not pre-installed.',
      'Uploads are at /mnt/user-data/uploads/. Write deliverables to',
      '/mnt/user-data/outputs/ — files there are surfaced as downloads',
      'in the chat. Bundled Anthropic skill assets live at /mnt/skills/',
      '<skill-name>/ when the snapshot is enabled.',
      'No network access except PyPI, GitHub, and the AI Gateway.',
      'Hard timeout per command: 180 seconds.',
    ].join(' '),
    parameters: z.object({
      command: z
        .string()
        .min(1)
        .max(8_000)
        .describe(
          'A shell snippet executed under `sh -lc`. You can chain ' +
            'commands with `&&` / `;` / pipes as needed.',
        ),
    }),
    execute: async ({ command }) => {
      const preview = previewBashCommand(command)
      try {
        const sandbox = await getOrCreateSandboxForChat(chatId, onProgress)
        const startedAt = Date.now()
        onProgress?.({ phase: 'snippet-running', tool: 'bash', preview })
        const result = await sandbox.runCommand({
          cmd:  'sh',
          args: ['-lc', command],
          // The SDK has no first-class timeout; we use AbortSignal.
          signal: AbortSignal.timeout(COMMAND_TIMEOUT_MS),
        })
        const stdout = await result.stdout()
        const stderr = await result.stderr()
        const out = capText(stdout)
        const err = capText(stderr)
        const durationMs = Date.now() - startedAt
        onProgress?.({
          phase: 'snippet-done',
          tool: 'bash',
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
          onProgress?.({ phase: 'snippet-timeout', tool: 'bash', durationMs: COMMAND_TIMEOUT_MS })
          return {
            ok: false,
            exitCode: -1,
            stdout: '',
            stderr:
              'Shell command exceeded the 180s wall-clock cap and was aborted.',
            kind: 'timeout',
            durationMs: COMMAND_TIMEOUT_MS,
            suggestion:
              'For pip installs, install fewer packages per call or use ' +
              '`pip install --prefer-binary` to force wheel use. For other ' +
              'long-running commands, run them in chunks.',
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

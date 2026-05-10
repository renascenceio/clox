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
import { getOrCreateSandboxForChat } from '@/lib/sandbox/manager'

/** Per-command wall-clock cap. Document-processing recipes should
 *  finish in under 30s; the 60s limit gives headroom for the rare
 *  multi-page PDF rasterise. */
const COMMAND_TIMEOUT_MS = 60_000

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

/** Build the `bash` tool, parameterised by the chat id so each tool
 *  invocation can find its own sandbox.
 *
 *  Accepting the chat id at build time (rather than reading it from
 *  the model's args) is intentional — the model has no business
 *  picking which chat's sandbox to drive. */
export function makeBashTool(chatId: string) {
  return tool({
    description: [
      'Run a shell command inside the conversation-scoped Linux microVM.',
      'Use this for filesystem operations, listing files, examining',
      'uploads, running CLI utilities (pdfinfo, pdftotext, qpdf, file,',
      'unzip, ls, cat, head, tail, grep, sed, awk, find).',
      'Uploads are at /mnt/user-data/uploads/. Write deliverables to',
      '/mnt/user-data/outputs/ — files there are surfaced as downloads',
      'in the chat. Bundled Anthropic skill assets live at /mnt/skills/',
      '<skill-name>/ when the snapshot is enabled.',
      'No network access except PyPI, GitHub, and the AI Gateway.',
      'Hard timeout per command: 60 seconds.',
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
      try {
        const sandbox = await getOrCreateSandboxForChat(chatId)
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

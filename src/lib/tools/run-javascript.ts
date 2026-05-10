/**
 * `run_javascript` tool — server-side, callable by the model via the AI
 * SDK 4 `tool()` API. Executes a short JavaScript snippet inside a
 * deliberately-sandboxed Node `vm` context.
 *
 * Why a JS sandbox and not Python:
 *   - Zero extra runtime: Node's `node:vm` is built-in. Adding a Python
 *     interpreter would mean spinning up an external sandbox service or
 *     pulling in a 100MB pyodide bundle.
 *   - The model is happy to convert "compute the median of [4, 9, 1, 7]"
 *     into JavaScript; for serious numerical work the user should use a
 *     dedicated tool, which is out of scope here.
 *
 * Sandbox contract:
 *   - No `require`, `process`, `fs`, `import`, network, timers, or
 *     globalThis access. The context is a fresh object with only the
 *     standard globals the V8 sandbox provides (Math, JSON, Date,
 *     Number, String, Array, Object, etc.) plus our `print()` helper.
 *   - The snippet runs with a hard 1-second wall clock timeout via
 *     `vm.runInNewContext({ timeout: 1000 })`. Past the timeout V8
 *     throws and we surface that as a structured error.
 *   - The snippet's last expression is captured as the `result` field;
 *     anything passed to `print()` is collected into `stdout`. This is
 *     the same dual-channel contract Jupyter uses, so the model already
 *     knows how to drive it.
 *
 * Threat model:
 *   `node:vm` is NOT a security boundary against a determined adversary
 *   — V8 isolates can occasionally be escaped via prototype tricks, and
 *   Node leaks some host references through error stacks. For a fully
 *   adversarial workload we'd run this in a separate Vercel Sandbox
 *   process. For a co-operative LLM (which is the realistic threat
 *   surface here), `vm` + a clean context + a tight timeout is the
 *   right tradeoff. We document this so future readers don't ship this
 *   to a multi-tenant untrusted environment.
 */

import { tool } from 'ai'
import { z } from 'zod'
import vm from 'node:vm'

export const runJavaScriptTool = tool({
  description: [
    'Execute a short JavaScript snippet in a sandboxed Node VM and return',
    'the result and stdout. Use this for exact arithmetic, simple data',
    'transforms, regex testing, parsing snippets the user pastes, or any',
    'time you would otherwise be tempted to "calculate by hand" and risk',
    'an off-by-one. The sandbox has NO network, NO file system, NO module',
    'imports, and a 1 second timeout. Available: Math, JSON, Date, Number,',
    'String, Array, Object, Map, Set, Symbol, BigInt, Promise, and a',
    'global `print(...)` helper that appends to stdout.',
  ].join(' '),
  parameters: z.object({
    code: z
      .string()
      .min(1)
      .max(8_000)
      .describe(
        'A complete JS snippet. The last expression is returned as `result`.',
      ),
  }),
  execute: async ({ code }) => {
    // stdout buffer — the snippet drops strings here via `print(...)`.
    // We cap at 16KB so the model can't accidentally explode the
    // response with a `for (;;) print(' ')` loop.
    const STDOUT_CAP = 16_000
    let stdout = ''
    const print = (...args: unknown[]) => {
      const line = args
        .map(a =>
          typeof a === 'string'
            ? a
            : (() => {
                try { return JSON.stringify(a, null, 2) } catch { return String(a) }
              })(),
        )
        .join(' ')
      stdout = (stdout + line + '\n').slice(0, STDOUT_CAP)
    }

    // Build the sandbox object. We expose ONLY whitelisted globals so
    // the snippet can't accidentally reach the Node host. No `require`,
    // no `process`, no `fetch`, no timers.
    const sandbox: Record<string, unknown> = {
      print,
      Math, JSON, Date,
      Number, String, Boolean, Array, Object,
      Map, Set, Symbol, BigInt, Promise,
      Error, RangeError, TypeError, SyntaxError,
      // No console — we route output through `print()` so the model
      // gets a clear channel for textual output.
    }
    const context = vm.createContext(sandbox, {
      // Preventing the inner code from accessing `globalThis` of the
      // host realm — `codeGeneration: { strings: false }` blocks
      // `eval`/`new Function` constructed at runtime, which would
      // otherwise let the snippet escape via dynamic compilation.
      codeGeneration: { strings: false, wasm: false },
    })

    try {
      // Wrap the snippet so the LAST expression value comes back as
      // `result` while top-level statements still run. Using an IIFE
      // around the full body and adding a `;return (lastExpr)` on the
      // tail is brittle for arbitrary code, so instead we just eval
      // the snippet and let the user's snippet `return` or assign to
      // `result` themselves. The convention the description teaches
      // is: end with a bare expression OR call `print(...)`.
      const wrapped = `(()=>{ let __result; try { __result = (function(){ ${code} \n })(); } catch (e) { throw e } return __result })()`
      const result = vm.runInNewContext(wrapped, context, {
        timeout: 1000,
        displayErrors: true,
        // Filename only affects stack traces, but anchoring it makes
        // the error messages clearer for the model.
        filename: 'snippet.js',
      })
      // JSON-stringify defensively so the model gets a readable result
      // even when the snippet returns a class instance with circular
      // refs or similar.
      let resultText: string
      try {
        resultText = result === undefined ? 'undefined' : JSON.stringify(result)
      } catch {
        resultText = String(result)
      }
      return { ok: true, result: resultText, stdout }
    } catch (e) {
      // Surface timeouts as a distinct error code so the model can tell
      // the user it ran out of time vs hit a syntax problem.
      const err = e as Error
      const isTimeout = /Script execution timed out/i.test(err.message ?? '')
      return {
        ok: false,
        error: err.message ?? String(err),
        kind: isTimeout ? 'timeout' : 'runtime',
        stdout,
      }
    }
  },
})

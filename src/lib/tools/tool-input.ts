/** Sandbox tool inputs are checked inside `execute`, not in the zod
 *  schema. A schema failure (too long, cut-off JSON) throws out of
 *  streamText and ends the whole reply with a raw "Invalid arguments"
 *  error; a failed `execute` comes back to the model as a tool result it
 *  can read and recover from. */

/** The chat route's repair hook rewrites a broken call into
 *  `<BROKEN_CALL><reason>` so the tool can explain instead of crashing. */
export const BROKEN_CALL = '__clox_broken_call__:'

export const SNIPPET_MAX_CHARS = 120_000

const SPLIT_HINT =
  'Write long scripts in parts: append each part to a file (python: open(path, "a"); ' +
  'bash: cat >> /tmp/build.py <<\'EOF\' … EOF), then run the file in a short final call. ' +
  'For decks, reports and books use `from clox_kit import Deck, Report, Book` — it needs far less code.'

export function snippetProblem(text: string | undefined, noun: string) {
  const body = typeof text === 'string' ? text : ''
  if (body.startsWith(BROKEN_CALL)) {
    return { ok: false as const, kind: 'invalid-call', exitCode: 2, stdout: '', stderr: body.slice(BROKEN_CALL.length), suggestion: SPLIT_HINT }
  }
  if (!body.trim()) {
    return { ok: false as const, kind: 'invalid-call', exitCode: 2, stdout: '', stderr: `Empty ${noun}.`, suggestion: SPLIT_HINT }
  }
  if (body.length > SNIPPET_MAX_CHARS) {
    return {
      ok: false as const,
      kind: 'too-long',
      exitCode: 2,
      stdout: '',
      stderr: `The ${noun} was ${body.length.toLocaleString('en-US')} characters; the limit per call is ${SNIPPET_MAX_CHARS.toLocaleString('en-US')}. Nothing was run.`,
      suggestion: SPLIT_HINT,
    }
  }
  return null
}

/** A brand-new deck drawn shape by shape with python-pptx looks home-made
 *  and costs dozens of calls; clox_kit does the design. `Presentation()`
 *  with no file is how a new deck starts, so that is what we refuse. */
const NEW_RAW_DECK = /\bPresentation\(\s*\)/

export function rawDeckProblem(code: string) {
  if (!NEW_RAW_DECK.test(code) || /clox_kit/.test(code)) return null
  return {
    ok: false as const,
    kind: 'use-kit',
    exitCode: 2,
    stdout: '',
    stderr: 'New decks are built with clox_kit, not raw python-pptx. Nothing was run.',
    suggestion:
      'from clox_kit import Deck\n' +
      'd = Deck("my-deck", theme="noir", brand="Company", new=True)   # noir = dark + gold; navy, ivory, studio, midnight…\n' +
      'd.cover("Title", "Subtitle", kicker="Label"); d.stat("AED 761B", "What it is", context="Why it matters")\n' +
      'Later calls: d = Deck("my-deck") then d.kpis / d.chart / d.feature / d.cards / d.timeline …, finish with d.check().\n' +
      'Colours and fonts: brand="#C9A84C", fonts=("Playfair Display", "Inter").',
  }
}

/** The field each sandbox tool reads its snippet from. */
export const SNIPPET_FIELD: Record<string, string> = {
  bash: 'command',
  python: 'code',
  run_javascript: 'code',
}

export function brokenCallReason(error: unknown, rawArgs: string) {
  let parsed = true
  try { JSON.parse(rawArgs) } catch { parsed = false }
  if (!parsed) {
    return 'Your last call was not run: its arguments were not valid JSON, usually because the script was cut off by the output limit.'
  }
  const message = error instanceof Error ? error.message : String(error)
  return `Your last call was not run: its arguments did not match the tool (${message.slice(0, 300)}).`
}

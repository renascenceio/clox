/**
 * Token estimator — shared between client (composer meter) and server
 * (compaction trigger).
 *
 * Why character-count heuristics, not a real tokenizer
 * ----------------------------------------------------
 * A proper BPE / SentencePiece tokenizer (tiktoken / @anthropic-ai/tokenizer
 * / google's text-tokeniser-ts) would be exact, but it ships ~1-3 MB of
 * vocabulary tables — too heavy for the client bundle, and on the server
 * every request would deserialize the table even though we only use it to
 * decide whether to summarize. We instead use the well-known heuristic
 *
 *     tokens ≈ chars / 4
 *
 * which is within ~10-15 % of every modern tokenizer on English / code.
 * Multi-byte characters (CJK, emoji) push the ratio closer to 1:1 — the
 * estimator over-counts those, which is the safe direction for budget
 * decisions (we'd compact slightly earlier, not later than ideal).
 *
 * The two helpers below intentionally accept the same shapes the rest of
 * the codebase already deals with:
 *   - `estimateTokensForString(s)` for a raw block of text (system prompt,
 *     a single user draft)
 *   - `estimateTokensForMessages(msgs)` for a useChat-shaped transcript
 *     where each message has a `content` that is either a string or an
 *     array of `{type, text}` parts (multimodal). Image parts contribute
 *     a fixed 100-token estimate — close enough for budget gating; the
 *     real cost depends on resolution and provider. */

/** Cheap shared estimator. Always returns a non-negative integer. */
export function estimateTokensForString(text: unknown): number {
  if (typeof text !== 'string' || text.length === 0) return 0
  // chars / 4, floor — the +3 / 4 bias rounds up for short strings so a
  // 2-char message still counts as 1 token, not 0.
  return Math.max(1, Math.ceil(text.length / 4))
}

/**
 * Estimate tokens for a useChat-shaped message array. Handles:
 *   - `{ content: 'plain string' }` (most common)
 *   - `{ content: [{type:'text', text:'…'}, {type:'image', …}, …] }`
 *     (multimodal — vision uploads, attached PDFs)
 *   - `experimental_attachments: [{name, contentType, url}]`
 *     (the `useChat` mirror of the same parts)
 * Unknown shapes contribute 0 rather than throwing — this is a budget
 * heuristic, not a validator. */
export function estimateTokensForMessages(
  messages: ReadonlyArray<unknown>,
): number {
  let total = 0
  for (const m of messages) {
    if (!m || typeof m !== 'object') continue
    const msg = m as {
      content?: unknown
      experimental_attachments?: Array<{ contentType?: string }>
    }
    if (typeof msg.content === 'string') {
      total += estimateTokensForString(msg.content)
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (!part || typeof part !== 'object') continue
        const p = part as { type?: string; text?: string }
        if (p.type === 'text') total += estimateTokensForString(p.text)
        // 100-token flat for any non-text part (image / file / tool-call).
        // Matches OpenAI's vision-low-detail floor closely enough for
        // budget decisions. The actual cost depends on resolution.
        else total += 100
      }
    }
    if (Array.isArray(msg.experimental_attachments)) {
      // Each attachment that ISN'T already represented as a content
      // part adds the same 100-token floor.
      total += msg.experimental_attachments.length * 100
    }
  }
  return total
}

/**
 * Format a token count for tight UI affordances (composer meter).
 *   42       → "42"
 *   1234     → "1.2k"
 *   12345    → "12k"
 *   123456   → "123k"
 * Always returns ≤4 visible characters so the meter doesn't reflow when
 * the count grows during typing. */
export function formatTokenCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return Math.round(n / 1000) + 'k'
}

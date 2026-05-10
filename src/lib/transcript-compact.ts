/**
 * Transcript auto-compaction.
 *
 * Why heuristic, not LLM-summarised
 * ---------------------------------
 * The whole point of compaction is to relieve rate-limit pressure.
 * Calling an LLM to summarise old turns would BURN against the same
 * per-minute input ceiling we're trying to avoid bouncing off — Opus
 * 4.6's 10k TPM cap is the constraint, and a summary call would eat
 * a 4-6k chunk of it the moment compaction needs to fire. The
 * heuristic below preserves enough signal (last user prompt of each
 * compacted turn, leading sentences of each assistant reply, file /
 * tool-call headers) to keep the model grounded, costs zero extra
 * tokens to produce, and runs in <1ms. We can upgrade to an
 * LLM-summarised path later if the heuristic ever proves too lossy
 * on real transcripts.
 *
 * Trigger
 * -------
 * Compaction fires when the estimated token cost of the messages
 * array exceeds `maxBudgetTokens`. We always keep the LAST
 * `keepRecentTurns` turns verbatim — the model needs the latest
 * exchange in full to respond accurately. Only the older prefix is
 * collapsed into a single synthetic system message.
 *
 * Safety
 * ------
 *   - We never compact attachments — multimodal content (images,
 *     files) stays attached to its original message. If a turn has
 *     attachments and falls in the compact range, we keep that turn
 *     verbatim too. The token saving is on text-heavy transcripts.
 *   - Tool-call / tool-result message pairs are kept together. A
 *     lone tool-result without its triggering call would confuse
 *     the model's tool-use state machine and could provoke a 400
 *     from strict providers (Anthropic).
 *   - The synthetic system message is tagged with a leading marker
 *     so it's easy to spot in logs, and the route emits a
 *     `kind: 'compacted'` annotation so the UI can show a badge. */

import { estimateTokensForMessages } from '@/lib/token-estimate'

export interface CompactionResult {
  /** New message array to send to the provider. */
  messages: unknown[]
  /** How many original messages were folded into the summary. 0 = no compaction happened. */
  compactedCount: number
  /** Estimated tokens BEFORE compaction. Useful for telemetry / UI badges. */
  beforeTokens: number
  /** Estimated tokens AFTER compaction. */
  afterTokens: number
}

interface CompactionOptions {
  /**
   * If the estimated input-token cost of the message array exceeds
   * this, compaction kicks in. Default 6000 — chosen so even the
   * tightest provider tier (Anthropic Opus 4.6 at 10k input TPM)
   * has comfortable headroom for the system prompt + completion.
   */
  maxBudgetTokens?: number
  /**
   * How many trailing turns to keep verbatim. A "turn" here is one
   * message regardless of role; we don't try to pair user+assistant.
   * Default 8 — typically 4 user + 4 assistant, which covers the
   * recency window the model needs to maintain coherence.
   */
  keepRecentTurns?: number
}

interface MessageLike {
  role?: string
  content?: unknown
  experimental_attachments?: unknown[]
  // Some providers / our internal format use these instead of `content`.
  // We touch them defensively when summarising.
  toolInvocations?: unknown[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any
}

/**
 * Extract a plain-text approximation of a message's content suitable
 * for inclusion in a summary block. Handles both string content and
 * AI-SDK-style content arrays (`[{type:'text', text:...}, ...]`).
 * Multi-modal parts are described, not rendered, to keep the summary
 * token-cheap. */
function flattenContent(c: unknown): string {
  if (typeof c === 'string') return c
  if (!Array.isArray(c)) return ''
  const parts: string[] = []
  for (const p of c as Array<{ type?: string; text?: string }>) {
    if (!p || typeof p !== 'object') continue
    if (p.type === 'text' && typeof p.text === 'string') parts.push(p.text)
    else if (p.type === 'image') parts.push('[image]')
    else if (p.type === 'tool-call') parts.push('[tool call]')
    else if (p.type === 'tool-result') parts.push('[tool result]')
  }
  return parts.join(' ')
}

/**
 * Trim a message body to its leading sentences. Used for assistant
 * messages where the first 1-2 sentences usually carry the answer's
 * thesis and the rest is detail. We cap at 320 chars regardless to
 * bound worst-case bloat. */
function leadingSentences(text: string, maxSentences = 2, maxChars = 320): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  // Greedy split on sentence terminators followed by whitespace.
  const matches = cleaned.match(/[^.!?]+[.!?]+(?:\s|$)/g)
  const head = matches ? matches.slice(0, maxSentences).join('').trim() : cleaned
  return head.length > maxChars ? head.slice(0, maxChars - 1).trimEnd() + '…' : head
}

/**
 * Compact a transcript when its token cost exceeds the budget. Pure
 * function — no I/O, no model calls. Returns the original array
 * untouched (with `compactedCount: 0`) when no compaction is needed,
 * so callers can apply this unconditionally without a token check
 * of their own. */
export function compactTranscript(
  messages: unknown[],
  opts: CompactionOptions = {},
): CompactionResult {
  const maxBudget = opts.maxBudgetTokens ?? 6000
  const keepRecent = opts.keepRecentTurns ?? 8

  const beforeTokens = estimateTokensForMessages(messages)

  // Fast path: under budget OR not enough messages to bother
  // compacting (compacting 5-message transcripts saves tens of
  // tokens at the cost of model coherence — not worth it).
  if (beforeTokens <= maxBudget || messages.length <= keepRecent + 2) {
    return { messages, compactedCount: 0, beforeTokens, afterTokens: beforeTokens }
  }

  // Find the split point. We want to compact `messages[0..splitIdx-1]`
  // and keep `messages[splitIdx..]` verbatim. We also REFUSE to split
  // inside a tool-call / tool-result pair: if the message at splitIdx
  // is a tool-result, walk forward until we find a non-tool message
  // so the call+result pair stays together.
  let splitIdx = Math.max(0, messages.length - keepRecent)
  while (
    splitIdx < messages.length &&
    (messages[splitIdx] as MessageLike)?.role === 'tool'
  ) {
    splitIdx += 1
  }

  // Refuse to compact anything with attachments. If the prefix
  // contains attachments, we either skip compaction entirely (when
  // the attachments are recent) or accept the lower token saving.
  // For simplicity in this first pass, we drop into a "no compact"
  // result if ANY of the would-be-compacted messages has attachments,
  // and let the user resolve via Phase 3's manual compact button when
  // we ship that. Heuristic compaction of an image-heavy transcript
  // would lose context the model genuinely needs.
  const prefixHasAttachments = messages.slice(0, splitIdx).some(m => {
    const att = (m as MessageLike)?.experimental_attachments
    return Array.isArray(att) && att.length > 0
  })
  if (prefixHasAttachments) {
    return { messages, compactedCount: 0, beforeTokens, afterTokens: beforeTokens }
  }

  // Build the synthetic summary. Format:
  //
  //   [Auto-compacted summary of N earlier turns]
  //
  //   • User asked: "<first ~120 chars of user message>"
  //   • Assistant: "<leading 1-2 sentences of assistant reply>"
  //   • User asked: "..."
  //   ...
  //
  // This layout is intentionally bullet-y so the model can scan it
  // quickly and so future compactions can re-collapse cleanly.
  const compacted = messages.slice(0, splitIdx)
  const lines: string[] = []
  for (const m of compacted as MessageLike[]) {
    const text = flattenContent(m?.content)
    if (!text) continue
    const role = m?.role ?? 'user'
    if (role === 'user') {
      const head = text.replace(/\s+/g, ' ').trim().slice(0, 240)
      lines.push(`• User: ${head}${text.length > 240 ? '…' : ''}`)
    } else if (role === 'assistant') {
      lines.push(`• Assistant: ${leadingSentences(text)}`)
    } else if (role === 'system') {
      // Per-turn system messages are extremely rare in this app
      // (we use a single system prompt at the top), but if one slips
      // through we preserve its gist.
      lines.push(`• System: ${leadingSentences(text, 1, 200)}`)
    }
  }

  const summaryContent = [
    `[Auto-compacted summary of ${compacted.length} earlier turns]`,
    '',
    'The following bullets capture the gist of the conversation up to',
    'this point. Use them as context but treat the verbatim messages',
    'that follow as the authoritative current state.',
    '',
    ...lines,
  ].join('\n')

  // The summary rides as a `system` message so it sits at the top of
  // the visible-to-the-model conversation and is treated as ground
  // truth context. Some providers (OpenAI, Gemini) accept multiple
  // system messages; the AI SDK's adapters handle the case where they
  // need to be merged downstream.
  const summaryMessage: MessageLike = {
    role: 'system',
    content: summaryContent,
  }

  const recent = messages.slice(splitIdx)
  const next = [summaryMessage, ...recent]
  const afterTokens = estimateTokensForMessages(next)

  return {
    messages: next,
    compactedCount: compacted.length,
    beforeTokens,
    afterTokens,
  }
}

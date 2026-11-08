/**
 * Server-side access to the Vercel AI Gateway — the only route Clox uses
 * to reach any model.
 *
 * Auth: `AI_GATEWAY_API_KEY` when set, otherwise the deployment's Vercel
 * OIDC token (issued automatically on Vercel; `vercel env pull` provides
 * one for local dev).
 *
 * Two SDK lines are in play:
 *   - Chat streaming (`/api/chat`) runs on `ai@4`, whose `useChat` stream
 *     protocol the client speaks. ai@4 only takes v1 models, so chat talks
 *     to the gateway's Anthropic Messages endpoint for Claude (keeps prompt
 *     caching + extended thinking) and its OpenAI-compatible endpoint for
 *     everything else.
 *   - Image, video, speech and transcription run on `ai7` (AI SDK 7, an
 *     npm alias), whose built-in gateway provider covers those modalities.
 */
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { getVercelOidcToken } from '@vercel/oidc'
import { createGateway } from 'ai7'

export const GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1'

export class GatewayAuthError extends Error {
  status = 503
  constructor() {
    super(
      'AI Gateway is not connected. On Vercel this works automatically; for local runs set ' +
        'AI_GATEWAY_API_KEY or pull a Vercel OIDC token with `vercel env pull`.',
    )
  }
}

export async function gatewayToken(): Promise<string> {
  const key = process.env.AI_GATEWAY_API_KEY?.trim()
  if (key) return key
  try {
    const token = await getVercelOidcToken()
    if (token) return token
  } catch {
    /* fall through */
  }
  throw new GatewayAuthError()
}

/** True when the server can authenticate to the gateway. */
export async function gatewayConnected(): Promise<boolean> {
  try {
    await gatewayToken()
    return true
  } catch {
    return false
  }
}

/** Private request header carrying a Claude effort level (see below). */
export const CLAUDE_EFFORT_HEADER = 'x-clox-claude-effort'

/**
 * Newer Claude models think adaptively and take `output_config.effort`
 * instead of a fixed `thinking.budget_tokens`. @ai-sdk/anthropic v1 has
 * no option for either, so the chat route sends the effort as a private
 * header and this wrapper moves it into the request body.
 */
const claudeEffortFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers)
  const effort = headers.get(CLAUDE_EFFORT_HEADER)
  const usageId = headers.get(CLAUDE_USAGE_HEADER)
  headers.delete(CLAUDE_USAGE_HEADER)
  let body = init?.body
  if (effort && typeof body === 'string') {
    headers.delete(CLAUDE_EFFORT_HEADER)
    const parsed = JSON.parse(body)
    delete parsed.thinking
    delete parsed.temperature
    if (effort !== 'none') {
      parsed.thinking = { type: 'adaptive' }
      parsed.output_config = { ...(parsed.output_config ?? {}), effort }
    }
    body = JSON.stringify(parsed)
  }
  const res = await fetch(input, { ...init, headers, body })
  return usageId ? tapClaudeUsage(res, usageId) : res
}

/**
 * Claude input-token counts.
 *
 * The gateway's Messages endpoint sends `input_tokens: 0` in
 * `message_start` and the real count in the final `message_delta`.
 * @ai-sdk/anthropic v1 only reads input tokens from `message_start`, so
 * every Claude turn was logged (and charged) as 0 input tokens. The chat
 * route tags its requests with a usage id; we read the final counts off
 * the stream as it passes through and add them up per id (a turn with
 * tool calls makes several requests).
 */
export const CLAUDE_USAGE_HEADER = 'x-clox-usage-id'

type ClaudeUsage = { inputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }
const claudeUsage = new Map<string, ClaudeUsage>()

/** Returns (and forgets) the counts gathered for a usage id. */
export function takeClaudeUsage(id: string): ClaudeUsage | null {
  const u = claudeUsage.get(id) ?? null
  claudeUsage.delete(id)
  return u
}

function addClaudeUsage(id: string, usage: Record<string, unknown> | undefined) {
  if (!usage) return
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const prev = claudeUsage.get(id) ?? { inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
  claudeUsage.set(id, {
    inputTokens: prev.inputTokens + num(usage.input_tokens),
    cacheReadTokens: prev.cacheReadTokens + num(usage.cache_read_input_tokens),
    cacheWriteTokens: prev.cacheWriteTokens + num(usage.cache_creation_input_tokens),
  })
  // Never let an abandoned id grow the map without bound.
  if (claudeUsage.size > 2000) claudeUsage.delete(claudeUsage.keys().next().value as string)
}

function tapClaudeUsage(res: Response, id: string): Response {
  if (!res.ok || !res.body) return res
  const isStream = (res.headers.get('content-type') ?? '').includes('text/event-stream')
  if (!isStream) {
    const chunks: Uint8Array[] = []
    const tappedJson = res.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          chunks.push(chunk)
          controller.enqueue(chunk)
        },
        flush() {
          try {
            addClaudeUsage(id, JSON.parse(Buffer.concat(chunks).toString('utf8'))?.usage)
          } catch {
            /* not JSON — nothing to count */
          }
        },
      }),
    )
    return new Response(tappedJson, res)
  }
  const decoder = new TextDecoder()
  let buffer = ''
  const scan = (line: string) => {
    if (!line.startsWith('data:') || !line.includes('"message_delta"')) return
    try {
      const event = JSON.parse(line.slice(5).trim())
      if (event?.type === 'message_delta') addClaudeUsage(id, event.usage)
    } catch {
      /* partial or non-JSON line */
    }
  }
  const tapped = res.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk)
        buffer += decoder.decode(chunk, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        lines.forEach(scan)
      },
      flush() {
        scan(buffer)
      },
    }),
  )
  return new Response(tapped, res)
}

/** ai@4 (LanguageModelV1) model for `/api/chat`. */
export async function chatModel(modelId: string): Promise<unknown> {
  const token = await gatewayToken()
  if (modelId.startsWith('anthropic/')) {
    // The gateway reads the Authorization header first; the SDK's own
    // x-api-key header is ignored, so its value doesn't matter.
    return createAnthropic({
      apiKey: 'gateway',
      baseURL: GATEWAY_BASE_URL,
      fetch: claudeEffortFetch,
      headers: {
        Authorization: `Bearer ${token}`,
        // Raises Claude's per-turn output ceiling from 32k to 128k tokens.
        'anthropic-beta': 'output-128k-2025-02-19',
      },
    })(modelId)
  }
  return createOpenAI({
    apiKey: token,
    baseURL: GATEWAY_BASE_URL,
    compatibility: 'compatible',
  })(modelId)
}

/** AI SDK 7 gateway provider for image / video / speech / transcription. */
export async function mediaGateway() {
  return createGateway({ apiKey: await gatewayToken() })
}

/** Turns a gateway / provider error into a short message for the UI. */
export function describeGatewayError(err: unknown): { message: string; status: number } {
  if (err instanceof GatewayAuthError) return { message: err.message, status: 503 }
  const e = err as { message?: string; statusCode?: number; status?: number; responseBody?: string; cause?: unknown }
  let message = e?.message || 'The model request failed.'
  if (e?.responseBody) {
    try {
      const body = JSON.parse(e.responseBody)
      message = body?.error?.message || message
    } catch { /* keep message */ }
  }
  const status = e?.statusCode ?? e?.status ?? 502
  if (status === 429) message = `Rate limited by the provider: ${message}`
  if (status === 402 || /credit|insufficient/i.test(message)) {
    message = `AI Gateway credits are exhausted or billing isn't set up: ${message}`
  }
  return { message, status: status >= 400 && status < 600 ? status : 502 }
}

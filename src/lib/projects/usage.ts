/**
 * Usage logging.
 *
 * One function — `recordUsage()` — appends a `usage_logs` row server-side
 * (service role, RLS-bypassing). The DB trigger then rolls the cost into
 * `projects.credit_spent_usd` and the matching member row, and bumps the
 * chat's `updated_at`. Everything else is purely cosmetic.
 *
 * Pricing is a small table of per-1k-token rates for the models we have
 * wired today. Not exhaustive — when we wire a new provider we extend
 * `MODEL_PRICING` here.
 */

import { getServiceClient } from '@/lib/projects/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export type Modality = 'text' | 'image' | 'video' | 'audio' | 'research' | 'code'

interface ModelPrice {
  /** USD per 1k input tokens. Used for text/research/code modalities. */
  input_per_1k?: number
  /** USD per 1k output tokens. */
  output_per_1k?: number
  /** Flat cost per generation. Used for image/video/audio. */
  flat_per_call?: number
  /** Cost per second (audio TTS, video). */
  per_second?: number
}

// Coarse list — accurate enough for budget gating; not invoicing-grade.
// Numbers are public list prices in USD per 1k tokens (2026-05) or per call.
export const MODEL_PRICING: Record<string, ModelPrice> = {
  // Text — Google
  'gemini-2.5-flash':            { input_per_1k: 0.00030, output_per_1k: 0.0025 },
  'gemini-2.5-pro':              { input_per_1k: 0.00125, output_per_1k: 0.0100 },
  'gemini-3-pro':                { input_per_1k: 0.00200, output_per_1k: 0.0150 },
  'gemini-3-flash':              { input_per_1k: 0.00040, output_per_1k: 0.0030 },
  // Text — Anthropic
  'claude-sonnet-4.5':           { input_per_1k: 0.003,   output_per_1k: 0.015  },
  'claude-opus-4.6':             { input_per_1k: 0.015,   output_per_1k: 0.075  },
  'claude-haiku-4':              { input_per_1k: 0.0008,  output_per_1k: 0.004  },
  'claude-sonnet-4.6':           { input_per_1k: 0.003,   output_per_1k: 0.015  },
  // Text — OpenAI
  'gpt-4o':                      { input_per_1k: 0.0025,  output_per_1k: 0.010  },
  'gpt-4o-mini':                 { input_per_1k: 0.00015, output_per_1k: 0.0006 },
  'gpt-5':                       { input_per_1k: 0.005,   output_per_1k: 0.020  },
  'gpt-5-mini':                  { input_per_1k: 0.00080, output_per_1k: 0.0032 },
  // Image — flat per generation
  'dall-e-3':                    { flat_per_call: 0.040 },
  'imagen-3':                    { flat_per_call: 0.020 },
  'imagen-4':                    { flat_per_call: 0.030 },
  'nano-banana':                 { flat_per_call: 0.020 },
  'nano-banana-2':               { flat_per_call: 0.030 },
  'nano-banana-pro':             { flat_per_call: 0.060 },
  // Audio TTS — per second
  'gemini-tts':                  { per_second: 0.000015 },
  'gemini-tts-3.1':              { per_second: 0.000020 },
  // Video — flat (very rough; vendor APIs vary)
  'sora':                        { flat_per_call: 0.500 },
  'runway':                      { flat_per_call: 0.500 },
}

const FALLBACK_TEXT: ModelPrice = { input_per_1k: 0.0010, output_per_1k: 0.0050 }
const FALLBACK_IMAGE: ModelPrice = { flat_per_call: 0.030 }
const FALLBACK_AUDIO: ModelPrice = { per_second: 0.000020 }
const FALLBACK_VIDEO: ModelPrice = { flat_per_call: 0.500 }

export function priceFor(modality: Modality, model: string): ModelPrice {
  const direct = MODEL_PRICING[model]
  if (direct) return direct
  if (modality === 'image') return FALLBACK_IMAGE
  if (modality === 'audio') return FALLBACK_AUDIO
  if (modality === 'video') return FALLBACK_VIDEO
  return FALLBACK_TEXT
}

export function computeCostUsd(opts: {
  modality: Modality
  model: string
  promptTokens?: number
  completionTokens?: number
  durationSec?: number
}): number {
  const p = priceFor(opts.modality, opts.model)
  let total = 0
  if (p.input_per_1k && opts.promptTokens) {
    total += (opts.promptTokens / 1000) * p.input_per_1k
  }
  if (p.output_per_1k && opts.completionTokens) {
    total += (opts.completionTokens / 1000) * p.output_per_1k
  }
  if (p.flat_per_call) total += p.flat_per_call
  if (p.per_second && opts.durationSec) total += opts.durationSec * p.per_second
  return Math.round(total * 1000000) / 1000000
}

// ---------- Recording -------------------------------------------------------

export interface RecordUsageInput {
  userId: string
  domain?: string | null
  isFreeDomain?: boolean
  provider: string
  model: string
  modality: Modality
  chatType?: string
  promptTokens?: number
  completionTokens?: number
  durationSec?: number
  costUsd?: number
  projectId?: string | null
  chatId?: string | null
}

/**
 * Insert a `usage_logs` row. Returns the computed cost. Cheap to call;
 * synchronous from the caller's perspective but does NOT block the request
 * if you `void` it (we use that pattern after streamed responses).
 */
export async function recordUsage(input: RecordUsageInput): Promise<number> {
  const cost = input.costUsd ?? computeCostUsd({
    modality: input.modality,
    model: input.model,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    durationSec: input.durationSec,
  })

  const sb = getServiceClient()
  const { error } = await sb.from('usage_logs').insert({
    user_id: input.userId,
    project_id: input.projectId ?? null,
    chat_id: input.chatId ?? null,
    modality: input.modality,
    chat_type: input.chatType ?? input.modality,
    provider: input.provider,
    model: input.model,
    prompt_tokens: Math.max(0, Math.floor(input.promptTokens ?? 0)),
    completion_tokens: Math.max(0, Math.floor(input.completionTokens ?? 0)),
    cost_usd: cost,
    domain: input.domain ?? null,
    is_free_domain: Boolean(input.isFreeDomain),
  })
  if (error) console.error('[v0] recordUsage failed:', error.message)
  return cost
}

/**
 * Server-side helper: read the auth user (or null) for usage logging from
 * inside an API route. Will not throw.
 */
export async function getCallerForLogging() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const domain = (user.email ?? '').split('@')[1]?.toLowerCase() ?? null
    return { userId: user.id, email: user.email ?? null, domain }
  } catch {
    return null
  }
}

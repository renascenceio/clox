import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import { createXai } from '@ai-sdk/xai'
import { createCohere } from '@ai-sdk/cohere'
// All @ai-sdk/* providers are pinned to their v1 line so they implement
// LanguageModelV1, which is what `ai@4.x`'s `streamText` requires. xai and
// cohere were briefly bumped to v3, which uses LanguageModelV2 and crashes
// streamText with "Unsupported model version" 400s. Keep them on ^1.x until
// `ai` itself is upgraded to v5+ and streamText callers are reworked.

// NB: the `provider` union here is the superset of what the UI can send. The
// resolveLanguageModel helper below decides what's actually runnable based on
// the API keys we can see + whether AI Gateway is connected.
export type AIProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'xai'
  | 'cohere'
  | 'deepseek'
  | 'moonshot'
  | 'alibaba'
  | 'perplexity'
  | 'zhipu'

/**
 * Maps our internal model IDs to the provider-specific model IDs required by
 * each SDK's direct path.
 *
 * Background: most of our UI ids are also valid provider ids (e.g. `gpt-4o`,
 * `grok-4`, `gemini-2.5-flash`) so they pass through unchanged. The two
 * exceptions are:
 *
 *   1. **Anthropic**'s API expects dashes only — `claude-opus-4-6`, not
 *      `claude-opus-4.6`. The "4.6" version of the id was a Vercel AI Gateway
 *      convenience that the gateway translated for us; once we removed the
 *      gateway path, every Claude request started 404'ing because the dot
 *      form isn't a real model name at api.anthropic.com.
 *   2. **Perplexity**'s `sonar-large` / `sonar-small` are short labels we
 *      coined; the real ids are the long `llama-3.1-sonar-*-128k-online`
 *      strings.
 *
 * Add an entry only when the UI label cannot be sent verbatim to the
 * provider's API. Provider catalogs change often, so prefer pass-through.
 */
const MODEL_ID_MAP: Record<string, string> = {
  // Anthropic — dot form ↔ dash form.
  'claude-opus-4.6':   'claude-opus-4-6',
  'claude-sonnet-4.6': 'claude-sonnet-4-6',
  'claude-haiku-4.5':  'claude-haiku-4-5',
  'claude-opus-4.7':   'claude-opus-4-7',

  // Perplexity — short label ↔ canonical Sonar name.
  'sonar-large': 'llama-3.1-sonar-large-128k-online',
  'sonar-small': 'llama-3.1-sonar-small-128k-online',
}

// Resolve the env var(s) that hold a provider's API key. Mirrors lib/providers.ts.
// Some providers accept multiple names (e.g. the Vercel Anthropic integration
// ships the key as ANTHROPIC_AUTH_TOKEN instead of ANTHROPIC_API_KEY), so we
// support a prioritised list and the first non-empty one wins.
const ENV_KEY_MAP: Record<AIProvider, string[]> = {
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'],
  google: ['GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY'],
  mistral: ['MISTRAL_API_KEY'],
  xai: ['XAI_API_KEY'],
  cohere: ['COHERE_API_KEY'],
  deepseek: ['DEEPSEEK_API_KEY'],
  moonshot: ['MOONSHOT_API_KEY'],
  alibaba: ['DASHSCOPE_API_KEY'],
  perplexity: ['PERPLEXITY_API_KEY'],
  zhipu: ['ZHIPUAI_API_KEY'],
}

/** Returns the first env-var value found for this provider, or undefined. */
function envKeyFor(provider: AIProvider): string | undefined {
  for (const name of ENV_KEY_MAP[provider]) {
    const v = process.env[name]
    if (v && v.trim().length > 0) return v
  }
  return undefined
}

/** Primary env var name, for display. */
export function primaryEnvKeyName(provider: AIProvider): string {
  return ENV_KEY_MAP[provider][0]
}

/** All env var names a provider will accept. */
export function acceptedEnvKeyNames(provider: AIProvider): string[] {
  return ENV_KEY_MAP[provider]
}

// OpenAI-compatible base URLs for providers that don't have a dedicated SDK.
const OPENAI_COMPATIBLE_BASES: Partial<Record<AIProvider, string>> = {
  deepseek: 'https://api.deepseek.com/v1',
  moonshot: 'https://api.moonshot.cn/v1',
  alibaba: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  perplexity: 'https://api.perplexity.ai',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
}

/**
 * Resolution strategy — provider SDK only, NEVER the AI Gateway.
 *
 * History: we used to fall back to the Vercel AI Gateway by returning a
 * string like `"openai/gpt-4o"` from this function. That worked on AI SDK 5+
 * but this project is pinned to ai@4 (LanguageModelV1), and v4's
 * `streamText` does NOT accept gateway strings — it requires a real
 * LanguageModel instance. The result was every chat request crashing with
 * "Unsupported model version. AI SDK 4 only supports models that implement
 * specification version 'v1'." even though the @ai-sdk/* packages are all
 * pinned to their v1 line.
 *
 * The fix is simple: always go direct. Priority is:
 *
 *   1. Client-supplied API key (typed into Super Admin > API Keys).
 *   2. Server-side env var for the provider.
 *
 * If neither is present we throw a clear, actionable error that names the
 * exact env var(s) the user needs to set.
 */
export function resolveLanguageModel(
  provider: AIProvider,
  modelId: string,
  clientApiKey?: string,
): unknown {
  const actualModelId = MODEL_ID_MAP[modelId] || modelId
  const clientKey = clientApiKey?.trim() || undefined
  const envKey = envKeyFor(provider)

  // Priority 1 — explicit client key overrides everything so the user's
  // Super Admin entry always takes effect.
  if (clientKey) {
    return buildDirectModel(provider, actualModelId, clientKey)
  }

  // Priority 2 — server env var.
  if (envKey) {
    return buildDirectModel(provider, actualModelId, envKey)
  }

  const names = ENV_KEY_MAP[provider].join(' or ')
  throw new Error(
    `No API key configured for ${provider}. Add one in Super Admin > API Keys, ` +
      `or set ${names} on the server.`,
  )
}

/**
 * Beta headers we always want on Anthropic requests. These unlock paid
 * features that the default endpoint refuses with a 400 or, worse,
 * silently downgrades.
 *
 *   - `output-128k-2025-02-19` — raises the per-turn output ceiling
 *     from 32k → 128k for all Claude 4.x models. Without this header,
 *     `maxTokens: 128_000` is silently clamped to 32k and the response
 *     ends with `finishReason: 'length'` at exactly 32k tokens. THIS
 *     is the bug that caused "the script stopped" mid-build even
 *     after we'd bumped maxTokens in code — the cap was server-side.
 *
 * IMPORTANT: headers must go on `createAnthropic({ headers })`, NOT
 * on `streamText({ providerOptions: { anthropic: { headers } } })`.
 * The latter slot only accepts model-specific options (cacheControl
 * etc.) and silently drops arbitrary HTTP headers. Took several
 * truncated decks to figure out.
 */
const ANTHROPIC_BETA_HEADERS = {
  'anthropic-beta': 'output-128k-2025-02-19',
} as const

/** Build a LanguageModel instance from the right @ai-sdk package. */
function buildDirectModel(provider: AIProvider, modelId: string, key: string): unknown {
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey: key })(modelId)
    case 'anthropic':
      return createAnthropic({ apiKey: key, headers: ANTHROPIC_BETA_HEADERS })(modelId)
    case 'google':
      return createGoogleGenerativeAI({ apiKey: key })(modelId)
    case 'mistral':
      return createMistral({ apiKey: key })(modelId)
    case 'xai':
      return createXai({ apiKey: key })(modelId)
    case 'cohere':
      return createCohere({ apiKey: key })(modelId)
    case 'deepseek':
    case 'moonshot':
    case 'alibaba':
    case 'perplexity':
    case 'zhipu': {
      // These providers all expose OpenAI-compatible endpoints, so we reuse
      // the OpenAI factory with a custom baseURL.
      const baseURL = OPENAI_COMPATIBLE_BASES[provider]
      return createOpenAI({ apiKey: key, baseURL })(modelId)
    }
    default: {
      // Defensive fallthrough: throw an informative error rather than silently
      // routing an unknown provider to OpenAI.
      const exhaustive: never = provider
      throw new Error(`Unsupported provider: ${String(exhaustive)}`)
    }
  }
}

/**
 * @deprecated Use resolveLanguageModel. Kept so existing code compiles.
 */
export function getModel(provider: AIProvider, modelId: string, apiKey?: string) {
  return resolveLanguageModel(provider, modelId, apiKey)
}

// Provider-specific max durations (in seconds) based on API limits
export const PROVIDER_MAX_DURATION: Record<string, number> = {
  openai: 60,
  anthropic: 60,
  google: 300,
  mistral: 60,
  xai: 60,
  cohere: 60,
  deepseek: 60,
  moonshot: 60,
  alibaba: 60,
  perplexity: 60,
  zhipu: 60,
}

export const TEXT_MODELS = [
  // Google Gemini
  { id: 'gemini-2.5-flash', name: '2.5 Flash', version: '2.5 Flash', provider: 'google', brandName: 'Gemini' },
  { id: 'gemini-2.0-flash', name: '2.0 Flash', version: '2.0 Flash', provider: 'google', brandName: 'Gemini' },
  { id: 'gemini-1.5-pro', name: '1.5 Pro', version: '1.5 Pro', provider: 'google', brandName: 'Gemini' },

  // OpenAI ChatGPT
  { id: 'gpt-4o', name: 'GPT-4o', version: 'GPT-4o', provider: 'openai', brandName: 'ChatGPT' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', version: 'GPT-4o Mini', provider: 'openai', brandName: 'ChatGPT' },

  // Anthropic Claude
  { id: 'claude-opus-4.6', name: 'Opus 4.6', version: 'Opus 4.6', provider: 'anthropic', brandName: 'Claude' },
  { id: 'claude-sonnet-4.6', name: 'Sonnet 4.6', version: 'Sonnet 4.6', provider: 'anthropic', brandName: 'Claude' },
  { id: 'claude-haiku-4.5', name: 'Haiku 4.5', version: 'Haiku 4.5', provider: 'anthropic', brandName: 'Claude' },

  // Mistral
  { id: 'mistral-large-latest', name: 'Large', version: 'Large', provider: 'mistral', brandName: 'Mistral AI' },
  { id: 'mistral-small-latest', name: 'Small', version: 'Small', provider: 'mistral', brandName: 'Mistral AI' },

  // xAI Grok
  { id: 'grok-4', name: 'Grok 4', version: '4', provider: 'xai', brandName: 'Grok' },
  { id: 'grok-3', name: 'Grok 3', version: '3', provider: 'xai', brandName: 'Grok' },

  // DeepSeek
  { id: 'deepseek-chat', name: 'Chat v3', version: 'Chat v3', provider: 'deepseek', brandName: 'DeepSeek' },
  { id: 'deepseek-reasoner', name: 'Reasoner R1', version: 'Reasoner R1', provider: 'deepseek', brandName: 'DeepSeek' },

  // Moonshot Kimi
  { id: 'kimi-k2', name: 'K2', version: 'K2', provider: 'moonshot', brandName: 'Kimi' },
  { id: 'moonshot-v1-128k', name: 'v1 128k', version: 'v1 128k', provider: 'moonshot', brandName: 'Kimi' },

  // Alibaba Qwen
  { id: 'qwen-max', name: 'Max', version: 'Max', provider: 'alibaba', brandName: 'Qwen' },
  { id: 'qwen-plus', name: 'Plus', version: 'Plus', provider: 'alibaba', brandName: 'Qwen' },

  // Cohere
  { id: 'command-r-plus', name: 'Command R+', version: 'R+', provider: 'cohere', brandName: 'Cohere' },
  { id: 'command-r', name: 'Command R', version: 'R', provider: 'cohere', brandName: 'Cohere' },

  // Perplexity
  { id: 'sonar-large', name: 'llama-3.1-sonar-large-128k-online', version: 'Sonar Large', provider: 'perplexity', brandName: 'Perplexity' },
  { id: 'sonar-small', name: 'llama-3.1-sonar-small-128k-online', version: 'Sonar Small', provider: 'perplexity', brandName: 'Perplexity' },

  // Zhipu ChatGLM
  { id: 'glm-4.5', name: 'GLM-4.5', version: '4.5', provider: 'zhipu', brandName: 'ChatGLM' },
]

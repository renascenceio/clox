import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import { createXai } from '@ai-sdk/xai'
import { createCohere } from '@ai-sdk/cohere'
// We intentionally don't narrow the return type of resolveLanguageModel: the
// @ai-sdk packages in this project are a mix of LanguageModelV1 (openai,
// anthropic, google, mistral) and LanguageModelV3 (xai, cohere). AI SDK 4's
// `streamText` accepts both at runtime; typing the return as `unknown` keeps
// TS quiet without lying about the shape.

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
 * each SDK's direct path. We deliberately keep this MINIMAL and prefer to pass
 * ids through unchanged, because hardcoded names drift every time a provider
 * ships a new model family (e.g. `claude-3-5-sonnet-20241022` is long dead).
 * When the AI Gateway is available we bypass this map entirely — the gateway
 * keeps its own up-to-date catalog and tolerates friendly names like
 * `claude-sonnet-4.6` or `gemini-2.5-flash`.
 *
 * Only add an entry here if our UI ID is a synthetic label that *cannot* be
 * sent directly to the provider API.
 */
const MODEL_ID_MAP: Record<string, string> = {
  // (Intentionally empty — we pass UI ids straight through.)
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
 * Which providers can be routed through the Vercel AI Gateway.
 *
 *   - OpenAI / Anthropic / Google work *zero-config* on Vercel (no AI_GATEWAY_API_KEY required).
 *   - Everything else listed here works through the gateway as long as
 *     AI_GATEWAY_API_KEY is present. The gateway handles auth / billing.
 *
 * Keeping this list in one place also means if a provider is added to the
 * gateway later we just append it here.
 */
const GATEWAY_ZERO_CONFIG: AIProvider[] = ['openai', 'anthropic', 'google']
const GATEWAY_WITH_KEY: AIProvider[] = [
  'openai', 'anthropic', 'google',
  'mistral', 'xai', 'cohere', 'deepseek', 'perplexity',
]

/**
 * Resolution strategy, in priority order:
 *
 *   1. Explicit client-supplied key → use the provider SDK directly.
 *      (User typed a key into Super Admin — respect that override.)
 *   2. AI Gateway → when available for this provider. The gateway keeps
 *      track of current model IDs, so friendly names like `claude-sonnet-4.6`
 *      or `gemini-2.5-flash` Just Work without us maintaining a map.
 *   3. Server env var → direct provider SDK as a fallback.
 *
 * Returns either a gateway model string (e.g. `openai/gpt-4o`) or a
 * LanguageModel instance from one of the @ai-sdk packages.
 */
export function resolveLanguageModel(
  provider: AIProvider,
  modelId: string,
  clientApiKey?: string,
): unknown {
  const actualModelId = MODEL_ID_MAP[modelId] || modelId
  const clientKey = clientApiKey?.trim() || undefined
  const envKey = envKeyFor(provider)

  // Gateway is usable when either (a) the provider is zero-config and we're
  // on Vercel, or (b) AI_GATEWAY_API_KEY is set and the provider is on the
  // gateway catalog.
  const gatewayUsable =
    (GATEWAY_ZERO_CONFIG.includes(provider) && Boolean(process.env.VERCEL)) ||
    (GATEWAY_WITH_KEY.includes(provider) && Boolean(process.env.AI_GATEWAY_API_KEY))

  // Priority 1 — explicit client key overrides everything so the user's
  // Super Admin entry always takes effect.
  if (clientKey) {
    return buildDirectModel(provider, actualModelId, clientKey)
  }

  // Priority 2 — gateway. Preferred over env-var-direct because the gateway
  // catalog is kept current, avoiding the stale-model-id class of bugs.
  if (gatewayUsable) {
    return `${provider}/${actualModelId}`
  }

  // Priority 3 — env var + direct SDK.
  if (envKey) {
    return buildDirectModel(provider, actualModelId, envKey)
  }

  const names = ENV_KEY_MAP[provider].join(' or ')
  throw new Error(
    `No API key available for ${provider}. Set ${names} in Vercel, ` +
      `enable the AI Gateway with AI_GATEWAY_API_KEY, or add a key in Super Admin > API Keys.`,
  )
}

/** Build a LanguageModel instance from the right @ai-sdk package. */
function buildDirectModel(provider: AIProvider, modelId: string, key: string): unknown {
  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey: key })(modelId)
    case 'anthropic':
      return createAnthropic({ apiKey: key })(modelId)
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

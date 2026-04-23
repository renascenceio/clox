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
 * each SDK. If a model isn't listed, we pass the id through unchanged.
 */
const MODEL_ID_MAP: Record<string, string> = {
  // Anthropic — internal names use friendly marketing versions
  'claude-opus-4.6': 'claude-3-5-sonnet-20241022',
  'claude-sonnet-4.6': 'claude-3-5-sonnet-20241022',
  'claude-haiku-4.5': 'claude-3-5-haiku-20241022',
  // Google
  'gemini-2.5-flash': 'gemini-2.0-flash-exp',
  'gemini-2.0-flash': 'gemini-2.0-flash-exp',
  'gemini-1.5-pro': 'gemini-1.5-pro',
  // xAI
  'grok-4': 'grok-beta',
  'grok-3': 'grok-beta',
  // DeepSeek / Moonshot / Alibaba / Perplexity / Zhipu — pass through (handled via OpenAI-compatible base URL)
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
 * Resolution strategy, in order of preference:
 *   1. Explicit client-supplied key (user typed one into Super Admin).
 *   2. Server env var.
 *   3. Vercel AI Gateway zero-config (openai/anthropic/google only).
 *
 * Returns either a {model: string} for gateway, or {model: LanguageModelV1}.
 */
export function resolveLanguageModel(
  provider: AIProvider,
  modelId: string,
  clientApiKey?: string,
): unknown {
  const actualModelId = MODEL_ID_MAP[modelId] || modelId
  const key = clientApiKey?.trim() || envKeyFor(provider)
  const aiGatewayAvailable = Boolean(
    process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL,
  )

  // Gateway path — passing a `provider/model` string tells AI SDK 4 to route
  // through the AI Gateway. Only openai/anthropic/google are supported zero-config.
  const gatewayCapable = ['openai', 'anthropic', 'google'].includes(provider)
  const useGateway = !key && aiGatewayAvailable && gatewayCapable
  if (useGateway) {
    return `${provider}/${actualModelId}`
  }

  if (!key) {
    const names = ENV_KEY_MAP[provider].join(' or ')
    throw new Error(
      `No API key available for ${provider}. Set ${names} in Vercel, or add one in Super Admin > API Keys.`,
    )
  }

  switch (provider) {
    case 'openai':
      return createOpenAI({ apiKey: key })(actualModelId)
    case 'anthropic':
      return createAnthropic({ apiKey: key })(actualModelId)
    case 'google':
      return createGoogleGenerativeAI({ apiKey: key })(actualModelId)
    case 'mistral':
      return createMistral({ apiKey: key })(actualModelId)
    case 'xai':
      return createXai({ apiKey: key })(actualModelId)
    case 'cohere':
      return createCohere({ apiKey: key })(actualModelId)
    case 'deepseek':
    case 'moonshot':
    case 'alibaba':
    case 'perplexity':
    case 'zhipu': {
      // These providers all expose OpenAI-compatible endpoints, so we reuse
      // the OpenAI factory with a custom baseURL.
      const baseURL = OPENAI_COMPATIBLE_BASES[provider]
      return createOpenAI({ apiKey: key, baseURL })(actualModelId)
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

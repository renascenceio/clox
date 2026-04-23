import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import type { LanguageModel } from 'ai'

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'mistral'

/**
 * Maps our internal model IDs to provider-specific model IDs
 */
const MODEL_ID_MAP: Record<string, string> = {
  // OpenAI
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  
  // Anthropic
  'claude-opus-4.6': 'claude-sonnet-4-20250514',
  'claude-sonnet-4.6': 'claude-sonnet-4-20250514',
  'claude-haiku-4.5': 'claude-3-5-haiku-20241022',
  
  // Google Gemini - Use correct GA model IDs
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash': 'gemini-2.0-flash',
  'gemini-1.5-pro': 'gemini-1.5-pro',
  
  // Mistral
  'mistral-large-latest': 'mistral-large-latest',
}

/**
 * Returns a LanguageModel instance for the given provider and model.
 * Uses factory functions to inject API key at runtime.
 */
export function getModel(provider: AIProvider, modelId: string, apiKey?: string): LanguageModel {
  // Map our model ID to the provider's actual model ID
  const actualModelId = MODEL_ID_MAP[modelId] || modelId
  
  console.log('[v0] getModel:', { provider, modelId, actualModelId, hasApiKey: !!apiKey })
  
  if (!apiKey) {
    throw new Error(`No API key provided for provider: ${provider}`)
  }
  
  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({ apiKey })
      return openai(actualModelId)
    }
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey })
      return anthropic(actualModelId)
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey })
      return google(actualModelId)
    }
    case 'mistral': {
      const mistral = createMistral({ apiKey })
      return mistral(actualModelId)
    }
    default:
      console.log('[v0] Unsupported provider:', provider, '- defaulting to OpenAI')
      const openai = createOpenAI({ apiKey })
      return openai('gpt-4o')
  }
}

// Provider-specific max durations (in seconds) based on API limits
export const PROVIDER_MAX_DURATION: Record<AIProvider, number> = {
  openai: 60,
  anthropic: 60,
  google: 300, // Google allows longer requests
  mistral: 60,
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
  { id: 'sonar-large', name: 'Sonar Large', version: 'Sonar Large', provider: 'perplexity', brandName: 'Perplexity' },
  { id: 'sonar-small', name: 'Sonar Small', version: 'Sonar Small', provider: 'perplexity', brandName: 'Perplexity' },

  // Zhipu ChatGLM
  { id: 'glm-4.5', name: 'GLM-4.5', version: '4.5', provider: 'zhipu', brandName: 'ChatGLM' },
]

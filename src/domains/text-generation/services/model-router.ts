import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { mistral } from '@ai-sdk/mistral'
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
  
  // Google Gemini - 2.5 Flash is the working model
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash': 'gemini-2.0-flash',
  'gemini-1.5-pro': 'gemini-1.5-pro',
  
  // Mistral
  'mistral-large-latest': 'mistral-large-latest',
}

/**
 * Returns a LanguageModel instance for the given provider and model.
 * Sets API key from admin settings (passed from client) as environment variable.
 */
export function getModel(provider: AIProvider, modelId: string, apiKey?: string): LanguageModel {
  // Map our model ID to the provider's actual model ID
  const actualModelId = MODEL_ID_MAP[modelId] || modelId
  
  console.log('[v0] getModel:', { provider, modelId, actualModelId, hasApiKey: !!apiKey })
  
  // Set API key as environment variable so provider SDKs can use it
  if (apiKey) {
    if (provider === 'openai') {
      process.env.OPENAI_API_KEY = apiKey
    } else if (provider === 'anthropic') {
      process.env.ANTHROPIC_API_KEY = apiKey
    } else if (provider === 'google') {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey
    } else if (provider === 'mistral') {
      process.env.MISTRAL_API_KEY = apiKey
    }
  }
  
  switch (provider) {
    case 'openai':
      return openai(actualModelId)
    case 'anthropic':
      return anthropic(actualModelId)
    case 'google':
      return google(actualModelId)
    case 'mistral':
      return mistral(actualModelId)
    default:
      // Default to OpenAI for unsupported providers
      console.log('[v0] Unsupported provider:', provider, '- defaulting to OpenAI')
      return openai('gpt-4o')
  }
}

export const TEXT_MODELS = [
  // Google Gemini - 2.5 Flash is the tested working model
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
]

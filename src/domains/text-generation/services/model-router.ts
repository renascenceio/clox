import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { mistral } from '@ai-sdk/mistral'
import { xai } from '@ai-sdk/xai'
import { cohere } from '@ai-sdk/cohere'
import type { LanguageModel } from 'ai'

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'xai' | 'perplexity' | 'deepseek' | 'groq' | 'zhipu' | 'qwen' | 'baidu' | 'kimi' | 'meta' | 'cohere' | 'ai21'

/**
 * Maps our internal model IDs to provider-specific model IDs
 */
const MODEL_ID_MAP: Record<string, string> = {
  // OpenAI
  'gpt-5.4': 'gpt-4o',
  'gpt-5-mini': 'gpt-4o-mini',
  'gpt-4o': 'gpt-4o',
  'gpt-4o-mini': 'gpt-4o-mini',
  'o1': 'o1',
  'o1-mini': 'o1-mini',
  
  // Anthropic
  'claude-opus-4.6': 'claude-sonnet-4-20250514',
  'claude-sonnet-4.6': 'claude-sonnet-4-20250514',
  'claude-haiku-4.5': 'claude-3-5-haiku-20241022',
  'claude-3-5-sonnet-20240620': 'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku': 'claude-3-5-haiku-20241022',
  
  // Google Gemini - Use actual Gemini model IDs
  'gemini-live-2.5-flash-native-audio': 'gemini-2.0-flash',
  'gemini-2.0-flash': 'gemini-2.0-flash',
  'gemini-1.5-pro': 'gemini-1.5-pro',
  
  // Mistral
  'mistral-large-latest': 'mistral-large-latest',
  'mistral-medium': 'mistral-medium-latest',
  
  // xAI Grok
  'grok-2': 'grok-2',
  'grok-2-mini': 'grok-2-mini',
  
  // Cohere
  'command-r-plus': 'command-r-plus',
  'command-r': 'command-r',
}

/**
 * Returns a LanguageModel instance for the given provider and model.
 * Accepts API key directly from admin settings (passed from client).
 */
export function getModel(provider: AIProvider, modelId: string, apiKey?: string): LanguageModel {
  // Map our model ID to the provider's actual model ID
  const actualModelId = MODEL_ID_MAP[modelId] || modelId
  
  console.log('[v0] getModel:', { provider, modelId, actualModelId, hasApiKey: !!apiKey })
  
  switch (provider) {
    case 'openai':
      return openai(actualModelId, { apiKey: apiKey || process.env.OPENAI_API_KEY })
    case 'anthropic':
      return anthropic(actualModelId, { apiKey: apiKey || process.env.ANTHROPIC_API_KEY })
    case 'google':
      // Google SDK uses GOOGLE_GENERATIVE_AI_API_KEY
      return google(actualModelId, { apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY })
    case 'mistral':
      return mistral(actualModelId, { apiKey: apiKey || process.env.MISTRAL_API_KEY })
    case 'xai':
      return xai(actualModelId, { apiKey: apiKey || process.env.XAI_API_KEY })
    case 'cohere':
      return cohere(actualModelId, { apiKey: apiKey || process.env.COHERE_API_KEY })
    default:
      // Default to OpenAI for unsupported providers
      console.log('[v0] Unsupported provider:', provider, '- defaulting to OpenAI')
      return openai('gpt-4o', { apiKey: apiKey || process.env.OPENAI_API_KEY })
  }
}

export const TEXT_MODELS = [
  // OpenAI / ChatGPT
  { id: 'gpt-5.4', name: 'GPT-5.4', version: 'GPT-5.4', provider: 'openai', brandName: 'ChatGPT' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', version: 'GPT-5 Mini', provider: 'openai', brandName: 'ChatGPT' },
  { id: 'gpt-4o', name: 'GPT-4o', version: 'GPT-4o', provider: 'openai', brandName: 'ChatGPT' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', version: 'GPT-4o Mini', provider: 'openai', brandName: 'ChatGPT' },
  { id: 'o1', name: 'o1', version: 'o1', provider: 'openai', brandName: 'ChatGPT' },
  { id: 'o1-mini', name: 'o1 Mini', version: 'o1 Mini', provider: 'openai', brandName: 'ChatGPT' },
  
  // Anthropic Claude
  { id: 'claude-opus-4.6', name: 'Opus 4.6', version: 'Opus 4.6', provider: 'anthropic', brandName: 'Claude' },
  { id: 'claude-sonnet-4.6', name: 'Sonnet 4.6', version: 'Sonnet 4.6', provider: 'anthropic', brandName: 'Claude' },
  { id: 'claude-haiku-4.5', name: 'Haiku 4.5', version: 'Haiku 4.5', provider: 'anthropic', brandName: 'Claude' },
  { id: 'claude-3-5-sonnet-20240620', name: '3.5 Sonnet', version: '3.5 Sonnet', provider: 'anthropic', brandName: 'Claude' },
  { id: 'claude-3-5-haiku', name: '3.5 Haiku', version: '3.5 Haiku', provider: 'anthropic', brandName: 'Claude' },
  
  // Google Gemini
  { id: 'gemini-live-2.5-flash-native-audio', name: '2.5 Flash', version: '2.5 Flash', provider: 'google', brandName: 'Gemini' },
  { id: 'gemini-2.0-flash', name: '2.0 Flash', version: '2.0 Flash', provider: 'google', brandName: 'Gemini' },
  { id: 'gemini-1.5-pro', name: '1.5 Pro', version: '1.5 Pro', provider: 'google', brandName: 'Gemini' },
  
  // Meta Llama
  { id: 'llama-3.3-70b', name: '3.3 70B', version: '3.3 70B', provider: 'meta', brandName: 'Llama' },
  { id: 'llama-3.2-90b', name: '3.2 90B', version: '3.2 90B', provider: 'meta', brandName: 'Llama' },
  
  // Mistral
  { id: 'mistral-large-latest', name: 'Large', version: 'Large', provider: 'mistral', brandName: 'Mistral AI' },
  { id: 'mistral-medium', name: 'Medium', version: 'Medium', provider: 'mistral', brandName: 'Mistral AI' },
  
  // xAI Grok
  { id: 'grok-2', name: 'Grok 2', version: 'Grok 2', provider: 'xai', brandName: 'Grok' },
  { id: 'grok-2-mini', name: 'Grok 2 Mini', version: 'Grok 2 Mini', provider: 'xai', brandName: 'Grok' },
  
  // Cohere
  { id: 'command-r-plus', name: 'Command R+', version: 'Command R+', provider: 'cohere', brandName: 'Cohere' },
  { id: 'command-r', name: 'Command R', version: 'Command R', provider: 'cohere', brandName: 'Cohere' },
  
  // AI21 Labs
  { id: 'jamba-1.5-large', name: 'Jamba 1.5 Large', version: 'Jamba 1.5 Large', provider: 'ai21', brandName: 'AI21 Labs' },
  
  // DeepSeek
  { id: 'deepseek-v4', name: 'V4', version: 'V4', provider: 'deepseek', brandName: 'DeepSeek' },
  { id: 'deepseek-r1', name: 'R1', version: 'R1', provider: 'deepseek', brandName: 'DeepSeek' },
  { id: 'deepseek-coder-v2', name: 'Coder V2', version: 'Coder V2', provider: 'deepseek', brandName: 'DeepSeek' },
  
  // Qwen (Alibaba)
  { id: 'qwen-3.5-turbo', name: '3.5 Turbo', version: '3.5 Turbo', provider: 'qwen', brandName: 'Qwen' },
  { id: 'qwen-3.5-plus', name: '3.5 Plus', version: '3.5 Plus', provider: 'qwen', brandName: 'Qwen' },
  { id: 'qwen-max', name: 'Max', version: 'Max', provider: 'qwen', brandName: 'Qwen' },
  { id: 'qwen-coder-turbo', name: 'Coder Turbo', version: 'Coder Turbo', provider: 'qwen', brandName: 'Qwen' },
  
  // GLM (Zhipu AI)
  { id: 'glm-5-plus', name: '5 Plus', version: '5 Plus', provider: 'zhipu', brandName: 'GLM' },
  { id: 'glm-4-plus', name: '4 Plus', version: '4 Plus', provider: 'zhipu', brandName: 'GLM' },
  { id: 'glm-4-air', name: '4 Air', version: '4 Air', provider: 'zhipu', brandName: 'GLM' },
  
  // Kimi (Moonshot AI)
  { id: 'kimi-k2.5', name: 'K2.5', version: 'K2.5', provider: 'kimi', brandName: 'Kimi' },
  { id: 'moonshot-v1-128k', name: 'V1 128K', version: 'V1 128K', provider: 'kimi', brandName: 'Kimi' },
  
  // Baidu ERNIE
  { id: 'ernie-4.5-turbo', name: '4.5 Turbo', version: '4.5 Turbo', provider: 'baidu', brandName: 'ERNIE' },
  { id: 'ernie-4.0', name: '4.0', version: '4.0', provider: 'baidu', brandName: 'ERNIE' },
  { id: 'ernie-3.5', name: '3.5', version: '3.5', provider: 'baidu', brandName: 'ERNIE' },
]

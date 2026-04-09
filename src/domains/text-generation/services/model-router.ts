import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { mistral } from '@ai-sdk/mistral'
import type { LanguageModel } from 'ai'

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'xai' | 'perplexity' | 'deepseek' | 'groq' | 'zhipu' | 'qwen' | 'baidu' | 'kimi' | 'meta' | 'cohere' | 'ai21'

export function getModel(provider: AIProvider, modelId: string): LanguageModel {
  switch (provider) {
    case 'openai':
      return openai(modelId)
    case 'anthropic':
      return anthropic(modelId)
    case 'google':
      return google(modelId)
    case 'mistral':
      return mistral(modelId)
    // Add other providers as needed
    default:
      return openai('gpt-4o')
  }
}

export const TEXT_MODELS = [
  // OpenAI
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'openai', category: 'Western AI' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', category: 'Western AI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', category: 'Western AI' },
  { id: 'o1', name: 'OpenAI o1', provider: 'openai', category: 'Western AI' },
  { id: 'o1-mini', name: 'OpenAI o1 Mini', provider: 'openai', category: 'Western AI' },
  
  // Anthropic
  { id: 'claude-opus-4.6', name: 'Claude Opus 4.6', provider: 'anthropic', category: 'Western AI' },
  { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', provider: 'anthropic', category: 'Western AI' },
  { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', provider: 'anthropic', category: 'Western AI' },
  
  // Google
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', provider: 'google', category: 'Western AI' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', category: 'Western AI' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', category: 'Western AI' },
  
  // Meta
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'meta', category: 'Western AI' },
  { id: 'llama-3.2-90b', name: 'Llama 3.2 90B', provider: 'meta', category: 'Western AI' },
  
  // Mistral
  { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral', category: 'Western AI' },
  { id: 'mistral-medium', name: 'Mistral Medium', provider: 'mistral', category: 'Western AI' },
  
  // xAI
  { id: 'grok-2', name: 'Grok 2', provider: 'xai', category: 'Western AI' },
  { id: 'grok-2-mini', name: 'Grok 2 Mini', provider: 'xai', category: 'Western AI' },
  
  // Cohere
  { id: 'command-r-plus', name: 'Command R+', provider: 'cohere', category: 'Western AI' },
  { id: 'command-r', name: 'Command R', provider: 'cohere', category: 'Western AI' },
  
  // AI21
  { id: 'jamba-1.5-large', name: 'Jamba 1.5 Large', provider: 'ai21', category: 'Western AI' },
  
  // === CHINESE AI MODELS ===
  
  // DeepSeek
  { id: 'deepseek-v4', name: 'DeepSeek V4', provider: 'deepseek', category: 'Chinese AI' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'deepseek', category: 'Chinese AI' },
  { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', provider: 'deepseek', category: 'Chinese AI' },
  
  // Qwen (Alibaba)
  { id: 'qwen-3.5-turbo', name: 'Qwen 3.5 Turbo', provider: 'qwen', category: 'Chinese AI' },
  { id: 'qwen-3.5-plus', name: 'Qwen 3.5 Plus', provider: 'qwen', category: 'Chinese AI' },
  { id: 'qwen-max', name: 'Qwen Max', provider: 'qwen', category: 'Chinese AI' },
  { id: 'qwen-coder-turbo', name: 'Qwen Coder Turbo', provider: 'qwen', category: 'Chinese AI' },
  
  // GLM (Zhipu AI)
  { id: 'glm-5-plus', name: 'GLM-5 Plus', provider: 'zhipu', category: 'Chinese AI' },
  { id: 'glm-4-plus', name: 'GLM-4 Plus', provider: 'zhipu', category: 'Chinese AI' },
  { id: 'glm-4-air', name: 'GLM-4 Air', provider: 'zhipu', category: 'Chinese AI' },
  
  // Kimi (Moonshot AI)
  { id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'kimi', category: 'Chinese AI' },
  { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', provider: 'kimi', category: 'Chinese AI' },
  
  // Baidu
  { id: 'ernie-4.5-turbo', name: 'ERNIE 4.5 Turbo', provider: 'baidu', category: 'Chinese AI' },
  { id: 'ernie-4.0', name: 'ERNIE 4.0', provider: 'baidu', category: 'Chinese AI' },
  { id: 'ernie-3.5', name: 'ERNIE 3.5', provider: 'baidu', category: 'Chinese AI' },
]

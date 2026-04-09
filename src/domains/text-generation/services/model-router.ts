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
  // OpenAI / ChatGPT (Latest: GPT-5.4 as of March 2026)
  { id: 'gpt-5.4', name: 'GPT-5.4', version: 'GPT-5.4', provider: 'openai', brandName: 'ChatGPT' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', version: 'GPT-5 Mini', provider: 'openai', brandName: 'ChatGPT' },
  { id: 'gpt-4o', name: 'GPT-4o', version: 'GPT-4o', provider: 'openai', brandName: 'ChatGPT' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', version: 'GPT-4o Mini', provider: 'openai', brandName: 'ChatGPT' },
  { id: 'o1', name: 'o1', version: 'o1', provider: 'openai', brandName: 'ChatGPT' },
  { id: 'o1-mini', name: 'o1 Mini', version: 'o1 Mini', provider: 'openai', brandName: 'ChatGPT' },
  
  // Anthropic Claude (Latest: Opus 4.6, Sonnet 4.6 as of February 2026)
  { id: 'claude-opus-4.6', name: 'Opus 4.6', version: 'Opus 4.6', provider: 'anthropic', brandName: 'Claude' },
  { id: 'claude-sonnet-4.6', name: 'Sonnet 4.6', version: 'Sonnet 4.6', provider: 'anthropic', brandName: 'Claude' },
  { id: 'claude-haiku-4.5', name: 'Haiku 4.5', version: 'Haiku 4.5', provider: 'anthropic', brandName: 'Claude' },
  { id: 'claude-3-5-sonnet-20240620', name: '3.5 Sonnet', version: '3.5 Sonnet', provider: 'anthropic', brandName: 'Claude' },
  { id: 'claude-3-5-haiku', name: '3.5 Haiku', version: '3.5 Haiku', provider: 'anthropic', brandName: 'Claude' },
  
  // Google Gemini (Latest: 2.5 Flash as of April 2026)
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

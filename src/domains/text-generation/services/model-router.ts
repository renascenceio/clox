import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { mistral } from '@ai-sdk/mistral'
import type { LanguageModel } from 'ai'

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'xai' | 'perplexity' | 'deepseek' | 'groq'

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
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai' },
  { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google' },
  { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral' },
]

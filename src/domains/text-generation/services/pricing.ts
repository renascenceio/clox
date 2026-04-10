/**
 * Pricing per 1M tokens in USD.
 * Input and output costs per provider + model.
 */
export interface ModelPricing {
  inputPer1M: number  // USD per 1M input tokens
  outputPer1M: number // USD per 1M output tokens
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Google Gemini
  'gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'gemini-2.0-flash': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'gemini-1.5-pro':   { inputPer1M: 1.25, outputPer1M: 5.00 },

  // OpenAI
  'gpt-4o':           { inputPer1M: 2.50, outputPer1M: 10.00 },
  'gpt-4o-mini':      { inputPer1M: 0.15, outputPer1M: 0.60  },

  // Anthropic
  'claude-opus-4.6':  { inputPer1M: 15.00, outputPer1M: 75.00 },
  'claude-sonnet-4.6':{ inputPer1M: 3.00,  outputPer1M: 15.00 },
  'claude-haiku-4.5': { inputPer1M: 0.80,  outputPer1M: 4.00  },

  // Mistral
  'mistral-large-latest': { inputPer1M: 2.00, outputPer1M: 6.00 },
}

export const DEFAULT_PRICING: ModelPricing = { inputPer1M: 1.00, outputPer1M: 3.00 }

export function calcCostUsd(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[modelId] ?? DEFAULT_PRICING
  return (
    (promptTokens / 1_000_000) * pricing.inputPer1M +
    (completionTokens / 1_000_000) * pricing.outputPer1M
  )
}

/**
 * Free domains — users from these email domains are not charged credits.
 * Add/remove domains to control access.
 */
export const FREE_DOMAINS: string[] = [
  'renascence.io',
  'gaiarealty.ae',
  'clox.ai',
]

export function isFreeDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  return FREE_DOMAINS.includes(domain)
}

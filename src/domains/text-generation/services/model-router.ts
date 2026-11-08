/**
 * Text model registry + resolver. Every model is served by the Vercel AI
 * Gateway; see `lib/gateway/catalog.ts` for the list and
 * `lib/gateway/server.ts` for how a request reaches the gateway.
 */
import { TEXT_MODELS, resolveModelId } from '@/lib/gateway/catalog'
import { chatModel } from '@/lib/gateway/server'

export { TEXT_MODELS }

/** Gateway creator slug (`anthropic`, `openai`, `google`, …). */
export type AIProvider = string

/** Resolves a (possibly legacy) model id to a gateway chat model. */
export async function resolveLanguageModel(modelId: string): Promise<{ model: unknown; modelId: string }> {
  const id = resolveModelId(modelId, 'text')
  return { model: await chatModel(id), modelId: id }
}

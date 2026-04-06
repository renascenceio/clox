import { streamText } from 'ai'
import { getModel, AIProvider } from '@/domains/text-generation/services/model-router'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, model, provider } = await req.json()

  const result = await streamText({
    model: getModel(provider as AIProvider, model),
    messages,
  })

  return result.toTextStreamResponse()
}

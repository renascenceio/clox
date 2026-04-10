import { streamText } from 'ai'
import { getModel, AIProvider } from '@/domains/text-generation/services/model-router'
import { calcCostUsd, isFreeDomain } from '@/domains/text-generation/services/pricing'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(req: Request) {
  let requestData
  try {
    requestData = await req.json()
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }

  const {
    messages,
    model,
    provider,
    temperature = 0.7,
    maxTokens = 2048,
    systemPrompt,
    apiKey,
  } = requestData

  if (!apiKey) {
    return new Response(
      `No API key configured for ${provider}. Please add your API key in Admin > API Keys.`,
      { status: 400 }
    )
  }

  // Resolve the authenticated user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check credits (skip check for free domains)
  let userFreeDomain = false
  if (user) {
    const email = user.email ?? ''
    userFreeDomain = isFreeDomain(email)

    if (!userFreeDomain) {
      const { data: credits } = await supabase
        .from('credits')
        .select('balance_usd')
        .eq('user_id', user.id)
        .single()

      if (!credits || parseFloat(credits.balance_usd) <= 0) {
        return new Response(
          'Insufficient credits. Please top up your account.',
          { status: 402 }
        )
      }
    }
  }

  try {
    const languageModel = getModel(provider as AIProvider, model, apiKey)

    const result = await streamText({
      model: languageModel,
      messages: systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages,
      temperature,
      maxTokens,
      onFinish: async ({ usage }) => {
        if (!user) return

        const promptTokens = usage?.promptTokens ?? 0
        const completionTokens = usage?.completionTokens ?? 0
        const costUsd = userFreeDomain
          ? 0
          : calcCostUsd(model, promptTokens, completionTokens)
        const domain = (user.email ?? '').split('@')[1] ?? ''

        // Log usage
        await supabase.from('usage_logs').insert({
          user_id: user.id,
          provider,
          model,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          cost_usd: costUsd,
          is_free_domain: userFreeDomain,
          domain,
          chat_type: 'text',
        })

        // Deduct credits
        if (!userFreeDomain && costUsd > 0) {
          await supabase.rpc('deduct_credits', {
            p_user_id: user.id,
            p_amount: costUsd,
          })
        }
      },
    })

    return result.toDataStreamResponse()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(`Error: ${errorMessage}`, { status: 500 })
  }
}

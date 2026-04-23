import { experimental_generateImage as generateImage } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createOpenAI } from '@ai-sdk/openai'

export const maxDuration = 60

/**
 * Maps our internal image model IDs to AI-SDK-runnable identifiers.
 *
 * Providers supported right now via the AI Gateway / AI SDK:
 *   - OpenAI (DALL-E 3, DALL-E 2)  — via @ai-sdk/openai
 *   - Google (Imagen / Nano Banana) — via AI Gateway model id string
 *
 * Everything else returns a clear "not wired up yet" error so the UI can
 * explain what's happening instead of silently falling back to a placeholder.
 */
const IMAGE_MODEL_MAP: Record<string, { provider: string; modelId: string }> = {
  // OpenAI — DALL-E 4 doesn't exist as a model name, it's marketing; route to
  // the latest runnable model.
  'dall-e-4': { provider: 'openai', modelId: 'dall-e-3' },
  'dall-e-3': { provider: 'openai', modelId: 'dall-e-3' },

  // Google image models via AI Gateway (zero-config).
  // Both Imagen 3 and Nano Banana share the same underlying Gemini 3 Flash
  // Image Preview endpoint and the same GOOGLE_GENERATIVE_AI_API_KEY.
  'imagen-3':    { provider: 'google', modelId: 'gemini-3.1-flash-image-preview' },
  'nano-banana': { provider: 'google', modelId: 'gemini-3.1-flash-image-preview' },
}

// Map our aspect-ratio strings to DALL-E 3's supported sizes.
const OPENAI_SIZE_FROM_RATIO: Record<string, `${number}x${number}`> = {
  '1:1': '1024x1024',
  '16:9': '1792x1024',
  '21:9': '1792x1024',
  '4:3': '1024x1024',
  '3:2': '1024x1024',
  '9:16': '1024x1792',
  '3:4': '1024x1792',
  '2:3': '1024x1792',
}

export async function POST(request: Request) {
  let body: {
    prompt?: string
    model?: string
    ratio?: string
    apiKey?: string
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const { prompt, model: requestedModelId = 'dall-e-3', ratio = '1:1', apiKey: clientApiKey } = body

  if (!prompt || !prompt.trim()) {
    return Response.json({ success: false, error: 'Prompt is required' }, { status: 400 })
  }

  const mapped = IMAGE_MODEL_MAP[requestedModelId]
  if (!mapped) {
    return Response.json(
      {
        success: false,
        error: `${requestedModelId} isn't wired up yet. Pick DALL-E 3 or Imagen 3 for now, or add an API key for this provider in Super Admin.`,
      },
      { status: 400 },
    )
  }

  try {
    console.log('[v0] /api/generate-image:', {
      requestedModelId,
      mappedTo: mapped,
      ratio,
      hasClientKey: Boolean(clientApiKey),
    })

    if (mapped.provider === 'openai') {
      const size = OPENAI_SIZE_FROM_RATIO[ratio] ?? '1024x1024'
      // Prefer an explicit key (client or env), fall back to the default
      // client which picks up OPENAI_API_KEY / AI Gateway automatically.
      const envKey = process.env.OPENAI_API_KEY
      const key = clientApiKey?.trim() || envKey
      const client = key ? createOpenAI({ apiKey: key }) : openai

      const { image } = await generateImage({
        model: client.image(mapped.modelId),
        prompt,
        size,
      })

      // `image` is a GeneratedFile with base64 + mimeType. Return a data URL
      // the <Image> component can render directly without going through Picsum.
      const dataUrl = `data:${image.mimeType};base64,${image.base64}`
      return Response.json({
        success: true,
        url: dataUrl,
        prompt,
        model: mapped.modelId,
      })
    }

    if (mapped.provider === 'google') {
      // Google image generation via AI Gateway: pass the gateway model string
      // directly. `experimental_generateImage` accepts any ImageModel.
      const { image } = await generateImage({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: `${mapped.provider}/${mapped.modelId}` as any,
        prompt,
      })
      const dataUrl = `data:${image.mimeType};base64,${image.base64}`
      return Response.json({ success: true, url: dataUrl, prompt, model: mapped.modelId })
    }

    return Response.json(
      { success: false, error: `Unsupported provider: ${mapped.provider}` },
      { status: 400 },
    )
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Image generation failed'
    console.error('[v0] Image generation error:', errorMessage)
    return Response.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

/**
 * Real image generation.
 *
 * Two paths are wired up, everything else returns a clear error:
 *
 *  - Google (Nano Banana / Imagen 3) — called directly against the Generative
 *    Language REST API. We go through REST rather than `@ai-sdk/google` v1.x
 *    because that package's image models are v2-spec and AI SDK 4 only
 *    accepts v1 ("Unsupported model version" bug).
 *
 *  - OpenAI (DALL-E 3) — via `@ai-sdk/openai` which ships a v1-spec image
 *    model. Requires a real OPENAI_API_KEY; AI Gateway cannot proxy image
 *    generation calls.
 */

import { experimental_generateImage as generateImage } from 'ai'
import { createOpenAI, openai as defaultOpenai } from '@ai-sdk/openai'

export const maxDuration = 60

type GoogleImageMode = 'gemini' | 'imagen'

interface MappedModel {
  provider: 'openai' | 'google'
  modelId: string
  googleMode?: GoogleImageMode
}

const IMAGE_MODEL_MAP: Record<string, MappedModel> = {
  // OpenAI
  'dall-e-3': { provider: 'openai', modelId: 'dall-e-3' },
  'dall-e-4': { provider: 'openai', modelId: 'dall-e-3' },

  // Google — all three entries share the same GOOGLE_GENERATIVE_AI_API_KEY
  // but hit different endpoints. Names verified from ai.google.dev/gemini-api
  // docs (April 2026). Preview slugs are unstable and may need bumping again
  // when Google promotes / retires them.
  'nano-banana': {
    provider: 'google',
    modelId: 'gemini-2.5-flash-image', // Nano Banana (stable)
    googleMode: 'gemini',
  },
  'nano-banana-2': {
    provider: 'google',
    modelId: 'gemini-3.1-flash-image-preview', // Nano Banana 2
    googleMode: 'gemini',
  },
  'nano-banana-pro': {
    provider: 'google',
    modelId: 'gemini-3-pro-image-preview', // Nano Banana Pro
    googleMode: 'gemini',
  },
  // Imagen 3 was superseded by Imagen 4 on the Gemini API. We keep the
  // legacy 'imagen-3' id so existing selections don't break, but route it
  // to imagen-4.0-generate-001 which is the current public model.
  'imagen-3': {
    provider: 'google',
    modelId: 'imagen-4.0-generate-001',
    googleMode: 'imagen',
  },
  'imagen-4': {
    provider: 'google',
    modelId: 'imagen-4.0-generate-001',
    googleMode: 'imagen',
  },
}

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

const IMAGEN_ASPECT_FROM_RATIO: Record<string, string> = {
  '1:1': '1:1',
  '16:9': '16:9',
  '9:16': '9:16',
  '4:3': '4:3',
  '3:4': '3:4',
  '3:2': '4:3',
  '2:3': '3:4',
  '21:9': '16:9',
}

function googleApiKey(clientApiKey?: string) {
  return (
    clientApiKey?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY
  )
}

async function generateWithGeminiImage(
  modelId: string,
  prompt: string,
  apiKey: string,
): Promise<{ dataUrl: string; mimeType: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      // Tell Gemini we expect images back. Without this it returns text only.
      responseModalities: ['TEXT', 'IMAGE'],
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini image API ${res.status}: ${errText}`)
  }
  const json = await res.json()
  const parts = json?.candidates?.[0]?.content?.parts ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imagePart = parts.find((p: any) => p.inlineData?.data)
  if (!imagePart) {
    // Surface any textual refusal so the caller understands why it failed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textPart = parts.find((p: any) => p.text)
    throw new Error(
      textPart?.text
        ? `Gemini returned no image: ${textPart.text}`
        : 'Gemini returned no image data.',
    )
  }
  const mimeType: string = imagePart.inlineData.mimeType || 'image/png'
  return {
    dataUrl: `data:${mimeType};base64,${imagePart.inlineData.data}`,
    mimeType,
  }
}

async function generateWithImagen(
  modelId: string,
  prompt: string,
  ratio: string,
  apiKey: string,
): Promise<{ dataUrl: string; mimeType: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predict?key=${apiKey}`
  const body = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: IMAGEN_ASPECT_FROM_RATIO[ratio] ?? '1:1',
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Imagen API ${res.status}: ${errText}`)
  }
  const json = await res.json()
  const base64 = json?.predictions?.[0]?.bytesBase64Encoded
  if (!base64) throw new Error('Imagen returned no image data.')
  return { dataUrl: `data:image/png;base64,${base64}`, mimeType: 'image/png' }
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

  const {
    prompt,
    model: requestedModelId = 'nano-banana',
    ratio = '1:1',
    apiKey: clientApiKey,
  } = body

  if (!prompt || !prompt.trim()) {
    return Response.json({ success: false, error: 'Prompt is required' }, { status: 400 })
  }

  const mapped = IMAGE_MODEL_MAP[requestedModelId]
  if (!mapped) {
    return Response.json(
      {
        success: false,
        error:
          `${requestedModelId} isn't wired to a live provider yet. ` +
          `Pick Nano Banana / Imagen 3 (Google) or DALL-E 3 (OpenAI) for now.`,
      },
      { status: 400 },
    )
  }

  try {
    console.log('[v0] /api/generate-image:', {
      requestedModelId,
      provider: mapped.provider,
      modelId: mapped.modelId,
      ratio,
    })

    if (mapped.provider === 'google') {
      const key = googleApiKey(clientApiKey)
      if (!key) {
        return Response.json(
          {
            success: false,
            error:
              'Google image generation needs GOOGLE_GENERATIVE_AI_API_KEY in your Vercel env vars, or a key saved in Super Admin → API Keys.',
          },
          { status: 400 },
        )
      }

      const { dataUrl } =
        mapped.googleMode === 'imagen'
          ? await generateWithImagen(mapped.modelId, prompt, ratio, key)
          : await generateWithGeminiImage(mapped.modelId, prompt, key)

      return Response.json({
        success: true,
        url: dataUrl,
        prompt,
        model: mapped.modelId,
      })
    }

    if (mapped.provider === 'openai') {
      const envKey = process.env.OPENAI_API_KEY
      const key = clientApiKey?.trim() || envKey
      if (!key) {
        return Response.json(
          {
            success: false,
            error:
              'DALL-E needs OPENAI_API_KEY in your Vercel env vars, or a key saved in Super Admin → API Keys. (AI Gateway does not proxy image generation.)',
          },
          { status: 400 },
        )
      }
      const size = OPENAI_SIZE_FROM_RATIO[ratio] ?? '1024x1024'
      const client = key === envKey ? defaultOpenai : createOpenAI({ apiKey: key })
      const { image } = await generateImage({
        model: client.image(mapped.modelId),
        prompt,
        size,
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

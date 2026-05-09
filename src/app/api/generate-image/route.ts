/**
 * Real image generation.
 *
 * Live providers (each opt-in via the matching API key, env var or
 * Super Admin → API Keys):
 *
 *   - Google (Nano Banana / Imagen)        — GOOGLE_GENERATIVE_AI_API_KEY
 *   - OpenAI (DALL-E 3 / 4)                — OPENAI_API_KEY
 *   - Stability AI (SD 3.5, SDXL Core)     — STABILITY_API_KEY
 *   - Black Forest Labs (FLUX 1.x)         — BFL_API_KEY
 *   - Ideogram (3.0, 2.0 Turbo)            — IDEOGRAM_API_KEY
 *
 * Other providers (Midjourney, Recraft, Playground, CogView, Wanxiang,
 * ERNIE-ViLG, Kolors) return a clear "missing key" error pointing at the
 * right env var. Midjourney has no public API at all; it returns a note.
 */

import { experimental_generateImage as generateImage } from 'ai'
import { createOpenAI, openai as defaultOpenai } from '@ai-sdk/openai'
import { assertBudget } from '@/lib/projects/server'
import { recordUsage, getCallerForLogging } from '@/lib/projects/usage'

export const maxDuration = 60

type ImageProvider =
  | 'openai'
  | 'google'
  | 'stability'
  | 'bfl'
  | 'ideogram'

interface MappedModel {
  provider: ImageProvider
  modelId: string
  /** Google sub-mode — Nano Banana hits :generateContent, Imagen hits :predict. */
  googleMode?: 'gemini' | 'imagen'
  /** Stability sub-mode — SD3 hits the sd3 endpoint, others the core endpoint. */
  stabilityMode?: 'sd3' | 'core'
  /** BFL sub-path — `flux-pro-1.1-ultra`, `flux-pro-1.1`, `flux-dev` etc. */
  bflPath?: string
  /** Ideogram model_version request param. */
  ideogramVersion?: string
}

const IMAGE_MODEL_MAP: Record<string, MappedModel> = {
  // OpenAI
  'dall-e-3': { provider: 'openai', modelId: 'dall-e-3' },
  'dall-e-4': { provider: 'openai', modelId: 'dall-e-3' },

  // Google — preview slugs are unstable, bump as Google promotes models.
  'nano-banana':     { provider: 'google', modelId: 'gemini-2.5-flash-image',         googleMode: 'gemini' },
  'nano-banana-2':   { provider: 'google', modelId: 'gemini-3.1-flash-image-preview', googleMode: 'gemini' },
  'nano-banana-pro': { provider: 'google', modelId: 'gemini-3-pro-image-preview',     googleMode: 'gemini' },
  'imagen-3':        { provider: 'google', modelId: 'imagen-4.0-generate-001',        googleMode: 'imagen' },
  'imagen-4':        { provider: 'google', modelId: 'imagen-4.0-generate-001',        googleMode: 'imagen' },

  // Stability AI — `sd3` for SD3 family, `core` for SDXL/SD1.5 fallback.
  'stable-diffusion-3.5': { provider: 'stability', modelId: 'sd3-large',  stabilityMode: 'sd3' },
  'stable-diffusion-xl':  { provider: 'stability', modelId: 'sdxl-1.0',   stabilityMode: 'core' },

  // Black Forest Labs FLUX — separate REST endpoints per model.
  'flux-1.1-pro-ultra': { provider: 'bfl', modelId: 'flux-pro-1.1-ultra', bflPath: 'flux-pro-1.1-ultra' },
  'flux-1-pro':         { provider: 'bfl', modelId: 'flux-pro-1.1',       bflPath: 'flux-pro-1.1' },
  'flux-1-dev':         { provider: 'bfl', modelId: 'flux-dev',           bflPath: 'flux-dev' },

  // Ideogram
  'ideogram-3.0':       { provider: 'ideogram', modelId: 'V_3',       ideogramVersion: 'V_3' },
  'ideogram-2.0-turbo': { provider: 'ideogram', modelId: 'V_2_TURBO', ideogramVersion: 'V_2_TURBO' },
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
  '1:1': '1:1', '16:9': '16:9', '9:16': '9:16',
  '4:3': '4:3', '3:4': '3:4', '3:2': '4:3', '2:3': '3:4', '21:9': '16:9',
}

const STABILITY_ASPECT_FROM_RATIO: Record<string, string> = {
  '1:1': '1:1', '16:9': '16:9', '9:16': '9:16',
  '4:3': '4:5', '3:4': '5:4', '3:2': '3:2', '2:3': '2:3', '21:9': '21:9',
}

const IDEOGRAM_ASPECT_FROM_RATIO: Record<string, string> = {
  '1:1': 'ASPECT_1_1',  '16:9': 'ASPECT_16_9',  '9:16': 'ASPECT_9_16',
  '4:3': 'ASPECT_4_3',  '3:4': 'ASPECT_3_4',
  '3:2': 'ASPECT_3_2',  '2:3': 'ASPECT_2_3',
  '21:9': 'ASPECT_16_9',
}

/* ------------------------------------------------------------------ */
/*                         Provider adapters                          */
/* ------------------------------------------------------------------ */

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
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text()
    // Reshape Google's verbose JSON quota error into something a user can
    // actually act on. The free tier is `limit: 0` for the image preview
    // models, so a 429 here almost always means "your project doesn't
    // have paid access to this preview model" rather than rate limiting
    // in the usual sense.
    if (res.status === 429) {
      let retryHint = ''
      try {
        const json = JSON.parse(errText)
        const retry = json?.error?.details?.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d: any) => d?.['@type']?.includes?.('RetryInfo'),
        )?.retryDelay
        if (retry) retryHint = ` (retry in ${retry})`
      } catch { /* ignore */ }
      throw new Error(
        `Google rate-limited ${modelId}${retryHint}. ` +
        `The Gemini image preview models (Nano Banana 2 / Pro) require a paid Google AI Studio plan — ` +
        `free tier is limit-0 for those. Either enable billing at aistudio.google.com/app/billing, ` +
        `or pick a different model: Nano Banana (gemini-2.5-flash-image) on the same key, ` +
        `or DALL-E 3 / Stable Diffusion 3.5 / FLUX with their own key.`,
      )
    }
    if (res.status === 403) {
      throw new Error(
        `Google denied access to ${modelId} (403). Your API key likely doesn't have permission for this model. ` +
        `Try Nano Banana (gemini-2.5-flash-image) instead, or check that your Google Cloud project has the ` +
        `Generative Language API enabled.`,
      )
    }
    throw new Error(`Gemini image API ${res.status}: ${errText}`)
  }
  const json = await res.json()
  const parts = json?.candidates?.[0]?.content?.parts ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imagePart = parts.find((p: any) => p.inlineData?.data)
  if (!imagePart) {
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
    parameters: { sampleCount: 1, aspectRatio: IMAGEN_ASPECT_FROM_RATIO[ratio] ?? '1:1' },
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

/**
 * Stability AI — Stable Image Generate. SD3 family hits `/v2beta/stable-image/generate/sd3`,
 * SDXL hits `/v2beta/stable-image/generate/core`. Both are synchronous.
 * Multipart form-data is required even for text-only prompts; the API
 * uses the boundary to detect file uploads.
 */
async function generateWithStability(
  mapped: MappedModel,
  prompt: string,
  ratio: string,
  apiKey: string,
): Promise<{ dataUrl: string; mimeType: string }> {
  const endpoint =
    mapped.stabilityMode === 'sd3'
      ? 'https://api.stability.ai/v2beta/stable-image/generate/sd3'
      : 'https://api.stability.ai/v2beta/stable-image/generate/core'

  const form = new FormData()
  form.set('prompt', prompt)
  form.set('output_format', 'png')
  form.set('aspect_ratio', STABILITY_ASPECT_FROM_RATIO[ratio] ?? '1:1')
  if (mapped.stabilityMode === 'sd3') {
    // The SD3 endpoint accepts a `model` param to pick large / medium / turbo.
    form.set('model', mapped.modelId === 'sd3-large' ? 'sd3.5-large' : 'sd3.5-medium')
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      // Image bytes back, base64-encoded for symmetry with our other paths.
      Accept: 'application/json',
    },
    body: form,
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Stability ${res.status}: ${errText}`)
  }
  const json = await res.json()
  // Stability returns { image: <base64>, finish_reason, seed }. When the
  // request is a content-mod hit it returns finish_reason === 'CONTENT_FILTERED'.
  if (json?.finish_reason && json.finish_reason !== 'SUCCESS') {
    throw new Error(`Stability refused this prompt: ${json.finish_reason}`)
  }
  const base64 = json?.image
  if (!base64) throw new Error('Stability returned no image data.')
  return { dataUrl: `data:image/png;base64,${base64}`, mimeType: 'image/png' }
}

/**
 * Black Forest Labs FLUX — async REST. POST starts a job and returns an
 * `id` and `polling_url`. We poll until the result is ready and then
 * fetch the signed image URL it returns. Polling is the only option
 * BFL exposes; their docs say results are usually ready in ≤10s.
 */
async function generateWithBfl(
  mapped: MappedModel,
  prompt: string,
  ratio: string,
  apiKey: string,
): Promise<{ dataUrl: string; mimeType: string }> {
  // BFL uses width/height. Pick a sensible resolution per ratio (≤2048
  // long side, multiple of 32). The numbers below match BFL's recommended
  // presets for FLUX 1.1.
  const sizeForRatio: Record<string, { width: number; height: number }> = {
    '1:1':  { width: 1024, height: 1024 },
    '16:9': { width: 1280, height: 720  },
    '9:16': { width: 720,  height: 1280 },
    '4:3':  { width: 1152, height: 864  },
    '3:4':  { width: 864,  height: 1152 },
    '3:2':  { width: 1216, height: 832  },
    '2:3':  { width: 832,  height: 1216 },
    '21:9': { width: 1280, height: 544  },
  }
  const size = sizeForRatio[ratio] ?? sizeForRatio['1:1']

  const startRes = await fetch(`https://api.bfl.ai/v1/${mapped.bflPath}`, {
    method: 'POST',
    headers: {
      'x-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, width: size.width, height: size.height }),
  })
  if (!startRes.ok) {
    const errText = await startRes.text()
    throw new Error(`BFL start ${startRes.status}: ${errText}`)
  }
  const startJson = await startRes.json()
  const pollingUrl: string | undefined = startJson?.polling_url
  if (!pollingUrl) throw new Error('BFL did not return a polling URL.')

  // Poll for up to ~50s — within our maxDuration of 60s.
  const startedAt = Date.now()
  while (Date.now() - startedAt < 50_000) {
    await new Promise(r => setTimeout(r, 1500))
    const pollRes = await fetch(pollingUrl, { headers: { 'x-key': apiKey } })
    if (!pollRes.ok) continue
    const pollJson = await pollRes.json()
    if (pollJson?.status === 'Ready') {
      const imageUrl: string | undefined = pollJson?.result?.sample
      if (!imageUrl) throw new Error('BFL returned no result URL.')
      // Fetch the signed image and inline it as a data URL so the client
      // doesn't have to deal with cross-origin caching quirks.
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) throw new Error(`BFL image fetch ${imgRes.status}`)
      const buf = Buffer.from(await imgRes.arrayBuffer())
      return {
        dataUrl: `data:image/png;base64,${buf.toString('base64')}`,
        mimeType: 'image/png',
      }
    }
    if (pollJson?.status === 'Error' || pollJson?.status === 'Failed') {
      throw new Error(`BFL job failed: ${pollJson?.result ?? 'unknown'}`)
    }
  }
  throw new Error('BFL job timed out (50s).')
}

/**
 * Ideogram — synchronous JSON API. Returns an array of objects with `url`
 * pointing at a signed CDN. We download and inline.
 */
async function generateWithIdeogram(
  mapped: MappedModel,
  prompt: string,
  ratio: string,
  apiKey: string,
): Promise<{ dataUrl: string; mimeType: string }> {
  const res = await fetch('https://api.ideogram.ai/generate', {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_request: {
        prompt,
        aspect_ratio: IDEOGRAM_ASPECT_FROM_RATIO[ratio] ?? 'ASPECT_1_1',
        model: mapped.ideogramVersion,
      },
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Ideogram ${res.status}: ${errText}`)
  }
  const json = await res.json()
  const url: string | undefined = json?.data?.[0]?.url
  if (!url) throw new Error('Ideogram returned no image URL.')
  const imgRes = await fetch(url)
  if (!imgRes.ok) throw new Error(`Ideogram image fetch ${imgRes.status}`)
  const mimeType = imgRes.headers.get('content-type') || 'image/png'
  const buf = Buffer.from(await imgRes.arrayBuffer())
  return {
    dataUrl: `data:${mimeType};base64,${buf.toString('base64')}`,
    mimeType,
  }
}

/* ------------------------------------------------------------------ */
/*                              Handler                               */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  let body: {
    prompt?: string
    model?: string
    ratio?: string
    /** Number of images to generate (1-4). Most providers accept this
     *  natively; DALL-E 3 only supports `n: 1` per request, so we loop
     *  N parallel calls and merge the results. */
    count?: number
    apiKey?: string
    projectId?: string | null
    chatId?: string | null
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
    count: rawCount,
    apiKey: clientApiKey,
    projectId,
    chatId,
  } = body

  // Clamp to a sane range so a malformed payload doesn't accidentally
  // burn 50 credits on a single send.
  const count = Math.max(1, Math.min(4, Math.floor(Number(rawCount) || 1)))

  const caller = await getCallerForLogging()
  if (projectId && caller) {
    try {
      await assertBudget({ projectId, userId: caller.userId })
    } catch (e) {
      const err = e as Error & { status?: number }
      return Response.json({ success: false, error: err.message }, { status: err.status ?? 402 })
    }
  }

  if (!prompt || !prompt.trim()) {
    return Response.json({ success: false, error: 'Prompt is required' }, { status: 400 })
  }

  const mapped = IMAGE_MODEL_MAP[requestedModelId]
  if (!mapped) {
    return Response.json(
      {
        success: false,
        error:
          `${requestedModelId} isn't connected to a live image provider yet. ` +
          `Currently wired: Nano Banana / Imagen (Google), DALL-E (OpenAI), Stable Diffusion 3.5 / SDXL (Stability), FLUX (BFL), Ideogram. ` +
          `Other providers (Midjourney has no public API; Recraft / Playground / CogView / Wanxiang / ERNIE / Kolors are coming) need their adapter wired here.`,
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
      count,
    })

    // ---- key-resolution pass --------------------------------------
    // We resolve the provider key ONCE before fanning out. Returning a
    // Response from inside the per-call helper would short-circuit
    // `Promise.all` in unhelpful ways (you'd get one Response and N-1
    // results), so missing-key errors stay here at the route level.
    let providerKey: string | null = null
    let openaiUseDefaultClient = false
    if (mapped.provider === 'google') {
      providerKey = googleApiKey(clientApiKey) ?? null
      if (!providerKey) {
        return Response.json(
          { success: false, error: 'Google image generation needs GOOGLE_GENERATIVE_AI_API_KEY in your Vercel env vars, or a key saved in Super Admin → API Keys.' },
          { status: 400 },
        )
      }
    } else if (mapped.provider === 'openai') {
      const envKey = process.env.OPENAI_API_KEY
      providerKey = clientApiKey?.trim() || envKey || null
      openaiUseDefaultClient = providerKey === envKey
      if (!providerKey) {
        return Response.json(
          { success: false, error: 'DALL-E needs OPENAI_API_KEY in your Vercel env vars, or a key saved in Super Admin → API Keys.' },
          { status: 400 },
        )
      }
    } else if (mapped.provider === 'stability') {
      providerKey = clientApiKey?.trim() || process.env.STABILITY_API_KEY || null
      if (!providerKey) {
        return Response.json(
          { success: false, error: 'Stable Diffusion needs STABILITY_API_KEY in your Vercel env vars, or a key saved in Super Admin → API Keys.' },
          { status: 400 },
        )
      }
    } else if (mapped.provider === 'bfl') {
      providerKey = clientApiKey?.trim() || process.env.BFL_API_KEY || null
      if (!providerKey) {
        return Response.json(
          { success: false, error: 'FLUX needs BFL_API_KEY in your Vercel env vars, or a key saved in Super Admin → API Keys (api.bfl.ai).' },
          { status: 400 },
        )
      }
    } else if (mapped.provider === 'ideogram') {
      providerKey = clientApiKey?.trim() || process.env.IDEOGRAM_API_KEY || null
      if (!providerKey) {
        return Response.json(
          { success: false, error: 'Ideogram needs IDEOGRAM_API_KEY in your Vercel env vars, or a key saved in Super Admin → API Keys.' },
          { status: 400 },
        )
      }
    }

    // Single-call generator → one image. We run it `count` times in
    // parallel below so every provider gets the same multi-image UX
    // even when its native API only supports n=1 (DALL-E 3, Imagen
    // single-call, Nano Banana :generateContent).
    const generateOne = async (): Promise<{ dataUrl: string; mimeType: string } | null> => {
      const key = providerKey!  // Already validated above.
      if (mapped.provider === 'google') {
        return mapped.googleMode === 'imagen'
          ? await generateWithImagen(mapped.modelId, prompt, ratio, key)
          : await generateWithGeminiImage(mapped.modelId, prompt, key)
      }
      if (mapped.provider === 'openai') {
        const size = OPENAI_SIZE_FROM_RATIO[ratio] ?? '1024x1024'
        const client = openaiUseDefaultClient ? defaultOpenai : createOpenAI({ apiKey: key })
        const { image } = await generateImage({
          model: client.image(mapped.modelId),
          prompt,
          size,
        })
        return {
          dataUrl: `data:${image.mimeType};base64,${image.base64}`,
          mimeType: image.mimeType,
        }
      }
      if (mapped.provider === 'stability') return await generateWithStability(mapped, prompt, ratio, key)
      if (mapped.provider === 'bfl')       return await generateWithBfl(mapped, prompt, ratio, key)
      if (mapped.provider === 'ideogram')  return await generateWithIdeogram(mapped, prompt, ratio, key)
      return null
    }

    // Fan out `count` calls in parallel. `Promise.all` is fine here
    // because most providers cost a flat per-image rate; if any single
    // call fails we surface its error (the user expects all-or-nothing
    // for a small N, and partial results would be confusing in the
    // composer).
    const tasks = Array.from({ length: count }, () => generateOne())
    const settled = await Promise.all(tasks)
    const results = settled.filter((r): r is { dataUrl: string; mimeType: string } => Boolean(r))

    if (results.length === 0) {
      return Response.json(
        { success: false, error: `Unsupported provider: ${mapped.provider}` },
        { status: 400 },
      )
    }

    if (caller) {
      // Record one usage row per generated image so the cost ledger
      // matches what the user actually got back.
      for (let i = 0; i < results.length; i++) {
        void recordUsage({
          userId: caller.userId,
          domain: caller.domain,
          provider: mapped.provider,
          model: requestedModelId,
          modality: 'image',
          chatType: 'image',
          projectId: projectId ?? null,
          chatId: chatId ?? null,
        })
      }
    }
    return Response.json({
      success: true,
      // Back-compat: existing callers read `url`. New callers read `urls`.
      url: results[0].dataUrl,
      urls: results.map(r => r.dataUrl),
      prompt,
      model: mapped.modelId,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Image generation failed'
    console.error('[v0] Image generation error:', errorMessage)
    return Response.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

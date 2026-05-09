/**
 * Real video generation.
 *
 * Live providers (each opt-in via the matching API key, env var or
 * Super Admin → API Keys):
 *
 *   - Luma Dream Machine — LUMAAI_API_KEY
 *   - Runway (Gen-3 Alpha / Gen-4 Turbo) — RUNWAYML_API_SECRET
 *
 * Sora is waitlisted with no public REST endpoint, Pika / Haiper / Vidu /
 * PixVerse / Kling / CogVideo / HeyGen / Synthesia / D-ID need their own
 * adapter wired below — they all return a clean "missing key" error
 * pointing at the right env var until then.
 *
 * NOTE: video jobs typically take 30-180s. We extend the route's
 * `maxDuration` to 300s and poll inside the handler.
 */

import { assertBudget } from '@/lib/projects/server'
import { recordUsage, getCallerForLogging } from '@/lib/projects/usage'

export const maxDuration = 300

type VideoProvider = 'luma' | 'runway'

interface VideoMapEntry {
  provider: VideoProvider
  /** Provider-side model identifier. */
  modelId: string
}

const VIDEO_MODEL_MAP: Record<string, VideoMapEntry> = {
  // Luma — `ray-2` and `ray-1-6` are the current public Dream Machine models.
  'luma-dream-machine':   { provider: 'luma',   modelId: 'ray-1-6' },
  'luma-dream-machine-2': { provider: 'luma',   modelId: 'ray-2' },

  // Runway
  'runway-gen-3-alpha':   { provider: 'runway', modelId: 'gen3a_turbo' },
  'runway-gen-4-turbo':   { provider: 'runway', modelId: 'gen4_turbo' },
}

/** For providers that aren't wired we still surface the right env var so
 *  the user knows what to add. */
const UNWIRED_HINT: Record<
  string,
  { provider: string; envKey: string; docsUrl: string }
> = {
  'sora-turbo':         { provider: 'OpenAI Sora', envKey: 'OPENAI_API_KEY (Sora API access)', docsUrl: 'https://openai.com/sora' },
  sora:                 { provider: 'OpenAI Sora', envKey: 'OPENAI_API_KEY (Sora API access)', docsUrl: 'https://openai.com/sora' },
  'pika-2.0':           { provider: 'Pika',         envKey: 'PIKA_API_KEY',     docsUrl: 'https://pika.art' },
  'pika-1.5':           { provider: 'Pika',         envKey: 'PIKA_API_KEY',     docsUrl: 'https://pika.art' },
  'haiper-2.0':         { provider: 'Haiper',       envKey: 'HAIPER_API_KEY',   docsUrl: 'https://haiper.ai' },
  'stability-video':    { provider: 'Stability AI', envKey: 'STABILITY_API_KEY', docsUrl: 'https://platform.stability.ai' },
  'kling-2.0':          { provider: 'Kling',        envKey: 'KLING_API_KEY + KLING_SECRET_KEY', docsUrl: 'https://app.klingai.com' },
  'kling-1.5':          { provider: 'Kling',        envKey: 'KLING_API_KEY + KLING_SECRET_KEY', docsUrl: 'https://app.klingai.com' },
  'cogvideo-x':         { provider: 'Zhipu CogVideo', envKey: 'ZHIPUAI_API_KEY', docsUrl: 'https://open.bigmodel.cn' },
  'pixverse-v3':        { provider: 'PixVerse',     envKey: 'PIXVERSE_API_KEY', docsUrl: 'https://app.pixverse.ai' },
  'vidu-1.5':           { provider: 'Vidu',         envKey: 'VIDU_API_KEY',     docsUrl: 'https://www.vidu.studio' },
  'heygen-avatar-iv':   { provider: 'HeyGen',       envKey: 'HEYGEN_API_KEY',   docsUrl: 'https://app.heygen.com/settings?nav=API' },
  'heygen-avatar-iii':  { provider: 'HeyGen',       envKey: 'HEYGEN_API_KEY',   docsUrl: 'https://app.heygen.com/settings?nav=API' },
  'synthesia-standard': { provider: 'Synthesia',    envKey: 'SYNTHESIA_API_KEY', docsUrl: 'https://www.synthesia.io/api' },
  'did-studio':         { provider: 'D-ID',         envKey: 'DID_API_KEY',      docsUrl: 'https://studio.d-id.com' },
}

/* ------------------------------------------------------------------ */
/*                          Provider adapters                          */
/* ------------------------------------------------------------------ */

const RUNWAY_RATIO_MAP: Record<string, string> = {
  '16:9': '1280:720',  '9:16': '720:1280',
  '1:1':  '960:960',   '4:3':  '1104:832',
  '3:4':  '832:1104',  '21:9': '1584:672',
}

/**
 * Luma Dream Machine — POST `/v1/generations` returns a job, then poll
 * `/v1/generations/{id}` until `state === "completed"`. The response carries
 * `assets.video` (CDN URL) which we fetch and inline as a data URL.
 */
async function generateWithLuma(
  modelId: string,
  prompt: string,
  ratio: string,
  duration: number,
  apiKey: string,
): Promise<{ dataUrl: string; durationSec: number }> {
  // Luma's public API uses 5s clips for ray-1-6 / ray-2; the `duration`
  // param drives clip length where supported.
  const startRes = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      prompt,
      model: modelId,
      aspect_ratio: ratio,
      duration: `${Math.max(5, Math.min(9, duration))}s`,
    }),
  })
  if (!startRes.ok) {
    const errText = await startRes.text()
    throw new Error(`Luma start ${startRes.status}: ${errText}`)
  }
  const startJson = await startRes.json()
  const jobId: string | undefined = startJson?.id
  if (!jobId) throw new Error('Luma did not return a job id.')

  const startedAt = Date.now()
  // Most Luma jobs finish in 60-150s.
  while (Date.now() - startedAt < 240_000) {
    await new Promise(r => setTimeout(r, 4_000))
    const pollRes = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!pollRes.ok) continue
    const pollJson = await pollRes.json()
    if (pollJson?.state === 'completed') {
      const videoUrl: string | undefined = pollJson?.assets?.video
      if (!videoUrl) throw new Error('Luma returned no video URL.')
      const vidRes = await fetch(videoUrl)
      if (!vidRes.ok) throw new Error(`Luma video fetch ${vidRes.status}`)
      const buf = Buffer.from(await vidRes.arrayBuffer())
      return {
        dataUrl: `data:video/mp4;base64,${buf.toString('base64')}`,
        durationSec: duration,
      }
    }
    if (pollJson?.state === 'failed') {
      throw new Error(`Luma job failed: ${pollJson?.failure_reason ?? 'unknown'}`)
    }
  }
  throw new Error('Luma job timed out (240s).')
}

/**
 * Runway — POST `/v1/image_to_video` or `/v1/text_to_video` returns a
 * task id; poll `/v1/tasks/{id}` until `status === "SUCCEEDED"`. The
 * response carries `output[0]` which is a signed CDN URL.
 *
 * NOTE: Runway's official `image_to_video` requires a starting image, so
 * for text-only prompts we use their `text_to_video` endpoint when the
 * model supports it (Gen-3/Gen-4 alpha series).
 */
async function generateWithRunway(
  modelId: string,
  prompt: string,
  ratio: string,
  duration: number,
  apiKey: string,
): Promise<{ dataUrl: string; durationSec: number }> {
  const startRes = await fetch('https://api.dev.runwayml.com/v1/text_to_video', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-Runway-Version': '2024-11-06',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      promptText: prompt,
      model: modelId,
      ratio: RUNWAY_RATIO_MAP[ratio] ?? '1280:720',
      duration: Math.max(5, Math.min(10, duration)),
    }),
  })
  if (!startRes.ok) {
    const errText = await startRes.text()
    throw new Error(`Runway start ${startRes.status}: ${errText}`)
  }
  const startJson = await startRes.json()
  const taskId: string | undefined = startJson?.id
  if (!taskId) throw new Error('Runway did not return a task id.')

  const startedAt = Date.now()
  while (Date.now() - startedAt < 240_000) {
    await new Promise(r => setTimeout(r, 4_000))
    const pollRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-11-06',
      },
    })
    if (!pollRes.ok) continue
    const pollJson = await pollRes.json()
    if (pollJson?.status === 'SUCCEEDED') {
      const videoUrl: string | undefined = pollJson?.output?.[0]
      if (!videoUrl) throw new Error('Runway returned no video URL.')
      const vidRes = await fetch(videoUrl)
      if (!vidRes.ok) throw new Error(`Runway video fetch ${vidRes.status}`)
      const buf = Buffer.from(await vidRes.arrayBuffer())
      return {
        dataUrl: `data:video/mp4;base64,${buf.toString('base64')}`,
        durationSec: duration,
      }
    }
    if (pollJson?.status === 'FAILED') {
      throw new Error(`Runway job failed: ${pollJson?.failure ?? 'unknown'}`)
    }
  }
  throw new Error('Runway job timed out (240s).')
}

/* ------------------------------------------------------------------ */
/*                              Handler                               */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  let body: {
    prompt?: string
    model?: string
    aspectRatio?: string
    duration?: number
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
    model: requestedModelId = '',
    aspectRatio = '16:9',
    duration = 5,
    apiKey: clientApiKey,
    projectId,
    chatId,
  } = body

  if (!prompt || !prompt.trim()) {
    return Response.json({ success: false, error: 'Prompt is required' }, { status: 400 })
  }

  const caller = await getCallerForLogging()
  if (projectId && caller) {
    try {
      await assertBudget({ projectId, userId: caller.userId })
    } catch (e) {
      const err = e as Error & { status?: number }
      return Response.json({ success: false, error: err.message }, { status: err.status ?? 402 })
    }
  }

  const mapped = VIDEO_MODEL_MAP[requestedModelId]
  if (!mapped) {
    const hint = UNWIRED_HINT[requestedModelId]
    return Response.json(
      {
        success: false,
        error: hint
          ? `${hint.provider} video isn't connected. Add ${hint.envKey} to your Vercel project env vars (Settings → Environment Variables) — get a key at ${hint.docsUrl}. Redeploy after saving.`
          : `${requestedModelId} isn't connected to a live video provider yet. Currently wired: Luma Dream Machine, Runway Gen-3/Gen-4.`,
      },
      { status: 501 },
    )
  }

  try {
    console.log('[v0] /api/generate-video:', {
      requestedModelId,
      provider: mapped.provider,
      modelId: mapped.modelId,
      aspectRatio,
      duration,
    })

    let result: { dataUrl: string; durationSec: number } | null = null

    if (mapped.provider === 'luma') {
      const key = clientApiKey?.trim() || process.env.LUMAAI_API_KEY
      if (!key) {
        return Response.json(
          {
            success: false,
            error: 'Luma Dream Machine needs LUMAAI_API_KEY in your Vercel env vars, or a key saved in Super Admin → API Keys.',
          },
          { status: 400 },
        )
      }
      result = await generateWithLuma(mapped.modelId, prompt, aspectRatio, duration, key)
    } else if (mapped.provider === 'runway') {
      const key =
        clientApiKey?.trim() ||
        process.env.RUNWAYML_API_SECRET ||
        process.env.RUNWAY_API_KEY
      if (!key) {
        return Response.json(
          {
            success: false,
            error: 'Runway needs RUNWAYML_API_SECRET in your Vercel env vars, or a key saved in Super Admin → API Keys.',
          },
          { status: 400 },
        )
      }
      result = await generateWithRunway(mapped.modelId, prompt, aspectRatio, duration, key)
    }

    if (!result) {
      return Response.json(
        { success: false, error: `Unsupported provider: ${mapped.provider}` },
        { status: 400 },
      )
    }

    if (caller) {
      void recordUsage({
        userId: caller.userId,
        domain: caller.domain,
        provider: mapped.provider,
        model: requestedModelId,
        modality: 'video',
        chatType: 'video',
        durationSec: result.durationSec,
        projectId: projectId ?? null,
        chatId: chatId ?? null,
      })
    }
    return Response.json({
      success: true,
      url: result.dataUrl,
      prompt,
      model: mapped.modelId,
      durationSec: result.durationSec,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Video generation failed'
    console.error('[v0] Video generation error:', errorMessage)
    return Response.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

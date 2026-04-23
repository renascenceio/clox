/**
 * Video generation endpoint.
 *
 * None of the video providers (Sora, Runway, Luma, Pika, Haiper, Kling,
 * HeyGen, Synthesia, D-ID, etc.) work through the AI Gateway or through the
 * AI SDK. Each has its own proprietary REST + polling API, and each needs a
 * real provider-specific API key (RUNWAY_API_KEY, LUMAAI_API_KEY, etc.).
 *
 * Rather than silently loop the same sample MP4 (which is what the old page
 * was doing and what produced the "random results" you saw), we return an
 * honest error explaining exactly which env var is missing. When you add one,
 * we'll wire up the corresponding adapter in this file.
 */

export const maxDuration = 60

/**
 * Map our internal model ids to the provider they need, plus the env var that
 * would unlock them. The UI uses this to tell the user what to do next.
 */
const VIDEO_MODEL_REQUIREMENTS: Record<
  string,
  { provider: string; envKey: string; docsUrl: string }
> = {
  // Sora — waitlisted, not yet in the public OpenAI API.
  'sora-turbo': {
    provider: 'OpenAI',
    envKey: 'OPENAI_API_KEY (Sora API access required)',
    docsUrl: 'https://openai.com/sora',
  },
  sora: {
    provider: 'OpenAI',
    envKey: 'OPENAI_API_KEY (Sora API access required)',
    docsUrl: 'https://openai.com/sora',
  },
  // Runway
  'runway-gen-4-turbo': { provider: 'Runway', envKey: 'RUNWAY_API_KEY', docsUrl: 'https://dev.runwayml.com' },
  'runway-gen-3-alpha': { provider: 'Runway', envKey: 'RUNWAY_API_KEY', docsUrl: 'https://dev.runwayml.com' },
  // Luma
  'luma-dream-machine-2': { provider: 'Luma AI', envKey: 'LUMAAI_API_KEY', docsUrl: 'https://lumalabs.ai/dream-machine/api' },
  'luma-dream-machine': { provider: 'Luma AI', envKey: 'LUMAAI_API_KEY', docsUrl: 'https://lumalabs.ai/dream-machine/api' },
  // Pika
  'pika-2.0': { provider: 'Pika', envKey: 'PIKA_API_KEY', docsUrl: 'https://pika.art' },
  'pika-1.5': { provider: 'Pika', envKey: 'PIKA_API_KEY', docsUrl: 'https://pika.art' },
  // Haiper
  'haiper-2.0': { provider: 'Haiper', envKey: 'HAIPER_API_KEY', docsUrl: 'https://haiper.ai' },
  // Stability
  'stability-video': { provider: 'Stability AI', envKey: 'STABILITY_API_KEY', docsUrl: 'https://platform.stability.ai' },
  // Kling
  'kling-2.0': { provider: 'Kling', envKey: 'KLING_API_KEY', docsUrl: 'https://app.klingai.com' },
  'kling-1.5': { provider: 'Kling', envKey: 'KLING_API_KEY', docsUrl: 'https://app.klingai.com' },
  // Zhipu CogVideo
  'cogvideo-x': { provider: 'Zhipu CogVideo', envKey: 'ZHIPUAI_API_KEY', docsUrl: 'https://open.bigmodel.cn' },
  // PixVerse
  'pixverse-v3': { provider: 'PixVerse', envKey: 'PIXVERSE_API_KEY', docsUrl: 'https://app.pixverse.ai' },
  // Vidu
  'vidu-1.5': { provider: 'Vidu', envKey: 'VIDU_API_KEY', docsUrl: 'https://www.vidu.studio' },
  // HeyGen
  'heygen-avatar-iv': { provider: 'HeyGen', envKey: 'HEYGEN_API_KEY', docsUrl: 'https://app.heygen.com/settings?nav=API' },
  'heygen-avatar-iii': { provider: 'HeyGen', envKey: 'HEYGEN_API_KEY', docsUrl: 'https://app.heygen.com/settings?nav=API' },
  // Synthesia
  'synthesia-standard': { provider: 'Synthesia', envKey: 'SYNTHESIA_API_KEY', docsUrl: 'https://www.synthesia.io/api' },
  // D-ID
  'did-studio': { provider: 'D-ID', envKey: 'DID_API_KEY', docsUrl: 'https://studio.d-id.com' },
}

export async function POST(request: Request) {
  let body: { prompt?: string; model?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const { prompt, model: requestedModelId = '' } = body
  if (!prompt || !prompt.trim()) {
    return Response.json({ success: false, error: 'Prompt is required' }, { status: 400 })
  }

  const req = VIDEO_MODEL_REQUIREMENTS[requestedModelId]
  const provider = req?.provider ?? requestedModelId
  const envKey = req?.envKey ?? 'the provider API key'
  const docs = req?.docsUrl

  // When a real adapter is implemented for a provider, check its env var here
  // and proxy the request instead of erroring.

  return Response.json(
    {
      success: false,
      error:
        `${provider} video generation isn't connected. ` +
        `Add ${envKey} to your Vercel project environment variables (Settings → Environment Variables)` +
        (docs ? ` — get a key at ${docs}.` : '.') +
        ` Redeploy after saving.`,
    },
    { status: 501 },
  )
}

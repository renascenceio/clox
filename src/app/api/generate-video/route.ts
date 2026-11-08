/**
 * Video generation through the Vercel AI Gateway (Veo, Kling, Seedance,
 * Wan, MiniMax, Grok Imagine Video, HeyGen, FLUX Video, …).
 *
 * The config pane offers exactly what the gateway reports for the model
 * (`video_capabilities`): aspect ratios, resolutions, durations, audio,
 * sample count. Attached images become the start frame, start + end
 * frames, or character references depending on the chosen mode.
 */
import { experimental_generateVideo as generateVideo } from 'ai7'
import { catalogEntry, resolveModelId } from '@/lib/gateway/catalog'
import { mediaGateway } from '@/lib/gateway/server'
import {
  checkBudget,
  decodeDataUrl,
  deliver,
  downloadMedia,
  errorResponse,
  hostInputs,
  logUsage,
  readMediaRequest,
  seedFrom,
  warningText,
  withDefaults,
} from '@/lib/gateway/media'

export const maxDuration = 300

export async function POST(request: Request) {
  const req = await readMediaRequest(request)
  if (req instanceof Response) return req
  const { prompt, files, projectId, chatId } = req

  const { caller, blocked } = await checkBudget(projectId)
  if (blocked) return blocked

  const modelId = resolveModelId(req.model, 'video')
  const params = withDefaults(req.params, modelId, 'video')
  const entry = catalogEntry(modelId)
  const caps = entry?.video ?? {}
  if (!entry) return Response.json({ success: false, error: `Unknown video model ${req.model}` }, { status: 400 })
  if (!prompt) return Response.json({ success: false, error: 'Prompt is required' }, { status: 400 })

  const ops = caps.supported_operations ?? ['text-to-video']
  const images = files.filter(f => f.contentType.startsWith('image/')).map(f => decodeDataUrl(f.url))
  const mode = typeof params.mode === 'string' && ops.includes(params.mode)
    ? params.mode
    : images.length === 0
      ? 'text-to-video'
      : ops.includes('image-to-video') ? 'image-to-video' : ops[0]

  if (mode !== 'text-to-video' && images.length === 0) {
    return Response.json(
      { success: false, error: 'Attach an image — this model animates images rather than starting from text.' },
      { status: 400 },
    )
  }
  if (!ops.includes('text-to-video') && images.length === 0) {
    return Response.json({ success: false, error: 'This model needs a start image.' }, { status: 400 })
  }

  const str = (k: string) => (typeof params[k] === 'string' && params[k] !== '' ? (params[k] as string) : undefined)
  const aspectRatio = str('aspectRatio') && caps.supported_aspect_ratios?.includes(str('aspectRatio')!)
    ? str('aspectRatio')
    : caps.supported_aspect_ratios?.includes('16:9') ? '16:9' : caps.supported_aspect_ratios?.[0]
  const durations = caps.supported_durations_seconds ?? []
  const wanted = Number(params.duration)
  const duration = durations.length
    ? (durations.includes(wanted) ? wanted : durations.includes(5) ? 5 : durations[0])
    : Number.isFinite(wanted) && wanted > 0 ? wanted : undefined
  // The gateway takes the resolution labels it advertises ("720p"), even
  // though the SDK types the option as "WIDTHxHEIGHT".
  const resolution = str('resolution') && caps.supported_resolutions?.includes(str('resolution')!)
    ? str('resolution')
    : caps.supported_resolutions?.includes('720p') ? '720p' : caps.supported_resolutions?.[0]
  const n = Math.max(1, Math.min(caps.max_sample_count ?? 1, Math.floor(Number(params.count) || 1)))

  try {
    // Many video models only fetch input images by URL. Store the
    // attachments and hand the model short-lived signed links; models that
    // accept inline images get the bytes directly.
    const sources = (caps.input_limits?.image as { supported_sources?: string[] } | undefined)?.supported_sources
    const needsUrls = images.length > 0 && sources !== undefined && !sources.includes('base64')
    let inputs: Array<Uint8Array | string> = images.map(i => i.bytes)
    if (needsUrls) {
      if (!caller) {
        return Response.json({ success: false, error: 'Sign in to animate images with this model.' }, { status: 401 })
      }
      inputs = await hostInputs(images, { caller, chatId })
    }

    const gateway = await mediaGateway()
    const result = await generateVideo({
      model: gateway.videoModel(modelId),
      prompt: mode === 'image-to-video' && inputs[0]
        ? { image: inputs[0], text: prompt }
        : prompt,
      n,
      maxRetries: 0,
      download: downloadMedia,
      ...(aspectRatio ? { aspectRatio: aspectRatio as `${number}:${number}` } : {}),
      ...(resolution ? { resolution: resolution as `${number}x${number}` } : {}),
      ...(duration ? { duration } : {}),
      ...(seedFrom(params.seed) !== undefined ? { seed: seedFrom(params.seed) } : {}),
      ...(caps.generate_audio && params.generateAudio !== undefined ? { generateAudio: Boolean(params.generateAudio) } : {}),
      ...(mode === 'first-last-frame'
        ? {
            frameImages: [
              { image: inputs[0], frameType: 'first_frame' as const },
              ...(inputs[1] ? [{ image: inputs[1], frameType: 'last_frame' as const }] : []),
            ],
          }
        : {}),
      ...(mode === 'reference-to-video'
        ? { inputReferences: inputs.map((data, i) => ({ data, mediaType: images[i].mediaType })) }
        : {}),
      // Jobs without inline bytes run as a gateway background job, so no
      // single network request has to stay open for minutes. Inline images
      // use the direct flow (the job store caps request size).
      ...(images.length === 0 || needsUrls ? { poll: { intervalMs: 5000, timeoutMs: 280_000 } } : {}),
    })

    const outputs = result.videos.map(v => ({ bytes: v.uint8Array, mediaType: v.mediaType ?? 'video/mp4' }))
    const urls = await deliver(outputs, { caller, chatId, kind: 'video' })
    logUsage(caller, { provider: entry.owner, model: modelId, modality: 'video', count: urls.length, projectId, chatId })
    return Response.json({
      success: true,
      url: urls[0],
      urls,
      durationSec: duration,
      model: modelId,
      warnings: warningText(result.warnings),
    })
  } catch (error) {
    return errorResponse(error, 'generate-video')
  }
}

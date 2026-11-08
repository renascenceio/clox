/**
 * Image generation through the Vercel AI Gateway.
 *
 *   - Image models (GPT Image, FLUX, Recraft, Seedream, Grok Imagine,
 *     MAI, Muse, Topaz, …) → `generateImage`.
 *   - Language models with image output (Nano Banana, Arrow) →
 *     `generateText`, reading the generated files.
 *
 * Settings come from the config pane (field keys in lib/ai-capabilities).
 * Anything a model doesn't take comes back as a warning instead of
 * failing the request.
 */
import { generateImage, generateText } from 'ai7'
import { catalogEntry, isImageLanguageModel, resolveModelId } from '@/lib/gateway/catalog'
import { mediaGateway } from '@/lib/gateway/server'
import {
  checkBudget,
  decodeDataUrl,
  deliver,
  errorResponse,
  logUsage,
  readMediaRequest,
  seedFrom,
  warningText,
} from '@/lib/gateway/media'

export const maxDuration = 300

type Out = { bytes: Uint8Array; mediaType: string }

export async function POST(request: Request) {
  const req = await readMediaRequest(request)
  if (req instanceof Response) return req
  const { prompt, params, files, projectId, chatId } = req

  const { caller, blocked } = await checkBudget(projectId)
  if (blocked) return blocked

  const modelId = resolveModelId(req.model, 'image')
  const entry = catalogEntry(modelId)
  if (!entry) return Response.json({ success: false, error: `Unknown image model ${req.model}` }, { status: 400 })

  const images = files.filter(f => f.contentType.startsWith('image/')).map(f => decodeDataUrl(f.url))
  if (!prompt && images.length === 0) {
    return Response.json({ success: false, error: 'Prompt is required' }, { status: 400 })
  }
  if (entry.owner === 'topaz' && images.length === 0) {
    return Response.json({ success: false, error: 'Attach the image you want enhanced.' }, { status: 400 })
  }

  const count = Math.max(1, Math.min(4, Math.floor(Number(params.count) || 1)))
  const avoid = typeof params.negativePrompt === 'string' ? params.negativePrompt.trim() : ''
  const text = avoid ? `${prompt}\n\nAvoid: ${avoid}` : prompt
  const str = (k: string) => (typeof params[k] === 'string' && params[k] !== '' ? (params[k] as string) : undefined)

  try {
    const gateway = await mediaGateway()
    let outputs: Out[] = []
    let warnings: string[] = []

    if (isImageLanguageModel(entry)) {
      // Nano Banana / Arrow: one image per call, so fan out for count > 1.
      const google = entry.owner === 'google'
        ? {
            google: {
              responseModalities: ['TEXT', 'IMAGE'],
              imageConfig: {
                ...(str('aspectRatio') ? { aspectRatio: str('aspectRatio') } : {}),
                ...(str('imageSize') ? { imageSize: str('imageSize') } : {}),
              },
            },
          }
        : undefined
      const runs = await Promise.all(
        Array.from({ length: count }, () =>
          generateText({
            model: gateway(modelId),
            maxRetries: 1,
            messages: [{
              role: 'user',
              content: [
                ...images.map(img => ({ type: 'file' as const, data: img.bytes, mediaType: img.mediaType })),
                { type: 'text' as const, text: text || 'Edit this image.' },
              ],
            }],
            ...(google ? { providerOptions: google } : {}),
          }),
        ),
      )
      for (const r of runs) {
        for (const f of r.files) {
          if (f.mediaType?.startsWith('image/')) outputs.push({ bytes: f.uint8Array, mediaType: f.mediaType })
        }
        warnings.push(...warningText(r.warnings))
      }
      if (outputs.length === 0) {
        const said = runs.map(r => r.text).filter(Boolean).join(' ').slice(0, 300)
        throw new Error(said ? `The model returned no image: ${said}` : 'The model returned no image.')
      }
    } else {
      const fam = entry.owner
      const providerOptions: Record<string, Record<string, unknown>> = {}
      if (fam === 'openai') {
        providerOptions.openai = {
          ...(str('quality') && str('quality') !== 'auto' ? { quality: str('quality') } : {}),
          ...(str('background') && str('background') !== 'auto' ? { background: str('background') } : {}),
          ...(str('outputFormat') ? { outputFormat: str('outputFormat') } : {}),
        }
      }
      if (fam === 'bfl') {
        providerOptions.blackForestLabs = {
          ...(str('outputFormat') ? { outputFormat: str('outputFormat') } : {}),
          ...(params.safetyTolerance !== undefined ? { safetyTolerance: Number(params.safetyTolerance) } : {}),
          ...(params.promptUpsampling !== undefined ? { promptUpsampling: Boolean(params.promptUpsampling) } : {}),
          ...(params.steps !== undefined ? { steps: Number(params.steps) } : {}),
          ...(params.guidance !== undefined ? { guidance: Number(params.guidance) } : {}),
        }
      }
      if (fam === 'recraft' && str('style') && str('style') !== 'any') {
        providerOptions.recraft = { style: str('style') }
      }

      const size = str('size') && str('size') !== 'auto' ? (str('size') as `${number}x${number}`) : undefined
      const result = await generateImage({
        model: gateway.imageModel(modelId),
        prompt: images.length > 0
          ? { text: text || 'Enhance this image.', images: images.map(i => i.bytes) }
          : text,
        n: count,
        maxRetries: 1,
        ...(size ? { size } : {}),
        ...(str('aspectRatio') ? { aspectRatio: str('aspectRatio') as `${number}:${number}` } : {}),
        ...(seedFrom(params.seed) !== undefined ? { seed: seedFrom(params.seed) } : {}),
        ...(Object.keys(providerOptions).length ? { providerOptions: providerOptions as never } : {}),
      })
      outputs = result.images.map(img => ({ bytes: img.uint8Array, mediaType: img.mediaType ?? 'image/png' }))
      warnings = warningText(result.warnings)
    }

    const urls = await deliver(outputs, { caller, chatId, kind: 'image' })
    logUsage(caller, { provider: entry.owner, model: modelId, modality: 'image', count: urls.length, projectId, chatId })
    return Response.json({
      success: true,
      url: urls[0],
      urls,
      prompt,
      model: modelId,
      warnings: Array.from(new Set(warnings)),
    })
  } catch (error) {
    return errorResponse(error, 'generate-image')
  }
}

/**
 * Speech, music and sound effects through the Vercel AI Gateway
 * (ElevenLabs, OpenAI TTS, Gemini TTS, Fish Audio, MAI Voice, Voxtral,
 * Grok TTS, Eleven Music, Eleven Sound Effects).
 */
import { generateSpeech } from 'ai7'
import { catalogEntry, resolveModelId } from '@/lib/gateway/catalog'
import { mediaGateway } from '@/lib/gateway/server'
import {
  checkBudget,
  deliver,
  errorResponse,
  logUsage,
  readMediaRequest,
  seedFrom,
  warningText,
} from '@/lib/gateway/media'

export const maxDuration = 120

/** Rough duration for the transcript chip when the provider doesn't say. */
function estimateSeconds(bytes: number, mediaType: string, text: string) {
  if (mediaType.includes('mpeg') || mediaType.includes('mp3')) return Math.round((bytes * 8) / 128_000)
  if (mediaType.includes('wav')) return Math.round(bytes / (24_000 * 2))
  return Math.max(1, Math.round(text.split(/\s+/).length / 2.5))
}

export async function POST(request: Request) {
  const req = await readMediaRequest(request)
  if (req instanceof Response) return req
  const { prompt, params, projectId, chatId } = req

  const { caller, blocked } = await checkBudget(projectId)
  if (blocked) return blocked
  if (!prompt) return Response.json({ success: false, error: 'Prompt is required' }, { status: 400 })

  const modelId = resolveModelId(req.model, 'audio')
  const entry = catalogEntry(modelId)
  if (!entry) return Response.json({ success: false, error: `Unknown audio model ${req.model}` }, { status: 400 })

  const tags = entry.tags ?? []
  const isMusic = tags.includes('music')
  const isSfx = tags.includes('sound-effects')
  const str = (k: string) => (typeof params[k] === 'string' && (params[k] as string).trim() !== '' ? (params[k] as string).trim() : undefined)
  const num = (k: string) => (params[k] !== undefined && params[k] !== '' && Number.isFinite(Number(params[k])) ? Number(params[k]) : undefined)

  const voice = str('customVoice') ?? str('voice')
  const providerOptions: Record<string, Record<string, unknown>> = {}

  if (entry.owner === 'elevenlabs') {
    const eleven: Record<string, unknown> = {}
    if (isMusic) {
      if (num('duration')) eleven.musicLengthMs = Math.round(num('duration')! * 1000)
      if (params.instrumental === true) eleven.forceInstrumental = true
    } else if (isSfx) {
      if (num('duration')) eleven.durationSeconds = num('duration')
      if (num('promptInfluence') !== undefined) eleven.promptInfluence = num('promptInfluence')
      if (params.loop === true) eleven.loop = true
    } else {
      const settings: Record<string, unknown> = {}
      if (num('stability') !== undefined) settings.stability = num('stability')
      if (num('similarity') !== undefined) settings.similarityBoost = num('similarity')
      if (num('style') !== undefined) settings.style = num('style')
      if (params.speakerBoost !== undefined) settings.useSpeakerBoost = Boolean(params.speakerBoost)
      if (Object.keys(settings).length) eleven.voiceSettings = settings
      if (seedFrom(params.seed) !== undefined) eleven.seed = seedFrom(params.seed)
    }
    if (Object.keys(eleven).length) providerOptions.elevenlabs = eleven
  }

  try {
    const gateway = await mediaGateway()
    const result = await generateSpeech({
      model: gateway.speechModel(modelId),
      text: prompt,
      maxRetries: 1,
      ...(voice && !isMusic && !isSfx ? { voice } : {}),
      ...(num('speed') !== undefined && !isMusic && !isSfx ? { speed: num('speed') } : {}),
      ...(str('outputFormat') ? { outputFormat: str('outputFormat') } : {}),
      ...(str('instructions') ? { instructions: str('instructions') } : {}),
      ...(str('language') ? { language: str('language') } : {}),
      ...(Object.keys(providerOptions).length ? { providerOptions: providerOptions as never } : {}),
    })

    const mediaType = result.audio.mediaType || 'audio/mpeg'
    const bytes = result.audio.uint8Array
    const [url] = await deliver([{ bytes, mediaType }], { caller, chatId, kind: 'audio' })
    logUsage(caller, { provider: entry.owner, model: modelId, modality: 'audio', count: 1, projectId, chatId })
    return Response.json({
      success: true,
      url,
      durationSec: isMusic || isSfx ? num('duration') : estimateSeconds(bytes.byteLength, mediaType, prompt),
      model: modelId,
      warnings: warningText(result.warnings),
    })
  } catch (error) {
    return errorResponse(error, 'generate-audio')
  }
}

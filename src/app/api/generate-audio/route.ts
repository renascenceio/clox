/**
 * Real audio generation.
 *
 * Live providers (each opt-in via the matching API key, env var or
 * Super Admin → API Keys):
 *
 *   - Google Gemini TTS  — GOOGLE_GENERATIVE_AI_API_KEY
 *   - OpenAI TTS         — OPENAI_API_KEY
 *   - ElevenLabs         — ELEVENLABS_API_KEY
 *
 * Other providers (Suno, Udio, Stable Audio, Play.ht, Azure, Fish, ChatGLM)
 * return a clear "missing key" error pointing at the right env var rather
 * than playing a fake sample file.
 */

import { assertBudget } from '@/lib/projects/server'
import { recordUsage, getCallerForLogging } from '@/lib/projects/usage'

export const maxDuration = 60

type AudioProvider = 'google' | 'openai' | 'elevenlabs'

interface AudioMapEntry {
  provider: AudioProvider
  /** The exact provider model id to call. */
  modelId: string
  /** Default voice for providers that need one. */
  defaultVoice?: string
}

const AUDIO_MODEL_MAP: Record<string, AudioMapEntry> = {
  // Google
  'gemini-tts':     { provider: 'google', modelId: 'gemini-2.5-flash-preview-tts',  defaultVoice: 'Kore' },
  'gemini-tts-3.1': { provider: 'google', modelId: 'gemini-3.1-flash-tts-preview',  defaultVoice: 'Kore' },

  // OpenAI — three TTS models. `tts-1` is the cheap & fast one, `tts-1-hd`
  // is higher fidelity, `gpt-4o-mini-tts` is the newest steerable model.
  'openai-tts-1':       { provider: 'openai', modelId: 'tts-1',          defaultVoice: 'alloy' },
  'openai-tts-1-hd':    { provider: 'openai', modelId: 'tts-1-hd',       defaultVoice: 'alloy' },
  'openai-gpt-4o-tts':  { provider: 'openai', modelId: 'gpt-4o-mini-tts', defaultVoice: 'alloy' },

  // ElevenLabs — these are model ids accepted by api.elevenlabs.io. The
  // voice id is a per-account thing; without one we use ElevenLabs'
  // public "Rachel" voice (21m00Tcm4TlvDq8ikWAM) which is always available.
  'elevenlabs-turbo-v2.5':       { provider: 'elevenlabs', modelId: 'eleven_turbo_v2_5',     defaultVoice: '21m00Tcm4TlvDq8ikWAM' },
  'elevenlabs-multilingual-v2':  { provider: 'elevenlabs', modelId: 'eleven_multilingual_v2', defaultVoice: '21m00Tcm4TlvDq8ikWAM' },
}

/* ------------------------------------------------------------------ */
/*                          Provider adapters                          */
/* ------------------------------------------------------------------ */

function googleApiKey(clientApiKey?: string) {
  return (
    clientApiKey?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY
  )
}

/**
 * Gemini TTS returns raw PCM (signed 16-bit little-endian, 24 kHz, mono).
 * Browsers can't play that directly, so we prepend a standard RIFF/WAV header.
 */
function pcm16ToWav(pcmBytes: Uint8Array, sampleRate: number): Uint8Array {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const dataSize = pcmBytes.length
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  const out = new Uint8Array(buffer)
  out.set(pcmBytes, 44)
  return out
}

function extractSampleRate(mimeType: string | undefined): number {
  if (!mimeType) return 24000
  const match = /rate=(\d+)/i.exec(mimeType)
  return match ? Number(match[1]) : 24000
}

async function generateWithGeminiTts(
  modelId: string,
  prompt: string,
  voice: string,
  apiKey: string,
): Promise<{ dataUrl: string; durationSec: number }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
      },
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini TTS ${res.status}: ${errText}`)
  }
  const json = await res.json()
  const parts = json?.candidates?.[0]?.content?.parts ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audioPart = parts.find((p: any) => p.inlineData?.data)
  if (!audioPart) throw new Error('Gemini TTS returned no audio data.')

  const mimeType: string = audioPart.inlineData.mimeType || 'audio/L16;rate=24000'
  const sampleRate = extractSampleRate(mimeType)
  const pcm = Uint8Array.from(atob(audioPart.inlineData.data), c => c.charCodeAt(0))
  const wav = pcm16ToWav(pcm, sampleRate)
  const durationSec = pcm.length / 2 / sampleRate
  const wavBase64 = Buffer.from(wav).toString('base64')
  return {
    dataUrl: `data:audio/wav;base64,${wavBase64}`,
    durationSec: Math.round(durationSec * 10) / 10,
  }
}

/**
 * OpenAI TTS — POST `/v1/audio/speech` returns the raw audio body in the
 * requested format. We use mp3 because it's the smallest and every browser
 * plays it natively; the spec says default is mp3 but we set it explicitly
 * to be safe.
 */
async function generateWithOpenAiTts(
  modelId: string,
  prompt: string,
  voice: string,
  apiKey: string,
): Promise<{ dataUrl: string; durationSec: number }> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      input: prompt,
      voice,
      response_format: 'mp3',
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI TTS ${res.status}: ${errText}`)
  }
  const arrayBuf = await res.arrayBuffer()
  const base64 = Buffer.from(arrayBuf).toString('base64')
  // We can't know the exact duration without decoding, so estimate at the
  // OpenAI TTS average rate of ~150 wpm (2.5 wps). It's a hint for the UI;
  // exact length is reflected by the audio element on playback.
  const wordCount = prompt.trim().split(/\s+/).length
  const durationSec = Math.max(1, Math.round((wordCount / 2.5) * 10) / 10)
  return {
    dataUrl: `data:audio/mpeg;base64,${base64}`,
    durationSec,
  }
}

/**
 * ElevenLabs TTS — POST `/v1/text-to-speech/{voice_id}`. Headers carry the
 * API key (`xi-api-key`) and the response body is the audio. Default
 * output format is mp3_44100_128 which we keep.
 */
async function generateWithElevenLabs(
  modelId: string,
  prompt: string,
  voice: string,
  apiKey: string,
): Promise<{ dataUrl: string; durationSec: number }> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: prompt,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`ElevenLabs ${res.status}: ${errText}`)
  }
  const arrayBuf = await res.arrayBuffer()
  const base64 = Buffer.from(arrayBuf).toString('base64')
  const wordCount = prompt.trim().split(/\s+/).length
  const durationSec = Math.max(1, Math.round((wordCount / 2.5) * 10) / 10)
  return {
    dataUrl: `data:audio/mpeg;base64,${base64}`,
    durationSec,
  }
}

/* ------------------------------------------------------------------ */
/*                              Handler                                */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  let body: {
    prompt?: string; model?: string; apiKey?: string; voice?: string;
    projectId?: string | null; chatId?: string | null;
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const {
    prompt, model: requestedModelId = 'gemini-tts',
    apiKey: clientApiKey, voice, projectId, chatId,
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

  const mapped = AUDIO_MODEL_MAP[requestedModelId]
  if (!mapped) {
    return Response.json(
      {
        success: false,
        error:
          `${requestedModelId} isn't connected to a live audio provider yet. ` +
          `Pick a Gemini TTS, OpenAI TTS, or ElevenLabs model — or add an API key for this provider in Vercel env vars / Super Admin → API Keys.`,
      },
      { status: 400 },
    )
  }

  try {
    console.log('[v0] /api/generate-audio:', {
      requestedModelId,
      provider: mapped.provider,
      modelId: mapped.modelId,
    })

    let dataUrl = ''
    let durationSec = 0

    if (mapped.provider === 'google') {
      const key = googleApiKey(clientApiKey)
      if (!key) {
        return Response.json(
          {
            success: false,
            error: 'Gemini TTS needs GOOGLE_GENERATIVE_AI_API_KEY in Vercel env vars or a key in Super Admin → API Keys.',
          },
          { status: 400 },
        )
      }
      const r = await generateWithGeminiTts(mapped.modelId, prompt, voice || mapped.defaultVoice || 'Kore', key)
      dataUrl = r.dataUrl
      durationSec = r.durationSec
    } else if (mapped.provider === 'openai') {
      const key = clientApiKey?.trim() || process.env.OPENAI_API_KEY
      if (!key) {
        return Response.json(
          {
            success: false,
            error: 'OpenAI TTS needs OPENAI_API_KEY in Vercel env vars or a key in Super Admin → API Keys.',
          },
          { status: 400 },
        )
      }
      const r = await generateWithOpenAiTts(mapped.modelId, prompt, voice || mapped.defaultVoice || 'alloy', key)
      dataUrl = r.dataUrl
      durationSec = r.durationSec
    } else if (mapped.provider === 'elevenlabs') {
      const key = clientApiKey?.trim() || process.env.ELEVENLABS_API_KEY
      if (!key) {
        return Response.json(
          {
            success: false,
            error: 'ElevenLabs needs ELEVENLABS_API_KEY in Vercel env vars or a key in Super Admin → API Keys.',
          },
          { status: 400 },
        )
      }
      const r = await generateWithElevenLabs(
        mapped.modelId, prompt,
        voice || mapped.defaultVoice || '21m00Tcm4TlvDq8ikWAM',
        key,
      )
      dataUrl = r.dataUrl
      durationSec = r.durationSec
    }

    if (caller) {
      void recordUsage({
        userId: caller.userId,
        domain: caller.domain,
        provider: mapped.provider,
        model: requestedModelId,
        modality: 'audio',
        chatType: 'audio',
        durationSec,
        projectId: projectId ?? null,
        chatId: chatId ?? null,
      })
    }
    return Response.json({
      success: true,
      url: dataUrl,
      prompt,
      model: mapped.modelId,
      durationSec,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Audio generation failed'
    console.error('[v0] Audio generation error:', errorMessage)
    return Response.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

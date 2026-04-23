/**
 * Real audio generation.
 *
 * Currently wired up:
 *   - Google Gemini 2.5 Flash Preview TTS (text-to-speech) via REST — works
 *     with the same GOOGLE_GENERATIVE_AI_API_KEY the chat uses. This is the
 *     only live backend at the moment.
 *
 * All other audio providers (ElevenLabs, Suno, Udio, Azure, Play.ht, Stable
 * Audio, Fish Speech, ChatGLM Audio) return a clear "missing key" error
 * instead of silently falling back to a sample file — that's what produced
 * the fake 7-minute melody you saw.
 */

export const maxDuration = 60

interface AudioMapEntry {
  provider: string
  /** The exact REST model id to call. */
  modelId: string
  /** Default voice name for Gemini TTS (has a palette of prebuilt voices). */
  voice?: string
}

const AUDIO_MODEL_MAP: Record<string, AudioMapEntry> = {
  // Gemini TTS. The same key powers chat and TTS on this model family.
  // "Kore" is a neutral default; users can pick a different voice from the
  // settings panel once we expose it in the UI.
  'gemini-tts': {
    provider: 'google',
    modelId: 'gemini-2.5-flash-preview-tts',
    voice: 'Kore',
  },
  'gemini-tts-3.1': {
    provider: 'google',
    modelId: 'gemini-3.1-flash-tts-preview',
    voice: 'Kore',
  },
}

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
 * This is a purely mechanical wrap — no resampling.
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
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
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

/** Parse a mimeType like "audio/L16;rate=24000" → 24000 (default 24000). */
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

  // Compute duration from PCM size (2 bytes per sample, mono).
  const durationSec = pcm.length / 2 / sampleRate

  const wavBase64 = Buffer.from(wav).toString('base64')
  return {
    dataUrl: `data:audio/wav;base64,${wavBase64}`,
    durationSec: Math.round(durationSec * 10) / 10,
  }
}

export async function POST(request: Request) {
  let body: { prompt?: string; model?: string; apiKey?: string; voice?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const { prompt, model: requestedModelId = 'gemini-tts', apiKey: clientApiKey, voice } = body
  if (!prompt || !prompt.trim()) {
    return Response.json({ success: false, error: 'Prompt is required' }, { status: 400 })
  }

  const mapped = AUDIO_MODEL_MAP[requestedModelId]
  if (!mapped) {
    return Response.json(
      {
        success: false,
        error:
          `${requestedModelId} isn't wired to a live audio provider yet. ` +
          `Pick "Gemini TTS" (Google) to generate real audio, or add an API key for this provider.`,
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

    if (mapped.provider === 'google') {
      const key = googleApiKey(clientApiKey)
      if (!key) {
        return Response.json(
          {
            success: false,
            error:
              'Gemini TTS needs GOOGLE_GENERATIVE_AI_API_KEY in Vercel env vars or a key in Super Admin → API Keys.',
          },
          { status: 400 },
        )
      }

      const { dataUrl, durationSec } = await generateWithGeminiTts(
        mapped.modelId,
        prompt,
        voice || mapped.voice || 'Kore',
        key,
      )
      return Response.json({
        success: true,
        url: dataUrl,
        prompt,
        model: mapped.modelId,
        durationSec,
      })
    }

    return Response.json(
      { success: false, error: `Unsupported audio provider: ${mapped.provider}` },
      { status: 400 },
    )
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Audio generation failed'
    console.error('[v0] Audio generation error:', errorMessage)
    return Response.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

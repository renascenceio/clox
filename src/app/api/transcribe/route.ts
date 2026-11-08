import { NextResponse } from 'next/server'
import { transcribe } from 'ai7'
import { defaultModelId, resolveModelId } from '@/lib/gateway/catalog'
import { describeGatewayError, mediaGateway } from '@/lib/gateway/server'

/**
 * POST /api/transcribe
 *
 * Receives an audio recording (multipart/form-data, field `audio`, optional
 * `model` and `language`) from the in-chat dictation button and returns a
 * plain-text transcript, using a speech-to-text model on the Vercel AI
 * Gateway (default GPT-4o mini Transcribe). Browsers record webm/opus
 * (Chromium), mp4 (Safari) or ogg (Firefox); the gateway accepts all three.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const audio = form.get('audio')
    if (!(audio instanceof Blob)) {
      return NextResponse.json({ error: 'Missing `audio` blob.' }, { status: 400 })
    }
    if (audio.size === 0) {
      return NextResponse.json({ error: 'Empty recording.' }, { status: 400 })
    }
    // 25 MB is the provider ceiling and far above a dictation clip.
    if (audio.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'Recording too long.' }, { status: 413 })
    }

    const requested = form.get('model')
    const modelId = typeof requested === 'string'
      ? resolveModelId(requested, 'transcription')
      : defaultModelId('transcription')
    const language = form.get('language')

    const gateway = await mediaGateway()
    const result = await transcribe({
      model: gateway.transcriptionModel(modelId),
      audio: new Uint8Array(await audio.arrayBuffer()),
      maxRetries: 1,
      ...(typeof language === 'string' && language
        ? { providerOptions: { openai: { language } } }
        : {}),
    })

    return NextResponse.json({ text: result.text.trim(), language: result.language, model: modelId })
  } catch (err) {
    const { message, status } = describeGatewayError(err)
    console.error('[v0] /api/transcribe failed', message)
    return NextResponse.json({ error: message }, { status })
  }
}

import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

/**
 * POST /api/transcribe
 *
 * Receives an audio recording (multipart/form-data, field name `audio`)
 * captured by the in-chat dictation button and returns a plain-text
 * transcript.
 *
 * Implementation choice — Gemini 2.0 Flash:
 *   The project already has GOOGLE_GENERATIVE_AI_API_KEY configured,
 *   Gemini accepts audio inline as a `file` content part, and the Flash
 *   tier is cheap enough that even verbose dictation costs a fraction
 *   of a cent. We avoid a separate Whisper / Deepgram dependency and
 *   skip a second env var the user would have to set.
 *
 * Why not the AI Gateway:
 *   AI SDK 4's gateway mode doesn't yet route the file/audio modality
 *   reliably through every model — direct Google works today and the
 *   key is already present in the environment.
 *
 * The endpoint is *intentionally* tolerant about MIME types: browsers
 * pick from a small set (audio/webm; codecs=opus on Chromium, audio/mp4
 * on Safari, audio/ogg on Firefox), and Gemini accepts all of them via
 * the `audio/*` family. We pass the recorder's reported mimeType
 * straight through and only fall back to `audio/webm` when the upload
 * has no type at all.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Transcription not configured: GOOGLE_GENERATIVE_AI_API_KEY missing.' },
        { status: 503 },
      )
    }

    const form = await req.formData()
    const audio = form.get('audio')
    if (!(audio instanceof Blob)) {
      return NextResponse.json({ error: 'Missing `audio` blob.' }, { status: 400 })
    }
    if (audio.size === 0) {
      return NextResponse.json({ error: 'Empty recording.' }, { status: 400 })
    }
    // 25 MB cap — well above what 60 seconds of webm/opus produces, but
    // small enough that a runaway recording can't OOM the function.
    if (audio.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'Recording too long.' }, { status: 413 })
    }

    const mimeType = (audio.type && audio.type.length > 0 ? audio.type : 'audio/webm')
      // Gemini only wants the mime type, not the codec parameter.
      // `audio/webm; codecs=opus` → `audio/webm`.
      .split(';')[0]
      .trim()

    const buffer = Buffer.from(await audio.arrayBuffer())

    const google = createGoogleGenerativeAI({ apiKey })
    const { text } = await generateText({
      model: google('gemini-2.0-flash'),
      // Tight system prompt: we want a verbatim transcript, no "here's
      // what I heard:" framing, no [inaudible] tags, no language guess
      // unless useful. Gemini honours this consistently.
      system:
        'You are a transcription engine. Return ONLY the verbatim transcript of the supplied audio in the original language. ' +
        'Do not add commentary, headings, quotation marks, language labels, or any text that is not in the recording. ' +
        'If the audio is silent or unintelligible, return an empty response.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Transcribe the audio.' },
            { type: 'file', data: buffer, mimeType },
          ],
        },
      ],
      // A short cap keeps Gemini honest — dictation longer than a few
      // thousand tokens of speech is unusual, and an open-ended limit
      // lets the model hallucinate a continuation.
      maxTokens: 4000,
    })

    return NextResponse.json({ text: text.trim() })
  } catch (err) {
    console.error('[v0] /api/transcribe failed', err)
    const message = err instanceof Error ? err.message : 'Transcription failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

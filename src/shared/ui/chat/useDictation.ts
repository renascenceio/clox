'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Browser-side dictation lifecycle:
 *   idle      — never recorded, or the previous recording finished
 *   recording — MediaRecorder is capturing
 *   transcribing — the blob has been sent to /api/transcribe; we're
 *                  awaiting the transcript
 *
 * The mic button uses `state` to flip between three visual modes:
 * idle (outline mic), recording (red dot), transcribing (spinner).
 */
export type DictationState = 'idle' | 'recording' | 'transcribing'

/**
 * Pick the first MediaRecorder mimeType the current browser actually
 * supports. Browsers each ship a slightly different default:
 *   - Chromium       → audio/webm;codecs=opus
 *   - Safari (iOS+)  → audio/mp4
 *   - Firefox        → audio/ogg;codecs=opus
 * Picking explicitly avoids `MediaRecorder is not supported` on Safari
 * (which silently rejects the codec-less call in some versions) and
 * gives us a known mime type we can forward to the server.
 */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ]
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c
    } catch {
      /* old browsers throw on isTypeSupported — fall through */
    }
  }
  return undefined
}

interface UseDictationOptions {
  /** Called with the final transcript when it arrives. */
  onTranscript: (text: string) => void
  /** Called when something goes wrong — show a user-visible message. */
  onError?: (message: string) => void
}

interface UseDictationApi {
  state: DictationState
  /** Toggle: starts recording if idle, stops + transcribes if recording. */
  toggle: () => void
  /** Read-only flag for code that wants to disable the mic (e.g. while transcribing). */
  isBusy: boolean
}

export function useDictation({ onTranscript, onError }: UseDictationOptions): UseDictationApi {
  const [state, setState] = useState<DictationState>('idle')

  // We hold these in refs (not state) because their identity is part of
  // the recorder lifecycle — re-renders triggered by `state` changes
  // must not reset them.
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const mimeRef = useRef<string>('audio/webm')

  // Snapshot the latest callbacks in refs so the recorder's `onstop`
  // closure (created once at startRecording time) always calls the
  // current handler, not whichever one happened to be in scope when
  // recording started. This pattern avoids the "stale callback" bug
  // where a parent component re-renders mid-recording.
  const onTranscriptRef = useRef(onTranscript)
  const onErrorRef = useRef(onError)
  useEffect(() => { onTranscriptRef.current = onTranscript }, [onTranscript])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  /** Release the microphone tracks so the browser's "recording" tab
   *  indicator goes away and other apps can use the mic. */
  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  // If the component owning the hook unmounts mid-recording, release
  // the mic. Without this the "tab is using your microphone" indicator
  // would persist until the user navigated away or refreshed.
  useEffect(() => {
    return () => { cleanupStream() }
  }, [cleanupStream])

  const startRecording = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onErrorRef.current?.('Microphone access is not available in this browser.')
      return
    }
    try {
      // Tweak the constraints conservatively — `echoCancellation` and
      // `noiseSuppression` are widely supported and improve transcription
      // accuracy in noisy rooms; `channelCount: 1` keeps the upload tiny.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      })
      streamRef.current = stream

      const mimeType = pickMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      mimeRef.current = recorder.mimeType || mimeType || 'audio/webm'
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.addEventListener('dataavailable', e => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      })

      recorder.addEventListener('stop', async () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current })
        cleanupStream()

        // A stop with zero captured bytes means the user hit the mic
        // and immediately hit it again — nothing to transcribe.
        if (blob.size === 0) {
          setState('idle')
          return
        }

        setState('transcribing')
        try {
          const form = new FormData()
          // Filename matters: some servers infer the mime from the
          // extension. Pick one that matches the recorder's output.
          const ext =
            mimeRef.current.includes('mp4') ? 'm4a'
            : mimeRef.current.includes('ogg') ? 'ogg'
            : 'webm'
          form.append('audio', blob, `dictation.${ext}`)

          const res = await fetch('/api/transcribe', { method: 'POST', body: form })
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}))
            throw new Error(payload.error || `Transcription failed (${res.status}).`)
          }
          const { text } = (await res.json()) as { text: string }
          if (text && text.trim().length > 0) {
            onTranscriptRef.current(text.trim())
          } else {
            onErrorRef.current?.('No speech detected.')
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Transcription failed.'
          onErrorRef.current?.(msg)
        } finally {
          setState('idle')
        }
      })

      // Collect data in 250ms chunks rather than waiting for stop.
      // This makes the eventual blob assembly faster for long takes
      // and is a no-op for short ones.
      recorder.start(250)
      setState('recording')
    } catch (err) {
      cleanupStream()
      setState('idle')
      const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      onErrorRef.current?.(
        denied
          ? 'Microphone permission denied. Allow access in your browser settings to dictate.'
          : err instanceof Error ? err.message : 'Could not start recording.',
      )
    }
  }, [cleanupStream])

  const stopRecording = useCallback(() => {
    const r = recorderRef.current
    if (!r) {
      setState('idle')
      return
    }
    if (r.state === 'recording') {
      // The `stop` event listener above takes it from here.
      r.stop()
    } else {
      cleanupStream()
      setState('idle')
    }
  }, [cleanupStream])

  const toggle = useCallback(() => {
    if (state === 'recording') stopRecording()
    else if (state === 'idle') startRecording()
    // While `transcribing` we ignore the click — the user can't usefully
    // "cancel" a network round-trip in a way that's better than the
    // 1-2 seconds it usually takes. The button is also visually
    // disabled during this state.
  }, [state, startRecording, stopRecording])

  return {
    state,
    toggle,
    isBusy: state !== 'idle',
  }
}

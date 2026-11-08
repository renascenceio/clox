/** Saves a chat transcript to localStorage without ever throwing.
 *
 *  Browsers allow about 5 MB per site. Attached files are kept on messages
 *  as data URLs, so a few images or PDFs used to fill it; setItem then threw
 *  inside a React effect. When the full copy doesn't fit we keep the text
 *  and drop the file bodies (names and types stay), and as a last resort
 *  clear the oldest other transcripts. */

import { emitChatChange } from './chat-store'

const PREFIX = 'chat-history-'

type Msg = Record<string, unknown>

function withoutFileBodies(messages: unknown[]): unknown[] {
  return messages.map(raw => {
    const m = raw as Msg
    const files = m.experimental_attachments
    if (!Array.isArray(files) || files.length === 0) return m
    return {
      ...m,
      experimental_attachments: files.map(f => {
        const file = f as Msg
        return typeof file.url === 'string' && file.url.startsWith('data:')
          ? { ...file, url: '', dropped: true }
          : file
      }),
    }
  })
}

function tryWrite(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function otherTranscriptKeys(keep: string) {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX) && k !== keep) keys.push(k)
  }
  return keys
}

export function saveTranscript(chatId: string, messages: unknown[]) {
  if (typeof window === 'undefined' || !chatId || messages.length === 0) return
  emitChatChange({ kind: 'history', chatId, modality: 'text', items: messages })
  writeLocal(chatId, messages)
}

/** Keep a transcript in this browser only (e.g. one just loaded from the server). */
export function cacheTranscript(chatId: string, messages: unknown[]) {
  if (typeof window === 'undefined' || !chatId || messages.length === 0) return
  writeLocal(chatId, messages)
}

function writeLocal(chatId: string, messages: unknown[]) {
  const key = PREFIX + chatId
  let full: string
  try { full = JSON.stringify(messages) } catch { return }
  if (tryWrite(key, full)) return

  const slim = JSON.stringify(withoutFileBodies(messages))
  if (tryWrite(key, slim)) return

  // Chat ids are not time-ordered, so free space one transcript at a time.
  for (const other of otherTranscriptKeys(key)) {
    localStorage.removeItem(other)
    if (tryWrite(key, slim)) return
  }
  console.warn('[clox] transcript too large to keep in this browser; the server copy stays')
}

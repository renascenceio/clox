/**
 * Shapes the messages useChat posts to /api/chat so the request stays under
 * the hosting platform's 4.5 MB body limit.
 */

/** Room left for attachment bodies after the conversation text. */
export const MAX_REQUEST_CHARS = 3_900_000

type Msg = {
  role: string
  content: string
  experimental_attachments?: Array<{ url?: string; name?: string; contentType?: string }>
  data?: unknown
  annotations?: unknown
  toolInvocations?: unknown
  parts?: unknown
}

/** Same fields useChat sends by default (`sendExtraMessageFields: false`),
 *  with older attachment bodies dropped — newest first kept — until it fits. */
export function fitAttachments(messages: Msg[]): Msg[] {
  const out: Msg[] = messages.map(({ role, content, experimental_attachments, data, annotations, toolInvocations, parts }) => ({
    role,
    content,
    ...(experimental_attachments !== undefined && { experimental_attachments: experimental_attachments.map(a => ({ ...a })) }),
    ...(data !== undefined && { data }),
    ...(annotations !== undefined && { annotations }),
    ...(toolInvocations !== undefined && { toolInvocations }),
    ...(parts !== undefined && { parts }),
  }))

  let size = JSON.stringify(out).length
  if (size <= MAX_REQUEST_CHARS) return out

  for (const m of out) {
    for (const a of m.experimental_attachments ?? []) {
      if (size <= MAX_REQUEST_CHARS) return out
      if (typeof a.url === 'string' && a.url.startsWith('data:')) {
        size -= a.url.length
        a.url = ''
      }
    }
  }
  // Attachments the model can't see are noise to it.
  for (const m of out) {
    if (m.experimental_attachments) m.experimental_attachments = m.experimental_attachments.filter(a => a.url)
  }
  return out
}

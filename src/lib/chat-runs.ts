import { getServiceClient } from '@/lib/projects/server'

/**
 * A "run" is one assistant reply being generated on the server. The reply
 * is saved as it grows, so a reloaded or closed tab can pick it up again:
 * generation never depends on the browser staying connected.
 */

type ToolInvocation = {
  state: 'call' | 'result'
  step: number
  toolCallId: string
  toolName: string
  args: unknown
  result?: unknown
}

type Part =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; reasoning: string; details: Array<{ type: 'text'; text: string }> }
  | { type: 'tool-invocation'; toolInvocation: ToolInvocation }
  | { type: 'step-start' }

export type RunMessage = {
  id: string
  role: 'assistant'
  content: string
  createdAt: string
  toolInvocations: ToolInvocation[]
  annotations: unknown[]
  parts: Part[]
}

const FLUSH_EVERY_MS = 1500

export async function startRun(input: { userId: string; chatId: string; model: string }) {
  const { data, error } = await getServiceClient()
    .from('chat_runs')
    .insert({ user_id: input.userId, chat_id: input.chatId, model: input.model, status: 'running' })
    .select('id')
    .single()
  if (error) {
    console.error('[v0] chat run start failed:', error.message)
    return null
  }
  return createRecorder(data.id as string)
}

export type RunRecorder = ReturnType<typeof createRecorder>

function createRecorder(runId: string) {
  const message: RunMessage = {
    id: '',
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    toolInvocations: [],
    annotations: [],
    parts: [],
  }
  let step = 0
  let dirty = false
  let lastFlush = 0
  let writing: Promise<void> = Promise.resolve()

  const write = (fields: Record<string, unknown>) => {
    writing = writing.then(async () => {
      const { error } = await getServiceClient()
        .from('chat_runs')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', runId)
      if (error) console.error('[v0] chat run save failed:', error.message)
    })
    return writing
  }

  const flush = (force = false) => {
    if (!dirty) return
    const now = Date.now()
    if (!force && now - lastFlush < FLUSH_EVERY_MS) return
    dirty = false
    lastFlush = now
    void write({ message, message_id: message.id || null })
  }

  const addText = (text: string) => {
    message.content += text
    const last = message.parts[message.parts.length - 1]
    if (last?.type === 'text') last.text += text
    else message.parts.push({ type: 'text', text })
  }

  return {
    annotation(a: unknown) {
      message.annotations.push(a)
      dirty = true
      flush()
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    part(p: any) {
      switch (p?.type) {
        case 'step-start':
          if (!message.id && p.messageId) message.id = String(p.messageId)
          if (step > 0) message.parts.push({ type: 'step-start' })
          break
        case 'text-delta':
          addText(String(p.textDelta ?? ''))
          break
        case 'reasoning': {
          const last = message.parts[message.parts.length - 1]
          if (last?.type === 'reasoning') {
            last.reasoning += p.textDelta
            last.details[0].text += p.textDelta
          } else {
            message.parts.push({ type: 'reasoning', reasoning: p.textDelta, details: [{ type: 'text', text: p.textDelta }] })
          }
          break
        }
        case 'tool-call': {
          const inv: ToolInvocation = { state: 'call', step, toolCallId: p.toolCallId, toolName: p.toolName, args: p.args }
          message.toolInvocations.push(inv)
          message.parts.push({ type: 'tool-invocation', toolInvocation: inv })
          flush(true)
          break
        }
        case 'tool-result': {
          const inv = message.toolInvocations.find(t => t.toolCallId === p.toolCallId)
          if (inv) {
            inv.state = 'result'
            inv.result = p.result
          }
          dirty = true
          flush(true)
          return
        }
        case 'step-finish':
          step += 1
          break
        default:
          return
      }
      dirty = true
      flush()
    },
    async finish(error?: string) {
      dirty = false
      await write({ message, message_id: message.id || null, status: error ? 'error' : 'done', error: error ?? null })
    },
  }
}

/** The newest run of a chat, if it started in the last six hours. */
export async function latestRun(userId: string, chatId: string) {
  const since = new Date(Date.now() - 6 * 3600_000).toISOString()
  const { data } = await getServiceClient()
    .from('chat_runs')
    .select('id, status, message_id, message, error, updated_at, created_at')
    .eq('user_id', userId)
    .eq('chat_id', chatId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  // A run that hasn't saved anything for 20 minutes died with its server.
  const stale = data.status === 'running' && Date.now() - new Date(data.updated_at).getTime() > 20 * 60_000
  return { ...data, status: stale ? 'error' : data.status, error: stale ? 'The server stopped before the reply finished.' : data.error }
}

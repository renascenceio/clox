/**
 * `browser` tool — the model's own web browser. Each call performs one
 * action (open, click, type …) in a headless Chrome that keeps its
 * state for the chat, and returns what the page looks like now: URL,
 * title, the clickable elements with refs, and a screenshot.
 *
 * The screenshot is stored and its URL goes back in the result so the
 * chat can show the browser live. The image itself is only given to the
 * model when it asks to see (look / open / see: true) — each image costs
 * ~1.3k input tokens, the element list is usually enough to act on.
 */
import { tool } from 'ai'
import { z } from 'zod'
import { browse, type BrowserAction, type BrowserProgress } from '@/lib/sandbox/browser'
import { saveBrowserShot } from '@/lib/storage/chat-outputs'

/** Screenshots waiting to be shown to the model, by tool call id. The
 *  model reads them within the same request, so a short-lived map is
 *  enough; older turns get the text part only. */
const PENDING_IMAGES = new Map<string, { data: string; at: number }>()
const IMAGE_TTL_MS = 10 * 60 * 1000

function remember(id: string, png: Buffer) {
  const now = Date.now()
  PENDING_IMAGES.forEach((v, k) => { if (now - v.at > IMAGE_TTL_MS) PENDING_IMAGES.delete(k) })
  PENDING_IMAGES.set(id, { data: png.toString('base64'), at: now })
}

const DESCRIPTION = `Your own web browser (headless Chrome, 1280×800). It stays open for this chat: pages, logins and history persist between calls. One action per call; every call returns the page's URL, title and its interactive elements as "role "name" [ref=e12]".

Actions:
  open   url        go to a page (https:// added if missing)
  click  ref        click an element from the latest elements list
  type   ref, text  replace a field's text; submit: true presses Enter after
  press  key        Enter, Tab, Escape, ArrowDown …
  select ref, value choose a dropdown option
  scroll direction  "down" | "up" (one screen)
  back              previous page
  read   [ref]      the visible text of the page (or of one element) — use this to quote or summarise
  look              attach a screenshot for you to inspect (layout, charts, images, anything the text misses)

Rules:
  - Refs change after every action: only use refs from the most recent result.
  - Prefer read for facts and the element list for navigation; use look / see: true when the visual matters.
  - The user watches the screenshots live, so work step by step and say what you're doing.
  - Never type passwords, card numbers or personal data unless the user gave them for this purpose in this chat.
  - Don't buy, book, post or send anything without the user confirming in the chat first.`

export function makeBrowserTool(
  chatId: string,
  userId: string | null,
  onProgress?: (event: Record<string, unknown>) => void,
) {
  const progress = (e: BrowserProgress) => onProgress?.({ ...e, kind: 'browser' })
  return tool({
    description: DESCRIPTION,
    parameters: z.object({
      action: z.enum(['open', 'click', 'type', 'press', 'select', 'scroll', 'back', 'read', 'look']),
      url: z.string().optional(),
      ref: z.string().optional().describe('Element ref from the latest elements list, e.g. "e12"'),
      text: z.string().optional(),
      submit: z.boolean().optional(),
      key: z.string().optional(),
      value: z.string().optional(),
      direction: z.enum(['up', 'down']).optional(),
      see: z.boolean().optional().describe('Also attach the screenshot for you to inspect'),
    }),
    execute: async (args, { toolCallId }) => {
      const missing = (field: string) => ({ ok: false, action: args.action, message: `"${args.action}" needs ${field}.` })
      let step: BrowserAction
      switch (args.action) {
        case 'open': if (!args.url) return missing('url'); step = { action: 'open', url: args.url }; break
        case 'click': if (!args.ref) return missing('ref'); step = { action: 'click', ref: args.ref }; break
        case 'type':
          if (!args.ref || args.text === undefined) return missing('ref and text')
          step = { action: 'type', ref: args.ref, text: args.text, submit: args.submit }
          break
        case 'press': if (!args.key) return missing('key'); step = { action: 'press', key: args.key }; break
        case 'select':
          if (!args.ref || !args.value) return missing('ref and value')
          step = { action: 'select', ref: args.ref, value: args.value }
          break
        case 'scroll': step = { action: 'scroll', direction: args.direction ?? 'down' }; break
        case 'back': step = { action: 'back' }; break
        case 'read': step = { action: 'read', ref: args.ref }; break
        default: step = { action: 'look' }
      }
      try {
        const r = await browse(chatId, step, progress)
        let shot: string | null = null
        if (r.screenshot && userId) {
          shot = await saveBrowserShot({ userId, chatId, name: `${toolCallId}.png`, content: r.screenshot })
            .catch(e => { console.error('[v0] browser shot upload failed:', (e as Error).message); return null })
        }
        const seen = Boolean(r.screenshot) && (args.see || args.action === 'look' || args.action === 'open')
        if (seen && r.screenshot) remember(toolCallId, r.screenshot)
        return {
          ok: r.ok,
          action: args.action,
          message: r.message,
          url: r.url,
          title: r.title,
          elements: r.elements,
          ...(r.text !== undefined ? { text: r.text } : {}),
          shot,
          seen,
          toolCallId,
        }
      } catch (e) {
        return { ok: false, action: args.action, message: `Browser unavailable: ${(e as Error).message}` }
      }
    },
    experimental_toToolResultContent: result => {
      const r = result as { toolCallId?: string; shot?: unknown; seen?: unknown }
      const { shot: _shot, seen: _seen, toolCallId: _id, ...rest } = r as Record<string, unknown>
      const parts: ({ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string })[] = [
        { type: 'text', text: JSON.stringify(rest) },
      ]
      const image = r.toolCallId ? PENDING_IMAGES.get(r.toolCallId) : undefined
      if (image) parts.push({ type: 'image', data: image.data, mimeType: 'image/png' })
      return parts
    },
  })
}

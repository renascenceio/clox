'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { ProjectFull, ProjectChat } from '../_types'

/**
 * The Chats tab. Two responsibilities:
 *
 *  1. Show every chat that lives inside this project, grouped by modality.
 *  2. Be the primary drop target for chats dragged out of the sidebar.
 *
 * The drop event reads `text/x-clox-chat-id` and posts to
 * `PATCH /api/chats/:id` to set `project_id`. After a successful drop we
 * dispatch the existing `clox-chats-changed` event so the sidebar re-syncs.
 */
export default function ChatsTab({
  project,
  onChange,
}: { project: ProjectFull; onChange: () => void }) {
  const [chats, setChats] = useState<ProjectChat[] | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/chats?project_id=${project.id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      setChats(j.chats || [])
    } catch (e) { setError((e as Error).message) }
  }, [project.id])

  useEffect(() => { load() }, [load])

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const chatId = e.dataTransfer.getData('text/x-clox-chat-id')
    const localChat = e.dataTransfer.getData('text/x-clox-local-chat')
    try {
      if (chatId) {
        // DB-backed chat: just reassign.
        await fetch(`/api/chats/${chatId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ project_id: project.id }),
        })
      } else if (localChat) {
        // localStorage chat: promote to DB and link.
        const parsed = JSON.parse(localChat)
        await fetch('/api/chats', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: parsed.id,
            title: parsed.title || 'Untitled',
            modality: parsed.modality || 'text',
            model: parsed.model || null,
            project_id: project.id,
          }),
        })
        // Also stamp the localStorage row so the sidebar shows the link
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('clox-chat-linked', {
            detail: { chatId: parsed.id, projectId: project.id },
          }))
        }
      } else {
        return
      }
      window.dispatchEvent(new Event('clox-chats-changed'))
      onChange()
      load()
    } catch (e) { setError((e as Error).message) }
  }

  const grouped: Record<string, ProjectChat[]> = {}
  for (const c of (chats ?? [])) {
    const k = c.modality || 'text'
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(c)
  }
  const orderedKeys = ['text', 'research', 'code', 'image', 'video', 'audio'].filter(k => grouped[k])

  return (
    <div>
      {/* drop zone — always visible, intensifies on hover */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border border-dashed transition-colors px-6 py-8 mb-8 ${
          dragOver
            ? 'border-accent bg-accent/5'
            : 'border-hairline bg-transparent hover:border-hairline-soft'
        }`}
      >
        <div className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-ink-muted mb-1">
          drop zone
        </div>
        <div className={`font-serif italic text-[20px] ${dragOver ? 'text-accent' : 'text-ink'}`}>
          {dragOver ? 'Release to add this chat to the project.' : 'Drag a chat from the sidebar to add it here.'}
        </div>
        <div className="text-[12px] text-ink-soft mt-2">
          Every generation in the dropped chat will count toward this project&apos;s budget from the moment it lands.
        </div>
      </div>

      {error && (
        <div className="font-mono text-[11px] text-accent mb-4">{error}</div>
      )}

      {/* chat list */}
      {chats === null ? (
        <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-muted py-8 text-center">
          loading chats…
        </div>
      ) : chats.length === 0 ? (
        <div className="text-[14px] text-ink-soft italic font-serif text-center py-12 border border-hairline">
          No chats yet. Drag one in, or start a new chat from this project.
        </div>
      ) : (
        <div className="space-y-8">
          {orderedKeys.map(modality => (
            <div key={modality}>
              <div className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-ink-muted border-b border-hairline pb-2 mb-2 flex items-baseline justify-between">
                <span>{modality} · {grouped[modality].length}</span>
              </div>
              <div>
                {grouped[modality].map((c, idx) => (
                  <ChatRow
                    key={c.id}
                    chat={c}
                    idx={idx + 1}
                    projectId={project.id}
                    onChange={() => { onChange(); load() }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ChatRow({
  chat,
  idx,
  projectId,
  onChange,
}: { chat: ProjectChat; idx: number; projectId: string; onChange: () => void }) {
  async function unlink() {
    if (!confirm('Remove this chat from the project? Its history is preserved; only the link is broken.')) return
    await fetch(`/api/chats/${chat.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: null }),
    })
    window.dispatchEvent(new Event('clox-chats-changed'))
    onChange()
  }

  const surface = surfaceForModality(chat.modality)

  return (
    <div className="grid grid-cols-[40px_1fr_auto_auto] gap-4 items-center px-2 py-3 border-b border-hairline hover:bg-rail-soft/40 transition-colors group">
      <div className="font-mono text-[10px] tracking-[0.08em] text-ink-muted tabular-nums">
        {String(idx).padStart(2, '0')}
      </div>
      <Link href={`${surface}?chat=${chat.id}&project=${projectId}`} className="min-w-0">
        <div className="text-[14px] text-ink truncate group-hover:text-accent transition-colors">
          {chat.title || 'Untitled'}
        </div>
        <div className="font-mono text-[10px] tracking-[0.06em] text-ink-muted mt-0.5 truncate">
          {chat.model || '—'} · updated {new Date(chat.updated_at).toLocaleDateString()}
        </div>
      </Link>
      <span className="font-mono text-[9.5px] tracking-[0.08em] uppercase text-ink-muted">
        {chat.modality}
      </span>
      <button
        onClick={unlink}
        className="opacity-0 group-hover:opacity-100 font-mono text-[10px] tracking-[0.06em] text-ink-muted hover:text-accent transition-all px-2"
        title="Remove from project"
      >
        unlink
      </button>
    </div>
  )
}

function surfaceForModality(m: string): string {
  // Every chat modality lives on `/text` — the user picks the modality
  // from the in-composer slash menu after landing. Research and code
  // are still on their own surfaces. We keep the parameter for the rare
  // case where /research or /code rows appear in this list.
  switch (m) {
    case 'research': return '/research'
    case 'code':     return '/code'
    default:         return '/text'
  }
}

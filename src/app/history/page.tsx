'use client'

import { useEffect, useMemo, useState } from 'react'

import ChatWorkspace, { type RailRecentItem } from '@/shared/ui/chat/ChatWorkspace'
import { useChatChrome } from '@/shared/ui/chat/useChatChrome'
import { PALETTES } from '@/shared/ui/chat/palettes'
import {
  // Switched from `listChats` → `listActiveChats` so the History view
  // shows the same set of chats the sidebar shows: archived chats are
  // hidden here and live on /archives. Without this, the Archive
  // action below would soft-archive a chat but leave it visible in
  // History, defeating the action.
  listActiveChats,
  // Used solely to count archived chats so we can render a
  // "Archives · 12" affordance next to the filter rail. The full
  // listing of archived chats lives on /archives.
  listChats,
  archiveChat,
  permanentlyDeleteChat,
  renameChat,
  type Chat,
  type Modality,
} from '@/lib/chat-store'
import RowActionsMenu, { RowActionIcons } from '@/shared/ui/components/RowActionsMenu'

const MODALITY_LABEL: Record<Modality, string> = {
  text:  'chat',
  image: 'image',
  audio: 'voice',
  video: 'video',
}

const FILTERS: { id: 'all' | Modality; label: string }[] = [
  { id: 'all',   label: 'All' },
  { id: 'text',  label: 'Chats' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Voice' },
]

function bucketOf(t: number): string {
  const now = new Date()
  const d = new Date(t)
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return 'Today'

  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.getFullYear() === yest.getFullYear() && d.getMonth() === yest.getMonth() && d.getDate() === yest.getDate()) {
    return 'Yesterday'
  }
  const diff = Math.floor((+now - +d) / 86400000)
  if (diff < 7)  return 'Earlier this week'
  if (diff < 30) return 'Earlier this month'
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function HistoryPage() {
  const chrome = useChatChrome('history')
  const p = PALETTES[chrome.theme]
  const mono = `'Geist Mono', ui-monospace, monospace`
  const serif = `'Newsreader', Georgia, serif`

  const [chats, setChats] = useState<Chat[]>([])
  // Track archived count separately so the "Archives · N" link can
  // display a live tally without paying the cost of materialising the
  // full archived list. We deliberately don't store the archived
  // chats themselves — anyone wanting to interact with them gets
  // routed to /archives.
  const [archivedCount, setArchivedCount] = useState(0)
  // Inline rename state — keyed by chat id so only the row being
  // edited shows an input. Same pattern the sidebar uses.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  useEffect(() => {
    const refresh = () => {
      setChats(listActiveChats().sort((a, b) => b.createdAt - a.createdAt))
      // listChats() returns ALL chats (active + archived); subtract
      // the active count to get the archived tally. Cheaper than a
      // dedicated `listArchivedChats()` call which would re-iterate
      // localStorage a second time for the same data.
      const all = listChats()
      const archived = all.filter(c => c.archived).length
      setArchivedCount(archived)
    }
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('clox-chats-changed', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('clox-chats-changed', refresh)
    }
  }, [])

  function handleArchive(id: string) {
    archiveChat(id)
    // archiveChat fires `clox-chats-changed` via saveChats; the
    // listener above re-runs `listActiveChats()` so the row drops
    // out of the view automatically. We still call setChats here
    // for the rare case where the event listener hasn't attached
    // yet (StrictMode double-mount, fast clicks during boot).
    setChats(listActiveChats().sort((a, b) => b.createdAt - a.createdAt))
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this chat forever? This cannot be undone — the history bucket will be removed too.')) return
    permanentlyDeleteChat(id)
    setChats(listActiveChats().sort((a, b) => b.createdAt - a.createdAt))
  }

  function startRename(id: string, currentTitle: string) {
    setEditingId(id)
    setEditingTitle(currentTitle)
  }

  function commitRename() {
    if (!editingId) return
    const v = editingTitle.trim()
    // Empty rename = cancel rather than wiping the title — saves the
    // user from a misclick that erases all context for the chat.
    if (v && v.length > 0) renameChat(editingId, v)
    setEditingId(null)
    setEditingTitle('')
    setChats(listActiveChats().sort((a, b) => b.createdAt - a.createdAt))
  }

  function cancelRename() {
    setEditingId(null)
    setEditingTitle('')
  }

  const [filter, setFilter] = useState<'all' | Modality>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return chats.filter(c => {
      const mod: Modality = c.modality ?? 'text'
      if (filter !== 'all' && mod !== filter) return false
      if (q && !c.title.toLowerCase().includes(q) && !c.model.toLowerCase().includes(q)) return false
      return true
    })
  }, [chats, filter, query])

  // Group into time buckets, preserving insertion order so newest stays first.
  const buckets = useMemo(() => {
    const map = new Map<string, Chat[]>()
    for (const c of filtered) {
      const b = bucketOf(c.createdAt)
      if (!map.has(b)) map.set(b, [])
      map.get(b)!.push(c)
    }
    return Array.from(map.entries())
  }, [filtered])

  const recent: RailRecentItem[] = chats
    .filter(c => (c.modality ?? 'text') === 'text')
    .slice(0, 8)
    .map(c => ({
      id: c.id,
      title: c.title,
      meta: new Date(c.createdAt).toLocaleString([], { month: 'short', day: 'numeric' }) + ' · ' + c.model.toLowerCase(),
      onClick: () => {
        if (typeof window !== 'undefined') localStorage.setItem('activeChatId:text', c.id)
        chrome.router.push('/text')
      },
    }))

  function open(c: Chat) {
    const mod: Modality = c.modality ?? 'text'
    if (typeof window !== 'undefined') localStorage.setItem(`activeChatId:${mod}`, c.id)
    // Every modality lives on /text now; differ only by the `mode` query.
    const mode = mod === 'text' ? 'chat' : mod === 'audio' ? 'voice' : mod
    chrome.router.push(`/text?mode=${mode}`)
  }

  return (
    <div className="fixed inset-0 isolate">
      <ChatWorkspace
        theme={chrome.theme}
        onChangeTheme={chrome.handleThemeChange}
        brandName="Clox"
        brandVersion="0.5"
        user={chrome.user}
        language={chrome.language}
        onChangeLanguage={chrome.handleChangeLanguage}
        onOpenSettings={chrome.onOpenSettings}
        onOpenSuperAdmin={chrome.onOpenSuperAdmin}
        onOpenSkills={chrome.onOpenSkills}
        onSignOut={chrome.handleSignOut}
        onDeleteAccount={chrome.handleDeleteAccount}
        nav={chrome.nav}
        recent={recent}
        onNewChat={chrome.onNewChat}
        breadcrumb="library · history"
        title="History"
        models={[]}
        modelId=""
        onChangeModel={() => undefined}
        modes={[]}
        modeId=""
        onChangeMode={() => undefined}
        transcript={[]}
        inputValue=""
        onInputChange={() => undefined}
        onSend={() => undefined}
        bodySlot={
          <div style={{ padding: '28px 56px 64px', maxWidth: 920, margin: '0 auto', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
            {/* Filter rail + search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              marginBottom: 24, paddingBottom: 14,
              borderBottom: `1px solid ${p.hairlineSoft}`,
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', gap: 0, fontFamily: mono, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: '6px 14px',
                      color: filter === f.id ? p.ink : p.inkMuted,
                      borderBottom: `2px solid ${filter === f.id ? p.accent : 'transparent'}`,
                      transition: 'color .15s, border-color .15s',
                    }}
                  >{f.label}</button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              {/* Archives shortcut — placed right of the filter tabs
                  so the user has a visible escape hatch to retrieve
                  anything they've put away. Stays visible even when
                  the archive count is 0 so users can build a mental
                  map of where archived chats go BEFORE they archive
                  anything. The count badge mirrors the bucket-header
                  pattern below ("today  4") for visual consistency. */}
              <a
                href="/archives"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontFamily: mono, fontSize: 11, letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  padding: '6px 10px',
                  border: `1px solid ${p.hairlineSoft}`,
                  borderRadius: 2,
                  color: p.inkSoft,
                  textDecoration: 'none',
                  transition: 'border-color .15s, color .15s',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = p.hairline
                  ;(e.currentTarget as HTMLElement).style.color = p.ink
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = p.hairlineSoft
                  ;(e.currentTarget as HTMLElement).style.color = p.inkSoft
                }}
              >
                <span>Archives</span>
                <span
                  // Render the badge in `ink` regardless of count so
                  // a "0" reads as "you have an archive folder, it's
                  // currently empty" rather than as a disabled affordance.
                  style={{ color: p.ink, fontWeight: 500 }}
                >{archivedCount}</span>
              </a>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search history…"
                style={{
                  background: p.surface, border: `1px solid ${p.hairline}`,
                  borderRadius: 3, padding: '8px 12px',
                  fontFamily: mono, fontSize: 12, color: p.ink,
                  width: 240, outline: 'none',
                }}
              />
            </div>

            {/* Buckets */}
            {buckets.length === 0 ? (
              <div style={{
                border: `1px solid ${p.hairline}`,
                borderRadius: 3, background: p.surface,
                padding: '40px 32px', textAlign: 'center',
                color: p.inkSoft,
              }}>
                <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 22, color: p.ink, marginBottom: 6 }}>
                  {archivedCount > 0 ? 'Nothing here right now' : 'No conversations yet'}
                </div>
                <div style={{ fontSize: 13, color: p.inkMuted }}>
                  {archivedCount > 0 ? (
                    // Distinguish "no chats anywhere" from "no
                    // ACTIVE chats but you have stuff archived" so a
                    // user who's archived everything doesn't think
                    // their data is gone.
                    <>
                      Start a new thread on the <a href="/text" style={{ color: p.accent }}>chat</a> surface,
                      or restore one from <a href="/archives" style={{ color: p.accent }}>Archives</a> ({archivedCount}).
                    </>
                  ) : (
                    <>Start a thread on the <a href="/text" style={{ color: p.accent }}>chat</a> surface to see it appear here.</>
                  )}
                </div>
              </div>
            ) : buckets.map(([bucket, items]) => (
              <section key={bucket} style={{ marginBottom: 28 }}>
                <header style={{
                  fontFamily: mono, fontSize: 10.5, letterSpacing: '0.2em',
                  textTransform: 'uppercase', color: p.inkMuted,
                  padding: '4px 0', marginBottom: 4,
                }}>{bucket} <span style={{ color: p.ink, marginLeft: 6 }}>{items.length}</span></header>

                <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: `1px solid ${p.hairlineSoft}` }}>
                  {items.map(c => {
                    const mod: Modality = c.modality ?? 'text'
                    const isEditing = editingId === c.id
                    return (
                      <li
                        key={c.id}
                        // `position: relative` is required because
                        // RowActionsMenu positions its popover absolutely
                        // against the nearest positioned ancestor.
                        // Padding-right reserves space for the menu so
                        // it can sit alongside the timestamp without
                        // overlapping the title text on narrow widths.
                        style={{
                          position: 'relative',
                          borderBottom: `1px solid ${p.hairlineSoft}`,
                        }}
                        className="group"
                      >
                        {/* The action menu sits above the row button
                            with z-index so its clicks don't bubble
                            into `open(c)`. RowActionsMenu itself
                            stops propagation on its trigger.

                            The trigger fades in on row hover via the
                            `.group:hover` selector + Tailwind's
                            `group-hover` utilities so the row stays
                            visually quiet at rest, matching the
                            editorial Anthology palette. */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            right: 8,
                            zIndex: 2,
                          }}
                          className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                        >
                          <RowActionsMenu
                            title="Chat actions"
                            side="bottom-right"
                            items={[
                              { key: 'open',    label: 'Open',    icon: RowActionIcons.open,    onSelect: () => open(c) },
                              { key: 'rename',  label: 'Rename',  icon: RowActionIcons.rename,  onSelect: () => startRename(c.id, c.title) },
                              { key: 'archive', label: 'Archive', icon: RowActionIcons.archive, onSelect: () => handleArchive(c.id) },
                              { key: 'delete',  label: 'Delete forever', tone: 'destructive' as const, icon: RowActionIcons.delete, onSelect: () => handleDelete(c.id) },
                            ]}
                          />
                        </div>

                        <button
                          // While inline-editing the title we disable
                          // the row's click-to-open so the user can
                          // interact with the input without being
                          // navigated away mid-edit.
                          onClick={() => { if (!isEditing) open(c) }}
                          // Reserve right padding for the absolutely
                          // positioned menu so it never overlaps the
                          // timestamp/title on narrow viewports.
                          style={{
                            display: 'grid', gridTemplateColumns: '92px 1fr auto',
                            gap: 18, alignItems: 'center',
                            width: '100%', padding: '14px 40px 14px 8px',
                            background: 'transparent', border: 'none', textAlign: 'left',
                            cursor: isEditing ? 'default' : 'pointer', color: p.ink,
                            transition: 'background .15s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = p.surfaceAlt }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        >
                          <span style={{
                            fontFamily: mono, fontSize: 10, letterSpacing: '0.18em',
                            textTransform: 'uppercase', color: p.inkMuted,
                          }}>{MODALITY_LABEL[mod]}</span>

                          <span style={{ minWidth: 0 }}>
                            {isEditing ? (
                              <input
                                autoFocus
                                value={editingTitle}
                                onChange={e => setEditingTitle(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter')   { e.preventDefault(); commitRename() }
                                  if (e.key === 'Escape')  { e.preventDefault(); cancelRename() }
                                }}
                                onBlur={commitRename}
                                // stopPropagation so clicks inside
                                // the input don't trigger the row's
                                // `onClick` (which would navigate).
                                onClick={e => e.stopPropagation()}
                                style={{
                                  display: 'block', width: '100%',
                                  fontFamily: serif, fontSize: 15, lineHeight: 1.4,
                                  background: 'transparent',
                                  border: 'none', borderBottom: `1px solid ${p.ink}`,
                                  outline: 'none', color: p.ink, padding: '0 0 2px',
                                }}
                              />
                            ) : (
                              <span style={{
                                display: 'block',
                                fontFamily: serif, fontSize: 15, lineHeight: 1.4,
                                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                              }}>{c.title || 'Untitled'}</span>
                            )}
                            <span style={{
                              display: 'block',
                              fontFamily: mono, fontSize: 10.5, color: p.inkMuted,
                              letterSpacing: '0.06em', marginTop: 2,
                            }}>{c.model.toLowerCase()}</span>
                          </span>

                          <span style={{
                            fontFamily: mono, fontSize: 11, color: p.inkMuted,
                            letterSpacing: '0.04em',
                          }}>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        }
      />
    </div>
  )
}

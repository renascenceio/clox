'use client'

import { useEffect, useMemo, useState } from 'react'

import ChatWorkspace, { type RailRecentItem } from '@/shared/ui/chat/ChatWorkspace'
import { useChatChrome } from '@/shared/ui/chat/useChatChrome'
import { PALETTES } from '@/shared/ui/chat/palettes'
import { listChats, type Chat, type Modality } from '@/lib/chat-store'

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
  useEffect(() => {
    setChats(listChats().sort((a, b) => b.createdAt - a.createdAt))
    function refresh() { setChats(listChats().sort((a, b) => b.createdAt - a.createdAt)) }
    window.addEventListener('storage', refresh)
    window.addEventListener('clox-chats-changed', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('clox-chats-changed', refresh)
    }
  }, [])

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
    const route = mod === 'text' ? '/text' : mod === 'image' ? '/image' : mod === 'video' ? '/video' : '/audio'
    chrome.router.push(route)
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
                  No conversations yet
                </div>
                <div style={{ fontSize: 13, color: p.inkMuted }}>
                  Start a thread on the <a href="/text" style={{ color: p.accent }}>chat</a> surface to see it appear here.
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
                    return (
                      <li key={c.id} style={{ borderBottom: `1px solid ${p.hairlineSoft}` }}>
                        <button
                          onClick={() => open(c)}
                          style={{
                            display: 'grid', gridTemplateColumns: '92px 1fr auto',
                            gap: 18, alignItems: 'center',
                            width: '100%', padding: '14px 8px',
                            background: 'transparent', border: 'none', textAlign: 'left',
                            cursor: 'pointer', color: p.ink,
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
                            <span style={{
                              display: 'block',
                              fontFamily: serif, fontSize: 15, lineHeight: 1.4,
                              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                            }}>{c.title || 'Untitled'}</span>
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

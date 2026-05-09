'use client'

import { useEffect, useMemo, useState } from 'react'

import ChatWorkspace from '@/shared/ui/chat/ChatWorkspace'
import { useChatChrome } from '@/shared/ui/chat/useChatChrome'
import { PALETTES, type Palette } from '@/shared/ui/chat/palettes'
import { listChats, loadHistory, type Chat, type Modality } from '@/lib/chat-store'

type GalleryItem = {
  kind: 'image' | 'video' | 'audio'
  id: string
  url: string
  thumbnail?: string
  prompt: string
  model: string
  ratio?: string
  duration?: number
  createdAt: number
  chatId: string
  chatTitle: string
}

const TABS: { id: 'all' | 'image' | 'video' | 'audio'; label: string }[] = [
  { id: 'all',   label: 'All' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Voice' },
]

export default function GalleryPage() {
  const chrome = useChatChrome('gallery')
  const p = PALETTES[chrome.theme]
  const mono = `'Geist Mono', ui-monospace, monospace`
  const serif = `'Newsreader', Georgia, serif`

  const [items, setItems] = useState<GalleryItem[]>([])
  const [tab, setTab] = useState<'all' | 'image' | 'video' | 'audio'>('all')

  useEffect(() => {
    function refresh() {
      const chats = listChats()
      const out: GalleryItem[] = []

      for (const c of chats) {
        const mod: Modality = c.modality ?? 'text'
        if (mod === 'text') continue

        const history = loadHistory<Record<string, unknown>>(mod, c.id)
        for (const raw of history) {
          const url = typeof raw.url === 'string' ? raw.url : ''
          if (!url) continue
          const item: GalleryItem = {
            kind: mod,
            id: typeof raw.id === 'string' ? raw.id : `${c.id}-${out.length}`,
            url,
            thumbnail: typeof raw.thumbnail === 'string' ? raw.thumbnail : undefined,
            prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
            model: typeof raw.model === 'string'
              ? raw.model
              : typeof raw.brand === 'string' && typeof raw.version === 'string'
                ? `${raw.brand} ${raw.version}`
                : c.model,
            ratio: typeof raw.ratio === 'string' ? raw.ratio : undefined,
            duration: typeof raw.duration === 'number' ? raw.duration : undefined,
            createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : c.createdAt,
            chatId: c.id,
            chatTitle: c.title,
          }
          out.push(item)
        }
      }

      out.sort((a, b) => b.createdAt - a.createdAt)
      setItems(out)
    }
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('clox-chats-changed', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('clox-chats-changed', refresh)
    }
  }, [])

  const filtered = useMemo(
    () => tab === 'all' ? items : items.filter(i => i.kind === tab),
    [items, tab],
  )

  function open(it: GalleryItem) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`activeChatId:${it.kind}`, it.chatId)
    }
    chrome.router.push(it.kind === 'image' ? '/image' : it.kind === 'video' ? '/video' : '/audio')
  }

  // Recent text chats — keep the rail's "recent threads" useful even though
  // we're on the gallery surface.
  const recent = listChats()
    .filter(c => (c.modality ?? 'text') === 'text')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6)
    .map((c: Chat) => ({
      id: c.id,
      title: c.title,
      meta: new Date(c.createdAt).toLocaleString([], { month: 'short', day: 'numeric' }) + ' · ' + c.model.toLowerCase(),
      onClick: () => {
        if (typeof window !== 'undefined') localStorage.setItem('activeChatId:text', c.id)
        chrome.router.push('/text')
      },
    }))

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
        breadcrumb="library · gallery"
        title="Gallery"
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
          <div style={{ padding: '28px 56px 64px', maxWidth: 1140, margin: '0 auto' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              marginBottom: 24, paddingBottom: 14,
              borderBottom: `1px solid ${p.hairlineSoft}`,
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', gap: 0, fontFamily: mono, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: '6px 14px',
                      color: tab === t.id ? p.ink : p.inkMuted,
                      borderBottom: `2px solid ${tab === t.id ? p.accent : 'transparent'}`,
                      transition: 'color .15s, border-color .15s',
                    }}
                  >{t.label}</button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: mono, fontSize: 11, color: p.inkMuted, letterSpacing: '0.06em' }}>
                {filtered.length} item{filtered.length === 1 ? '' : 's'}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div style={{
                border: `1px solid ${p.hairline}`,
                borderRadius: 3, background: p.surface,
                padding: '48px 32px', textAlign: 'center',
                color: p.inkSoft,
              }}>
                <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 22, color: p.ink, marginBottom: 6 }}>
                  Nothing here yet
                </div>
                <div style={{ fontSize: 13, color: p.inkMuted, marginBottom: 18 }}>
                  Generate something on the <a href="/image" style={{ color: p.accent }}>image</a>, <a href="/video" style={{ color: p.accent }}>video</a> or <a href="/audio" style={{ color: p.accent }}>voice</a> surfaces and it will collect here.
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 18,
              }}>
                {filtered.map(it => (
                  <button
                    key={`${it.kind}-${it.id}`}
                    onClick={() => open(it)}
                    style={{
                      position: 'relative',
                      background: p.surface,
                      border: `1px solid ${p.hairline}`,
                      borderRadius: 3, overflow: 'hidden',
                      padding: 0, textAlign: 'left',
                      aspectRatio: '4 / 5',
                      cursor: 'pointer', color: p.ink,
                      transition: 'transform .15s, box-shadow .15s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'translateY(-2px)'
                      el.style.boxShadow = `0 14px 36px ${p.hairline}`
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.transform = 'none'
                      el.style.boxShadow = 'none'
                    }}
                  >
                    <Tile p={p} mono={mono} serif={serif} item={it} />
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />
    </div>
  )
}

function Tile({
  p, mono, serif, item,
}: {
  p: Palette
  mono: string
  serif: string
  item: GalleryItem
}) {
  return (
    <>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: p.surfaceAlt }}>
        {item.kind === 'image' && (
          // Plain <img> is fine here — the URL is user-generated and we don't
          // want the next/image strict-domain whitelist getting in the way.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.prompt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        {item.kind === 'video' && (
          <video src={item.url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        {item.kind === 'audio' && (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: p.inkSoft, fontFamily: serif, fontStyle: 'italic',
            fontSize: 30, background: p.surface,
          }}>♫</div>
        )}

        <span style={{
          position: 'absolute', top: 8, left: 8,
          fontFamily: mono, fontSize: 9.5, letterSpacing: '0.18em',
          textTransform: 'uppercase',
          background: p.ink, color: p.bg,
          padding: '3px 7px', borderRadius: 2,
        }}>
          {item.kind}
        </span>
      </div>

      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{
          fontFamily: serif, fontSize: 13, lineHeight: 1.35,
          color: p.ink,
          display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
          overflow: 'hidden',
        }}>{item.prompt || 'Untitled'}</div>
        <div style={{
          marginTop: 6, fontFamily: mono, fontSize: 10, letterSpacing: '0.08em',
          color: p.inkMuted, display: 'flex', justifyContent: 'space-between', gap: 6,
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.model}</span>
          <span>{new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>
    </>
  )
}

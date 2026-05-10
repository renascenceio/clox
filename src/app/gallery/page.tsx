'use client'

import { useEffect, useMemo, useState } from 'react'

import ChatWorkspace from '@/shared/ui/chat/ChatWorkspace'
import { useChatChrome } from '@/shared/ui/chat/useChatChrome'
import { PALETTES, type Palette } from '@/shared/ui/chat/palettes'
import {
  listChats,
  loadHistory,
  setGenerationArchived,
  permanentlyDeleteGeneration,
  type Chat,
  type Modality,
} from '@/lib/chat-store'
import {
  type Collection,
  listCollections,
  createCollection,
  renameCollection,
  deleteCollection,
  addToCollection,
  removeFromCollection,
} from '@/lib/collections-store'
import RowActionsMenu, { RowActionIcons } from '@/shared/ui/components/RowActionsMenu'

// ---------------------------------------------------------------------------
// /gallery — every image / video / audio generation the signed-in user has
// produced, gathered from per-chat history buckets. Editorial-grade list,
// hairlines only, with three-dots menus on tiles.
//
// Surfaces:
//   • Tab strip       — all / images / video / voice → filters tiles
//   • Sub-strip       — generations · collections    → switches what's listed
//   • Tile menu       — Add to collection / Archive / Delete
//   • Collection grid — albums of generations grouped by user
//
// Source of truth:
//   - Generations live in their chat-history buckets (per modality / per
//     chat). The archive flag rides on the history record (`_archived`).
//   - Collections live in `lib/collections-store` (localStorage).
// ---------------------------------------------------------------------------

type GalleryItem = {
  kind: 'image' | 'video' | 'audio'
  id: string
  /** Stable id we use for menu actions. Falls back to URL when the
   *  underlying record predates id stamping. */
  itemId?: string
  url: string
  thumbnail?: string
  prompt: string
  model: string
  ratio?: string
  duration?: number
  createdAt: number
  chatId: string
  chatTitle: string
  archived: boolean
}

type KindFilter = 'all' | 'image' | 'video' | 'audio'

const TABS: { id: KindFilter; label: string }[] = [
  { id: 'all',   label: 'All' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Voice' },
]

type View = 'generations' | 'collections'

export default function GalleryPage() {
  const chrome = useChatChrome('gallery')
  const p = PALETTES[chrome.theme]
  const mono = `'Geist Mono', ui-monospace, monospace`
  const serif = `'Newsreader', Georgia, serif`

  const [items, setItems] = useState<GalleryItem[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [tab, setTab] = useState<KindFilter>('all')
  const [view, setView] = useState<View>('generations')

  // Refresh function — reads chats + their per-modality history buckets and
  // flattens into one timeline. Run on mount and whenever the chat store or
  // a sibling tab signals a change.
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
          const itemId = typeof raw.id === 'string' ? raw.id : undefined
          const item: GalleryItem = {
            kind: mod,
            id: itemId ?? `${c.id}-${out.length}`,
            itemId,
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
            archived: raw._archived === true,
          }
          out.push(item)
        }
      }

      out.sort((a, b) => b.createdAt - a.createdAt)
      setItems(out)
    }
    refresh()
    setCollections(listCollections())
    const onChats = () => refresh()
    const onCollections = () => setCollections(listCollections())
    window.addEventListener('storage', onChats)
    window.addEventListener('clox-chats-changed', onChats)
    window.addEventListener('clox-collections-changed', onCollections)
    return () => {
      window.removeEventListener('storage', onChats)
      window.removeEventListener('clox-chats-changed', onChats)
      window.removeEventListener('clox-collections-changed', onCollections)
    }
  }, [])

  // Filter pipeline — first by view, then by kind, hiding archived items.
  const visible = useMemo(() => items.filter(i => !i.archived), [items])
  const filteredGenerations = useMemo(
    () => tab === 'all' ? visible : visible.filter(i => i.kind === tab),
    [visible, tab],
  )
  const filteredCollections = useMemo(
    () => tab === 'all' ? collections : collections.filter(c => c.kind === tab || c.kind === 'mixed'),
    [collections, tab],
  )

  // Tile actions ---------------------------------------------------------
  function open(it: GalleryItem) {
    if (typeof window !== 'undefined') {
      // Stash the originating chat id so /text can rehydrate the same
      // thread on landing. Modality is read off the chat record, not
      // the URL — the slash-menu mode picker takes it from there.
      localStorage.setItem(`activeChatId:${it.kind}`, it.chatId)
    }
    chrome.router.push('/text')
  }
  function archiveItem(it: GalleryItem) {
    setGenerationArchived(it.kind, it.chatId, { id: it.itemId, url: it.url }, true)
  }
  function deleteItem(it: GalleryItem) {
    if (!window.confirm('Permanently delete this generation? This cannot be undone.')) return
    permanentlyDeleteGeneration(it.kind, it.chatId, { id: it.itemId, url: it.url })
  }

  // Recent text chats — keep the rail's "recent threads" useful even though
  // we're on the gallery surface.
  const recent = listChats()
    .filter(c => (c.modality ?? 'text') === 'text' && !c.archived)
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
        onSeeAllRecent={chrome.onSeeAllRecent}
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
            {/* Top tab strip — kind filter (all / images / video / voice). */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              marginBottom: 14, paddingBottom: 14,
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
                {view === 'generations' ? `${filteredGenerations.length} item${filteredGenerations.length === 1 ? '' : 's'}` : `${filteredCollections.length} collection${filteredCollections.length === 1 ? '' : 's'}`}
              </span>
            </div>

            {/* Sub-strip — generations vs. collections. Mirrors editorial sub-nav patterns. */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 22,
              marginBottom: 24,
              fontFamily: mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>
              {(['generations', 'collections'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: 0,
                    color: view === v ? p.ink : p.inkMuted,
                    fontWeight: view === v ? 600 : 400,
                    transition: 'color .15s',
                  }}
                >
                  {v}
                </button>
              ))}
              {view === 'collections' && (
                <NewCollectionInline p={p} mono={mono} kindHint={tab === 'all' ? 'mixed' : tab} />
              )}
            </div>

            {/* Body */}
            {view === 'generations' ? (
              <GenerationsBody
                p={p} mono={mono} serif={serif}
                items={filteredGenerations}
                collections={collections}
                open={open}
                archive={archiveItem}
                deleteItem={deleteItem}
              />
            ) : (
              <CollectionsBody
                p={p} mono={mono} serif={serif}
                collections={filteredCollections}
                items={visible}
                open={open}
              />
            )}
          </div>
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generations grid
// ---------------------------------------------------------------------------

function GenerationsBody({
  p, mono, serif, items, collections, open, archive, deleteItem,
}: {
  p: Palette
  mono: string
  serif: string
  items: GalleryItem[]
  collections: Collection[]
  open: (it: GalleryItem) => void
  archive: (it: GalleryItem) => void
  deleteItem: (it: GalleryItem) => void
}) {
  if (items.length === 0) {
    return (
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
          Open <a href="/text" style={{ color: p.accent }}>chat</a> and pick image, video, or voice from the slash menu — your generations will collect here.
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 18,
    }}>
      {items.map(it => (
        <div
          key={`${it.kind}-${it.id}`}
          className="group"
          style={{ position: 'relative' }}
        >
          <button
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
              width: '100%',
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

          {/* Three-dots menu — appears on hover. Clicking does not navigate
              because RowActionsMenu's trigger calls stopPropagation on click. */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <RowActionsMenu
              title="Generation actions"
              side="bottom-right"
              items={[
                { key: 'open', label: 'Open in editor', icon: RowActionIcons.open, onSelect: () => open(it) },
                {
                  key: 'add', label: 'Add to collection…',
                  icon: RowActionIcons.collection,
                  onSelect: () => {
                    if (collections.length === 0) {
                      const name = window.prompt('Name the new collection')
                      if (!name?.trim()) return
                      const c = createCollection({ name: name.trim(), kind: it.kind })
                      addToCollection(c.id, { kind: it.kind, chatId: it.chatId, itemId: it.itemId, url: it.url })
                      return
                    }
                    // Pick from existing OR create new — minimal prompt, no
                    // bespoke modal. Users with a long collections list can
                    // type its name; "+" creates a fresh one.
                    const choice = window.prompt(
                      [
                        'Pick a collection by typing its name, or "+ NewName" to create one.',
                        '',
                        'Available:',
                        ...collections.map(c => ` · ${c.name}`),
                      ].join('\n'),
                    )
                    if (!choice?.trim()) return
                    if (choice.startsWith('+')) {
                      const name = choice.slice(1).trim()
                      if (!name) return
                      const c = createCollection({ name, kind: it.kind })
                      addToCollection(c.id, { kind: it.kind, chatId: it.chatId, itemId: it.itemId, url: it.url })
                    } else {
                      const target = collections.find(c => c.name.toLowerCase() === choice.trim().toLowerCase())
                      if (!target) {
                        window.alert(`No collection called "${choice}".`)
                        return
                      }
                      addToCollection(target.id, { kind: it.kind, chatId: it.chatId, itemId: it.itemId, url: it.url })
                    }
                  },
                },
                { key: 'archive', label: 'Archive', icon: RowActionIcons.archive, onSelect: () => archive(it) },
                { key: 'delete', label: 'Delete', icon: RowActionIcons.delete, tone: 'destructive', onSelect: () => deleteItem(it) },
              ]}
            />
          </div>
        </div>
      ))}
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

// ---------------------------------------------------------------------------
// Collections grid + inline create button
// ---------------------------------------------------------------------------

function NewCollectionInline({
  p, mono, kindHint,
}: { p: Palette; mono: string; kindHint: 'image' | 'video' | 'audio' | 'mixed' }) {
  return (
    <button
      onClick={() => {
        const name = window.prompt('Name your collection')
        if (!name?.trim()) return
        createCollection({ name: name.trim(), kind: kindHint })
      }}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: 0, marginLeft: 'auto',
        fontFamily: mono, fontSize: 10, letterSpacing: '0.18em',
        textTransform: 'uppercase', color: p.accent,
      }}
    >
      + new collection
    </button>
  )
}

function CollectionsBody({
  p, mono, serif, collections, items, open,
}: {
  p: Palette
  mono: string
  serif: string
  collections: Collection[]
  items: GalleryItem[]
  open: (it: GalleryItem) => void
}) {
  if (collections.length === 0) {
    return (
      <div style={{
        border: `1px solid ${p.hairline}`,
        borderRadius: 3, background: p.surface,
        padding: '48px 32px', textAlign: 'center',
        color: p.inkSoft,
      }}>
        <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 22, color: p.ink, marginBottom: 6 }}>
          No collections yet
        </div>
        <div style={{ fontSize: 13, color: p.inkMuted }}>
          Hit <em>+ new collection</em> above, then add generations from the menu on each tile.
        </div>
      </div>
    )
  }

  // Resolve refs to the up-to-date GalleryItem so previews stay accurate
  // after archiving / deleting underlying generations.
  function resolveRefs(c: Collection): GalleryItem[] {
    const found: GalleryItem[] = []
    for (const r of c.refs) {
      const hit = items.find(it =>
        it.chatId === r.chatId &&
        ((r.itemId && it.itemId === r.itemId) || (r.url && it.url === r.url)),
      )
      if (hit) found.push(hit)
    }
    return found
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: 18,
    }}>
      {collections.map(c => {
        const refs = resolveRefs(c)
        const cover = refs.slice(0, 4)
        return (
          <div
            key={c.id}
            className="group"
            style={{
              position: 'relative',
              background: p.surface, border: `1px solid ${p.hairline}`,
              borderRadius: 3, overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: cover.length > 1 ? 'repeat(2, 1fr)' : '1fr',
              gridTemplateRows: cover.length > 2 ? 'repeat(2, 1fr)' : '1fr',
              aspectRatio: '5 / 3',
              gap: 1,
              background: p.hairlineSoft,
            }}>
              {cover.length === 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: p.inkMuted, fontFamily: mono, fontSize: 11, letterSpacing: '0.16em',
                  textTransform: 'uppercase', background: p.surfaceAlt,
                }}>
                  empty
                </div>
              )}
              {cover.map(it => (
                <div
                  key={it.id}
                  onClick={() => open(it)}
                  style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer', background: p.surfaceAlt }}
                >
                  {it.kind === 'image' && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.url} alt={it.prompt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  {it.kind === 'video' && (
                    <video src={it.url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  {it.kind === 'audio' && (
                    <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: p.inkSoft, fontFamily: serif, fontStyle: 'italic',
                      fontSize: 28,
                    }}>♫</div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 14px 14px' }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
              }}>
                <div style={{ fontFamily: serif, fontSize: 17, color: p.ink, lineHeight: 1.2, fontStyle: 'italic' }}>
                  {c.name}
                </div>
                <span style={{ fontFamily: mono, fontSize: 10, color: p.inkMuted, letterSpacing: '0.08em' }}>
                  {refs.length}
                </span>
              </div>
              <div style={{
                fontFamily: mono, fontSize: 10, color: p.inkMuted,
                marginTop: 6, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                {c.kind} · {new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </div>
            </div>

            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <RowActionsMenu
                title="Collection actions"
                side="bottom-right"
                items={[
                  {
                    key: 'rename', label: 'Rename', icon: RowActionIcons.rename,
                    onSelect: () => {
                      const next = window.prompt('Rename collection', c.name)
                      if (!next?.trim()) return
                      renameCollection(c.id, next.trim())
                    },
                  },
                  ...(refs.length > 0 ? [{
                    key: 'remove-last' as const, label: 'Remove last item',
                    icon: RowActionIcons.delete,
                    onSelect: () => {
                      const last = c.refs[0]
                      if (!last) return
                      removeFromCollection(c.id, { chatId: last.chatId, itemId: last.itemId, url: last.url })
                    },
                  }] : []),
                  {
                    key: 'delete', label: 'Delete collection',
                    icon: RowActionIcons.delete, tone: 'destructive' as const,
                    onSelect: () => {
                      if (!window.confirm(`Delete the collection "${c.name}"? Underlying generations are kept.`)) return
                      deleteCollection(c.id)
                    },
                  },
                ]}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

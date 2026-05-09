'use client'

/**
 * Archives — single home for chats, projects, and gallery items that the user
 * has tucked away from the active surfaces. The point is that "archive" is the
 * gentle, reversible counterpart to "delete": archived things are out of the
 * way but still findable, restorable, and permanently deletable from here.
 *
 * Sources we surface:
 *   - chats         — flagged with `chat.archived = true` in chat-store
 *   - projects      — DB rows where `archived_at` is non-null
 *   - generations   — history items inside any chat with `_archived = true`
 *
 * The page mounts the standard AppLayout so the sidebar / search / nav stay
 * consistent with the rest of the app.
 */

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar from '@/shared/ui/layout/ChatSidebar'
import RowActionsMenu, { RowActionIcons } from '@/shared/ui/components/RowActionsMenu'
import {
  Chat,
  Modality,
  listChats,
  listArchivedChats,
  unarchiveChat,
  permanentlyDeleteChat,
  loadHistory,
  setGenerationArchived,
  permanentlyDeleteGeneration,
  type ArchivableGeneration,
} from '@/lib/chat-store'

type Tab = 'chats' | 'projects' | 'generations'

interface DbProject {
  id: string
  title: string
  description?: string | null
  archived_at?: string | null
  my_role?: string | null
}

interface ArchivedGenerationRow {
  modality: Modality
  chatId: string
  chatTitle: string
  item: ArchivableGeneration & {
    prompt?: string
    createdAt?: number
    duration?: number
    voice?: string
    model?: string
  }
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'chats',       label: 'Chats' },
  { id: 'projects',    label: 'Projects' },
  { id: 'generations', label: 'Generations' },
]

export default function ArchivesPage() {
  const [tab, setTab] = useState<Tab>('chats')

  // ---- Chats ----
  const [archivedChats, setArchivedChats] = useState<Chat[]>([])
  const refreshChats = useCallback(() => {
    setArchivedChats(listArchivedChats().sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)))
  }, [])
  useEffect(() => {
    refreshChats()
    const onChange = () => refreshChats()
    window.addEventListener('clox-chats-changed', onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('clox-chats-changed', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [refreshChats])

  // ---- Projects ----
  const [archivedProjects, setArchivedProjects] = useState<DbProject[] | null>(null)
  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects?include=archived', { cache: 'no-store' })
      if (!res.ok) { setArchivedProjects([]); return }
      const body = await res.json().catch(() => ({}))
      const list = (body.projects ?? []) as DbProject[]
      setArchivedProjects(list.filter(p => p.archived_at))
    } catch { setArchivedProjects([]) }
  }, [])
  useEffect(() => {
    void refreshProjects()
    const onChange = () => { void refreshProjects() }
    window.addEventListener('clox-projects-changed', onChange)
    return () => window.removeEventListener('clox-projects-changed', onChange)
  }, [refreshProjects])

  // ---- Generations ---- (walk every non-text chat history bucket)
  const [archivedGens, setArchivedGens] = useState<ArchivedGenerationRow[]>([])
  const refreshGenerations = useCallback(() => {
    const out: ArchivedGenerationRow[] = []
    for (const chat of listChats()) {
      const modality = chat.modality ?? 'text'
      if (modality === 'text') continue
      const items = loadHistory<ArchivableGeneration & {
        prompt?: string; createdAt?: number; duration?: number; voice?: string; model?: string
      }>(modality, chat.id)
      for (const it of items) {
        if (it._archived) {
          out.push({ modality, chatId: chat.id, chatTitle: chat.title, item: it })
        }
      }
    }
    out.sort((a, b) => (b.item._archivedAt ?? 0) - (a.item._archivedAt ?? 0))
    setArchivedGens(out)
  }, [])
  useEffect(() => {
    refreshGenerations()
    const onChange = () => refreshGenerations()
    window.addEventListener('clox-chats-changed', onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('clox-chats-changed', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [refreshGenerations])

  // ---- Chat row mutators ----
  const handleRestoreChat = useCallback((id: string) => {
    unarchiveChat(id)
    refreshChats()
  }, [refreshChats])
  const handleDeleteChat = useCallback((id: string) => {
    if (!window.confirm('Delete this chat permanently? This cannot be undone.')) return
    permanentlyDeleteChat(id)
    refreshChats()
  }, [refreshChats])

  // ---- Project mutators ----
  const handleRestoreProject = useCallback(async (id: string) => {
    setArchivedProjects(prev => prev?.filter(p => p.id !== id) ?? prev)
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      })
      if (!res.ok) throw new Error()
      window.dispatchEvent(new CustomEvent('clox-projects-changed'))
    } catch { void refreshProjects() }
  }, [refreshProjects])
  const handleDeleteProject = useCallback(async (id: string) => {
    if (!window.confirm('Permanently delete this project? Members, settings, and budget records are removed. Linked chats stay.')) return
    setArchivedProjects(prev => prev?.filter(p => p.id !== id) ?? prev)
    try {
      const res = await fetch(`/api/projects/${id}?hard=1`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      window.dispatchEvent(new CustomEvent('clox-projects-changed'))
    } catch { void refreshProjects() }
  }, [refreshProjects])

  // ---- Generation mutators ----
  const handleRestoreGeneration = useCallback((row: ArchivedGenerationRow) => {
    setGenerationArchived(row.modality, row.chatId, { id: row.item.id, url: row.item.url }, false)
  }, [])
  const handleDeleteGeneration = useCallback((row: ArchivedGenerationRow) => {
    if (!window.confirm('Delete this generation permanently?')) return
    permanentlyDeleteGeneration(row.modality, row.chatId, { id: row.item.id, url: row.item.url })
  }, [])

  // ---- Counts ----
  const counts = useMemo(() => ({
    chats: archivedChats.length,
    projects: archivedProjects?.length ?? 0,
    generations: archivedGens.length,
  }), [archivedChats, archivedProjects, archivedGens])

  return (
    <AppLayout sidebar={<ChatSidebar />}>
      <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
        <header className="px-8 pt-10 pb-6 border-b border-hairline-soft">
          <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-muted mb-2">
            archives
          </div>
          <h1 className="font-serif italic text-[34px] tracking-[-0.012em] leading-[1.05] text-ink">
            Tucked away, but not gone.
          </h1>
          <p className="mt-3 max-w-[60ch] text-[13.5px] leading-[1.6] text-ink-soft">
            Archive is reversible. Anything in here can be restored to its original surface, or
            permanently deleted from this page. Chats, projects, and individual generations all
            land in the same drawer.
          </p>
        </header>

        {/* Tabs — same chrome as Gallery so the two surfaces feel paired. */}
        <div className="px-8 pt-5">
          <div className="flex items-center gap-1 border-b border-hairline-soft">
            {TABS.map(t => {
              const active = tab === t.id
              const count = counts[t.id]
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`relative px-3 py-2.5 text-[12.5px] tracking-[0.01em] transition-colors ${
                    active ? 'text-ink' : 'text-ink-muted hover:text-ink-soft'
                  }`}
                >
                  <span className="font-medium">{t.label}</span>
                  <span className="ml-1.5 font-mono text-[10px] tracking-[0.06em] text-ink-muted">
                    {count}
                  </span>
                  {active && <span className="absolute left-0 right-0 -bottom-px h-px bg-ink" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="px-8 py-6">
          {tab === 'chats' && (
            <ChatsTab
              rows={archivedChats}
              onRestore={handleRestoreChat}
              onDelete={handleDeleteChat}
            />
          )}
          {tab === 'projects' && (
            <ProjectsTab
              loading={archivedProjects === null}
              rows={archivedProjects ?? []}
              onRestore={handleRestoreProject}
              onDelete={handleDeleteProject}
            />
          )}
          {tab === 'generations' && (
            <GenerationsTab
              rows={archivedGens}
              onRestore={handleRestoreGeneration}
              onDelete={handleDeleteGeneration}
            />
          )}
        </div>
      </div>
    </AppLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Chats tab
// ─────────────────────────────────────────────────────────────────────────────

function ChatsTab({
  rows, onRestore, onDelete,
}: {
  rows: Chat[]
  onRestore: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (rows.length === 0) return <EmptyState label="No archived chats." />
  return (
    <ul className="divide-y divide-hairline-soft border border-hairline-soft rounded-sharp overflow-hidden">
      {rows.map(c => (
        <li key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-rail-soft/40 transition-colors">
          <ModalityBadge modality={c.modality ?? 'text'} />
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] text-ink truncate">{c.title}</div>
            <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted mt-0.5">
              {c.model.toLowerCase()} · archived {formatTime(c.archivedAt)}
            </div>
          </div>
          <RowActionsMenu
            title="Archived chat actions"
            items={[
              { key: 'restore', label: 'Restore',          icon: RowActionIcons.unarchive, onSelect: () => onRestore(c.id) },
              { key: 'delete',  label: 'Delete forever',   icon: RowActionIcons.delete,    tone: 'destructive', onSelect: () => onDelete(c.id) },
            ]}
          />
        </li>
      ))}
    </ul>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects tab
// ─────────────────────────────────────────────────────────────────────────────

function ProjectsTab({
  loading, rows, onRestore, onDelete,
}: {
  loading: boolean
  rows: DbProject[]
  onRestore: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  if (loading) return <EmptyState label="Loading…" />
  if (rows.length === 0) return <EmptyState label="No archived projects." />
  return (
    <ul className="divide-y divide-hairline-soft border border-hairline-soft rounded-sharp overflow-hidden">
      {rows.map(p => {
        const canDelete = p.my_role === 'owner'
        const canRestore = p.my_role === 'owner' || p.my_role === 'admin'
        return (
          <li key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-rail-soft/40 transition-colors">
            <span className="w-8 text-center font-mono text-[10px] tracking-[0.06em] text-ink-muted">
              {(p.my_role ?? 'viewer').slice(0, 3)}
            </span>
            <div className="flex-1 min-w-0">
              <Link href={`/projects/${p.id}`} className="text-[13.5px] text-ink hover:underline truncate block">
                {p.title}
              </Link>
              {p.description && (
                <div className="text-[11.5px] text-ink-muted truncate mt-0.5">{p.description}</div>
              )}
              <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted mt-0.5">
                archived {formatTime(p.archived_at ? new Date(p.archived_at).getTime() : undefined)}
              </div>
            </div>
            <RowActionsMenu
              title="Archived project actions"
              items={[
                ...(canRestore ? [{ key: 'restore', label: 'Restore', icon: RowActionIcons.unarchive, onSelect: () => { void onRestore(p.id) } }] : []),
                ...(canDelete  ? [{ key: 'delete',  label: 'Delete forever', icon: RowActionIcons.delete, tone: 'destructive' as const, onSelect: () => { void onDelete(p.id) } }] : []),
              ]}
            />
          </li>
        )
      })}
    </ul>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Generations tab
// ─────────────────────────────────────────────────────────────────────────────

function GenerationsTab({
  rows, onRestore, onDelete,
}: {
  rows: ArchivedGenerationRow[]
  onRestore: (row: ArchivedGenerationRow) => void
  onDelete: (row: ArchivedGenerationRow) => void
}) {
  if (rows.length === 0) return <EmptyState label="No archived generations." />
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {rows.map((row, idx) => {
        const url = row.item.url
        return (
          <div key={`${row.chatId}-${row.item.id ?? idx}`} className="group relative bg-surface border border-hairline-soft rounded-sharp overflow-hidden">
            <div className="aspect-square bg-rail-soft flex items-center justify-center">
              {row.modality === 'image' && url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={row.item.prompt ?? ''} className="w-full h-full object-cover" />
              )}
              {row.modality === 'video' && url && (
                <video src={url} className="w-full h-full object-cover" muted loop playsInline />
              )}
              {row.modality === 'audio' && (
                <div className="font-serif italic text-[24px] text-ink-soft">audio</div>
              )}
            </div>
            <div className="p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <ModalityBadge modality={row.modality} small />
                <span className="font-mono text-[9.5px] tracking-[0.06em] text-ink-muted truncate">
                  {row.chatTitle}
                </span>
              </div>
              {row.item.prompt && (
                <div className="text-[11.5px] text-ink-soft line-clamp-2">{row.item.prompt}</div>
              )}
            </div>
            <div className="absolute top-1.5 right-1.5">
              <RowActionsMenu
                title="Archived generation actions"
                items={[
                  { key: 'restore', label: 'Restore',        icon: RowActionIcons.unarchive, onSelect: () => onRestore(row) },
                  { key: 'delete',  label: 'Delete forever', icon: RowActionIcons.delete,    tone: 'destructive', onSelect: () => onDelete(row) },
                ]}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Bits
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="border border-dashed border-hairline-soft rounded-sharp px-8 py-16 flex flex-col items-center justify-center text-center">
      <div className="font-serif italic text-[18px] text-ink-soft mb-2">{label}</div>
      <div className="font-mono text-[10.5px] tracking-[0.06em] text-ink-muted max-w-[40ch]">
        Anything you archive from chats, projects, or the gallery will appear here.
      </div>
    </div>
  )
}

function ModalityBadge({ modality, small = false }: { modality: Modality; small?: boolean }) {
  const label =
    modality === 'image' ? 'IMG' :
    modality === 'video' ? 'VID' :
    modality === 'audio' ? 'AUD' : 'TXT'
  return (
    <span
      className={`inline-flex items-center justify-center font-mono tracking-[0.08em] border border-hairline-soft text-ink-muted ${
        small ? 'text-[8.5px] px-1.5 py-0.5' : 'text-[9.5px] px-2 py-1'
      }`}
    >
      {label}
    </span>
  )
}

function formatTime(ts?: number) {
  if (!ts) return 'recently'
  const diff = Date.now() - ts
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return 'today'
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
  return new Date(ts).toLocaleDateString()
}

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// /projects shares the editorial chrome with /history, /gallery, /skills,
// /settings. The shell is `ChatWorkspace` driven by `useChatChrome`, which
// gives us the four-item topstrip nav (Projects · Chats · History · Gallery)
// AND the uniform left rail spacing every other library page uses. The old
// AppLayout-only wrapping made History disappear from the topstrip and
// produced a slightly different rail gutter on project routes.
import ChatWorkspace, { type RailRecentItem } from '@/shared/ui/chat/ChatWorkspace'
import { useChatChrome } from '@/shared/ui/chat/useChatChrome'
import { listChats } from '@/lib/chat-store'
import RowActionsMenu, { RowActionIcons } from '@/shared/ui/components/RowActionsMenu'

// ---------------------------------------------------------------------------
// /projects — index of all projects the signed-in user owns or belongs to.
//
// Editorial: white space, hairlines, mono captions, serif italic headlines.
// No "card" rounded boxes. Every project is a row with a left-side numbered
// rule, a budget meter built from a single hairline + accent fill, and a
// member dot stack on the right.
// ---------------------------------------------------------------------------

type ProjectRow = {
  id: string
  title: string
  description: string | null
  owner_id: string
  owner_email: string | null
  owner_domain: string | null
  default_modality: string
  credit_budget_usd: number | null
  credit_spent_usd: number
  budget_period: 'lifetime' | 'monthly'
  archived_at: string | null
  allow_external: boolean
  last_activity_at: string
  created_at: string
  member_count: number
  chat_count: number
  my_role: 'owner' | 'admin' | 'member'
}

export default function ProjectsIndexPage() {
  // Chrome (topstrip nav, palette, language, identity, dropdowns). Active rail
  // is 'projects' so the topstrip highlights the right pill. `useChatChrome`
  // is the same hook every other library page uses — switching to it is what
  // brings the History link back into the topstrip on this surface.
  const chrome = useChatChrome('projects')

  const [projects, setProjects] = useState<ProjectRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter] = useState<'all' | 'owned' | 'shared' | 'archived'>('all')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/projects', { cache: 'no-store' })
      if (res.status === 401) {
        window.location.href = '/auth/login?redirect=/projects'
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const j = await res.json()
      setProjects(j.projects || [])
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = (projects || []).filter(p => {
    if (filter === 'owned') return p.my_role === 'owner'
    if (filter === 'shared') return p.my_role !== 'owner'
    if (filter === 'archived') return p.archived_at !== null
    return p.archived_at === null
  })

  // Mutators used by the per-row three-dots menu. We optimistically update
  // the local list and then reconcile with `load()` once the API confirms.
  // Permission errors fall back to a refetch so the row's state never lies.
  const archiveProject = useCallback(async (id: string) => {
    setProjects(prev =>
      prev?.map(p => p.id === id ? { ...p, archived_at: new Date().toISOString() } : p) ?? prev,
    )
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ archived: true }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
      window.dispatchEvent(new CustomEvent('clox-projects-changed'))
    } catch (e) { setError((e as Error).message); load() }
  }, [load])

  const unarchiveProject = useCallback(async (id: string) => {
    setProjects(prev =>
      prev?.map(p => p.id === id ? { ...p, archived_at: null } : p) ?? prev,
    )
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
      window.dispatchEvent(new CustomEvent('clox-projects-changed'))
    } catch (e) { setError((e as Error).message); load() }
  }, [load])

  const deleteProject = useCallback(async (id: string) => {
    if (!window.confirm('Permanently delete this project? Its chats stay; only the project record (members, budget, settings) is removed.')) return
    setProjects(prev => prev?.filter(p => p.id !== id) ?? prev)
    try {
      const res = await fetch(`/api/projects/${id}?hard=1`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
      window.dispatchEvent(new CustomEvent('clox-projects-changed'))
    } catch (e) { setError((e as Error).message); load() }
  }, [load])

  // Recent text-chats for the rail. Same shape /history, /skills and other
  // library surfaces use — a click drops the user back into /text on the
  // selected thread. We don't deep-link here because the projects index is
  // its own destination, not a chat composer.
  const recent: RailRecentItem[] = useMemo(() => {
    return listChats()
      .filter(c => (c.modality ?? 'text') === 'text')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
      .map(c => ({
        id: c.id,
        title: c.title,
        meta:
          new Date(c.createdAt).toLocaleString([], { month: 'short', day: 'numeric' }) +
          ' · ' + c.model.toLowerCase(),
        onClick: () => {
          if (typeof window !== 'undefined') localStorage.setItem('activeChatId:text', c.id)
          chrome.router.push('/text')
        },
      }))
  }, [chrome.router])

  // The page body stays exactly as it was — only the chrome around it
  // changes. Wrapping it in `bodySlot` reuses the same scrollable content
  // region every library surface uses, so the vertical rhythm matches.
  // Inner padding + max-width MUST match the rest of the ChatWorkspace
  // surfaces (`/history`, `/gallery`, `/skills`, `/settings`). Those pages
  // use an inline `padding: '28px 56px 64px'` with a content cap around
  // 1140px — switching /projects to the same values is what aligns the
  // top-of-page rhythm and the side gutters across the whole library.
  // The previous Tailwind `px-8 py-12 max-w-[1100px]` was just close
  // enough to look "off" without obviously being wrong.
  const body = (
    <div style={{ padding: '28px 56px 64px', maxWidth: 1140, margin: '0 auto' }}>

          {/* eyebrow + heading */}
          <div className="border-b border-hairline pb-6 mb-8">
            <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-muted mb-3">
              workspaces · projects
            </div>
            <div className="flex items-end justify-between gap-6">
              <h1 className="font-serif italic text-[44px] leading-[1.05] text-ink">
                Projects.
              </h1>
              <button
                onClick={() => setShowNew(true)}
                className="font-mono text-[11px] tracking-[0.08em] uppercase bg-ink text-bg px-5 py-2.5 hover:bg-ink-soft transition-colors"
              >
                New project →
              </button>
            </div>
            <p className="font-serif italic text-[18px] leading-[1.55] text-ink-soft mt-4 max-w-[640px]">
              A project is a room with a budget. Drop chats in to attribute their cost.
              Invite people to share files and a default model. Every cent spent is
              tracked back to who, when, and which chat.
            </p>
          </div>

          {/* filter rail */}
          <div className="flex items-center gap-1 mb-6 font-mono text-[10.5px] tracking-[0.08em] uppercase">
            {(['all', 'owned', 'shared', 'archived'] as const).map(k => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`px-3 py-1.5 transition-colors ${
                  filter === k
                    ? 'text-ink border-b border-ink'
                    : 'text-ink-muted hover:text-ink-soft border-b border-transparent'
                }`}
              >
                {k}
              </button>
            ))}
            <div className="flex-1" />
            <span className="text-ink-muted">
              {filtered.length} of {projects?.length ?? 0}
            </span>
          </div>

          {/* state: error */}
          {error && (
            <div className="border border-accent/40 bg-accent/5 px-5 py-4 mb-6">
              <div className="font-mono text-[10px] tracking-[0.08em] uppercase text-accent mb-1">
                error
              </div>
              <div className="text-[13px] text-ink">{error}</div>
            </div>
          )}

          {/* state: loading */}
          {projects === null && !error && (
            <div className="text-center py-24 font-mono text-[11px] tracking-[0.08em] uppercase text-ink-muted">
              reading projects…
            </div>
          )}

          {/* state: empty */}
          {projects !== null && filtered.length === 0 && !error && (
            <div className="border border-dashed border-hairline px-8 py-16 text-center">
              <div className="font-serif italic text-[24px] text-ink mb-2">
                Nothing here yet.
              </div>
              <p className="text-[13px] text-ink-soft max-w-[420px] mx-auto leading-[1.55]">
                Projects are how you group chats with a shared budget, members, files, and
                default model. Make one and start dragging chats into it.
              </p>
              <button
                onClick={() => setShowNew(true)}
                className="font-mono text-[11px] tracking-[0.08em] uppercase bg-ink text-bg px-5 py-2.5 mt-6 hover:bg-ink-soft transition-colors"
              >
                New project →
              </button>
            </div>
          )}

          {/* list */}
          {filtered.length > 0 && (
            <div className="border-t border-hairline">
              {filtered.map((p, idx) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  idx={idx + 1}
                  onArchive={() => archiveProject(p.id)}
                  onUnarchive={() => unarchiveProject(p.id)}
                  onDelete={() => deleteProject(p.id)}
                />
              ))}
            </div>
          )}

      <AnimatePresence>
        {showNew && (
          <NewProjectSheet
            onClose={() => setShowNew(false)}
            onCreated={() => { setShowNew(false); load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )

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
        breadcrumb="workspaces · projects"
        title="Projects"
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
        bodySlot={body}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single project row in the index.
// ---------------------------------------------------------------------------

function ProjectRow({
  project: p,
  idx,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  project: ProjectRow
  idx: number
  onArchive?: () => void
  onUnarchive?: () => void
  onDelete?: () => void
}) {
  const pct = p.credit_budget_usd && p.credit_budget_usd > 0
    ? Math.min(100, (p.credit_spent_usd / p.credit_budget_usd) * 100)
    : null
  const overBudget = pct !== null && pct >= 100
  const nearBudget = pct !== null && pct >= 90 && !overBudget
  const archived = !!p.archived_at
  const canMutate = p.my_role === 'owner' || p.my_role === 'admin'
  const canDelete = p.my_role === 'owner'

  return (
    <div className="relative border-b border-hairline group hover:bg-rail-soft/40 transition-colors">
      {/* Menu sits absolutely above the link so its clicks don't navigate. */}
      {canMutate && (
        <div className="absolute top-1/2 -translate-y-1/2 right-2 z-10">
          <RowActionsMenu
            title="Project actions"
            side="bottom-right"
            items={[
              { key: 'open', label: 'Open', icon: RowActionIcons.open, onSelect: () => { window.location.href = `/projects/${p.id}` } },
              archived
                ? { key: 'unarchive', label: 'Unarchive', icon: RowActionIcons.unarchive, onSelect: () => onUnarchive?.() }
                : { key: 'archive',   label: 'Archive',   icon: RowActionIcons.archive,   onSelect: () => onArchive?.() },
              ...(canDelete ? [{
                key: 'delete', label: 'Delete forever',
                icon: RowActionIcons.delete, tone: 'destructive' as const,
                onSelect: () => onDelete?.(),
              }] : []),
            ]}
          />
        </div>
      )}
      <Link
        href={`/projects/${p.id}`}
        className="block"
      >
      <div className={`grid grid-cols-[40px_1fr_auto] gap-6 px-2 py-5 items-center ${canMutate ? 'pr-12' : ''}`}>
        {/* index number */}
        <div className="font-mono text-[10.5px] tracking-[0.08em] text-ink-muted tabular-nums">
          {String(idx).padStart(2, '0')}
        </div>

        {/* title + meta */}
        <div className="min-w-0">
          <div className="flex items-baseline gap-3 mb-1.5">
            <h2 className="font-serif italic text-[22px] text-ink truncate group-hover:text-accent transition-colors">
              {p.title}
            </h2>
            {p.archived_at && (
              <span className="font-mono text-[9.5px] tracking-[0.1em] uppercase text-ink-muted">
                archived
              </span>
            )}
            {p.my_role !== 'owner' && (
              <span className="font-mono text-[9.5px] tracking-[0.1em] uppercase text-ink-muted">
                {p.my_role}
              </span>
            )}
          </div>
          {p.description && (
            <div className="text-[13px] text-ink-soft truncate mb-2">
              {p.description}
            </div>
          )}
          <div className="flex items-center gap-4 font-mono text-[10px] tracking-[0.06em] text-ink-muted">
            <span>{p.member_count} {p.member_count === 1 ? 'member' : 'members'}</span>
            <span className="text-ink-muted/50">·</span>
            <span>{p.chat_count} {p.chat_count === 1 ? 'chat' : 'chats'}</span>
            <span className="text-ink-muted/50">·</span>
            <span className="lowercase">{p.default_modality}</span>
            <span className="text-ink-muted/50">·</span>
            <span>updated {timeAgo(p.last_activity_at)}</span>
          </div>
        </div>

        {/* budget meter */}
        <div className="w-[180px] shrink-0">
          {p.credit_budget_usd === null ? (
            <div className="text-right">
              <div className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-muted mb-1">
                spent
              </div>
              <div className="font-mono text-[14px] tabular-nums text-ink">
                ${p.credit_spent_usd.toFixed(2)}
              </div>
              <div className="font-mono text-[9px] tracking-[0.06em] text-ink-muted mt-0.5">
                no cap
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-muted">
                  budget
                </span>
                <span className={`font-mono text-[11px] tabular-nums ${
                  overBudget ? 'text-accent font-medium' : nearBudget ? 'text-accent/80' : 'text-ink'
                }`}>
                  ${p.credit_spent_usd.toFixed(2)} / ${p.credit_budget_usd.toFixed(2)}
                </span>
              </div>
              <div className="relative h-[2px] bg-hairline overflow-hidden">
                <div
                  className={`absolute left-0 top-0 bottom-0 transition-all ${
                    overBudget ? 'bg-accent' : nearBudget ? 'bg-accent/80' : 'bg-ink'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="font-mono text-[9px] tracking-[0.06em] text-ink-muted mt-1 text-right">
                {p.budget_period} {overBudget ? '· over' : nearBudget ? '· near cap' : ''}
              </div>
            </div>
          )}
        </div>
      </div>
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------------------
// New-project sheet
// ---------------------------------------------------------------------------

function NewProjectSheet({
  onClose,
  onCreated,
}: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState<string>('')
  const [period, setPeriod] = useState<'lifetime' | 'monthly'>('lifetime')
  const [defaultModality, setDefaultModality] = useState('text')
  const [allowExternal, setAllowExternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          credit_budget_usd: budget ? Number(budget) : null,
          budget_period: period,
          default_modality: defaultModality,
          allow_external: allowExternal,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      onCreated()
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-bg w-full max-w-[560px] border border-hairline"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-7 pt-7 pb-5 border-b border-hairline">
          <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-muted mb-2">
            workspaces · new project
          </div>
          <h2 className="font-serif italic text-[28px] text-ink leading-tight">
            What are you working on?
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
          <Field label="Title">
            <input
              autoFocus
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Q3 brand refresh"
              className="w-full bg-transparent border-b border-hairline focus:border-ink outline-none py-2 text-[15px] text-ink placeholder:text-ink-muted"
            />
          </Field>

          <Field label="Description" optional>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional. One sentence is plenty."
              rows={2}
              className="w-full bg-transparent border-b border-hairline focus:border-ink outline-none py-2 text-[14px] text-ink placeholder:text-ink-muted resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-5">
            <Field label="Default modality">
              <select
                value={defaultModality}
                onChange={e => setDefaultModality(e.target.value)}
                className="w-full bg-transparent border-b border-hairline focus:border-ink outline-none py-2 text-[14px] text-ink"
              >
                <option value="text">Text / chat</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="research">Research</option>
                <option value="code">Code</option>
              </select>
            </Field>
            <Field label="Budget period">
              <select
                value={period}
                onChange={e => setPeriod(e.target.value as 'lifetime' | 'monthly')}
                className="w-full bg-transparent border-b border-hairline focus:border-ink outline-none py-2 text-[14px] text-ink"
              >
                <option value="lifetime">Lifetime</option>
                <option value="monthly">Monthly</option>
              </select>
            </Field>
          </div>

          <Field label="Credit budget" optional>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[14px] text-ink-muted">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="leave blank for no cap"
                className="flex-1 bg-transparent border-b border-hairline focus:border-ink outline-none py-2 text-[15px] text-ink placeholder:text-ink-muted"
              />
            </div>
          </Field>

          <label className="flex items-start gap-3 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={allowExternal}
              onChange={e => setAllowExternal(e.target.checked)}
              className="mt-1 accent-ink"
            />
            <div>
              <div className="text-[13px] text-ink">Allow external collaborators</div>
              <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted mt-0.5">
                If off, only members of your email domain can be invited.
              </div>
            </div>
          </label>

          {error && (
            <div className="font-mono text-[11px] text-accent">{error}</div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline-soft">
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink px-4 py-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="font-mono text-[11px] tracking-[0.08em] uppercase bg-ink text-bg px-5 py-2 hover:bg-ink-soft transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create project →'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function Field({
  label,
  optional,
  children,
}: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-muted">
        {label}{optional && <span className="ml-1 text-ink-muted/60 normal-case tracking-normal">— optional</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

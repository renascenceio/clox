'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useCallback, use } from 'react'

// Same chrome contract as /history, /gallery, /skills, /settings and
// /projects (index). Using `ChatWorkspace` here keeps the topstrip nav
// (Projects · Chats · History · Gallery) consistent with sibling pages
// and makes the left rail's vertical rhythm match too.
import ChatWorkspace, { type RailRecentItem } from '@/shared/ui/chat/ChatWorkspace'
import { useChatChrome } from '@/shared/ui/chat/useChatChrome'
import { listChats } from '@/lib/chat-store'

import ProjectHeader from './_components/ProjectHeader'
import ChatsTab from './_components/ChatsTab'
import MembersTab from './_components/MembersTab'
import UsageTab from './_components/UsageTab'
import FilesTab from './_components/FilesTab'
import SettingsTab from './_components/SettingsTab'
import ActivityRail from './_components/ActivityRail'
import type { ProjectFull } from './_types'

type Tab = 'chats' | 'members' | 'usage' | 'files' | 'settings'

export default function ProjectWorkspacePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const chrome = useChatChrome('projects')
  const [project, setProject] = useState<ProjectFull | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('chats')

  // Recent chats for the left rail — SCOPED to this project.
  //
  // /history, /gallery and the composers show globally-recent chats here.
  // On a project detail page that would be confusing: the user is looking
  // at Project X but the rail surfaces chats from Project Y and unfiled
  // chats too. Filtering by `projectId === id` makes the rail a true
  // drill-down ("Projects → this Project → its chats"), which is what the
  // user expects after clicking a project in the /projects index rail.
  const recent: RailRecentItem[] = useMemo(() => {
    return listChats()
      .filter(c => (c.modality ?? 'text') === 'text')
      .filter(c => c.projectId === id)
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
  }, [id, chrome.router])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`, { cache: 'no-store' })
      if (res.status === 401) {
        window.location.href = `/auth/login?redirect=/projects/${id}`
        return
      }
      if (res.status === 404) {
        setError('This project does not exist or you no longer have access.')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const j = await res.json()
      setProject(j.project)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // The body content varies by state (error / loading / loaded). The chrome
  // around it is identical, so we compute the body first and then wrap it
  // once below — this is what keeps the topstrip nav and rail spacing
  // consistent across every state of the page.
  const canManage =
    project ? project.my_role === 'owner' || project.my_role === 'admin' : false

  let body: React.ReactNode
  if (error) {
    body = (
      <div className="max-w-[720px] mx-auto px-8 py-24 text-center">
        <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-muted mb-3">
          workspaces · project
        </div>
        <h1 className="font-serif italic text-[36px] text-ink mb-3">Not available.</h1>
        <p className="text-[14px] text-ink-soft mb-6">{error}</p>
        <Link
          href="/projects"
          className="font-mono text-[11px] tracking-[0.08em] uppercase bg-ink text-bg px-5 py-2 hover:bg-ink-soft inline-block transition-colors"
        >
          ← Back to projects
        </Link>
      </div>
    )
  } else if (!project) {
    body = (
      <div className="max-w-[1100px] mx-auto px-8 py-24 text-center font-mono text-[11px] tracking-[0.08em] uppercase text-ink-muted">
        loading project…
      </div>
    )
  } else {
    // Same editorial padding contract as `/history`, `/gallery`, `/skills`,
    // `/settings`, and the projects index — `padding: '28px 56px 64px'`
    // with a content cap that matches the surface's density. The detail
    // page has a 280px right rail, so we cap a touch wider than the
    // gallery (1140) to give the main column comfortable breathing room.
    body = (
      <div style={{ padding: '28px 56px 64px', maxWidth: 1200, margin: '0 auto' }}>

        <ProjectHeader project={project} onChange={load} />

        {/* tab rail */}
        <div className="flex items-center gap-0 border-b border-hairline mt-8 mb-8 font-mono text-[10.5px] tracking-[0.1em] uppercase">
          {(['chats', 'members', 'usage', 'files', 'settings'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 -mb-px transition-colors border-b ${
                tab === t
                  ? 'border-ink text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink-soft'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">
          <div className="min-w-0">
            {tab === 'chats'    && <ChatsTab    project={project} onChange={load} />}
            {tab === 'members'  && <MembersTab  project={project} onChange={load} canManage={canManage} />}
            {tab === 'usage'    && <UsageTab    project={project} />}
            {tab === 'files'    && <FilesTab    project={project} onChange={load} canManage={canManage} />}
            {tab === 'settings' && <SettingsTab project={project} onChange={load} canManage={canManage} />}
          </div>
          <ActivityRail projectId={project.id} />
        </div>

      </div>
    )
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
        // Honest caption — the rail here is project-scoped (chats from
        // this project only), not the global recent list. Distinguishing
        // it visually keeps the projects-as-folders mental model intact.
        recentLabel="chats in project"
        // "See all →" on a project detail page should reveal every chat
        // belonging to this project — i.e. switch to the Chats tab and
        // scroll to it. Falling back to /history (the global default)
        // would lose the project filter entirely, which is the opposite
        // of what the user wants when drilling INTO a project.
        onSeeAllRecent={() => {
          setTab('chats')
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
        }}
        onNewChat={chrome.onNewChat}
        breadcrumb={project ? `workspaces · ${project.title}` : 'workspaces · project'}
        title={project?.title ?? 'Project'}
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

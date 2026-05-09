'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback, use } from 'react'
import AppLayout from '@/shared/ui/layout/AppLayout'
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
  const [project, setProject] = useState<ProjectFull | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('chats')

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

  if (error) {
    return (
      <AppLayout>
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
      </AppLayout>
    )
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="max-w-[1100px] mx-auto px-8 py-24 text-center font-mono text-[11px] tracking-[0.08em] uppercase text-ink-muted">
          loading project…
        </div>
      </AppLayout>
    )
  }

  const canManage = project.my_role === 'owner' || project.my_role === 'admin'

  return (
    <AppLayout>
      <div className="min-h-full bg-bg">
        <div className="max-w-[1280px] mx-auto px-8 py-10">

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
      </div>
    </AppLayout>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import type { ActivityEntry } from '../_types'

export default function ActivityRail({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/activity?limit=20`, { cache: 'no-store' })
      if (!res.ok) return
      const j = await res.json()
      setEntries(j.entries || [])
    } catch { /* ignore */ }
  }, [projectId])

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  return (
    <aside className="border-l border-hairline lg:pl-6 lg:py-1 hidden lg:block">
      <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-muted mb-3">
        activity
      </div>
      {entries === null ? (
        <div className="font-mono text-[10px] text-ink-muted">…</div>
      ) : entries.length === 0 ? (
        <div className="text-[12px] text-ink-soft italic font-serif">
          Nothing happened yet.
        </div>
      ) : (
        <ol className="space-y-3">
          {entries.map(e => (
            <li key={e.id} className="border-l-2 border-hairline pl-3">
              <div className="text-[12px] text-ink leading-snug">
                <span className="font-medium">{e.actor_email ?? 'system'}</span>
                {' '}
                <span className="text-ink-soft">{summarize(e)}</span>
              </div>
              <div className="font-mono text-[9.5px] tracking-[0.06em] text-ink-muted mt-1">
                {timeAgo(e.created_at)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}

function summarize(e: ActivityEntry): string {
  const p = e.payload || {}
  switch (e.action) {
    case 'project.created':       return `created the project${typeof p.title === 'string' ? ` "${p.title}"` : ''}`
    case 'project.updated':       return 'updated project settings'
    case 'project.archived':      return 'archived the project'
    case 'project.unarchived':    return 'reactivated the project'
    case 'project.deleted':       return 'deleted the project'
    case 'member.invited':        return `invited ${p.email ?? 'someone'}`
    case 'member.added':          return `added ${p.email ?? 'someone'} as ${p.role ?? 'member'}`
    case 'member.role_changed':   return `set ${p.email ?? 'a member'} to ${p.role ?? '?'}`
    case 'member.cap_changed':    return `set ${p.email ?? 'a member'}'s cap to ${p.credit_limit_usd != null ? '$' + p.credit_limit_usd : 'no cap'}`
    case 'member.removed':        return `removed ${p.email ?? 'a member'}`
    case 'invite.revoked':        return `revoked invite for ${p.email ?? '?'}`
    case 'invite.accepted':       return 'joined via invite'
    case 'chat.linked':           return `linked a chat${p.title ? ` "${p.title}"` : ''}`
    case 'chat.unlinked':         return 'unlinked a chat'
    case 'file.uploaded':         return `uploaded ${p.name ?? 'a file'}`
    case 'file.deleted':          return `deleted ${p.name ?? 'a file'}`
    case 'budget.reset':          return 'monthly budget reset'
    default:                      return e.action
  }
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

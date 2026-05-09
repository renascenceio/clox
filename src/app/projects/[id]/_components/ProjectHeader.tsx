'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ProjectFull } from '../_types'

/**
 * Editorial header for the project workspace.
 *
 *  ┌───────────────────────────────────────────────────────────────────────┐
 *  │ workspaces · projects · q3 brand refresh                              │
 *  │                                                                       │
 *  │ Q3 brand refresh.                                                     │
 *  │ One sentence description, set by the owner.                           │
 *  │                                                                       │
 *  │ owner — alex@renascence.io · 4 members · default model · text · …     │
 *  │ ─────────────── budget meter ───────────── $14.20 / $50.00            │
 *  └───────────────────────────────────────────────────────────────────────┘
 */
export default function ProjectHeader({
  project,
  onChange,
}: { project: ProjectFull; onChange: () => void }) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(project.title)
  const canManage = project.my_role === 'owner' || project.my_role === 'admin'

  const pct = project.credit_budget_usd && project.credit_budget_usd > 0
    ? Math.min(100, (project.credit_spent_usd / project.credit_budget_usd) * 100)
    : null
  const overBudget = pct !== null && pct >= 100
  const nearBudget = pct !== null && pct >= 90 && !overBudget

  async function saveTitle() {
    const v = titleDraft.trim()
    if (!v || v === project.title) {
      setEditingTitle(false); setTitleDraft(project.title); return
    }
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: v }),
    })
    setEditingTitle(false)
    onChange()
  }

  return (
    <div>
      {/* breadcrumb */}
      <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-muted mb-3 flex items-center gap-2">
        <Link href="/projects" className="hover:text-ink transition-colors">
          ← workspaces · projects
        </Link>
        {project.archived_at && (
          <span className="text-accent ml-3">· archived</span>
        )}
      </div>

      {/* title */}
      {editingTitle && canManage ? (
        <input
          autoFocus
          value={titleDraft}
          onChange={e => setTitleDraft(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={e => {
            if (e.key === 'Enter') saveTitle()
            if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(project.title) }
          }}
          className="font-serif italic text-[44px] leading-[1.05] text-ink bg-transparent border-b border-ink outline-none w-full max-w-[700px]"
        />
      ) : (
        <h1
          onClick={() => canManage && setEditingTitle(true)}
          className={`font-serif italic text-[44px] leading-[1.05] text-ink ${canManage ? 'cursor-text' : ''}`}
          title={canManage ? 'Click to rename' : undefined}
        >
          {project.title}.
        </h1>
      )}

      {project.description && (
        <p className="font-serif italic text-[18px] leading-[1.55] text-ink-soft mt-3 max-w-[640px]">
          {project.description}
        </p>
      )}

      {/* meta line */}
      <div className="font-mono text-[10.5px] tracking-[0.06em] text-ink-muted mt-5 flex items-center gap-3 flex-wrap">
        <span>owner — {project.owner_email}</span>
        <span className="text-ink-muted/40">·</span>
        <span>{project.member_count} {project.member_count === 1 ? 'member' : 'members'}</span>
        <span className="text-ink-muted/40">·</span>
        <span>default · {project.default_modality}</span>
        <span className="text-ink-muted/40">·</span>
        <span>{project.allow_external ? 'external collab on' : 'same-domain only'}</span>
        <span className="text-ink-muted/40">·</span>
        <span>your role · {project.my_role}</span>
      </div>

      {/* budget meter */}
      <div className="mt-7 border-t border-hairline pt-5">
        {project.credit_budget_usd === null ? (
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-ink-muted">
              spend · no cap
            </span>
            <span className="font-mono text-[14px] tabular-nums text-ink">
              ${project.credit_spent_usd.toFixed(2)}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-2">
              <span className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-ink-muted">
                budget · {project.budget_period}
                {overBudget && <span className="text-accent ml-2">over cap</span>}
                {nearBudget && <span className="text-accent ml-2">near cap</span>}
              </span>
              <span className={`font-mono text-[14px] tabular-nums ${
                overBudget ? 'text-accent font-medium' : 'text-ink'
              }`}>
                ${project.credit_spent_usd.toFixed(2)} / ${project.credit_budget_usd.toFixed(2)}
              </span>
            </div>
            <div className="relative h-[3px] bg-hairline overflow-hidden">
              <div
                className={`absolute left-0 top-0 bottom-0 transition-all ${
                  overBudget ? 'bg-accent' : nearBudget ? 'bg-accent/80' : 'bg-ink'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {project.budget_resets_at && project.budget_period === 'monthly' && (
              <div className="font-mono text-[9.5px] tracking-[0.06em] text-ink-muted mt-1.5">
                resets {new Date(project.budget_resets_at).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

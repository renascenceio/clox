'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProjectFull } from '../_types'

export default function SettingsTab({
  project,
  onChange,
  canManage,
}: {
  project: ProjectFull
  onChange: () => void
  canManage: boolean
}) {
  const router = useRouter()
  const [draft, setDraft] = useState({
    description: project.description ?? '',
    model: project.model ?? 'gemini-2.5-flash',
    default_modality: project.default_modality,
    system_prompt: project.system_prompt ?? '',
    temperature: project.temperature,
    max_tokens: project.max_tokens,
    credit_budget_usd: project.credit_budget_usd != null ? String(project.credit_budget_usd) : '',
    budget_period: project.budget_period,
    allow_external: project.allow_external,
  })
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function patch(payload: Record<string, unknown>, key: string) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      setSavedKey(key)
      setTimeout(() => setSavedKey(s => (s === key ? null : s)), 1500)
      onChange()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  async function archive() {
    if (!confirm('Archive this project? Members keep access in read-only mode and the budget freezes.')) return
    await patch({ archived_at: new Date().toISOString() }, 'archive')
  }
  async function unarchive() {
    await patch({ archived_at: null }, 'unarchive')
  }

  async function destroy() {
    const confirmText = `delete ${project.title}`
    const v = prompt(`Permanently delete "${project.title}"? This cannot be undone.\n\nType "${confirmText}" to confirm.`)
    if (v !== confirmText) return
    const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/projects')
  }

  function field(label: string, key: keyof typeof draft, child: React.ReactNode, hint?: string) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_60px] gap-4 items-start py-4 border-b border-hairline">
        <div>
          <div className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-ink">{label}</div>
          {hint && <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted mt-1 leading-relaxed">{hint}</div>}
        </div>
        <div>{child}</div>
        <div className="flex items-center justify-end font-mono text-[10px] tracking-[0.08em] uppercase">
          {savedKey === key ? (
            <span className="text-accent">saved</span>
          ) : (
            <span className="text-ink-muted/60">{busy && draft[key] !== undefined ? '…' : ''}</span>
          )}
        </div>
      </div>
    )
  }

  const disabled = !canManage

  return (
    <div>
      <div className="flex items-center justify-between border-b border-hairline pb-3 mb-2">
        <div>
          <div className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-ink-muted">
            settings
          </div>
          <h2 className="font-serif italic text-[26px] text-ink leading-tight mt-1">
            Knobs and guards.
          </h2>
        </div>
      </div>

      {error && <div className="font-mono text-[11px] text-accent my-3">{error}</div>}
      {!canManage && (
        <div className="font-mono text-[10px] tracking-[0.06em] text-ink-muted bg-rail-soft border border-hairline px-3 py-2 my-3 leading-relaxed">
          read-only · only owners and admins can change settings.
        </div>
      )}

      <div className="border-t border-hairline">

        {field('Description', 'description',
          <textarea
            disabled={disabled}
            rows={2}
            value={draft.description}
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
            onBlur={() => draft.description !== (project.description ?? '') && patch({ description: draft.description.trim() || null }, 'description')}
            className="w-full bg-transparent border-b border-hairline focus:border-ink outline-none py-2 text-[14px] resize-none disabled:opacity-50"
            placeholder="One sentence about what this project is for."
          />,
          'Visible to all members.'
        )}

        {field('Default model', 'model',
          <select
            disabled={disabled}
            value={draft.model}
            onChange={e => { setDraft(d => ({ ...d, model: e.target.value })); patch({ model: e.target.value }, 'model') }}
            className="w-full bg-transparent border-b border-hairline focus:border-ink outline-none py-2 text-[14px] disabled:opacity-50"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="claude-opus-4.6">Claude Opus 4.6</option>
            <option value="claude-sonnet-4.6">Claude Sonnet 4.6</option>
          </select>,
          'New chats in this project start on this model. Members can override per-chat.'
        )}

        {field('Default modality', 'default_modality',
          <select
            disabled={disabled}
            value={draft.default_modality}
            onChange={e => { const v = e.target.value; setDraft(d => ({ ...d, default_modality: v as ProjectFull['default_modality'] })); patch({ default_modality: v }, 'default_modality') }}
            className="w-full bg-transparent border-b border-hairline focus:border-ink outline-none py-2 text-[14px] disabled:opacity-50"
          >
            <option value="text">Text / chat</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
            <option value="research">Research</option>
            <option value="code">Code</option>
          </select>,
        )}

        {field('System prompt', 'system_prompt',
          <textarea
            disabled={disabled}
            rows={4}
            value={draft.system_prompt}
            onChange={e => setDraft(d => ({ ...d, system_prompt: e.target.value }))}
            onBlur={() => draft.system_prompt !== (project.system_prompt ?? '') && patch({ system_prompt: draft.system_prompt.trim() || null }, 'system_prompt')}
            className="w-full bg-transparent border-b border-hairline focus:border-ink outline-none py-2 text-[13px] font-mono leading-relaxed resize-none disabled:opacity-50"
            placeholder="Optional. Prepended to every chat in this project."
          />,
          'Use this for tone of voice, response format, or domain context.'
        )}

        {field('Temperature', 'temperature',
          <div className="flex items-center gap-3">
            <input
              type="range" min="0" max="2" step="0.1"
              disabled={disabled}
              value={draft.temperature}
              onChange={e => setDraft(d => ({ ...d, temperature: Number(e.target.value) }))}
              onMouseUp={() => patch({ temperature: draft.temperature }, 'temperature')}
              className="flex-1 accent-ink disabled:opacity-50"
            />
            <span className="font-mono text-[12px] tabular-nums text-ink w-10 text-right">{draft.temperature.toFixed(1)}</span>
          </div>,
        )}

        {field('Max tokens', 'max_tokens',
          <div className="flex items-center gap-3">
            <input
              type="range" min="256" max="8192" step="256"
              disabled={disabled}
              value={draft.max_tokens}
              onChange={e => setDraft(d => ({ ...d, max_tokens: Number(e.target.value) }))}
              onMouseUp={() => patch({ max_tokens: draft.max_tokens }, 'max_tokens')}
              className="flex-1 accent-ink disabled:opacity-50"
            />
            <span className="font-mono text-[12px] tabular-nums text-ink w-12 text-right">{draft.max_tokens}</span>
          </div>,
        )}

        {field('Credit budget', 'credit_budget_usd',
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[14px] text-ink-muted">$</span>
            <input
              type="number" step="0.01" min="0"
              disabled={disabled}
              value={draft.credit_budget_usd}
              onChange={e => setDraft(d => ({ ...d, credit_budget_usd: e.target.value }))}
              onBlur={() => {
                const next = draft.credit_budget_usd === '' ? null : Number(draft.credit_budget_usd)
                if (next !== project.credit_budget_usd) patch({ credit_budget_usd: next }, 'credit_budget_usd')
              }}
              placeholder="leave blank for no cap"
              className="flex-1 bg-transparent border-b border-hairline focus:border-ink outline-none py-2 text-[14px] disabled:opacity-50"
            />
          </div>,
          'Hard cap. Generations are blocked once this is reached. Set to blank for unlimited.'
        )}

        {field('Budget period', 'budget_period',
          <select
            disabled={disabled}
            value={draft.budget_period}
            onChange={e => { const v = e.target.value as 'lifetime' | 'monthly'; setDraft(d => ({ ...d, budget_period: v })); patch({ budget_period: v }, 'budget_period') }}
            className="w-full bg-transparent border-b border-hairline focus:border-ink outline-none py-2 text-[14px] disabled:opacity-50"
          >
            <option value="lifetime">Lifetime — single envelope, never resets</option>
            <option value="monthly">Monthly — resets on the same day each month</option>
          </select>,
        )}

        {field('External collaborators', 'allow_external',
          <label className="flex items-center gap-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              disabled={disabled}
              checked={draft.allow_external}
              onChange={e => { const v = e.target.checked; setDraft(d => ({ ...d, allow_external: v })); patch({ allow_external: v }, 'allow_external') }}
              className="accent-ink"
            />
            <span className="text-[13px] text-ink">
              {draft.allow_external ? 'On — invite anyone with an email' : 'Off — same email domain only'}
            </span>
          </label>,
        )}

      </div>

      {/* Danger zone */}
      {canManage && (
        <div className="mt-10 border border-accent/40 bg-accent/5 px-6 py-5">
          <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-accent mb-3">danger zone</div>
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="text-[13px] text-ink leading-relaxed max-w-[440px]">
              {project.archived_at
                ? 'This project is archived. Members can read it but no new chats or generations can run.'
                : 'Archiving freezes the budget and locks the project to read-only. Deletion permanently removes the project and unlinks all chats — usage history is preserved.'}
            </div>
            <div className="flex items-center gap-2">
              {project.archived_at ? (
                <button
                  onClick={unarchive}
                  className="font-mono text-[10.5px] tracking-[0.08em] uppercase border border-hairline bg-bg text-ink px-4 py-2 hover:bg-rail-soft"
                >
                  Unarchive
                </button>
              ) : (
                <button
                  onClick={archive}
                  className="font-mono text-[10.5px] tracking-[0.08em] uppercase border border-hairline bg-bg text-ink px-4 py-2 hover:bg-rail-soft"
                >
                  Archive
                </button>
              )}
              {project.my_role === 'owner' && (
                <button
                  onClick={destroy}
                  className="font-mono text-[10.5px] tracking-[0.08em] uppercase bg-accent text-bg px-4 py-2 hover:opacity-85"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

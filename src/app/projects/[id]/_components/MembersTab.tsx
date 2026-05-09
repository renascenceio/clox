'use client'

import { useEffect, useState, useCallback } from 'react'
import type { ProjectFull, ProjectMember, ProjectInvite } from '../_types'

export default function MembersTab({
  project,
  onChange,
  canManage,
}: {
  project: ProjectFull
  onChange: () => void
  canManage: boolean
}) {
  const [members, setMembers] = useState<ProjectMember[] | null>(null)
  const [invites, setInvites] = useState<ProjectInvite[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      setMembers(j.members || [])
      setInvites(j.invites || [])
      setError(null)
    } catch (e) { setError((e as Error).message) }
  }, [project.id])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center justify-between border-b border-hairline pb-3 mb-5">
        <div>
          <div className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-ink-muted">
            people
          </div>
          <h2 className="font-serif italic text-[26px] text-ink leading-tight mt-1">
            Who can see this project.
          </h2>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="font-mono text-[11px] tracking-[0.08em] uppercase bg-ink text-bg px-4 py-2 hover:bg-ink-soft transition-colors"
          >
            Invite →
          </button>
        )}
      </div>

      {error && (
        <div className="font-mono text-[11px] text-accent mb-4">{error}</div>
      )}

      {members === null ? (
        <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-muted py-8 text-center">
          loading members…
        </div>
      ) : (
        <>
          <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-muted mb-2">
            members · {members.length}
          </div>
          <div className="border-t border-hairline">
            {members.map((m, idx) => (
              <MemberRow
                key={m.id}
                member={m}
                idx={idx + 1}
                project={project}
                canManage={canManage}
                onChange={() => { load(); onChange() }}
              />
            ))}
          </div>
        </>
      )}

      {invites !== null && invites.length > 0 && (
        <div className="mt-10">
          <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-muted mb-2">
            pending invites · {invites.length}
          </div>
          <div className="border-t border-hairline">
            {invites.map((inv, idx) => (
              <InviteRow
                key={inv.id}
                invite={inv}
                idx={idx + 1}
                projectId={project.id}
                canManage={canManage}
                onChange={load}
              />
            ))}
          </div>
        </div>
      )}

      {showInvite && (
        <InviteModal
          project={project}
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); load(); onChange() }}
        />
      )}
    </div>
  )
}

function MemberRow({
  member,
  idx,
  project,
  canManage,
  onChange,
}: {
  member: ProjectMember
  idx: number
  project: ProjectFull
  canManage: boolean
  onChange: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState(member.role)
  const [limit, setLimit] = useState<string>(
    member.credit_limit_usd != null ? String(member.credit_limit_usd) : '',
  )
  const [busy, setBusy] = useState(false)

  const isOwner = member.role === 'owner'
  const editable = canManage && !isOwner

  const usagePct = member.credit_limit_usd && member.credit_limit_usd > 0
    ? Math.min(100, (member.credit_spent_usd / member.credit_limit_usd) * 100)
    : null

  async function save() {
    setBusy(true)
    try {
      await fetch(`/api/projects/${project.id}/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          role,
          credit_limit_usd: limit === '' ? null : Number(limit),
        }),
      })
      setEditing(false)
      onChange()
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm(`Remove ${member.email} from the project?`)) return
    await fetch(`/api/projects/${project.id}/members/${member.id}`, { method: 'DELETE' })
    onChange()
  }

  return (
    <div className="grid grid-cols-[40px_1fr_140px_auto] gap-4 items-center px-2 py-3 border-b border-hairline group">
      <div className="font-mono text-[10px] tracking-[0.08em] text-ink-muted tabular-nums">
        {String(idx).padStart(2, '0')}
      </div>
      <div className="min-w-0">
        <div className="text-[14px] text-ink truncate">{member.email}</div>
        <div className="font-mono text-[10px] tracking-[0.06em] text-ink-muted mt-0.5">
          {member.role}
          {member.joined_at && <> · joined {new Date(member.joined_at).toLocaleDateString()}</>}
        </div>
      </div>

      {/* per-seat cap meter */}
      <div className="min-w-0">
        {editing ? (
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="no cap"
            value={limit}
            onChange={e => setLimit(e.target.value)}
            className="w-full bg-transparent border-b border-hairline focus:border-ink outline-none py-1 font-mono text-[12px] text-ink"
          />
        ) : member.credit_limit_usd === null ? (
          <div className="font-mono text-[10px] tracking-[0.06em] text-ink-muted text-right">
            ${member.credit_spent_usd.toFixed(2)} · no cap
          </div>
        ) : (
          <div>
            <div className="font-mono text-[11px] tabular-nums text-right text-ink">
              ${member.credit_spent_usd.toFixed(2)} / ${Number(member.credit_limit_usd).toFixed(2)}
            </div>
            <div className="relative h-[2px] bg-hairline mt-1 overflow-hidden">
              <div
                className={`absolute left-0 top-0 bottom-0 ${
                  usagePct! >= 100 ? 'bg-accent' : 'bg-ink'
                }`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <select
              value={role}
              onChange={e => setRole(e.target.value as ProjectMember['role'])}
              className="font-mono text-[10px] tracking-[0.06em] uppercase bg-transparent border border-hairline px-2 py-1.5"
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            <button
              onClick={save}
              disabled={busy}
              className="font-mono text-[10px] tracking-[0.08em] uppercase text-accent hover:text-ink transition-colors px-2 py-1.5 disabled:opacity-50"
            >
              save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-muted hover:text-ink transition-colors px-2 py-1.5"
            >
              cancel
            </button>
          </>
        ) : editable ? (
          <>
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-muted hover:text-ink transition-all"
            >
              edit
            </button>
            <button
              onClick={remove}
              className="opacity-0 group-hover:opacity-100 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-muted hover:text-accent transition-all"
            >
              remove
            </button>
          </>
        ) : (
          <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-muted">
            {isOwner ? 'owner' : '—'}
          </span>
        )}
      </div>
    </div>
  )
}

function InviteRow({
  invite,
  idx,
  projectId,
  canManage,
  onChange,
}: {
  invite: ProjectInvite
  idx: number
  projectId: string
  canManage: boolean
  onChange: () => void
}) {
  const link = typeof window !== 'undefined'
    ? `${window.location.origin}/invite/${invite.token}`
    : `/invite/${invite.token}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
    } catch { /* ignore */ }
  }

  async function revoke() {
    if (!confirm(`Revoke invite for ${invite.email}?`)) return
    await fetch(`/api/projects/${projectId}/invites/${invite.id}`, { method: 'DELETE' })
    onChange()
  }

  return (
    <div className="grid grid-cols-[40px_1fr_auto_auto] gap-4 items-center px-2 py-3 border-b border-hairline group">
      <div className="font-mono text-[10px] tracking-[0.08em] text-ink-muted tabular-nums">
        {String(idx).padStart(2, '0')}
      </div>
      <div className="min-w-0">
        <div className="text-[14px] text-ink truncate">{invite.email}</div>
        <div className="font-mono text-[10px] tracking-[0.06em] text-ink-muted mt-0.5">
          {invite.role} · expires {new Date(invite.expires_at).toLocaleDateString()}
        </div>
      </div>
      <button
        onClick={copy}
        className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-muted hover:text-ink transition-colors px-2"
      >
        copy link
      </button>
      {canManage && (
        <button
          onClick={revoke}
          className="opacity-0 group-hover:opacity-100 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-muted hover:text-accent transition-all px-2"
        >
          revoke
        </button>
      )}
    </div>
  )
}

function InviteModal({
  project,
  onClose,
  onInvited,
}: { project: ProjectFull; onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      // The API returns either { member, invite: null } if the email is an
      // existing user, or { member: null, invite: { token, link, ... } } for
      // a token-based invite waiting on signup.
      if (body.invite?.token) {
        const origin = window.location.origin
        setLink(body.invite.link?.startsWith('http') ? body.invite.link : `${origin}/invite/${body.invite.token}`)
      } else {
        onInvited()
      }
    } catch (e) {
      setError((e as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-bg w-full max-w-[520px] border border-hairline"
      >
        <div className="px-7 pt-7 pb-5 border-b border-hairline">
          <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-muted mb-2">
            invite · {project.title}
          </div>
          <h2 className="font-serif italic text-[26px] text-ink leading-tight">
            Bring someone in.
          </h2>
        </div>

        {link ? (
          <div className="px-7 py-7 space-y-4">
            <div className="font-serif italic text-[18px] text-ink">Invite ready.</div>
            <p className="text-[13px] text-ink-soft">
              {email} doesn&apos;t have an account yet. Send them this link — it expires in 7 days.
            </p>
            <div className="bg-rail-soft border border-hairline px-3 py-2 font-mono text-[11px] text-ink break-all">
              {link}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-hairline-soft">
              <button
                onClick={() => navigator.clipboard.writeText(link)}
                className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink px-4 py-2"
              >
                Copy link
              </button>
              <button
                onClick={onInvited}
                className="font-mono text-[11px] tracking-[0.08em] uppercase bg-ink text-bg px-5 py-2 hover:bg-ink-soft"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="px-7 py-6 space-y-5">
            <label className="block">
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-muted">Email</span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="alex@renascence.io"
                className="mt-1 w-full bg-transparent border-b border-hairline focus:border-ink outline-none py-2 text-[15px]"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-muted">Role</span>
              <select
                value={role}
                onChange={e => setRole(e.target.value as 'admin' | 'member')}
                className="mt-1 w-full bg-transparent border-b border-hairline focus:border-ink outline-none py-2 text-[14px]"
              >
                <option value="member">Member — can use the project</option>
                <option value="admin">Admin — can also invite + manage caps</option>
              </select>
            </label>

            {!project.allow_external && (
              <div className="font-mono text-[10px] tracking-[0.06em] text-ink-muted bg-rail-soft border border-hairline px-3 py-2 leading-relaxed">
                this project is set to same-domain only. external addresses will be rejected unless an admin flips the toggle in settings.
              </div>
            )}

            {error && <div className="font-mono text-[11px] text-accent">{error}</div>}

            <div className="flex justify-end gap-2 pt-3 border-t border-hairline-soft">
              <button
                type="button"
                onClick={onClose}
                className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !email}
                className="font-mono text-[11px] tracking-[0.08em] uppercase bg-ink text-bg px-5 py-2 hover:bg-ink-soft disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Send invite →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

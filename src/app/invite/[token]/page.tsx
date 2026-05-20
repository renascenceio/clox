'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/**
 * /invite/[token] — accept-flow for project invitations.
 *
 * Three states the page handles:
 *   1. Invalid / expired / consumed token  → render the error and stop.
 *   2. Valid token but viewer not signed in (or signed in as the wrong email)
 *      → prompt them to sign in with the invite address.
 *   3. Valid token and viewer matches the invitee email
 *      → big "Accept invite" CTA. On success we route to the project.
 *
 * The API GET shape is flat (`email`, `role`, `project_id`, `project_title`,
 * `project_owner`, `expires_at`). We figure out the viewer state by hitting
 * the supabase browser client.
 */

type InviteResponse = {
  email: string
  role: 'admin' | 'member'
  project_id: string
  project_title: string
  project_owner: string | null
  expires_at: string
}

export default function InviteAcceptPage({
  params,
}: { params: { token: string } }) {
  // See note in /projects/[id]/page.tsx — Next 14 ships sync params on
  // client pages; React.use() on a plain object throws error #438.
  const { token } = params
  const router = useRouter()
  const [info, setInfo] = useState<InviteResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [viewerEmail, setViewerEmail] = useState<string | null | undefined>(undefined)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/invites/${token}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      setInfo(await res.json())
      setError(null)
    } catch (e) { setError((e as Error).message) }
  }, [token])

  useEffect(() => { load() }, [load])

  // Cheap viewer-state probe via the browser supabase client.
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      setViewerEmail(data.user?.email ?? null)
    })
    return () => { cancelled = true }
  }, [])

  async function accept() {
    setAccepting(true); setError(null)
    try {
      const res = await fetch(`/api/invites/${token}`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      router.push(`/projects/${body.project_id}`)
    } catch (e) { setError((e as Error).message); setAccepting(false) }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6 py-16">
      <div className="max-w-[560px] w-full">

        <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-muted text-center mb-3">
          invitation
        </div>

        {error && (
          <div className="border border-accent/40 bg-accent/5 px-5 py-4 mb-6">
            <div className="font-mono text-[10px] tracking-[0.08em] uppercase text-accent mb-1">expired or invalid</div>
            <div className="text-[13px] text-ink">{error}</div>
            <div className="mt-3">
              <Link href="/projects" className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink">
                ← go to projects
              </Link>
            </div>
          </div>
        )}

        {!info && !error && (
          <div className="text-center font-mono text-[11px] tracking-[0.08em] uppercase text-ink-muted py-8">
            checking invite…
          </div>
        )}

        {info && (
          <>
            <h1 className="font-serif italic text-[40px] leading-[1.05] text-ink text-center mb-3 text-balance">
              You&apos;re invited to {info.project_title}.
            </h1>
            <p className="font-serif italic text-[16px] leading-[1.55] text-ink-soft text-center max-w-[460px] mx-auto mb-2">
              {info.project_owner ?? 'A teammate'} added you as <span className="not-italic font-mono text-[12px] tracking-[0.06em] uppercase">{info.role}</span>.
            </p>

            <div className="border-t border-hairline pt-5 mt-6 grid grid-cols-2 gap-3 font-mono text-[10.5px] tracking-[0.06em] text-ink-muted text-center">
              <div>
                <div className="uppercase tracking-[0.1em] text-ink-muted/70">invited address</div>
                <div className="text-[12px] text-ink mt-0.5 normal-case tracking-normal">{info.email}</div>
              </div>
              <div>
                <div className="uppercase tracking-[0.1em] text-ink-muted/70">expires</div>
                <div className="text-[12px] text-ink mt-0.5">
                  {new Date(info.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>

            {viewerEmail === undefined ? (
              <div className="mt-8 text-center font-mono text-[10px] tracking-[0.08em] uppercase text-ink-muted">
                checking your sign-in…
              </div>
            ) : viewerEmail === null ? (
              <div className="mt-8 text-center space-y-3">
                <p className="text-[13px] text-ink">
                  Sign in as <span className="font-medium">{info.email}</span> to join.
                </p>
                <Link
                  href={`/auth/login?redirect=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(info.email)}`}
                  className="inline-block font-mono text-[11px] tracking-[0.08em] uppercase bg-ink text-bg px-5 py-2.5 hover:bg-ink-soft transition-colors"
                >
                  Sign in →
                </Link>
              </div>
            ) : viewerEmail.toLowerCase() !== info.email.toLowerCase() ? (
              <div className="mt-8 text-center space-y-3">
                <p className="text-[13px] text-ink">
                  This invite is for <span className="font-medium">{info.email}</span>, but you&apos;re signed in as <span className="font-medium">{viewerEmail}</span>.
                </p>
                <Link
                  href={`/auth/login?redirect=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(info.email)}`}
                  className="inline-block font-mono text-[11px] tracking-[0.08em] uppercase border border-hairline px-5 py-2 hover:bg-rail-soft"
                >
                  Switch account
                </Link>
              </div>
            ) : (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={accept}
                  disabled={accepting}
                  className="font-mono text-[11px] tracking-[0.08em] uppercase bg-ink text-bg px-7 py-3 hover:bg-ink-soft disabled:opacity-50 transition-colors"
                >
                  {accepting ? 'Joining…' : 'Accept invite →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

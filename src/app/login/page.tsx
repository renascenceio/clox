'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthShell, Field, Notice, PrimaryButton, authErrorText, landingFor, safeRedirect } from '@/shared/ui/auth/AuthShell'

function SignIn() {
  const params = useSearchParams()
  const next = safeRedirect(params.get('redirect') ?? params.get('next'))
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resent, setResent] = useState(false)

  const notice = params.get('notice')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setUnconfirmed(false)
    setLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) {
      setLoading(false)
      if (/confirm/i.test(signInError.message)) {
        setUnconfirmed(true)
        return
      }
      setError(authErrorText(signInError.message))
      return
    }
    // Full navigation so the server sees the new session cookie straight away.
    window.location.assign(await landingFor(supabase, next))
  }

  async function resend() {
    const supabase = createClient()
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (resendError) setError(authErrorText(resendError.message))
    else setResent(true)
  }

  const keep = new URLSearchParams()
  if (params.get('redirect')) keep.set('redirect', next)
  if (email) keep.set('email', email)
  const suffix = keep.toString() ? `?${keep}` : ''

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back."
      lede="Sign in to pick up where you left off."
      footer={
        <>
          New to Clox?{' '}
          <Link href={`/signup${suffix}`} className="text-ink underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {notice === 'confirmed' ? <Notice tone="ok">Your email is confirmed. Sign in to continue.</Notice> : null}
        {notice === 'password-updated' ? <Notice tone="ok">Your password is updated. Sign in with the new one.</Notice> : null}
        {notice === 'link-expired' ? <Notice>That link has expired or was already used. Sign in, or ask for a new link.</Notice> : null}
        <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          hint={
            <Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="underline underline-offset-4 hover:text-ink">
              Forgot it?
            </Link>
          }
        />
        {error ? <Notice>{error}</Notice> : null}
        {unconfirmed ? (
          <Notice>
            Please confirm your email first — we sent you a link when you signed up.{' '}
            {resent ? (
              'A new link is on its way.'
            ) : (
              <button type="button" onClick={resend} className="underline underline-offset-4">
                Send it again
              </button>
            )}
          </Notice>
        ) : null}
        <PrimaryButton type="submit" loading={loading}>
          Sign in
        </PrimaryButton>
      </form>
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex items-center gap-3 text-[12px] text-ink-muted" aria-hidden>
          <span className="h-px flex-1 bg-current opacity-20" />
          or
          <span className="h-px flex-1 bg-current opacity-20" />
        </div>
        {['invalid', 'used', 'failed', 'off'].includes(params.get('sso') ?? '') ? (
          <Notice>We couldn&apos;t sign you in through Gaia CRM. Try again, or sign in with your password.</Notice>
        ) : null}
        <a
          href={`/auth/gaia/start?next=${encodeURIComponent(next)}`}
          className="flex h-11 items-center justify-center rounded-full bg-ink/5 text-[14px] font-medium text-ink transition-colors hover:bg-ink/10"
        >
          Continue with Gaia CRM
        </a>
      </div>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <SignIn />
    </Suspense>
  )
}

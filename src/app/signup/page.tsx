'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthShell, Field, Notice, PrimaryButton, authErrorText, safeRedirect } from '@/shared/ui/auth/AuthShell'

const MIN_PASSWORD = 8

function CreateAccount() {
  const params = useSearchParams()
  const next = safeRedirect(params.get('redirect') ?? params.get('next'))
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/register?next=${encodeURIComponent(next)}&welcome=1`)}`

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for your password.`)
      return
    }
    if (!agreed) {
      setError('Please accept the terms and privacy policy to continue.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: callbackUrl(),
        data: { first_name: firstName.trim(), last_name: lastName.trim() },
      },
    })
    setLoading(false)
    if (signUpError) {
      setError(authErrorText(signUpError.message))
      return
    }
    // Supabase returns a user with no identities when the email is already taken
    // (it doesn't say so, to avoid revealing which emails have accounts).
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setError('An account with this email already exists. Sign in instead.')
      return
    }
    if (data.session) {
      window.location.assign(`/register?next=${encodeURIComponent(next)}&welcome=1`)
      return
    }
    setSentTo(email.trim())
  }

  async function resend() {
    if (!sentTo) return
    const supabase = createClient()
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: sentTo, options: { emailRedirectTo: callbackUrl() } })
    if (resendError) setError(authErrorText(resendError.message))
    else setResent(true)
  }

  const loginHref = `/login?${new URLSearchParams({ ...(params.get('redirect') ? { redirect: next } : {}), ...(email ? { email } : {}) })}`

  if (sentTo) {
    return (
      <AuthShell
        eyebrow="Check your inbox"
        title="Confirm your email."
        lede={
          <>
            We sent a link to <span className="text-ink">{sentTo}</span>. Open it to finish creating your account — it can take a minute to arrive, and may land in spam.
          </>
        }
        footer={
          <>
            Already confirmed?{' '}
            <Link href={loginHref} className="text-ink underline underline-offset-4">
              Sign in
            </Link>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error ? <Notice>{error}</Notice> : null}
          {resent ? (
            <Notice tone="ok">A new link is on its way.</Notice>
          ) : (
            <button type="button" onClick={resend} className="self-start text-[13.5px] text-ink-soft underline underline-offset-4 hover:text-ink">
              Didn&apos;t get it? Send it again
            </button>
          )}
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Create account"
      title="Start with Omma."
      lede="Every new account comes with $10 of credit to try every mode — no card needed."
      footer={
        <>
          Already have an account?{' '}
          <Link href={loginHref} className="text-ink underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Field id="first-name" label="First name" autoComplete="given-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading} />
          <Field id="last-name" label="Last name" autoComplete="family-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading} />
        </div>
        <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          hint={`${MIN_PASSWORD}+ characters`}
        />
        <label className="flex items-start gap-3 text-[13.5px] leading-relaxed text-ink-soft">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 h-4 w-4 accent-current" />
          <span>
            I agree to the{' '}
            <Link href="/terms" className="text-ink underline underline-offset-4" target="_blank">
              terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-ink underline underline-offset-4" target="_blank">
              privacy policy
            </Link>
            .
          </span>
        </label>
        {error ? <Notice>{error}</Notice> : null}
        <PrimaryButton type="submit" loading={loading}>
          Create account
        </PrimaryButton>
      </form>
    </AuthShell>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <CreateAccount />
    </Suspense>
  )
}

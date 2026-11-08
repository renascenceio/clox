'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthShell, Field, Notice, PrimaryButton, authErrorText } from '@/shared/ui/auth/AuthShell'

function ForgotPassword() {
  const params = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
    })
    setLoading(false)
    if (resetError) {
      setError(authErrorText(resetError.message))
      return
    }
    setSent(true)
  }

  return (
    <AuthShell
      eyebrow="Reset password"
      title={sent ? 'Check your inbox.' : 'Forgot your password?'}
      lede={
        sent ? (
          <>
            If an account exists for <span className="text-ink">{email.trim()}</span>, a link to choose a new password is on its way.
          </>
        ) : (
          'Enter the email you signed up with and we’ll send you a link to choose a new one.'
        )
      }
      footer={
        <Link href="/login" className="text-ink underline underline-offset-4">
          Back to sign in
        </Link>
      }
    >
      {sent ? null : (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          {error ? <Notice>{error}</Notice> : null}
          <PrimaryButton type="submit" loading={loading}>
            Send reset link
          </PrimaryButton>
        </form>
      )}
    </AuthShell>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPassword />
    </Suspense>
  )
}

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuthShell, Field, Notice, PrimaryButton } from '@/shared/ui/auth/AuthShell'

const MIN_PASSWORD = 8

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`)
      return
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setLoading(false)
      setError(/session/i.test(updateError.message) ? 'This reset link has expired. Ask for a new one.' : updateError.message)
      return
    }
    window.location.assign('/text')
  }

  return (
    <AuthShell eyebrow="Reset password" title="Choose a new password." lede="You’ll stay signed in on this device.">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field id="password" label="New password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} hint={`${MIN_PASSWORD}+ characters`} />
        <Field id="confirm" label="Repeat it" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={loading} />
        {error ? <Notice>{error}</Notice> : null}
        <PrimaryButton type="submit" loading={loading}>
          Save password
        </PrimaryButton>
      </form>
    </AuthShell>
  )
}

'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { AuthShell, landingFor, safeRedirect } from '@/shared/ui/auth/AuthShell'

/**
 * Lands every emailed link: sign-up confirmation, password reset, magic link.
 *
 * Handles all three shapes Supabase can send back — `?code=` (PKCE),
 * `?token_hash=&type=` and `#access_token=` (implicit) — and runs in the
 * browser so the PKCE verifier saved at sign-up time is available.
 *
 * When the link is opened on another device the verifier is missing, but
 * Supabase has already confirmed the email by then, so we send them to sign
 * in with a "confirmed" note instead of an error.
 */
function Callback() {
  const params = useSearchParams()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const next = safeRedirect(params.get('next'))
    const isReset = next.startsWith('/reset-password')
    const isDirect = isReset || next.startsWith('/register')
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const supabase = createClient()

    const failed = () => window.location.replace(`/login?notice=${isReset ? 'link-expired' : 'confirmed'}`)
    const done = async () => window.location.replace(isDirect ? next : await landingFor(supabase, next))

    ;(async () => {
      if (params.get('error_description') || hash.get('error_description')) return failed()

      const code = params.get('code')
      const tokenHash = params.get('token_hash')
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          // The verifier may have been used already (React strict mode, a
          // double click) — if we do have a session, carry on.
          const { data } = await supabase.auth.getSession()
          return data.session ? done() : failed()
        }
        return done()
      }
      if (tokenHash) {
        const type = (params.get('type') ?? 'email') as EmailOtpType
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        return error ? failed() : done()
      }
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        return error ? failed() : done()
      }
      const { data } = await supabase.auth.getSession()
      return data.session ? done() : failed()
    })()
  }, [params])

  return <AuthShell eyebrow="One moment" title="Signing you in…" lede="This only takes a second." >{null}</AuthShell>
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <Callback />
    </Suspense>
  )
}

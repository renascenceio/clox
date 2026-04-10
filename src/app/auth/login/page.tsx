'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const redirectTo =
      process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
      `${window.location.origin}/auth/callback`

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-brown-50 to-teal-50 dark:from-[#1C1C1E] dark:via-[#2C2C2E] dark:to-[#1C1C1E] p-4">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-brown/20 rounded-full filter blur-3xl animate-blob" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-teal/20 rounded-full filter blur-3xl animate-blob [animation-delay:2s]" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-brown-300/20 rounded-full filter blur-3xl animate-blob [animation-delay:4s]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-14 h-14 gradient-brown-teal rounded-2xl flex items-center justify-center shadow-brown-glow">
              <span className="text-white font-black text-2xl">C</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-label-primary tracking-tight">Clox</h1>
          <p className="text-sm font-medium text-label-tertiary mt-1">Your intelligent workspace</p>
        </div>

        <div className="backdrop-blur-2xl bg-white/90 dark:bg-[#1C1C1E]/90 rounded-3xl p-8 shadow-2xl border border-separator/50">
          {sent ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-teal/10 dark:bg-teal/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-teal-600 dark:text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-label-primary">Check your inbox</h2>
                <p className="text-sm text-label-secondary mt-2">
                  We sent a magic link to <span className="font-bold text-brown dark:text-teal">{email}</span>. Click it to sign in.
                </p>
              </div>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="text-xs font-medium text-label-tertiary hover:text-label-secondary transition-colors"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-label-primary">Sign in</h2>
                <p className="text-sm text-label-secondary mt-1">Enter your email and we&apos;ll send you a magic link</p>
              </div>

              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-xs font-bold text-label-tertiary uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoFocus
                    className="w-full h-12 px-4 bg-white dark:bg-[#2C2C2E] border-2 border-separator rounded-xl text-sm font-medium text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/40 dark:focus:ring-teal/40 focus:border-brown dark:focus:border-teal transition-all disabled:opacity-50"
                    placeholder="you@example.com"
                  />
                </div>

                {error && (
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full h-12 gradient-brown-teal text-white rounded-xl text-sm font-bold shadow-brown-glow hover:shadow-hig-hover hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending link...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Send magic link
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-xs text-label-tertiary mt-6">
                No account yet?{' '}
                <a href="/register" className="font-bold text-brown dark:text-teal hover:underline">
                  Create one here
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

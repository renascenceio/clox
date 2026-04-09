'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      if (data.user) {
        // Redirect to admin dashboard
        router.push('/admin')
      }
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-secondary via-white to-surface-secondary dark:from-surface-secondary dark:via-surface dark:to-surface-tertiary p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-14 h-14 gradient-brown-teal rounded-hig-2xl flex items-center justify-center shadow-brown-glow">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-label-primary">Clox Studio</h1>
          </div>
          <p className="text-sm font-semibold text-label-secondary">Admin Access Portal</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="bg-white dark:bg-surface rounded-hig-3xl p-8 space-y-6 shadow-float border border-separator/30">
          <div>
            <h2 className="text-2xl font-bold text-label-primary mb-2">Welcome Back</h2>
            <p className="text-sm text-label-secondary">Enter your credentials to access the admin dashboard</p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-hig-xl text-sm font-semibold text-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-bold text-label-secondary uppercase tracking-widest mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-14 px-4 bg-white dark:bg-surface-tertiary border-2 border-separator rounded-hig-xl text-base font-medium text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/30 focus:border-brown transition-all"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-label-secondary uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-14 px-4 bg-white dark:bg-surface-tertiary border-2 border-separator rounded-hig-xl text-base font-medium text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/30 focus:border-brown transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-16 gradient-brown-teal text-white rounded-hig-2xl text-lg font-bold shadow-float hover:shadow-hig-hover hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing In...' : 'Sign In to Dashboard'}
          </button>

          <div className="pt-4 border-t border-separator/30 text-center">
            <p className="text-xs text-label-tertiary">
              Use your Supabase credentials to sign in
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-label-tertiary">
          <p>Clox Studio • Powered by Supabase</p>
        </div>
      </div>
    </div>
  )
}

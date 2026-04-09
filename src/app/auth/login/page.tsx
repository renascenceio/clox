'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      // Redirect to admin dashboard
      router.push('/admin')
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">Clox Studio</h1>
          <p className="text-sm text-label-tertiary">Admin Access</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="glass-float rounded-hig-2xl p-8 space-y-6 shadow-float">
          <div>
            <h2 className="text-2xl font-bold text-label-primary mb-2">Sign In</h2>
            <p className="text-sm text-label-tertiary">Enter your credentials to access the admin dashboard</p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-hig-xl text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
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
                className="w-full h-12 px-4 bg-surface border-2 border-separator/50 rounded-hig-xl text-base font-medium focus:ring-2 focus:ring-brown/20 focus:border-brown outline-none transition-all"
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
                className="w-full h-12 px-4 bg-surface border-2 border-separator/50 rounded-hig-xl text-base font-medium focus:ring-2 focus:ring-brown/20 focus:border-brown outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 gradient-brown-teal text-white rounded-hig-xl font-bold shadow-float hover:shadow-hig-hover hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>

          <div className="pt-4 border-t border-separator/30 text-center">
            <p className="text-xs text-label-tertiary">
              Default admin: aslan@renascence.io
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-label-tertiary">
          <p>Clox Studio v1.0 • Powered by Renascence AI</p>
        </div>
      </div>
    </div>
  )
}

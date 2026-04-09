'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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

      if (data.session) {
        router.push('/admin')
      }
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  const handleCreateAccount = async () => {
    setError('')
    setLoading(true)

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: 'aslan@renascence.io',
        password: 'Admin123!',
        options: {
          data: {
            name: 'Aslan Renascence',
            role: 'super_admin',
          },
        },
      })

      if (signUpError) {
        setError(`Account creation failed: ${signUpError.message}`)
      } else {
        setError('✓ Admin account created successfully! You can now log in with aslan@renascence.io / Admin123!')
      }
    } catch {
      setError('Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-white via-brown-50 to-teal-50 dark:from-[#1C1C1E] dark:via-[#2C2C2E] dark:to-[#1C1C1E]">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-brown/20 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-teal/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-brown-300/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md mx-4 relative z-10">
        {/* Header with Logo */}
        <div className="text-center mb-8 space-y-4">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="relative">
              <div className="absolute inset-0 gradient-brown-teal blur-lg opacity-60 animate-pulse rounded-2xl"></div>
              <div className="relative w-16 h-16 gradient-brown-teal rounded-2xl flex items-center justify-center shadow-2xl">
                <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-black text-[#1C1C1E] dark:text-white mb-2 tracking-tight">
              Clox Studio
            </h1>
            <p className="text-sm font-semibold text-[#636366] dark:text-[#98989D] uppercase tracking-wider">
              Admin Portal
            </p>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="backdrop-blur-2xl bg-white/90 dark:bg-[#1C1C1E]/90 rounded-3xl p-8 shadow-2xl border border-[#E5E5EA]/50 dark:border-[#3A3A3C]/50">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#1C1C1E] dark:text-white mb-1">Welcome back</h2>
            <p className="text-sm text-[#636366] dark:text-[#98989D]">Sign in to access the admin dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-bold text-[#636366] dark:text-[#98989D] uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full h-12 px-4 bg-white dark:bg-[#2C2C2E] border-2 border-[#E5E5EA] dark:border-[#3A3A3C] rounded-xl text-base font-medium text-[#1C1C1E] dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#636366] focus:outline-none focus:ring-2 focus:ring-brown/40 dark:focus:ring-teal/40 focus:border-brown dark:focus:border-teal transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="admin@example.com"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-bold text-[#636366] dark:text-[#98989D] uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full h-12 px-4 bg-white dark:bg-[#2C2C2E] border-2 border-[#E5E5EA] dark:border-[#3A3A3C] rounded-xl text-base font-medium text-[#1C1C1E] dark:text-white placeholder:text-[#8E8E93] dark:placeholder:text-[#636366] focus:outline-none focus:ring-2 focus:ring-brown/40 dark:focus:ring-teal/40 focus:border-brown dark:focus:border-teal transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="••••••••"
              />
            </div>

            {/* Error/Success Message */}
            {error && (
              <div className={`p-4 rounded-xl border-2 ${
                error.includes('✓') 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <p className={`text-sm font-medium ${
                  error.includes('✓') 
                    ? 'text-green-700 dark:text-green-400' 
                    : 'text-red-700 dark:text-red-400'
                }`}>{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 gradient-brown-teal text-white rounded-xl text-lg font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign In to Dashboard
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E5E5EA] dark:border-[#3A3A3C]"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white dark:bg-[#1C1C1E] text-[#8E8E93] dark:text-[#636366] font-semibold">First time?</span>
            </div>
          </div>

          {/* Create Account Button */}
          <button
            onClick={handleCreateAccount}
            type="button"
            disabled={loading}
            className="w-full h-12 bg-[#F2F2F7] dark:bg-[#2C2C2E] hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C] text-[#1C1C1E] dark:text-white rounded-xl text-sm font-bold border-2 border-[#E5E5EA] dark:border-[#3A3A3C] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Admin Account
          </button>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-[#8E8E93] dark:text-[#636366]">
              Default: <span className="font-bold text-brown dark:text-teal">aslan@renascence.io</span> / Admin123!
            </p>
          </div>
        </div>

        {/* Bottom Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-[#636366] dark:text-[#98989D]">
            🔒 Protected by enterprise-grade security
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Simple hardcoded check for now
    if (email === 'aslan@renascence.io' && password === 'Admin123!') {
      // Set a session flag in localStorage
      localStorage.setItem('clox_admin_session', 'true')
      router.push('/admin')
    } else {
      setError('Invalid email or password')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #F2F2F7 0%, #FFFFFF 50%, #F2F2F7 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #A2845E 0%, #5AC8C8 100%)', boxShadow: '0 8px 16px rgba(162, 132, 94, 0.3)' }}>
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold" style={{ color: '#1C1C1E' }}>Clox Studio</h1>
          </div>
          <p className="text-sm font-semibold" style={{ color: '#636366' }}>Admin Access Portal</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="rounded-3xl p-8 space-y-6 shadow-xl" style={{ background: '#FFFFFF', border: '1px solid rgba(229, 229, 234, 0.5)' }}>
          <div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#1C1C1E' }}>Welcome Back</h2>
            <p className="text-sm" style={{ color: '#636366' }}>Enter your credentials to access the admin dashboard</p>
          </div>

          {error && (
            <div className="p-4 rounded-2xl text-sm font-semibold" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C' }}>
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#636366' }}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ 
                  background: '#FFFFFF',
                  border: '2px solid rgba(229, 229, 234, 0.8)',
                  color: '#1C1C1E'
                }}
                className="w-full h-14 px-4 rounded-2xl text-base font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#636366' }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ 
                  background: '#FFFFFF',
                  border: '2px solid rgba(229, 229, 234, 0.8)',
                  color: '#1C1C1E'
                }}
                className="w-full h-14 px-4 rounded-2xl text-base font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-16 text-white rounded-2xl text-lg font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              background: loading ? '#9CA3AF' : 'linear-gradient(135deg, #A2845E 0%, #5AC8C8 100%)',
              boxShadow: loading ? 'none' : '0 10px 25px rgba(162, 132, 94, 0.4)'
            }}
          >
            {loading ? 'Signing In...' : 'Sign In to Dashboard'}
          </button>

          <div className="pt-4 border-t text-center" style={{ borderColor: 'rgba(229, 229, 234, 0.5)' }}>
            <p className="text-xs" style={{ color: '#8E8E93' }}>
              Default credentials: aslan@renascence.io / Admin123!
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-xs" style={{ color: '#8E8E93' }}>
          <p>Clox Studio v1.0 • Powered by Renascence AI</p>
        </div>
      </div>
    </div>
  )
}

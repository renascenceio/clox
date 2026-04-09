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
        router.push('/admin')
      }
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f5f5f7 0%, #ffffff 50%, #f5f5f7 100%)',
      padding: '1rem'
    }}>
      <div style={{ width: '100%', maxWidth: '28rem' }}>
        {/* Logo/Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #A2845E 0%, #5AC8C8 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(162, 132, 94, 0.3)'
            }}>
              <svg style={{ width: '32px', height: '32px', color: '#ffffff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1C1C1E', margin: 0 }}>Clox Studio</h1>
          </div>
          <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#636366', margin: 0 }}>Admin Access Portal</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '2rem',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)',
          border: '1px solid rgba(229, 229, 234, 0.6)'
        }}>
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1C1C1E', marginBottom: '0.5rem' }}>Welcome Back</h2>
            <p style={{ fontSize: '0.875rem', color: '#636366', margin: 0 }}>Sign in to your Clox account</p>
          </div>

          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '12px',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#991b1b',
              marginBottom: '1.5rem'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="email" style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: '700',
              color: '#636366',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.5rem'
            }}>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                height: '56px',
                padding: '0 1rem',
                backgroundColor: '#ffffff',
                border: '2px solid #E5E5EA',
                borderRadius: '16px',
                fontSize: '1rem',
                fontWeight: '500',
                color: '#1C1C1E',
                outline: 'none',
                transition: 'all 0.2s'
              }}
              placeholder="aslan@renascence.io"
              onFocus={(e) => {
                e.target.style.borderColor = '#A2845E'
                e.target.style.boxShadow = '0 0 0 3px rgba(162, 132, 94, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#E5E5EA'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: '700',
              color: '#636366',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.5rem'
            }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                height: '56px',
                padding: '0 1rem',
                backgroundColor: '#ffffff',
                border: '2px solid #E5E5EA',
                borderRadius: '16px',
                fontSize: '1rem',
                fontWeight: '500',
                color: '#1C1C1E',
                outline: 'none',
                transition: 'all 0.2s'
              }}
              placeholder="••••••••"
              onFocus={(e) => {
                e.target.style.borderColor = '#A2845E'
                e.target.style.boxShadow = '0 0 0 3px rgba(162, 132, 94, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#E5E5EA'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '64px',
              background: loading ? '#cccccc' : 'linear-gradient(135deg, #A2845E 0%, #5AC8C8 100%)',
              color: '#ffffff',
              borderRadius: '16px',
              fontSize: '1.125rem',
              fontWeight: '700',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 8px 24px rgba(162, 132, 94, 0.25)',
              transition: 'all 0.2s',
              opacity: loading ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'scale(1.02)'
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(162, 132, 94, 0.35)'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(162, 132, 94, 0.25)'
              }
            }}
            onMouseDown={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'scale(0.98)'
              }
            }}
            onMouseUp={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'scale(1.02)'
              }
            }}
          >
            {loading ? 'Signing In...' : 'Sign In to Dashboard'}
          </button>

          <div style={{
            paddingTop: '1.5rem',
            marginTop: '1.5rem',
            borderTop: '1px solid rgba(229, 229, 234, 0.5)',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '0.75rem', color: '#8E8E93', margin: 0 }}>
              Use your Supabase credentials • aslan@renascence.io
            </p>
          </div>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#8E8E93' }}>
          <p style={{ margin: 0 }}>Clox Studio • Powered by Supabase</p>
        </div>
      </div>
    </div>
  )
}

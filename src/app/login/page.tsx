'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // Set a mock session cookie to bypass the auth guard during verification or dummy mode
    document.cookie = "mock-session=true; path=/; max-age=3600"
    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md bg-surface p-10 rounded-[32px] border border-separator shadow-2xl space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg mb-4">
            <span className="text-white font-bold text-2xl">C</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-label-primary">Welcome back</h1>
          <p className="text-sm text-label-secondary">Sign in to your Clox account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight ml-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 bg-fill border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-label-secondary/30"
              placeholder="name@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 bg-fill border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-label-secondary/30"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full h-12 bg-primary text-white rounded-2xl font-bold hover:bg-primary-dark transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg"
          >
            Sign In
          </button>
        </form>

        <div className="text-center space-y-4 pt-4 border-t border-separator">
           <button
             onClick={handleLogin}
             className="w-full h-12 bg-surface border border-separator rounded-2xl flex items-center justify-center gap-3 hover:bg-surface-secondary transition-all font-medium text-sm text-label-primary"
           >
             <Image src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width={18} height={18} alt="Google logo" />
             Continue with Google
           </button>
           <p className="text-xs text-label-secondary">
             Don&apos;t have an account? <Link href="/signup" className="text-primary font-bold hover:underline">Create one</Link>
           </p>
        </div>
      </motion.div>
    </div>
  )
}

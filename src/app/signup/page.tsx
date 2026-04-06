'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    // Mock signup redirect for verification
    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md bg-white p-10 rounded-[32px] border border-[#E5E5EA] shadow-2xl space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-[#5856D6] rounded-2xl flex items-center justify-center mx-auto shadow-lg mb-4">
            <span className="text-white font-bold text-2xl">C</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-[#636366]">Get started with Clox Studio</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight ml-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 px-4 bg-[#78788033] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#5856D6]/20 outline-none transition-all"
              placeholder="Aslan Renascence"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight ml-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 bg-[#78788033] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#5856D6]/20 outline-none transition-all"
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
              className="w-full h-12 px-4 bg-[#78788033] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#5856D6]/20 outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full h-12 bg-[#5856D6] text-white rounded-2xl font-bold hover:bg-[#3634A3] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg"
          >
            Create Account
          </button>
        </form>

        <div className="text-center space-y-4 pt-4 border-t border-[#E5E5EA]">
           <button className="w-full h-12 bg-white border border-[#E5E5EA] rounded-2xl flex items-center justify-center gap-3 hover:bg-[#F2F2F7] transition-all font-medium text-sm">
             <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" alt="Google logo" />
             Continue with Google
           </button>
           <p className="text-xs text-[#636366]">
             Already have an account? <Link href="/login" className="text-[#5856D6] font-bold hover:underline">Sign in</Link>
           </p>
        </div>
      </motion.div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Image from 'next/image'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    // Set a mock session cookie to bypass the auth guard during verification or dummy mode
    document.cookie = "mock-session=true; path=/; max-age=3600"
    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen bg-surface-secondary flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md bg-surface p-10 rounded-[32px] border border-separator shadow-2xl space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg mb-4">
            <span className="text-white font-bold text-2xl">C</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-label-primary">Create an account</h1>
          <p className="text-sm text-label-secondary">Start generating with 50+ AI models</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight ml-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 px-4 bg-fill border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-label-secondary/30"
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
          <p className="text-[10px] text-label-secondary leading-relaxed px-1">
            By clicking &quot;Create Account&quot;, you agree to our <Link href="#" className="underline">Terms of Service</Link> and <Link href="#" className="underline">Privacy Policy</Link>.
          </p>
          <button
            type="submit"
            className="w-full h-12 bg-primary text-white rounded-2xl font-bold hover:bg-primary-dark transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg mt-2"
          >
            Create Account
          </button>
        </form>

        <div className="text-center space-y-4 pt-4 border-t border-separator">
           <button
             onClick={handleSignup}
             className="w-full h-12 bg-surface border border-separator rounded-2xl flex items-center justify-center gap-3 hover:bg-surface-secondary transition-all font-medium text-sm text-label-primary"
           >
             <Image src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width={18} height={18} alt="Google logo" />
             Sign up with Google
           </button>
           <p className="text-xs text-label-secondary">
             Already have an account? <Link href="/login" className="text-primary font-bold hover:underline">Sign in</Link>
           </p>
        </div>
      </motion.div>
    </div>
  )
}

'use client'

import { motion, Transition, Variants } from 'framer-motion'
import { ReactNode, useState, useEffect, isValidElement, cloneElement } from 'react'
import ThemeToggle from '@/shared/ui/components/ThemeToggle'
import LanguageSwitcher from '@/shared/ui/components/LanguageSwitcher'
import Avatar from '@/shared/ui/components/Avatar'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export const spring: Transition = { type: "spring", stiffness: 380, damping: 30 }

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } }
}

export const stagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.08 } }
}

export const cardVariant: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { ...spring, duration: 0.5 } }
}

interface AppLayoutProps {
  children: ReactNode
  sidebar: ReactNode
  rightPanel?: ReactNode
}

interface UserProfile {
  email: string
  firstName: string
  role: string
  balance: string
}

export default function AppLayout({ children, sidebar, rightPanel }: AppLayoutProps) {
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [headerSearch, setHeaderSearch] = useState('')
  const [profile, setProfile] = useState<UserProfile>({
    email: '',
    firstName: '',
    role: 'user',
    balance: '0.00',
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const email = user.email ?? ''
      const [profileRes, creditsRes] = await Promise.all([
        supabase.from('profiles').select('first_name, role').eq('id', user.id).single(),
        supabase.from('credits').select('balance_usd').eq('user_id', user.id).single(),
      ])
      setProfile({
        email,
        firstName: profileRes.data?.first_name || email.split('@')[0],
        role: profileRes.data?.role || 'user',
        balance: creditsRes.data?.balance_usd != null
          ? parseFloat(creditsRes.data.balance_usd).toFixed(2)
          : '0.00',
      })
    })
  }, [])

  const handleHeaderNew = () => {
    const newId = `chat-${Date.now()}`
    const newChat = { id: newId, title: 'New Chat', model: 'gemini-2.5-flash', createdAt: Date.now(), type: 'chat' as const }
    const saved = JSON.parse(localStorage.getItem('clox_chats') || '[]')
    localStorage.setItem('clox_chats', JSON.stringify([newChat, ...saved]))
    localStorage.setItem('activeChatId', newId)
    router.push('/text')
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Delete profile (cascades to credits, usage_logs, etc.)
    await supabase.from('profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen relative bg-gradient-to-br from-surface-secondary via-surface-tertiary to-surface-secondary text-label-primary font-sans selection:bg-teal/20 overflow-hidden p-6 gap-6">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-10 w-[500px] h-[500px] bg-brown/20 dark:bg-brown-400/15 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob-slow opacity-60 dark:opacity-70" />
        <div className="absolute top-40 -right-10 w-[500px] h-[500px] bg-teal/20 dark:bg-teal-400/15 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob-slow [animation-delay:3s] opacity-60 dark:opacity-70" />
        <div className="absolute bottom-20 left-1/3 w-[500px] h-[500px] bg-brown-300/20 dark:bg-brown-500/15 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob-slow [animation-delay:6s] opacity-60 dark:opacity-70" />
      </div>

      {/* Floating Left Sidebar */}
      <aside className="w-[280px] glass-float rounded-hig-2xl shadow-float flex-shrink-0 flex flex-col z-20 overflow-hidden">
        {/* Sidebar header: logo + search + new */}
        <div className="h-16 border-b border-separator/50 flex items-center gap-2 px-3 bg-gradient-to-br from-brown/5 to-teal/5 dark:from-brown/10 dark:to-teal/10 flex-shrink-0">
          <div className="w-9 h-9 gradient-brown-teal rounded-hig-lg flex items-center justify-center shadow-brown-glow flex-shrink-0">
            <span className="text-white font-black text-base">C</span>
          </div>
          {/* Search */}
          <div className="relative flex-grow group">
            <input
              type="text"
              placeholder="Search..."
              value={headerSearch}
              onChange={e => setHeaderSearch(e.target.value)}
              className="w-full h-8 pl-7 pr-2 bg-surface-tertiary dark:bg-surface border border-separator/30 rounded-hig-lg text-xs focus:ring-2 focus:ring-brown/20 dark:focus:ring-teal/20 focus:border-brown/30 dark:focus:border-teal/30 outline-none transition-all placeholder:text-label-tertiary text-label-primary font-medium"
            />
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-label-tertiary" fill="none" viewBox="0 0 16 16" stroke="currentColor"><path d="M7.333 12.667A5.333 5.333 0 107.333 2a5.333 5.333 0 000 10.667zm6.667 1.333L11.1 11.1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          {/* New chat button */}
          <button
            onClick={handleHeaderNew}
            className="w-8 h-8 gradient-brown-teal text-white rounded-hig-lg font-bold shadow-brown-glow hover:scale-105 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            title="New chat"
          >
            <span className="text-lg leading-none">+</span>
          </button>
        </div>

        {/* Sidebar scrollable body */}
        <div className="flex-grow overflow-y-auto custom-scrollbar">
          {isValidElement(sidebar)
            ? cloneElement(sidebar as React.ReactElement<{ externalSearch?: string }>, { externalSearch: headerSearch })
            : sidebar}
        </div>

        {/* Sidebar footer */}
        <div className="p-4 border-t border-separator/50 bg-surface-secondary/30 dark:bg-surface-tertiary/30 space-y-3 flex-shrink-0">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <a href="/gallery" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-hig-lg hover:bg-surface-tertiary dark:hover:bg-surface transition-all group">
              <svg className="w-3.5 h-3.5 text-label-secondary group-hover:text-brown dark:group-hover:text-teal transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <span className="text-[11px] font-medium text-label-secondary group-hover:text-brown dark:group-hover:text-teal transition-colors">Gallery</span>
            </a>
            <a href="/deleted" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-hig-lg hover:bg-surface-tertiary dark:hover:bg-surface transition-all group">
              <svg className="w-3.5 h-3.5 text-label-secondary group-hover:text-brown dark:group-hover:text-teal transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              <span className="text-[11px] font-medium text-label-secondary group-hover:text-brown dark:group-hover:text-teal transition-colors">Deleted</span>
            </a>
            <a href="/skills" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-hig-lg hover:bg-surface-tertiary dark:hover:bg-surface transition-all group">
              <svg className="w-3.5 h-3.5 text-label-secondary group-hover:text-brown dark:group-hover:text-teal transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              <span className="text-[11px] font-medium text-label-secondary group-hover:text-brown dark:group-hover:text-teal transition-colors">Skills</span>
            </a>
          </div>

          {/* User tile */}
          <div className="relative">
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 p-3 bg-surface-tertiary dark:bg-surface rounded-hig-xl border border-separator shadow-sm cursor-pointer hover:shadow-hig-hover hover:border-brown dark:hover:border-teal transition-all active:scale-95 group"
            >
              <Avatar seed={profile.email || 'user'} size={40} className="group-hover:scale-105 transition-transform shadow-brown-glow" />
              <div className="flex-grow min-w-0">
                <div className="text-sm font-bold truncate text-label-primary capitalize">{profile.firstName || 'Loading...'}</div>
                <div className="text-[10px] font-bold text-brown dark:text-teal uppercase tracking-widest">{profile.role.replace('_', ' ')}</div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-secondary/60 dark:bg-surface-tertiary/60 rounded-hig-lg border border-separator/30">
                <span className="text-xs font-bold text-teal-600 dark:text-teal-400">${profile.balance}</span>
                <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
              </div>
            </div>

            {/* User menu */}
            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-surface-secondary dark:bg-[#2C2C2E] rounded-hig-xl border border-separator/50 shadow-float overflow-hidden z-50">
                <div className="p-2">
                  <a href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-hig-lg hover:bg-surface-tertiary dark:hover:bg-surface transition-colors">
                    <svg className="w-4 h-4 text-label-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-sm font-medium text-label-primary">Settings</span>
                  </a>

                  <div className="h-px bg-separator/30 my-1" />

                  <div className="flex items-center justify-between px-3 py-2.5 rounded-hig-lg hover:bg-surface-tertiary dark:hover:bg-surface transition-colors">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-label-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                      <span className="text-sm font-medium text-label-primary">Language</span>
                    </div>
                    <LanguageSwitcher />
                  </div>

                  <div className="flex items-center justify-between px-3 py-2.5 rounded-hig-lg hover:bg-surface-tertiary dark:hover:bg-surface transition-colors">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-label-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                      <span className="text-sm font-medium text-label-primary">Theme</span>
                    </div>
                    <ThemeToggle />
                  </div>

                  <div className="h-px bg-separator/30 my-1" />

                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-hig-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">Sign out</span>
                  </button>

                  <div className="h-px bg-separator/30 my-1" />

                  <button
                    onClick={handleDeleteAccount}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-hig-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                  >
                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    <span className="text-sm font-medium text-red-400 dark:text-red-500">Delete account</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col min-w-0 relative z-10">
        <div className="flex-grow relative overflow-y-auto scroll-smooth custom-scrollbar rounded-hig-2xl">
          {children}
        </div>
      </main>

      {/* Floating Right Panel */}
      {rightPanel && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          transition={spring}
          className="w-[320px] glass-float rounded-hig-2xl shadow-float flex-shrink-0 z-20 overflow-hidden"
        >
          {rightPanel}
        </motion.aside>
      )}
    </div>
  )
}

import { motion, Transition, Variants } from 'framer-motion'
import { ReactNode } from 'react'
import ThemeToggle from '@/shared/ui/components/ThemeToggle'
import Avatar from '@/shared/ui/components/Avatar'

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
  topBarContent?: ReactNode
}

export default function AppLayout({ children, sidebar, rightPanel, topBarContent }: AppLayoutProps) {
  return (
    <div className="flex h-screen relative bg-gradient-to-br from-surface-secondary via-surface-tertiary to-surface-secondary text-label-primary font-sans selection:bg-teal/20 overflow-hidden p-6 gap-6">
      {/* Visible Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-10 w-[500px] h-[500px] bg-brown/20 dark:bg-brown-400/15 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob-slow opacity-60 dark:opacity-70"></div>
        <div className="absolute top-40 -right-10 w-[500px] h-[500px] bg-teal/20 dark:bg-teal-400/15 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob-slow [animation-delay:3s] opacity-60 dark:opacity-70"></div>
        <div className="absolute bottom-20 left-1/3 w-[500px] h-[500px] bg-brown-300/20 dark:bg-brown-500/15 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl animate-blob-slow [animation-delay:6s] opacity-60 dark:opacity-70"></div>
      </div>
      {/* Floating Left Sidebar (280px) - Improved Design */}
      <aside className="w-[280px] glass-float rounded-hig-2xl shadow-float flex-shrink-0 flex flex-col z-20 overflow-hidden">
        <div className="h-20 border-b border-separator/50 flex items-center px-6 bg-gradient-to-br from-brown/5 to-teal/5 dark:from-brown/10 dark:to-teal/10">
           <div className="w-10 h-10 gradient-brown-teal rounded-hig-xl flex items-center justify-center mr-3 shadow-brown-glow">
             <span className="text-white font-bold text-lg">C</span>
           </div>
           <div>
             <div className="font-bold text-lg tracking-tight">Clox Studio</div>
             <div className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">AI Platform</div>
           </div>
        </div>
        <div className="flex-grow overflow-y-auto custom-scrollbar p-4">
          {sidebar}
        </div>
        <div className="p-4 border-t border-separator/50 bg-surface-secondary/30 dark:bg-surface-tertiary/30">
           <div className="flex items-center gap-3 p-3 bg-surface-tertiary dark:bg-surface rounded-hig-xl border border-separator shadow-sm group cursor-pointer hover:shadow-hig-hover transition-all active:scale-95 hover:border-brown dark:hover:border-teal">
              <Avatar seed="aslan@renascence.io" size={40} className="group-hover:scale-105 transition-transform shadow-brown-glow" />
              <div className="flex-grow min-w-0">
                 <div className="text-sm font-bold truncate text-label-primary">Aslan</div>
                 <div className="text-[10px] font-bold text-brown dark:text-teal uppercase tracking-widest">Super Admin</div>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content with Floating Top Nav */}
      <main className="flex-grow flex flex-col min-w-0 relative z-10 gap-6">
        {/* Floating Top Navigation */}
        <nav className="glass-float rounded-hig-2xl shadow-float flex items-center px-8 h-16 justify-between flex-shrink-0">
           <div className="flex items-center gap-4">
              <a href="/gallery" className="text-sm font-semibold text-label-secondary hover:text-brown transition-all flex items-center gap-2 hover:scale-105 active:scale-95">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                 </svg>
                 <span>Gallery</span>
                 <span className="px-2 py-0.5 bg-brown-100 dark:bg-brown-900/40 text-brown-700 dark:text-brown-300 rounded-md text-xs font-bold border border-brown-200 dark:border-brown-700">42</span>
              </a>
           </div>

           <div className="flex items-center gap-6">
              {/* Top Bar Content (Model Settings, etc.) */}
              {topBarContent && (
                <>
                  {topBarContent}
                  <div className="h-6 w-[1px] bg-separator/50"></div>
                </>
              )}

              <div className="flex items-center gap-3">
                <div className="hidden md:flex bg-surface-secondary/60 px-4 py-2 rounded-hig-lg items-center gap-3 border border-separator/30">
                  <span className="text-[10px] font-bold text-label-tertiary uppercase tracking-widest">Credits</span>
                  <span className="text-sm font-bold text-teal-600">$12.40</span>
                  <div className="w-2 h-2 bg-success rounded-full shadow-sm animate-pulse"></div>
                </div>
                <ThemeToggle />
                <button className="w-9 h-9 rounded-hig-lg bg-surface-secondary/60 border border-separator/30 flex items-center justify-center hover:bg-surface hover:border-separator transition-all shadow-sm active:scale-90 text-label-secondary hover:text-label-primary">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
              </div>
           </div>
        </nav>

        {/* Content Area */}
        <div className="flex-grow relative overflow-y-auto scroll-smooth custom-scrollbar rounded-hig-2xl">
          {children}
        </div>
      </main>

      {/* Floating Right Panel (320px) */}
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

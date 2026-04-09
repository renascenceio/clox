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
}

export default function AppLayout({ children, sidebar, rightPanel }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-gradient-to-br from-surface-secondary via-surface-tertiary to-surface-secondary text-label-primary font-sans selection:bg-teal/20 overflow-hidden p-6 gap-6">
      {/* Floating Left Sidebar (260px) */}
      <aside className="w-[260px] glass-float rounded-hig-2xl shadow-float flex-shrink-0 flex flex-col z-20 overflow-hidden">
        <div className="h-16 border-b border-separator/50 flex items-center px-6">
           <div className="w-8 h-8 gradient-brown-teal rounded-hig-lg flex items-center justify-center mr-3 shadow-brown-glow">
             <span className="text-white font-bold text-sm">C</span>
           </div>
           <span className="font-bold text-base tracking-tight">Clox Studio</span>
        </div>
        <div className="flex-grow overflow-y-auto custom-scrollbar">
          {sidebar}
        </div>
        <div className="p-4 border-t border-separator/50">
           <div className="flex items-center gap-3 p-2.5 bg-surface rounded-hig-xl border border-separator shadow-sm group cursor-pointer hover:shadow-hig-hover transition-all active:scale-95">
              <Avatar seed="aslan@renascence.io" size={36} className="group-hover:scale-105 transition-transform shadow-teal-glow" />
              <div className="flex-grow min-w-0">
                 <div className="text-xs font-bold truncate">Aslan Renascence</div>
                 <div className="text-[9px] font-bold text-brown uppercase tracking-widest">Super Admin</div>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content with Floating Top Nav */}
      <main className="flex-grow flex flex-col min-w-0 relative z-10 gap-6">
        {/* Floating Top Navigation */}
        <nav className="glass-float rounded-hig-2xl shadow-float flex items-center px-8 h-16 justify-between flex-shrink-0">
           <div className="flex items-center gap-8">
              {/* Modern Segmented Control for Generator Types */}
              <div className="flex items-center gap-2 bg-surface-secondary/60 p-1.5 rounded-hig-lg border border-separator/30">
                 <NavTab href="/text" label="Text" icon={
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                   </svg>
                 } />
                 <NavTab href="/image" label="Image" icon={
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                   </svg>
                 } />
                 <NavTab href="/video" label="Video" icon={
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                   </svg>
                 } />
                 <NavTab href="/audio" label="Audio" icon={
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                   </svg>
                 } />
              </div>
              
              <div className="h-6 w-[1px] bg-separator/50"></div>
              
              <a href="/gallery" className="text-sm font-semibold text-label-secondary hover:text-brown transition-all flex items-center gap-2 hover:scale-105 active:scale-95">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                 </svg>
                 <span>Gallery</span>
                 <span className="px-2 py-0.5 bg-brown-100 text-brown-700 rounded-md text-xs font-bold border border-brown-200">42</span>
              </a>
           </div>

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

function NavTab({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const isActive = typeof window !== 'undefined' && window.location.pathname === href
  
  return (
    <a
      href={href}
      className={`flex items-center gap-2 px-4 py-2 rounded-hig-md font-semibold text-sm transition-all ${
        isActive
          ? 'bg-white text-brown shadow-hig border border-separator/50'
          : 'text-label-secondary hover:text-label-primary hover:bg-white/50'
      }`}
    >
      {icon}
      <span>{label}</span>
    </a>
  )
}

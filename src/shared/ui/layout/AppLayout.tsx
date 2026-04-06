import { motion, Transition, Variants } from 'framer-motion'
import { ReactNode } from 'react'

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
    <div className="flex h-screen bg-surface-secondary text-label-primary font-sans selection:bg-primary/30 overflow-hidden">
      {/* Sidebar (240px) */}
      <aside className="w-60 border-r border-separator bg-surface flex-shrink-0 flex flex-col z-20">
        <div className="h-14 border-b border-separator flex items-center px-6">
           <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center mr-2 shadow-sm">
             <span className="text-white font-bold text-xs">C</span>
           </div>
           <span className="font-bold text-sm tracking-tight">Clox Studio</span>
        </div>
        <div className="flex-grow overflow-y-auto custom-scrollbar">
          {sidebar}
        </div>
        <div className="p-4 border-t border-separator bg-surface-secondary/50">
           <div className="flex items-center gap-3 p-2 bg-surface rounded-2xl border border-separator shadow-sm group cursor-pointer hover:shadow-md transition-all active:scale-95">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white shadow-inner group-hover:scale-105 transition-transform">
                AR
              </div>
              <div className="flex-grow min-w-0">
                 <div className="text-xs font-bold truncate">Aslan Renascence</div>
                 <div className="text-[9px] font-bold text-primary uppercase tracking-widest">Super Admin</div>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col min-w-0 bg-surface-secondary relative z-10">
        <nav className="h-14 border-b border-separator bg-surface/80 backdrop-blur-xl flex items-center px-8 justify-between sticky top-0 z-30 shadow-sm/5">
           <div className="flex items-center gap-8">
              <div className="flex items-center gap-6 text-sm font-bold">
                 <a href="/text" className="text-label-secondary hover:text-primary transition-all hover:scale-105">Text</a>
                 <a href="/image" className="text-label-secondary hover:text-primary transition-all hover:scale-105">Image</a>
                 <a href="/video" className="text-label-secondary hover:text-primary transition-all hover:scale-105">Video</a>
                 <a href="/audio" className="text-label-secondary hover:text-primary transition-all hover:scale-105">Audio</a>
              </div>
              <div className="h-4 w-[1px] bg-separator"></div>
              <a href="/gallery" className="text-sm font-bold text-label-secondary hover:text-primary transition-all hover:scale-105 flex items-center gap-2">
                 <span>Gallery</span>
                 <span className="px-1.5 py-0.5 bg-surface-secondary rounded-md text-[10px] font-bold text-primary border border-separator">42</span>
              </a>
           </div>

           <div className="flex items-center gap-4">
              <div className="hidden md:flex bg-fill px-3 py-1.5 rounded-full items-center gap-2 border border-separator/50">
                 <span className="text-[10px] font-bold text-label-secondary uppercase tracking-widest">Credits</span>
                 <span className="text-xs font-bold text-primary">$12.40</span>
                 <div className="w-3 h-3 bg-success rounded-full shadow-inner animate-pulse"></div>
              </div>
              <button className="w-8 h-8 rounded-full bg-surface-secondary border border-separator flex items-center justify-center hover:bg-surface transition-colors shadow-sm active:scale-90">
                 <span className="text-xs">🔔</span>
              </button>
           </div>
        </nav>

        <div className="flex-grow relative overflow-y-auto scroll-smooth custom-scrollbar">
          {children}
        </div>
      </main>

      {/* Settings Panel (280px) */}
      {rightPanel && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          transition={spring}
          className="w-[280px] border-l border-separator bg-surface flex-shrink-0 z-20 shadow-2xl shadow-black/5"
        >
          {rightPanel}
        </motion.aside>
      )}
    </div>
  )
}

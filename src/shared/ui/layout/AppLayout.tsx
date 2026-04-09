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
        <div className="p-4 border-t border-separator/50 bg-surface-secondary/30 dark:bg-surface-tertiary/30 space-y-3">
           {/* Credits & Theme */}
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-2 bg-surface-tertiary/60 dark:bg-surface/60 px-3 py-2 rounded-hig-lg border border-separator/30">
               <span className="text-[10px] font-bold text-label-tertiary uppercase tracking-widest">Credits</span>
               <span className="text-xs font-bold text-teal-600 dark:text-teal-400">$12.40</span>
               <div className="w-1.5 h-1.5 bg-success rounded-full shadow-sm animate-pulse"></div>
             </div>
             <ThemeToggle />
           </div>
           
           {/* User Profile */}
           <div className="flex items-center gap-3 p-3 bg-surface-tertiary dark:bg-surface rounded-hig-xl border border-separator shadow-sm group cursor-pointer hover:shadow-hig-hover transition-all active:scale-95 hover:border-brown dark:hover:border-teal">
              <Avatar seed="aslan@renascence.io" size={40} className="group-hover:scale-105 transition-transform shadow-brown-glow" />
              <div className="flex-grow min-w-0">
                 <div className="text-sm font-bold truncate text-label-primary">Aslan</div>
                 <div className="text-[10px] font-bold text-brown dark:text-teal uppercase tracking-widest">Super Admin</div>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content - No Top Bar */}
      <main className="flex-grow flex flex-col min-w-0 relative z-10">
        {/* Content Area - Full Height */}
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

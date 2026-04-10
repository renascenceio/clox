import { motion, Transition, Variants } from 'framer-motion'
import { ReactNode, useState } from 'react'
import ThemeToggle from '@/shared/ui/components/ThemeToggle'
import LanguageSwitcher from '@/shared/ui/components/LanguageSwitcher'
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
  const [showUserMenu, setShowUserMenu] = useState(false)
  
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
        <div className="h-16 border-b border-separator/50 flex items-center px-4 bg-gradient-to-br from-brown/5 to-teal/5 dark:from-brown/10 dark:to-teal/10">
           {/* Logo Icon Only */}
           <div className="w-9 h-9 gradient-brown-teal rounded-hig-lg flex items-center justify-center shadow-brown-glow">
             <span className="text-white font-bold text-base">C</span>
           </div>
        </div>
        <div className="flex-grow overflow-y-auto custom-scrollbar p-4">
          {sidebar}
        </div>
        <div className="p-4 border-t border-separator/50 bg-surface-secondary/30 dark:bg-surface-tertiary/30 space-y-3">
           {/* Gallery & Deleted Links */}
           <div className="flex items-center justify-center gap-4">
             <a 
               href="/gallery" 
               className="flex items-center gap-2 px-3 py-2 rounded-hig-lg hover:bg-surface-tertiary dark:hover:bg-surface transition-all group"
             >
               <svg className="w-4 h-4 text-label-secondary group-hover:text-brown dark:group-hover:text-teal transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
               </svg>
               <span className="text-xs font-medium text-label-secondary group-hover:text-brown dark:group-hover:text-teal transition-colors">Gallery</span>
             </a>
             <a 
               href="/deleted" 
               className="flex items-center gap-2 px-3 py-2 rounded-hig-lg hover:bg-surface-tertiary dark:hover:bg-surface transition-all group"
             >
               <svg className="w-4 h-4 text-label-secondary group-hover:text-brown dark:group-hover:text-teal transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
               </svg>
               <span className="text-xs font-medium text-label-secondary group-hover:text-brown dark:group-hover:text-teal transition-colors">Deleted</span>
             </a>
           </div>
           
           {/* User Profile with Credits and Menu */}
           <div className="relative">
             <div 
               onClick={() => setShowUserMenu(!showUserMenu)}
               className="flex items-center gap-3 p-3 bg-surface-tertiary dark:bg-surface rounded-hig-xl border border-separator shadow-sm group cursor-pointer hover:shadow-hig-hover transition-all active:scale-95 hover:border-brown dark:hover:border-teal"
             >
                <Avatar seed="aslan@renascence.io" size={40} className="group-hover:scale-105 transition-transform shadow-brown-glow" />
                <div className="flex-grow min-w-0">
                   <div className="text-sm font-bold truncate text-label-primary">Aslan</div>
                   <div className="text-[10px] font-bold text-brown dark:text-teal uppercase tracking-widest">Admin</div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-secondary/60 dark:bg-surface-tertiary/60 rounded-hig-lg border border-separator/30">
                  <span className="text-xs font-bold text-teal-600 dark:text-teal-400">$12.40</span>
                  <div className="w-1.5 h-1.5 bg-success rounded-full shadow-sm animate-pulse"></div>
                </div>
             </div>
             
             {/* User Menu Dropdown */}
             {showUserMenu && (
               <div className="absolute bottom-full left-0 right-0 mb-2 bg-surface-secondary dark:bg-[#2C2C2E] rounded-hig-xl border border-separator/50 shadow-float overflow-hidden z-50">
                 <div className="p-2">
                   {/* Settings */}
                   <a 
                     href="/admin"
                     className="flex items-center gap-3 px-3 py-2.5 rounded-hig-lg hover:bg-surface-tertiary dark:hover:bg-surface transition-colors"
                   >
                     <svg className="w-4 h-4 text-label-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                     </svg>
                     <span className="text-sm font-medium text-label-primary">Settings</span>
                   </a>
                   
                   <div className="h-px bg-separator/30 my-1"></div>
                   
                   {/* Language */}
                   <div className="flex items-center justify-between px-3 py-2.5 rounded-hig-lg hover:bg-surface-tertiary dark:hover:bg-surface transition-colors">
                     <div className="flex items-center gap-3">
                       <svg className="w-4 h-4 text-label-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                       </svg>
                       <span className="text-sm font-medium text-label-primary">Language</span>
                     </div>
                     <LanguageSwitcher />
                   </div>
                   
                   {/* Theme */}
                   <div className="flex items-center justify-between px-3 py-2.5 rounded-hig-lg hover:bg-surface-tertiary dark:hover:bg-surface transition-colors">
                     <div className="flex items-center gap-3">
                       <svg className="w-4 h-4 text-label-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                       </svg>
                       <span className="text-sm font-medium text-label-primary">Theme</span>
                     </div>
                     <ThemeToggle />
                   </div>
                 </div>
               </div>
             )}
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

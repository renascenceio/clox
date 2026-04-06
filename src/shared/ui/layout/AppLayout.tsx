import { motion, Transition, Variants } from 'framer-motion'
import { ReactNode } from 'react'

export const spring: Transition = { type: "spring", stiffness: 380, damping: 30 }

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } }
}

export const stagger: Variants = { animate: { transition: { staggerChildren: 0.06 } } }

export const cardVariant: Variants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: spring }
}

interface AppLayoutProps {
  children: ReactNode
  sidebar: ReactNode
  rightPanel?: ReactNode
}

export default function AppLayout({ children, sidebar, rightPanel }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-[#F2F2F7] text-[#1C1C1E] overflow-hidden">
      {/* Sidebar (240px) */}
      <aside className="w-60 border-r border-[#E5E5EA] bg-white flex-shrink-0 flex flex-col">
        {sidebar}
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col min-w-0 bg-[#F2F2F7]">
        <nav className="h-14 border-b border-[#E5E5EA] bg-white/80 backdrop-blur-md flex items-center px-4 justify-between sticky top-0 z-10">
           <div className="font-semibold text-[#5856D6] text-xl tracking-tight">Clox Studio</div>
           <div className="flex items-center gap-6 text-sm font-medium">
              <a href="/text" className="text-[#1C1C1E] hover:text-[#5856D6] transition-colors duration-200">Text</a>
              <a href="/image" className="text-[#1C1C1E] hover:text-[#5856D6] transition-colors duration-200">Image</a>
              <a href="/video" className="text-[#1C1C1E] hover:text-[#5856D6] transition-colors duration-200">Video</a>
              <a href="/audio" className="text-[#1C1C1E] hover:text-[#5856D6] transition-colors duration-200">Audio</a>
              <a href="/gallery" className="text-[#1C1C1E] hover:text-[#5856D6] transition-colors duration-200">Gallery</a>
           </div>
           <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-[#5856D6]/10 flex items-center justify-center text-xs font-bold text-[#5856D6] border border-[#5856D6]/20">
                JS
              </div>
           </div>
        </nav>

        <div className="flex-grow relative overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Settings Panel (280px) */}
      {rightPanel && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          transition={spring}
          className="w-[280px] border-l border-[#E5E5EA] bg-white flex-shrink-0"
        >
          {rightPanel}
        </motion.aside>
      )}
    </div>
  )
}

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface SidebarProps {
  children: ReactNode
}

export default function ChatSidebar({ children }: SidebarProps) {
  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="p-4 border-b border-separator">
        <button className="w-full h-10 bg-primary hover:bg-primary-light text-white rounded-xl font-medium transition-colors shadow-hig">
          + New Chat
        </button>
      </div>
      <div className="flex-grow overflow-y-auto px-2 py-4 space-y-1">
        <div className="text-[11px] font-bold text-label-secondary px-2 mb-2 uppercase tracking-tight">
          Recent
        </div>
        {children}
      </div>
      <div className="p-4 border-t border-separator bg-surface-secondary/50">
        <div className="flex items-center space-x-3 group cursor-pointer">
           <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">JS</div>
           <div className="flex-grow min-w-0">
             <div className="text-sm font-medium truncate">Jules Software</div>
             <div className="text-xs text-label-secondary truncate">Super Admin</div>
           </div>
        </div>
      </div>
    </div>
  )
}

export function SidebarItem({ title, active }: { title: string; active?: boolean }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
        active
          ? "bg-primary/10 text-primary font-medium"
          : "hover:bg-fill text-label hover:text-primary-light"
      }`}
    >
      <div className="text-sm truncate">{title}</div>
    </motion.div>
  )
}

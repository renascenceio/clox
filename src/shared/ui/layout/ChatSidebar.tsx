import { motion } from 'framer-motion'
import { ReactNode, useState } from 'react'

interface ChatSidebarProps {
  children?: ReactNode
}

export default function ChatSidebar({ children }: ChatSidebarProps) {
  const [search, setSearch] = useState('')

  const handleNewChat = () => {
    // Clear localStorage to reset recent activity
    localStorage.removeItem('clox_recent_chats')
    // Reload the page to clear state
    window.location.reload()
  }

  return (
    <div className="flex flex-col h-full bg-surface dark:bg-surface-secondary">
      <div className="p-5 space-y-4">
        <button 
          onClick={handleNewChat}
          className="w-full h-11 gradient-brown-teal text-white rounded-hig-xl font-bold transition-all shadow-brown-glow hover:shadow-hig-hover hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span className="text-lg">+</span> New Chat
        </button>

        <div className="relative group">
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 bg-surface-tertiary dark:bg-surface border border-separator/30 rounded-hig-lg text-xs focus:ring-2 focus:ring-brown/20 dark:focus:ring-teal/20 focus:border-brown/30 dark:focus:border-teal/30 outline-none transition-all placeholder:text-label-tertiary text-label-primary font-medium"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-label-secondary/40 group-focus-within:text-brown transition-colors">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 14L11.1 11.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto px-3 space-y-6 custom-scrollbar pb-10">
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-label-secondary px-3 mb-2 uppercase tracking-widest flex justify-between items-center">
            <span>Recent Activity</span>
            <span className="w-1 h-1 rounded-full bg-primary/40"></span>
          </div>
          <div className="space-y-0.5">
             {children || (
               <>
                 <SidebarItem title="Initial prompt..." model="GPT-4o" active />
                 <SidebarItem title="Refining the code" model="Claude 3.5" />
                 <SidebarItem title="Marketing ideas" model="Gemini Pro" />
               </>
             )}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[10px] font-bold text-label-secondary px-3 mb-2 uppercase tracking-widest">
            Folders
          </div>
          <div className="space-y-0.5">
            <FolderItem title="Project Phoenix" count={12} />
            <FolderItem title="Social Content" count={5} />
            <FolderItem title="Research" count={3} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function SidebarItem({ title, model, active }: { title: string; model?: string; active?: boolean }) {
  return (
    <motion.div
      whileHover={{ x: 4 }}
      className={`group px-3 py-2.5 rounded-hig-lg cursor-pointer transition-all flex items-center justify-between relative ${
        active
          ? "bg-brown-50 text-brown-700 border border-brown-200"
          : "hover:bg-fill text-label-primary"
      }`}
    >
      <div className="flex-grow min-w-0 mr-2">
        <div className={`text-sm font-bold truncate ${active ? 'text-brown-700' : 'text-label-primary'}`}>
          {title}
        </div>
        {model && (
          <div className={`text-[10px] font-medium opacity-50 truncate`}>
            {model}
          </div>
        )}
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <button className="w-5 h-5 rounded-md hover:bg-white/50 flex items-center justify-center text-xs text-label-secondary transition-colors">
          ⋯
        </button>
      </div>
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 top-2 bottom-2 w-1 bg-brown rounded-full shadow-brown-glow"
        />
      )}
    </motion.div>
  )
}

function FolderItem({ title, count }: { title: string; count: number }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="group px-3 py-2 rounded-hig-lg cursor-pointer transition-all hover:bg-surface-tertiary dark:hover:bg-surface flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <svg 
            className={`w-3 h-3 text-label-secondary group-hover:text-brown dark:group-hover:text-teal transition-all ${isExpanded ? 'rotate-90' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-4 h-4 text-label-secondary group-hover:text-brown dark:group-hover:text-teal transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="text-sm font-medium text-label-primary group-hover:text-brown dark:group-hover:text-teal truncate">{title}</span>
        </div>
        <span className="text-[10px] font-bold text-label-secondary group-hover:text-teal dark:group-hover:text-brown transition-colors">
          {count}
        </span>
      </div>
      {isExpanded && (
        <div className="ml-6 mt-1 space-y-0.5">
          <div className="px-3 py-1.5 text-xs text-label-secondary hover:text-label-primary cursor-pointer transition-colors">
            Chat item 1
          </div>
          <div className="px-3 py-1.5 text-xs text-label-secondary hover:text-label-primary cursor-pointer transition-colors">
            Chat item 2
          </div>
        </div>
      )}
    </div>
  )
}

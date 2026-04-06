import { motion } from 'framer-motion'
import { ReactNode, useState } from 'react'

interface ChatSidebarProps {
  children?: ReactNode
}

export default function ChatSidebar({ children }: ChatSidebarProps) {
  const [search, setSearch] = useState('')

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="p-5 space-y-4">
        <button className="w-full h-11 bg-primary text-white rounded-2xl font-bold transition-all shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
          <span className="text-lg">+</span> New Chat
        </button>

        <div className="relative group">
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 bg-fill border-none rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-label-secondary/50 font-medium"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-label-secondary/40 group-focus-within:text-primary transition-colors">
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
      className={`group px-3 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between relative ${
        active
          ? "bg-primary/5 text-primary"
          : "hover:bg-fill text-label-primary"
      }`}
    >
      <div className="flex-grow min-w-0 mr-2">
        <div className={`text-sm font-bold truncate ${active ? 'text-primary' : 'text-label-primary'}`}>
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
          className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-full shadow-[0_0_8px_rgba(88,86,214,0.4)]"
        />
      )}
    </motion.div>
  )
}

function FolderItem({ title, count }: { title: string; count: number }) {
  return (
    <div className="group px-3 py-2 rounded-xl cursor-pointer transition-all hover:bg-fill flex items-center justify-between">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-xs opacity-40 group-hover:opacity-100 transition-opacity">📁</span>
        <span className="text-sm font-medium text-label-primary truncate">{title}</span>
      </div>
      <span className="text-[10px] font-bold text-label-secondary/40 group-hover:text-primary transition-colors">
        {count}
      </span>
    </div>
  )
}

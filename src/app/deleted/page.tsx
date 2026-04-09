'use client'

import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar from '@/shared/ui/layout/ChatSidebar'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

interface DeletedItem {
  id: string
  title: string
  type: 'chat' | 'project'
  deletedAt: number
  model?: string
}

export default function DeletedPage() {
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  useEffect(() => {
    // Load deleted items from localStorage
    const saved = localStorage.getItem('deleted-items')
    if (saved) {
      const items: DeletedItem[] = JSON.parse(saved)
      // Filter out items older than 30 days
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
      const validItems = items.filter(item => item.deletedAt > thirtyDaysAgo)
      setDeletedItems(validItems)
      // Update localStorage if any items were removed
      if (validItems.length !== items.length) {
        localStorage.setItem('deleted-items', JSON.stringify(validItems))
      }
    }
  }, [])

  const getDaysRemaining = (deletedAt: number) => {
    const thirtyDaysFromDeletion = deletedAt + (30 * 24 * 60 * 60 * 1000)
    const remaining = thirtyDaysFromDeletion - Date.now()
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)))
  }

  const handleRestore = (id: string) => {
    const item = deletedItems.find(i => i.id === id)
    if (!item) return

    // Remove from deleted items
    const updatedDeleted = deletedItems.filter(i => i.id !== id)
    setDeletedItems(updatedDeleted)
    localStorage.setItem('deleted-items', JSON.stringify(updatedDeleted))

    // Restore to chats
    const chats = JSON.parse(localStorage.getItem('sidebar-chats') || '[]')
    chats.unshift({
      id: item.id,
      title: item.title,
      type: item.type,
      model: item.model || 'Restored',
      createdAt: Date.now(),
    })
    localStorage.setItem('sidebar-chats', JSON.stringify(chats))
  }

  const handlePermanentDelete = (id: string) => {
    const updatedDeleted = deletedItems.filter(i => i.id !== id)
    setDeletedItems(updatedDeleted)
    localStorage.setItem('deleted-items', JSON.stringify(updatedDeleted))
    // Also permanently clear chat history and settings
    localStorage.removeItem(`chat-history-${id}`)
    localStorage.removeItem(`chat-settings-${id}`)
  }

  const handleRestoreSelected = () => {
    selectedItems.forEach(id => handleRestore(id))
    setSelectedItems([])
  }

  const handleDeleteSelected = () => {
    selectedItems.forEach(id => handlePermanentDelete(id))
    setSelectedItems([])
  }

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  return (
    <AppLayout sidebar={<ChatSidebar />}>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-label-primary mb-2">Deleted Items</h1>
          <p className="text-sm text-label-secondary">Items are permanently deleted after 30 days</p>
        </div>

        {/* Bulk Actions */}
        {selectedItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-surface-tertiary dark:bg-surface rounded-hig-xl border border-separator flex items-center justify-between"
          >
            <span className="text-sm font-medium text-label-primary">
              {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleRestoreSelected}
                className="px-4 py-2 text-sm font-bold text-brown dark:text-teal hover:bg-brown/10 dark:hover:bg-teal/10 rounded-hig-lg transition-colors"
              >
                Restore All
              </button>
              <button
                onClick={handleDeleteSelected}
                className="px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-hig-lg transition-colors"
              >
                Delete Permanently
              </button>
            </div>
          </motion.div>
        )}

        {/* Deleted Items List */}
        {deletedItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-tertiary dark:bg-surface flex items-center justify-center">
              <svg className="w-8 h-8 text-label-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-label-primary mb-2">No deleted items</h3>
            <p className="text-sm text-label-secondary">Deleted chats and projects will appear here for 30 days</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {deletedItems.map(item => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-4 p-4 bg-surface-tertiary/50 dark:bg-surface/50 rounded-hig-xl border border-separator/30 hover:border-separator transition-colors group"
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelect(item.id)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      selectedItems.includes(item.id)
                        ? 'bg-brown dark:bg-teal border-brown dark:border-teal'
                        : 'border-separator hover:border-brown dark:hover:border-teal'
                    }`}
                  >
                    {selectedItems.includes(item.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-hig-lg flex items-center justify-center ${
                    item.type === 'project' 
                      ? 'bg-brown/10 dark:bg-teal/10' 
                      : 'bg-surface-tertiary dark:bg-surface'
                  }`}>
                    {item.type === 'project' ? (
                      <svg className="w-5 h-5 text-brown dark:text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-label-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-grow min-w-0">
                    <div className="text-sm font-bold text-label-primary truncate">{item.title}</div>
                    <div className="text-[10px] text-label-tertiary uppercase tracking-widest">
                      {item.type === 'project' ? 'Project' : item.model || 'Chat'} • {getDaysRemaining(item.deletedAt)} days remaining
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleRestore(item.id)}
                      className="px-3 py-1.5 text-xs font-bold text-brown dark:text-teal hover:bg-brown/10 dark:hover:bg-teal/10 rounded-hig-lg transition-colors"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(item.id)}
                      className="px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-hig-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

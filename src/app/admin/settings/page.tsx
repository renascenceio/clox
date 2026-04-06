'use client'

import { motion } from 'framer-motion'
import { stagger, cardVariant } from '@/shared/ui/layout/AppLayout'

export default function PlatformSettingsPage() {
  const sections = [
    { title: 'General', items: [
      { label: 'Site Name', type: 'text', value: 'Clox Studio' },
      { label: 'Tagline', type: 'text', value: 'The Centralized AI Workspace' },
      { label: 'Maintenance Mode', type: 'toggle', value: false },
    ]},
    { title: 'Registration', items: [
      { label: 'Open Registration', type: 'toggle', value: true },
      { label: 'Invite-only', type: 'toggle', value: false },
      { label: 'Allowed Domains', type: 'text', value: 'renascence.io, google.com' },
    ]},
    { title: 'Workspaces', items: [
      { label: 'Enable Text', type: 'toggle', value: true },
      { label: 'Enable Image', type: 'toggle', value: true },
      { label: 'Enable Video', type: 'toggle', value: true },
      { label: 'Enable Audio', type: 'toggle', value: true },
    ]},
  ]

  return (
    <div className="p-10 bg-surface-secondary min-h-screen">
      <div className="max-w-4xl mx-auto space-y-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
          <p className="text-label-secondary mt-1">Configure global application behavior</p>
        </header>

        <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-12">
           {sections.map(section => (
             <motion.section key={section.title} variants={cardVariant} className="bg-surface border border-separator rounded-3xl overflow-hidden shadow-sm">
                <div className="px-8 py-6 border-b border-separator flex items-center justify-between">
                   <h2 className="font-bold">{section.title}</h2>
                </div>
                <div className="p-0">
                   {section.items.map((item, idx) => (
                     <div key={item.label} className={`px-8 py-6 flex items-center justify-between ${idx !== section.items.length - 1 ? 'border-b border-separator' : ''}`}>
                        <div>
                           <div className="text-sm font-medium">{item.label}</div>
                        </div>
                        {item.type === 'toggle' ? (
                          <div className={`w-12 h-6 rounded-full p-1 transition-colors ${item.value ? 'bg-success' : 'bg-separator'}`}>
                             <div className={`w-4 h-4 bg-white rounded-full transition-transform ${item.value ? 'translate-x-6' : ''}`} />
                          </div>
                        ) : (
                          <input type="text" value={item.value as string} readOnly className="h-10 px-3 bg-fill border-none rounded-lg text-sm text-right focus:ring-2 focus:ring-primary/20 outline-none w-64" />
                        )}
                     </div>
                   ))}
                </div>
             </motion.section>
           ))}
        </motion.div>
      </div>
    </div>
  )
}

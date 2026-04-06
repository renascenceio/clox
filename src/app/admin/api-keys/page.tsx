'use client'

import { motion } from 'framer-motion'
import { stagger, cardVariant } from '@/shared/ui/layout/AppLayout'
import { useState } from 'react'

export default function ApiKeysPage() {
  const [keys] = useState([
    { provider: 'OpenAI', status: 'Connected', lastCheck: '2m ago', spend: '$42.10', cap: '$200.00' },
    { provider: 'Anthropic', status: 'Connected', lastCheck: '5m ago', spend: '$12.50', cap: '$100.00' },
    { provider: 'Google', status: 'Error', lastCheck: '1m ago', spend: '$0.00', cap: '$50.00' },
    { provider: 'Stability AI', status: 'Connected', lastCheck: '12m ago', spend: '$15.20', cap: '$50.00' },
  ])

  return (
    <div className="p-10 bg-surface-secondary min-h-screen">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="flex justify-between items-end">
           <div>
             <h1 className="text-3xl font-bold tracking-tight">AI API Configuration</h1>
             <p className="text-label-secondary mt-1">Manage credentials and model availability</p>
           </div>
        </header>

        <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {keys.map(k => (
             <motion.div key={k.provider} variants={cardVariant} className="bg-surface border border-separator rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-separator flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary">{k.provider[0]}</div>
                      <div>
                        <h3 className="font-bold">{k.provider}</h3>
                        <div className={`text-[10px] uppercase font-bold tracking-widest ${k.status === 'Error' ? 'text-destructive' : 'text-success'}`}>{k.status}</div>
                      </div>
                   </div>
                   <button className="text-xs font-medium text-primary hover:text-primary-light">Test Connection</button>
                </div>
                <div className="p-6 space-y-6">
                   <div className="space-y-2">
                      <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight">API Key</label>
                      <div className="flex gap-2">
                         <input type="password" value="sk-........................" readOnly className="flex-grow h-10 px-3 bg-fill border-none rounded-lg text-sm" />
                         <button className="px-4 bg-surface border border-separator rounded-lg text-sm font-medium">Edit</button>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                         <div className="text-[11px] font-bold text-label-secondary uppercase tracking-tight">Spend this month</div>
                         <div className="text-lg font-bold">{k.spend}</div>
                      </div>
                      <div className="space-y-1 text-right">
                         <div className="text-[11px] font-bold text-label-secondary uppercase tracking-tight">Monthly Cap</div>
                         <div className="text-lg font-bold">{k.cap}</div>
                      </div>
                   </div>
                   <div className="pt-4 border-t border-separator flex justify-between items-center">
                      <div className="text-xs text-label-secondary">Last health check: {k.lastCheck}</div>
                      <div className="flex gap-2">
                         <button className="text-xs font-medium px-3 py-1.5 rounded-lg border border-separator hover:bg-fill">Models</button>
                      </div>
                   </div>
                </div>
             </motion.div>
           ))}
        </motion.div>
      </div>
    </div>
  )
}

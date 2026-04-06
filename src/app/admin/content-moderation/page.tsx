'use client'

export default function ModerationPage() {
  const flaggedItems = [
    { id: '1', type: 'Image', user: 'user@example.com', reason: 'NSFW', model: 'SDXL', timestamp: '10m ago' },
    { id: '2', type: 'Text', user: 'anonymous@clox.ai', reason: 'Toxic content', model: 'GPT-4o', timestamp: '1h ago' },
  ]

  return (
    <div className="p-10 bg-surface-secondary min-h-screen">
      <div className="max-w-6xl mx-auto space-y-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Content Moderation</h1>
          <p className="text-label-secondary mt-1">Review flagged generations and enforce policies</p>
        </header>

        <section className="bg-surface border border-separator rounded-3xl overflow-hidden shadow-sm">
           <div className="p-0">
              <table className="w-full text-left">
                 <thead className="bg-fill border-b border-separator">
                    <tr>
                       <th className="px-8 py-4 text-[11px] font-bold text-label-secondary uppercase tracking-tight">Content</th>
                       <th className="px-8 py-4 text-[11px] font-bold text-label-secondary uppercase tracking-tight">Reason</th>
                       <th className="px-8 py-4 text-[11px] font-bold text-label-secondary uppercase tracking-tight">User</th>
                       <th className="px-8 py-4 text-[11px] font-bold text-label-secondary uppercase tracking-tight text-right">Actions</th>
                    </tr>
                 </thead>
                 <tbody>
                    {flaggedItems.map(item => (
                      <tr key={item.id} className="border-b border-separator last:border-none hover:bg-fill transition-colors">
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">{item.type[0]}</div>
                               <div>
                                  <div className="text-sm font-medium">{item.type} Generation</div>
                                  <div className="text-xs text-label-secondary">{item.model} · {item.timestamp}</div>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <span className="px-2 py-1 bg-destructive/10 text-destructive text-[10px] font-bold uppercase rounded-full tracking-wider">{item.reason}</span>
                         </td>
                         <td className="px-8 py-6 text-sm text-label-secondary">{item.user}</td>
                         <td className="px-8 py-6 text-right">
                            <div className="flex justify-end gap-3">
                               <button className="text-xs font-medium text-success hover:underline">Approve</button>
                               <button className="text-xs font-medium text-destructive hover:underline">Remove</button>
                            </div>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </section>
      </div>
    </div>
  )
}

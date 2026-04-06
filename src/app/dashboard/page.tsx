'use client'
import AppLayout from '@/shared/ui/layout/AppLayout'

export default function DashboardPage() {
  return (
    <AppLayout sidebar={<div className="p-4 text-xs font-bold text-label-secondary uppercase tracking-wider">Dashboard</div>}>
      <div className="p-10 space-y-8 max-w-6xl mx-auto">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, Aslan</h1>
          <p className="text-label-secondary mt-2">Here&apos;s an overview of your AI generations and projects.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Total Generations', value: '1,284', delta: '+12%' },
            { label: 'Saved Items', value: '42', delta: '+5' },
            { label: 'Projects', value: '8', delta: '0' },
            { label: 'API Spend', value: '$12.40', delta: '-15%' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white p-6 rounded-20px shadow-hig border border-separator">
              <div className="text-[11px] font-bold text-label-secondary uppercase tracking-tight">{stat.label}</div>
              <div className="text-2xl font-bold mt-2">{stat.value}</div>
              <div className={`text-[10px] font-medium mt-1 ${stat.delta.startsWith('+') ? 'text-success' : 'text-label-secondary'}`}>
                {stat.delta} from last week
              </div>
            </div>
          ))}
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Recent Activity</h2>
          <div className="bg-white rounded-20px shadow-hig border border-separator overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-secondary border-b border-separator text-[11px] font-bold text-label-secondary uppercase">
                <tr>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Model</th>
                  <th className="px-6 py-3">Prompt</th>
                  <th className="px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator">
                {[
                  { type: 'Text', model: 'GPT-4o', prompt: 'Write a blog post about Apple HIG...', date: '2m ago' },
                  { type: 'Image', model: 'DALL-E 3', prompt: 'A futuristic workspace in indigo colors...', date: '1h ago' },
                  { type: 'Video', model: 'Runway Gen-3', prompt: 'Cinematic drone shot of a mountain...', date: '5h ago' },
                ].map((item, i) => (
                  <tr key={i} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className="px-6 py-4 font-medium">{item.type}</td>
                    <td className="px-6 py-4 text-label-secondary">{item.model}</td>
                    <td className="px-6 py-4 text-label-secondary truncate max-w-xs">{item.prompt}</td>
                    <td className="px-6 py-4 text-label-secondary">{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppLayout>
  )
}

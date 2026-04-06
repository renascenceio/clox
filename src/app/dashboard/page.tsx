'use client'
import AppLayout from '@/shared/ui/layout/AppLayout'
import { motion } from 'framer-motion'
import { stagger, cardVariant } from '@/shared/ui/layout/AppLayout'
import Image from 'next/image'

const stats = [
  { label: 'Total Generations', value: '1,284', delta: '+12%', icon: '✨' },
  { label: 'Saved Items', value: '42', delta: '+5', icon: '🔖' },
  { label: 'Active Projects', value: '8', delta: '0', icon: '📁' },
  { label: 'API Credits Used', value: '$12.40', delta: '-15%', icon: '💳' },
]

const recentActivity = [
  { id: 1, type: 'Text', model: 'GPT-4o', title: 'Blog Post Draft', prompt: 'Write a blog post about Apple HIG...', date: '2m ago', color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 2, type: 'Image', model: 'DALL-E 3', title: 'Architecture Concept', prompt: 'A futuristic workspace in indigo colors...', date: '1h ago', color: 'text-purple-500', bg: 'bg-purple-50', thumb: 'https://picsum.photos/seed/dash1/400/300' },
  { id: 3, type: 'Video', model: 'Runway Gen-3', title: 'Cinematic Drone', prompt: 'Cinematic drone shot of a mountain...', date: '5h ago', color: 'text-orange-500', bg: 'bg-orange-50', thumb: 'https://picsum.photos/seed/dash2/400/300' },
  { id: 4, type: 'Audio', model: 'ElevenLabs', title: 'Voiceover English', prompt: 'The future of AI is here today...', date: '1d ago', color: 'text-green-500', bg: 'bg-green-50' },
]

export default function DashboardPage() {
  return (
    <AppLayout sidebar={
      <div className="p-6 space-y-6">
        <div className="space-y-1">
          <h2 className="text-[11px] font-bold text-label-secondary uppercase tracking-widest px-2">Overview</h2>
          <nav className="space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2 bg-primary/10 text-primary rounded-xl text-sm font-semibold transition-all shadow-sm">
              <span>🏠</span> Dashboard
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 text-label-primary hover:bg-fill rounded-xl text-sm font-medium transition-all group">
              <span className="group-hover:scale-110 transition-transform">⭐</span> Pinned
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 text-label-primary hover:bg-fill rounded-xl text-sm font-medium transition-all group">
              <span className="group-hover:scale-110 transition-transform">🕒</span> History
            </button>
          </nav>
        </div>

        <div className="space-y-1">
          <h2 className="text-[11px] font-bold text-label-secondary uppercase tracking-widest px-2">Your Projects</h2>
          <nav className="space-y-1">
            {['Portfolio v1', 'Social Media', 'Research'].map(p => (
              <button key={p} className="w-full flex items-center gap-3 px-3 py-2 text-label-primary hover:bg-fill rounded-xl text-sm font-medium transition-all group">
                <span className="text-xs opacity-40 group-hover:opacity-100 group-hover:scale-125 transition-all">📁</span> {p}
              </button>
            ))}
          </nav>
        </div>
      </div>
    }>
      <div className="p-10 space-y-12 max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-label-primary">Welcome, Aslan</h1>
            <p className="text-label-secondary text-lg">Here&apos;s what&apos;s happening with your creative projects today.</p>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-2.5 bg-surface border border-separator rounded-2xl text-sm font-bold shadow-sm hover:bg-surface-secondary transition-all active:scale-95">
              Export Stats
            </button>
            <button className="px-5 py-2.5 bg-primary text-white rounded-2xl text-sm font-bold shadow-lg hover:bg-primary-dark transition-all active:scale-95">
              New Generation
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={cardVariant}
              whileHover={{ y: -4, scale: 1.02 }}
              className="bg-surface p-6 rounded-[24px] shadow-hig border border-separator relative overflow-hidden group cursor-pointer transition-shadow hover:shadow-hig-hover"
            >
              <div className="absolute top-0 right-0 p-4 text-2xl opacity-10 group-hover:opacity-20 group-hover:scale-125 transition-all duration-500">
                {stat.icon}
              </div>
              <div className="text-[11px] font-bold text-label-secondary uppercase tracking-widest">{stat.label}</div>
              <div className="text-3xl font-bold mt-2 text-label-primary">{stat.value}</div>
              <div className="mt-4 flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  stat.delta.startsWith('+') ? 'bg-success/10 text-success' : 'bg-label-secondary/10 text-label-secondary'
                }`}>
                  {stat.delta}
                </span>
                <span className="text-[10px] text-label-secondary font-medium tracking-tight">from last week</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Recent Activity Card Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-label-primary">Recent Activity</h2>
            <button className="text-sm font-bold text-primary hover:underline transition-all">View All</button>
          </div>

          <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {recentActivity.map((activity) => (
              <motion.div
                key={activity.id}
                variants={cardVariant}
                whileHover={{ y: -8, scale: 1.01 }}
                className="bg-surface rounded-[24px] border border-separator shadow-hig overflow-hidden flex flex-col group cursor-pointer h-full transition-shadow hover:shadow-hig-hover"
              >
                <div className="relative h-40 bg-surface-secondary flex items-center justify-center overflow-hidden">
                  {activity.thumb ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={activity.thumb}
                        alt={activity.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    </div>
                  ) : (
                    <div className={`w-16 h-16 rounded-3xl ${activity.bg} ${activity.color} flex items-center justify-center text-3xl font-bold shadow-inner border border-white/50`}>
                      {activity.type[0]}
                    </div>
                  )}
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1.5 border border-white/50">
                    <span className={`w-1.5 h-1.5 rounded-full ${activity.type === 'Image' ? 'bg-purple-500' : activity.type === 'Video' ? 'bg-orange-500' : activity.type === 'Audio' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                    {activity.type} · {activity.model}
                  </div>
                </div>
                <div className="p-5 flex-grow space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-label-primary text-sm leading-tight">{activity.title}</h3>
                    <span className="text-[9px] font-bold text-label-secondary whitespace-nowrap bg-surface-secondary px-2 py-0.5 rounded-full border border-separator">{activity.date}</span>
                  </div>
                  <p className="text-xs text-label-secondary line-clamp-2 leading-relaxed italic">&quot;{activity.prompt}&quot;</p>
                </div>
                <div className="p-4 border-t border-separator flex justify-between items-center bg-surface-secondary/30">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-primary border-2 border-surface shadow-sm"></div>
                    <div className="w-6 h-6 rounded-full bg-primary-light border-2 border-surface shadow-sm"></div>
                  </div>
                  <button className="text-[10px] font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all border border-transparent hover:border-primary/20">
                    Open Project
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Quick Actions / Tips */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
           <motion.div variants={cardVariant} className="bg-primary rounded-[32px] p-10 text-white relative overflow-hidden group">
              <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-4">Try the new Flux.1 Pro model</h3>
                <p className="text-white/80 mb-8 leading-relaxed max-w-md">Our highest quality image generation model is now available. Create photorealistic results with incredible prompt adherence.</p>
                <button className="px-8 py-3 bg-white text-primary rounded-2xl font-bold shadow-xl hover:bg-surface-secondary transition-all hover:scale-105 active:scale-95">
                  Try it now
                </button>
              </div>
           </motion.div>
           <motion.div variants={cardVariant} className="bg-surface rounded-[32px] p-10 border border-separator shadow-hig flex flex-col justify-center group transition-shadow hover:shadow-hig-hover">
              <div className="flex gap-4 mb-6">
                 {['✨', '🎨', '🎬', '🎙️'].map((emoji, i) => (
                   <div key={i} className="w-12 h-12 bg-surface-secondary rounded-2xl flex items-center justify-center text-xl shadow-inner border border-separator group-hover:scale-110 group-hover:-rotate-3 transition-all duration-300">
                     {emoji}
                   </div>
                 ))}
              </div>
              <h3 className="text-2xl font-bold mb-2 text-label-primary">Explore the AI Ecosystem</h3>
              <p className="text-label-secondary leading-relaxed">Discover 50+ models across text, image, video, and audio. Switch seamlessly between them in your workflow.</p>
           </motion.div>
        </div>
      </div>
    </AppLayout>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar from '@/shared/ui/layout/ChatSidebar'
import { motion, AnimatePresence } from 'framer-motion'

type Skill = {
  id: string
  name: string
  description: string
  engine: string
  source_url: string | null
  system_prompt: string
  tags: string[]
  is_public: boolean
  created_at: string
}

type UserSkill = {
  id: string
  skill_id: string
  is_active: boolean
}

const ENGINE_COLORS: Record<string, string> = {
  claude:  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  openai:  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  gemini:  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  all:     'bg-surface-tertiary dark:bg-surface text-label-secondary',
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [userSkills, setUserSkills] = useState<UserSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEngine, setFilterEngine] = useState<string>('all')
  const [filterTag, setFilterTag] = useState<string>('')
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [{ data: skillsData }, { data: userSkillsData }] = await Promise.all([
      supabase.from('skills').select('*').order('name'),
      supabase.from('user_skills').select('*'),
    ])
    setSkills(skillsData || [])
    setUserSkills(userSkillsData || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const isEnabled = (skillId: string) =>
    userSkills.some(us => us.skill_id === skillId && us.is_active)

  const toggleSkill = async (skill: Skill) => {
    setSaving(skill.id)
    const supabase = createClient()
    const existing = userSkills.find(us => us.skill_id === skill.id)
    if (existing) {
      await supabase
        .from('user_skills')
        .update({ is_active: !existing.is_active })
        .eq('id', existing.id)
      setUserSkills(prev => prev.map(us => us.id === existing.id ? { ...us, is_active: !us.is_active } : us))
    } else {
      const { data } = await supabase
        .from('user_skills')
        .insert({ skill_id: skill.id, is_active: true })
        .select()
        .single()
      if (data) setUserSkills(prev => [...prev, data])
    }
    setSaving(null)
  }

  const allTags = Array.from(new Set(skills.flatMap(s => s.tags))).sort()
  const engines = ['all', ...Array.from(new Set(skills.map(s => s.engine)))].filter(Boolean)

  const filtered = skills.filter(s => {
    const engineMatch = filterEngine === 'all' || s.engine === filterEngine
    const tagMatch = !filterTag || s.tags.includes(filterTag)
    return engineMatch && tagMatch
  })

  const enabledCount = userSkills.filter(us => us.is_active).length

  return (
    <AppLayout sidebar={<ChatSidebar />}>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-label-primary">Skills</h1>
            <p className="text-sm text-label-secondary mt-1">
              Activate skills to enhance your AI conversations. Active skills inject expert context into the right moment.
            </p>
          </div>
          {enabledCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-teal-100 dark:bg-teal-900/30 rounded-hig-lg border border-teal-300 dark:border-teal-700">
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-bold text-teal-700 dark:text-teal-300">{enabledCount} active</span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Engine filter */}
          <div className="flex gap-1.5 p-1.5 bg-surface-secondary dark:bg-surface rounded-hig-lg border border-separator/30">
            {engines.map(eng => (
              <button
                key={eng}
                onClick={() => setFilterEngine(eng)}
                className={`px-3 py-1.5 rounded-hig-md text-xs font-bold transition-all capitalize ${
                  filterEngine === eng
                    ? 'gradient-brown-teal text-white shadow-brown-glow'
                    : 'text-label-secondary hover:text-label-primary hover:bg-surface-tertiary dark:hover:bg-surface-secondary'
                }`}
              >
                {eng}
              </button>
            ))}
          </div>

          {/* Tag filter */}
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  filterTag === tag
                    ? 'bg-brown/10 dark:bg-teal/10 border-brown dark:border-teal text-brown dark:text-teal'
                    : 'border-separator/30 text-label-secondary hover:border-separator'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        {/* Skills Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-36 bg-surface-secondary dark:bg-surface rounded-hig-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {filtered.map(skill => {
                const active = isEnabled(skill.id)
                const expanded = expandedSkill === skill.id
                const engineColor = ENGINE_COLORS[skill.engine] || ENGINE_COLORS.all

                return (
                  <motion.div
                    key={skill.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`bg-surface-secondary dark:bg-surface rounded-hig-xl border transition-all ${
                      active
                        ? 'border-brown/40 dark:border-teal/40 shadow-brown-glow'
                        : 'border-separator/30 hover:border-separator'
                    }`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${engineColor}`}>
                              {skill.engine}
                            </span>
                            {active && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                                Active
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-label-primary text-base leading-tight">{skill.name}</h3>
                          <p className="text-xs text-label-secondary mt-1 leading-relaxed">{skill.description}</p>
                        </div>

                        {/* Toggle */}
                        <button
                          onClick={() => toggleSkill(skill)}
                          disabled={saving === skill.id}
                          className={`w-11 h-6 rounded-full flex-shrink-0 transition-all relative ${
                            active ? 'gradient-brown-teal shadow-brown-glow' : 'bg-surface-tertiary dark:bg-[#3A3A3C]'
                          } ${saving === skill.id ? 'opacity-50' : ''}`}
                          aria-label={active ? 'Disable skill' : 'Enable skill'}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                            active ? 'left-[22px]' : 'left-0.5'
                          }`} />
                        </button>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {skill.tags.map(tag => (
                          <span key={tag} className="text-[10px] font-medium px-2 py-0.5 bg-surface-tertiary dark:bg-[#3A3A3C] text-label-tertiary rounded-full">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {/* Expand / Source */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedSkill(expanded ? null : skill.id)}
                          className="text-xs font-medium text-brown dark:text-teal hover:underline"
                        >
                          {expanded ? 'Hide prompt' : 'View prompt'}
                        </button>
                        {skill.source_url && (
                          <>
                            <span className="text-separator">·</span>
                            <a
                              href={skill.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-label-tertiary hover:text-label-secondary"
                            >
                              Source
                            </a>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expanded system prompt */}
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 border-t border-separator/20 pt-4">
                            <div className="text-xs font-bold text-label-tertiary uppercase tracking-widest mb-2">System Prompt</div>
                            <pre className="text-xs text-label-secondary whitespace-pre-wrap font-mono bg-surface-tertiary dark:bg-[#1C1C1E] rounded-hig-lg p-3 leading-relaxed">
                              {skill.system_prompt}
                            </pre>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-label-tertiary font-medium">
            No skills match your filters.
          </div>
        )}

        {/* How it works */}
        <div className="mt-10 p-5 bg-surface-secondary dark:bg-surface rounded-hig-xl border border-separator/30">
          <h3 className="font-bold text-label-primary mb-2">How skills work</h3>
          <p className="text-sm text-label-secondary leading-relaxed">
            When you activate a skill, Clox monitors your conversations for relevant context. If a match is detected, it will offer to inject the skill&apos;s system prompt. You can accept or dismiss the suggestion — you&apos;re always in control.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}

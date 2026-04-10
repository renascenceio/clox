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

const BLANK_SKILL = {
  name: '',
  description: '',
  engine: 'all',
  source_url: '',
  system_prompt: '',
  tags: '',
  is_public: true,
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [userSkills, setUserSkills] = useState<UserSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEngine, setFilterEngine] = useState<string>('all')
  const [filterTag, setFilterTag] = useState<string>('')
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  // Create skill panel state
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [createTab, setCreateTab] = useState<'github' | 'manual'>('manual')
  const [githubUrl, setGithubUrl] = useState('')
  const [githubFetching, setGithubFetching] = useState(false)
  const [githubError, setGithubError] = useState('')
  const [newSkill, setNewSkill] = useState(BLANK_SKILL)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const [{ data: skillsData }, { data: userSkillsData }, { data: profileData }] = await Promise.all([
      supabase.from('skills').select('*').order('name'),
      supabase.from('user_skills').select('*'),
      user ? supabase.from('profiles').select('role').eq('id', user.id).single() : Promise.resolve({ data: null }),
    ])
    setSkills(skillsData || [])
    setUserSkills(userSkillsData || [])
    setIsSuperAdmin(profileData?.role === 'super_admin')
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
      await supabase.from('user_skills').update({ is_active: !existing.is_active }).eq('id', existing.id)
      setUserSkills(prev => prev.map(us => us.id === existing.id ? { ...us, is_active: !us.is_active } : us))
    } else {
      const { data } = await supabase.from('user_skills').insert({ skill_id: skill.id, is_active: true }).select().single()
      if (data) setUserSkills(prev => [...prev, data])
    }
    setSaving(null)
  }

  // Attempt to fetch system_prompt text from a GitHub raw URL
  const fetchFromGitHub = async () => {
    if (!githubUrl.trim()) return
    setGithubFetching(true)
    setGithubError('')
    try {
      // Convert github.com blob URL to raw.githubusercontent.com
      let rawUrl = githubUrl.trim()
      rawUrl = rawUrl
        .replace('https://github.com/', 'https://raw.githubusercontent.com/')
        .replace('/blob/', '/')

      const res = await fetch(rawUrl)
      if (!res.ok) throw new Error(`Could not fetch: ${res.status}`)
      const text = await res.text()

      // Try to parse metadata from filename or content
      const filename = rawUrl.split('/').pop()?.replace(/\.[^.]+$/, '') || ''
      const nameFromFile = filename.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

      setNewSkill(prev => ({
        ...prev,
        name: prev.name || nameFromFile,
        system_prompt: text.trim(),
        source_url: githubUrl.trim(),
      }))
      setCreateTab('manual') // Show the manual form to review + complete metadata
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Failed to fetch from GitHub')
    } finally {
      setGithubFetching(false)
    }
  }

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSkill.name.trim() || !newSkill.system_prompt.trim()) return
    setCreateSaving(true)
    setCreateError('')

    const supabase = createClient()
    const tagsArray = newSkill.tags.split(',').map(t => t.trim()).filter(Boolean)
    const { error } = await supabase.from('skills').insert({
      name: newSkill.name.trim(),
      description: newSkill.description.trim(),
      engine: newSkill.engine,
      source_url: newSkill.source_url.trim() || null,
      system_prompt: newSkill.system_prompt.trim(),
      tags: tagsArray,
      is_public: newSkill.is_public,
    })

    setCreateSaving(false)
    if (error) {
      setCreateError(error.message)
    } else {
      setNewSkill(BLANK_SKILL)
      setGithubUrl('')
      setShowCreatePanel(false)
      loadData()
    }
  }

  const allTags = Array.from(new Set(skills.flatMap(s => s.tags))).sort()
  const engines = ['all', ...Array.from(new Set(skills.map(s => s.engine)))].filter(Boolean)

  const filtered = skills.filter(s => {
    const engineMatch = filterEngine === 'all' || s.engine === filterEngine
    const tagMatch = !filterTag || s.tags.includes(filterTag)
    return engineMatch && tagMatch
  })

  const enabledCount = userSkills.filter(us => us.is_active).length

  const inputClass = 'w-full h-10 px-3 bg-white/70 dark:bg-[#2C2C2E]/70 border border-separator rounded-hig-lg text-sm font-medium text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/30 dark:focus:ring-teal/30 focus:border-brown dark:focus:border-teal transition-all'
  const labelClass = 'block text-xs font-bold text-label-tertiary uppercase tracking-wider mb-1'

  return (
    <AppLayout sidebar={<ChatSidebar />}>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-label-primary">Skills</h1>
            <p className="text-sm text-label-secondary mt-1">
              Activate skills to enhance your AI conversations. Active skills inject expert context at the right moment.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {enabledCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-teal-100 dark:bg-teal-900/30 rounded-hig-lg border border-teal-300 dark:border-teal-700">
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                <span className="text-sm font-bold text-teal-700 dark:text-teal-300">{enabledCount} active</span>
              </div>
            )}
            {isSuperAdmin && (
              <button
                onClick={() => setShowCreatePanel(true)}
                className="flex items-center gap-2 px-4 py-2 gradient-brown-teal text-white rounded-hig-lg text-sm font-bold shadow-brown-glow hover:scale-105 active:scale-95 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Skill
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
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

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {skill.tags.map(tag => (
                          <span key={tag} className="text-[10px] font-medium px-2 py-0.5 bg-surface-tertiary dark:bg-[#3A3A3C] text-label-tertiary rounded-full">
                            #{tag}
                          </span>
                        ))}
                      </div>

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

        <div className="mt-10 p-5 bg-surface-secondary dark:bg-surface rounded-hig-xl border border-separator/30">
          <h3 className="font-bold text-label-primary mb-2">How skills work</h3>
          <p className="text-sm text-label-secondary leading-relaxed">
            When you activate a skill, Clox monitors your conversations for relevant context. If a match is detected, it will offer to inject the skill&apos;s system prompt. You can accept or dismiss the suggestion — you&apos;re always in control.
          </p>
        </div>
      </div>

      {/* Create Skill Panel — Super Admin only */}
      <AnimatePresence>
        {showCreatePanel && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]"
              onClick={() => setShowCreatePanel(false)}
            />

            {/* Slide-in panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="fixed top-0 right-0 h-full w-[460px] bg-surface-secondary dark:bg-[#1C1C1E] border-l border-separator shadow-2xl z-[100] overflow-y-auto custom-scrollbar"
            >
              <div className="p-6">
                {/* Panel header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-black text-label-primary">New Skill</h2>
                    <p className="text-xs text-label-tertiary mt-0.5">Import from GitHub or build manually</p>
                  </div>
                  <button
                    onClick={() => setShowCreatePanel(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-hig-lg hover:bg-surface-tertiary dark:hover:bg-surface transition-colors text-label-secondary"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-surface-tertiary dark:bg-surface rounded-hig-lg border border-separator/30 mb-6">
                  {(['github', 'manual'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setCreateTab(tab)}
                      className={`flex-1 py-2 rounded-hig-md text-xs font-bold capitalize transition-all ${
                        createTab === tab
                          ? 'gradient-brown-teal text-white shadow-brown-glow'
                          : 'text-label-secondary hover:text-label-primary'
                      }`}
                    >
                      {tab === 'github' ? 'Import from GitHub' : 'Build Manually'}
                    </button>
                  ))}
                </div>

                {/* GitHub Import */}
                {createTab === 'github' && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>GitHub File URL</label>
                      <input
                        type="url"
                        value={githubUrl}
                        onChange={e => setGithubUrl(e.target.value)}
                        className={inputClass}
                        placeholder="https://github.com/user/repo/blob/main/skill.md"
                      />
                      <p className="text-[11px] text-label-tertiary mt-1">
                        Paste a link to any raw text or markdown file containing a system prompt.
                      </p>
                    </div>

                    {githubError && (
                      <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-hig-lg px-3 py-2">
                        {githubError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={fetchFromGitHub}
                      disabled={githubFetching || !githubUrl.trim()}
                      className="w-full h-10 gradient-brown-teal text-white rounded-hig-lg text-sm font-bold shadow-brown-glow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {githubFetching ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Fetching...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Fetch & Preview
                        </>
                      )}
                    </button>

                    <div className="p-4 bg-surface-tertiary dark:bg-surface rounded-hig-lg border border-separator/30">
                      <h4 className="text-xs font-bold text-label-secondary uppercase tracking-widest mb-2">Example sources</h4>
                      <ul className="space-y-1 text-xs text-label-tertiary">
                        <li>github.com/ComposioHQ/awesome-claude-skills</li>
                        <li>github.com/blader/humanizer</li>
                        <li>Any raw text / markdown file with a system prompt</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Manual / Review form */}
                {createTab === 'manual' && (
                  <form onSubmit={handleCreateSkill} className="space-y-4">
                    <div>
                      <label className={labelClass}>Name <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={newSkill.name}
                        onChange={e => setNewSkill(p => ({ ...p, name: e.target.value }))}
                        required
                        className={inputClass}
                        placeholder="e.g. Code Reviewer"
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Description</label>
                      <input
                        type="text"
                        value={newSkill.description}
                        onChange={e => setNewSkill(p => ({ ...p, description: e.target.value }))}
                        className={inputClass}
                        placeholder="Short description of what this skill does"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Engine</label>
                        <select
                          value={newSkill.engine}
                          onChange={e => setNewSkill(p => ({ ...p, engine: e.target.value }))}
                          className={inputClass + ' cursor-pointer'}
                        >
                          <option value="all">All</option>
                          <option value="claude">Claude</option>
                          <option value="openai">OpenAI</option>
                          <option value="gemini">Gemini</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Tags (comma-separated)</label>
                        <input
                          type="text"
                          value={newSkill.tags}
                          onChange={e => setNewSkill(p => ({ ...p, tags: e.target.value }))}
                          className={inputClass}
                          placeholder="code, review, writing"
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Source URL (optional)</label>
                      <input
                        type="url"
                        value={newSkill.source_url}
                        onChange={e => setNewSkill(p => ({ ...p, source_url: e.target.value }))}
                        className={inputClass}
                        placeholder="https://github.com/..."
                      />
                    </div>

                    <div>
                      <label className={labelClass}>System Prompt <span className="text-red-400">*</span></label>
                      <textarea
                        value={newSkill.system_prompt}
                        onChange={e => setNewSkill(p => ({ ...p, system_prompt: e.target.value }))}
                        required
                        rows={8}
                        className="w-full px-3 py-2.5 bg-white/70 dark:bg-[#2C2C2E]/70 border border-separator rounded-hig-lg text-sm font-mono text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/30 dark:focus:ring-teal/30 focus:border-brown dark:focus:border-teal transition-all resize-y"
                        placeholder="You are an expert at..."
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setNewSkill(p => ({ ...p, is_public: !p.is_public }))}
                        className={`w-10 h-5 rounded-full relative transition-all ${
                          newSkill.is_public ? 'gradient-brown-teal shadow-brown-glow' : 'bg-surface-tertiary dark:bg-[#3A3A3C]'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                          newSkill.is_public ? 'left-5' : 'left-0.5'
                        }`} />
                      </button>
                      <span className="text-sm font-medium text-label-primary">Public (visible to all users)</span>
                    </div>

                    {createError && (
                      <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-hig-lg px-3 py-2">
                        {createError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={createSaving}
                      className="w-full h-11 gradient-brown-teal text-white rounded-hig-lg text-sm font-bold shadow-brown-glow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {createSaving ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Creating...
                        </>
                      ) : 'Create Skill'}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AppLayout>
  )
}

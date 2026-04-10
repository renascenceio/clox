'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/shared/ui/components/Avatar'

interface Member {
  id: string
  email: string
  role: 'owner' | 'member'
  joined_at: string | null
  invited_at: string
}

interface ProjectData {
  id: string
  title: string
  model: string
  owner_email: string
  owner_domain: string
}

interface ProjectPanelProps {
  /** The local sidebar chat ID (e.g. "project_1234") */
  localChatId: string
  /** Called when the DB project id is resolved so the parent can use it for messages */
  onProjectResolved: (dbProjectId: string | null) => void
  selectedModel: string
  systemPrompt: string
  onSystemPromptChange: (v: string) => void
  temperature: number
  onTemperatureChange: (v: number) => void
  maxTokens: number
  onMaxTokensChange: (v: number) => void
}

const GENERIC_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'protonmail.com', 'live.com', 'msn.com', 'me.com',
]

function isGenericEmail(email: string) {
  const domain = email.split('@')[1]?.toLowerCase()
  return GENERIC_DOMAINS.includes(domain)
}

export default function ProjectPanel({
  localChatId,
  onProjectResolved,
  selectedModel,
  systemPrompt,
  onSystemPromptChange,
  temperature,
  onTemperatureChange,
  maxTokens,
  onMaxTokensChange,
}: ProjectPanelProps) {
  const [project, setProject] = useState<ProjectData | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)

  const loadProject = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    setCurrentUserEmail(user.email || '')

    // Look up DB project by local sidebar id stored in metadata
    // We store localChatId → dbProjectId mapping in localStorage
    const stored = localStorage.getItem(`project-db-id-${localChatId}`)

    if (stored) {
      // Already linked — load project + members
      const [{ data: proj }, { data: mems }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', stored).single(),
        supabase.from('project_members').select('*').eq('project_id', stored).order('invited_at'),
      ])
      if (proj) {
        setProject(proj)
        setIsOwner(proj.owner_id === user.id)
        onProjectResolved(proj.id)
      }
      setMembers((mems as Member[]) || [])
    } else {
      // First time — create project in DB
      const title = (() => {
        try {
          const chats = JSON.parse(localStorage.getItem('clox_chats') || '[]')
          return chats.find((c: { id: string; title: string }) => c.id === localChatId)?.title || 'New Project'
        } catch { return 'New Project' }
      })()

      const { data: newProj, error } = await supabase
        .from('projects')
        .insert({
          title,
          model: selectedModel,
          owner_id: user.id,
          owner_email: user.email,
        })
        .select()
        .single()

      if (!error && newProj) {
        localStorage.setItem(`project-db-id-${localChatId}`, newProj.id)
        setProject(newProj)
        setIsOwner(true)
        onProjectResolved(newProj.id)
        // Load members (owner was auto-inserted by trigger)
        const { data: mems } = await supabase
          .from('project_members')
          .select('*')
          .eq('project_id', newProj.id)
        setMembers((mems as Member[]) || [])
      } else {
        onProjectResolved(null)
      }
    }
    setLoading(false)
  }, [localChatId, selectedModel, onProjectResolved])

  useEffect(() => {
    setLoading(true)
    setProject(null)
    setMembers([])
    loadProject()
  }, [loadProject])

  const handleInvite = async () => {
    if (!project || !inviteEmail.trim()) return
    setInviteError('')

    const email = inviteEmail.trim().toLowerCase()

    if (isGenericEmail(email)) {
      setInviteError('Only company email addresses can be invited (no Gmail, Yahoo, etc.)')
      return
    }

    const memberDomain = email.split('@')[1]
    if (memberDomain !== project.owner_domain) {
      setInviteError(`Only @${project.owner_domain} addresses can be added to this project.`)
      return
    }

    if (members.some(m => m.email === email)) {
      setInviteError('This person is already a member.')
      return
    }

    setInviting(true)
    const supabase = createClient()

    // Look up user by email to get their user_id (may be null if not signed up yet)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', (await supabase.from('profiles').select('id').limit(1)).data?.[0]?.id || '')
      .single()

    // Find user id from auth.users via profile lookup by searching joined data
    const { data: userMatch } = await supabase
      .rpc('get_user_id_by_email', { p_email: email })
      .single()

    const { data: newMember, error } = await supabase
      .from('project_members')
      .insert({
        project_id: project.id,
        user_id: (userMatch as { id: string } | null)?.id || null,
        email,
        role: 'member',
      })
      .select()
      .single()

    if (error) {
      setInviteError(error.message)
    } else {
      setMembers(prev => [...prev, newMember as Member])
      setInviteEmail('')
    }
    setInviting(false)
    // profile is unused beyond the lookup attempt — suppress lint
    void profile
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!project) return
    const supabase = createClient()
    await supabase.from('project_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-16 border-b border-separator/50 flex items-center px-6">
          <span className="font-bold text-sm">Project</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-brown/30 border-t-brown rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="h-16 border-b border-separator/50 flex items-center px-6 gap-3">
        <svg className="w-4 h-4 text-brown dark:text-teal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="font-bold text-sm truncate">{project?.title || 'Project'}</span>
      </div>

      <div className="flex-grow overflow-y-auto custom-scrollbar p-5 space-y-6">

        {/* Members */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-label-tertiary uppercase tracking-widest">Members</h3>
            <span className="text-xs text-label-tertiary">{members.length}</span>
          </div>

          <div className="space-y-1.5">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-hig-lg bg-surface-tertiary/40 dark:bg-surface/40">
                <Avatar seed={m.email} size={28} />
                <div className="flex-grow min-w-0">
                  <div className="text-xs font-semibold text-label-primary truncate">{m.email}</div>
                  <div className="text-[10px] text-label-tertiary capitalize">{m.role}</div>
                </div>
                {isOwner && m.role !== 'owner' && m.email !== currentUserEmail && (
                  <button
                    onClick={() => handleRemoveMember(m.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900/20 text-label-tertiary hover:text-red-500 transition-colors flex-shrink-0"
                    title="Remove member"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Invite */}
          {isOwner && project && (
            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => { setInviteEmail(e.target.value); setInviteError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                  placeholder={`colleague@${project.owner_domain}`}
                  className="flex-grow h-9 px-3 bg-white dark:bg-[#2C2C2E] border border-separator rounded-hig-lg text-xs text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/20 dark:focus:ring-teal/20 focus:border-brown dark:focus:border-teal transition-all"
                />
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="h-9 px-3 gradient-brown-teal text-white text-xs font-bold rounded-hig-lg disabled:opacity-40 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                >
                  {inviting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : 'Add'}
                </button>
              </div>
              {inviteError && (
                <p className="text-[11px] text-red-500 dark:text-red-400 leading-tight">{inviteError}</p>
              )}
              <p className="text-[10px] text-label-tertiary leading-tight">
                Only @{project.owner_domain} addresses can be invited.
              </p>
            </div>
          )}
        </div>

        <div className="h-px bg-separator/30" />

        {/* Model settings (same as chat right panel) */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-label-tertiary uppercase tracking-widest">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={e => onSystemPromptChange(e.target.value)}
            placeholder="You are a helpful assistant..."
            className="w-full min-h-[80px] p-3 bg-white dark:bg-[#2C2C2E] border border-separator rounded-hig-lg text-xs text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/20 focus:border-brown transition-all resize-none"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-label-tertiary uppercase tracking-widest">Temperature</label>
            <span className="text-sm font-bold text-brown">{temperature}</span>
          </div>
          <input type="range" min="0" max="2" step="0.1" value={temperature}
            onChange={e => onTemperatureChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer accent-brown"
          />
          <div className="flex justify-between text-xs text-label-tertiary"><span>Precise</span><span>Creative</span></div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-label-tertiary uppercase tracking-widest">Max Tokens</label>
            <span className="text-sm font-bold text-teal-600">{maxTokens}</span>
          </div>
          <input type="range" min="256" max="8192" step="256" value={maxTokens}
            onChange={e => onMaxTokensChange(parseInt(e.target.value))}
            className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer accent-teal"
          />
          <div className="flex justify-between text-xs text-label-tertiary"><span>256</span><span>8192</span></div>
        </div>

      </div>
    </div>
  )
}

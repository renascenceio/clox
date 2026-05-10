'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

import ChatWorkspace, { type RailRecentItem } from '@/shared/ui/chat/ChatWorkspace'
import { useChatChrome } from '@/shared/ui/chat/useChatChrome'
import { PALETTES, type Palette } from '@/shared/ui/chat/palettes'
import { listChats } from '@/lib/chat-store'
import { useUserSkills, type DbSkill as Skill } from '@/lib/hooks/useUserSkills'

const BLANK_SKILL = {
  name: '',
  description: '',
  engine: 'all',
  source_url: '',
  system_prompt: '',
  tags: '',
  is_public: true,
}

// Sentinel value the engine-filter uses for "show every engine" — distinct
// from the engine value 'all' (which means "this skill works on any model
// family"). Keeping them separate avoids the duplicate-pill bug we used to
// have when both the literal and any 'all'-engine skills showed up.
const FILTER_ANY = '*'

const MONO  = `'Geist Mono', ui-monospace, monospace`
const SERIF = `'Newsreader', Georgia, serif`
const SANS  = `ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', sans-serif`

export default function SkillsPage() {
  const chrome = useChatChrome('skills')
  const p = PALETTES[chrome.theme]

  /* ----- skills data ---------------------------------------------------
     Single source of truth lives in `useUserSkills` (Supabase-backed).
     The chat composer's Skills chip uses the same hook, so toggling here
     and toggling there always agree. */
  const { skills, activeIds, loading, refresh, toggle } = useUserSkills()
  // Sentinel for the "Any" filter pill — '*' can't collide with a real
  // engine value (which is one of 'all' | 'claude' | 'openai' | 'gemini'),
  // so the previous bug where we got two "all" pills (one literal, one
  // synthesised from skills.engine='all') is impossible by construction.
  const [filterEngine, setFilterEngine] = useState<string>(FILTER_ANY)
  const [filterTag, setFilterTag] = useState<string>('')
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  /* ----- create-skill panel ------------------------------------------- */
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [createTab, setCreateTab] = useState<'github' | 'manual'>('manual')
  const [githubUrl, setGithubUrl] = useState('')
  const [githubFetching, setGithubFetching] = useState(false)
  const [githubError, setGithubError] = useState('')
  const [newSkill, setNewSkill] = useState(BLANK_SKILL)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  // Look up the super-admin flag — we only render the "+ New skill" button
  // for super_admins. The skills list itself is loaded by the hook.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (!cancelled) setIsSuperAdmin(data?.role === 'super_admin')
    })()
    return () => { cancelled = true }
  }, [])

  const isEnabled = (skillId: string) => activeIds.includes(skillId)

  async function toggleSkill(skill: Skill) {
    setSaving(skill.id)
    await toggle(skill.id)
    setSaving(null)
  }

  async function fetchFromGitHub() {
    if (!githubUrl.trim()) return
    setGithubFetching(true)
    setGithubError('')
    try {
      let rawUrl = githubUrl.trim()
      rawUrl = rawUrl
        .replace('https://github.com/', 'https://raw.githubusercontent.com/')
        .replace('/blob/', '/')

      const res = await fetch(rawUrl)
      if (!res.ok) throw new Error(`Could not fetch: ${res.status}`)
      const text = await res.text()

      const filename = rawUrl.split('/').pop()?.replace(/\.[^.]+$/, '') || ''
      const nameFromFile = filename.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

      setNewSkill(prev => ({
        ...prev,
        name: prev.name || nameFromFile,
        system_prompt: text.trim(),
        source_url: githubUrl.trim(),
      }))
      setCreateTab('manual')
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : 'Failed to fetch from GitHub')
    } finally {
      setGithubFetching(false)
    }
  }

  async function handleCreateSkill(e: React.FormEvent) {
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
      refresh()
    }
  }

  /* ----- derived ------------------------------------------------------- */
  const allTags = useMemo(
    () => Array.from(new Set(skills.flatMap(s => s.tags))).sort(),
    [skills]
  )
  // The literal "Any" pill is always first; remaining pills are the unique
  // engines actually present in the catalogue, sorted for stable order.
  // We DON'T spread `'all'` from the skills array — `engine='all'` is a real
  // engine value that gets its own pill (rendered as "generic"), which is
  // distinct from "Any" (no filter at all).
  const engines = useMemo(() => {
    const set = new Set<string>()
    for (const s of skills) if (s.engine) set.add(s.engine)
    return [FILTER_ANY, ...Array.from(set).sort()]
  }, [skills])
  const filtered = useMemo(
    () => skills.filter(s => {
      const engineMatch = filterEngine === FILTER_ANY || s.engine === filterEngine
      const tagMatch = !filterTag || s.tags.includes(filterTag)
      return engineMatch && tagMatch
    }),
    [skills, filterEngine, filterTag]
  )
  const enabledCount = activeIds.length

  /* ----- recent rail (text chats only, like /history) ------------------ */
  const recent: RailRecentItem[] = useMemo(() => {
    return listChats()
      .filter(c => (c.modality ?? 'text') === 'text')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
      .map(c => ({
        id: c.id,
        title: c.title,
        meta: new Date(c.createdAt).toLocaleString([], { month: 'short', day: 'numeric' }) + ' · ' + c.model.toLowerCase(),
        onClick: () => {
          if (typeof window !== 'undefined') localStorage.setItem('activeChatId:text', c.id)
          chrome.router.push('/text')
        },
      }))
  }, [chrome.router])

  return (
    <div className="fixed inset-0 isolate">
      <ChatWorkspace
        theme={chrome.theme}
        onChangeTheme={chrome.handleThemeChange}
        brandName="Clox"
        brandVersion="0.5"
        user={chrome.user}
        language={chrome.language}
        onChangeLanguage={chrome.handleChangeLanguage}
        onOpenSettings={chrome.onOpenSettings}
        onOpenSuperAdmin={chrome.onOpenSuperAdmin}
        onOpenSkills={chrome.onOpenSkills}
        onSignOut={chrome.handleSignOut}
        onDeleteAccount={chrome.handleDeleteAccount}
        nav={chrome.nav}
        recent={recent}
        onSeeAllRecent={chrome.onSeeAllRecent}
        onNewChat={chrome.onNewChat}
        breadcrumb="library · skills"
        title="Skills"
        models={[]}
        modelId=""
        onChangeModel={() => undefined}
        modes={[]}
        modeId=""
        onChangeMode={() => undefined}
        transcript={[]}
        inputValue=""
        onInputChange={() => undefined}
        onSend={() => undefined}
        bodySlot={
          <div style={{ padding: '28px 56px 64px', maxWidth: 920, margin: '0 auto', fontFamily: SANS, color: p.ink }}>
            {/* Header row — count, intro, create button */}
            <div style={{
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
              gap: 24, marginBottom: 22, paddingBottom: 18,
              borderBottom: `1px solid ${p.hairlineSoft}`,
              flexWrap: 'wrap',
            }}>
              <div style={{ maxWidth: 560 }}>
                <p style={{
                  fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.2em',
                  textTransform: 'uppercase', color: p.inkMuted, margin: 0, marginBottom: 6,
                }}>
                  {enabledCount > 0
                    ? <><span style={{ color: p.accent }}>●</span> {enabledCount} active</>
                    : <>0 active</>}
                </p>
                <p style={{
                  fontFamily: SERIF, fontStyle: 'italic', fontSize: 16, lineHeight: 1.55,
                  color: p.inkSoft, margin: 0,
                }}>
                  Activate skills to enhance your conversations. Active skills inject expert
                  context at the right moment — you stay in control.
                </p>
              </div>

              {isSuperAdmin && (
                <button
                  onClick={() => setShowCreatePanel(true)}
                  style={{
                    padding: '10px 18px',
                    background: p.ink, color: p.bg,
                    border: 'none', borderRadius: 3,
                    fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em',
                    textTransform: 'uppercase', cursor: 'pointer',
                  }}
                >+ New skill</button>
              )}
            </div>

            {/* Filters */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 24,
              flexWrap: 'wrap', marginBottom: 22,
            }}>
              <div style={{ display: 'flex', gap: 0, fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                {engines.map(eng => {
                  // The sentinel renders as "any" (no filter); the engine
                  // value 'all' renders as "generic" so the user can pick
                  // out skills that aren't tuned for one model family.
                  const label =
                    eng === FILTER_ANY ? 'any' :
                    eng === 'all'      ? 'generic' :
                    eng
                  return (
                    <button
                      key={eng}
                      onClick={() => setFilterEngine(eng)}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        padding: '6px 14px',
                        color: filterEngine === eng ? p.ink : p.inkMuted,
                        borderBottom: `2px solid ${filterEngine === eng ? p.accent : 'transparent'}`,
                        transition: 'color .15s, border-color .15s',
                      }}
                    >{label}</button>
                  )
                })}
              </div>

              {allTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
                      style={{
                        background: filterTag === tag ? p.ink : 'transparent',
                        color: filterTag === tag ? p.bg : p.inkSoft,
                        border: `1px solid ${filterTag === tag ? p.ink : p.hairline}`,
                        padding: '3px 10px', borderRadius: 999,
                        fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.06em',
                        cursor: 'pointer', transition: 'all .15s',
                      }}
                    >#{tag}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Skills list */}
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ height: 132, background: p.surfaceAlt, borderRadius: 3, opacity: 0.6 }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{
                border: `1px solid ${p.hairline}`, borderRadius: 3, background: p.surface,
                padding: '40px 32px', textAlign: 'center', color: p.inkSoft,
              }}>
                <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 22, color: p.ink, marginBottom: 6 }}>
                  No skills match
                </div>
                <div style={{ fontSize: 13, color: p.inkMuted }}>
                  Try clearing the filter above.
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
                {filtered.map(skill => (
                  <SkillCard
                    key={skill.id}
                    p={p}
                    skill={skill}
                    active={isEnabled(skill.id)}
                    saving={saving === skill.id}
                    expanded={expandedSkill === skill.id}
                    onToggle={() => toggleSkill(skill)}
                    onExpand={() => setExpandedSkill(expandedSkill === skill.id ? null : skill.id)}
                  />
                ))}
              </div>
            )}

            {/* Footnote */}
            <div style={{
              marginTop: 36, padding: '20px 22px',
              border: `1px solid ${p.hairline}`, borderRadius: 3,
              background: p.surface,
            }}>
              <div style={{
                fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.2em',
                textTransform: 'uppercase', color: p.inkMuted, marginBottom: 6,
              }}>How skills work</div>
              <div style={{ fontFamily: SERIF, fontSize: 14, lineHeight: 1.6, color: p.inkSoft }}>
                When you activate a skill, Clox monitors your conversations for relevant
                context. If a match is detected, it offers to inject the skill&apos;s system
                prompt. You can accept or dismiss — you&apos;re always in control.
              </div>
            </div>

            {showCreatePanel && (
              <CreateSkillDrawer
                p={p}
                tab={createTab}
                onChangeTab={setCreateTab}
                githubUrl={githubUrl}
                onGithubUrlChange={setGithubUrl}
                githubFetching={githubFetching}
                githubError={githubError}
                onFetchGithub={fetchFromGitHub}
                newSkill={newSkill}
                onChangeNewSkill={setNewSkill}
                createSaving={createSaving}
                createError={createError}
                onSubmit={handleCreateSkill}
                onClose={() => setShowCreatePanel(false)}
              />
            )}
          </div>
        }
      />
    </div>
  )
}

/* =====================================================================
   Skill card — editorial hairline tile with toggle + expandable prompt
   ===================================================================== */

function SkillCard({
  p, skill, active, saving, expanded, onToggle, onExpand,
}: {
  p: Palette
  skill: Skill
  active: boolean
  saving: boolean
  expanded: boolean
  onToggle: () => void
  onExpand: () => void
}) {
  return (
    <article
      style={{
        background: p.surface,
        border: `1px solid ${active ? p.ink : p.hairline}`,
        borderRadius: 3,
        padding: '16px 18px',
        transition: 'border-color .15s',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: p.inkMuted, marginBottom: 4,
          }}>
            <span>{skill.engine}</span>
            {active && (
              <>
                <span aria-hidden style={{ color: p.hairline }}>·</span>
                <span style={{ color: p.accent }}>● active</span>
              </>
            )}
          </div>
          <h3 style={{
            fontFamily: SERIF, fontSize: 18, fontWeight: 500,
            lineHeight: 1.25, color: p.ink, margin: 0,
          }}>{skill.name}</h3>
          {skill.description && (
            <p style={{
              fontSize: 12.5, lineHeight: 1.5, color: p.inkSoft,
              margin: '4px 0 0', fontFamily: SANS,
            }}>{skill.description}</p>
          )}
        </div>

        <button
          onClick={onToggle}
          disabled={saving}
          aria-label={active ? 'Disable skill' : 'Enable skill'}
          style={{
            position: 'relative',
            width: 38, height: 22, borderRadius: 999, flexShrink: 0,
            background: active ? p.ink : p.surfaceAlt,
            border: `1px solid ${active ? p.ink : p.hairline}`,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.5 : 1,
            padding: 0,
            transition: 'background .2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 2, left: active ? 18 : 2,
            width: 16, height: 16, borderRadius: '50%',
            background: p.bg,
            transition: 'left .2s',
          }} />
        </button>
      </div>

      {skill.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {skill.tags.map(tag => (
            <span key={tag} style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em',
              padding: '2px 8px', borderRadius: 999,
              background: p.surfaceAlt, color: p.inkMuted,
            }}>#{tag}</span>
          ))}
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingTop: 6, borderTop: `1px solid ${p.hairlineSoft}`,
        fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em',
      }}>
        <button
          onClick={onExpand}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: p.ink, padding: 0,
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}
        >{expanded ? 'Hide prompt' : 'View prompt'}</button>
        {skill.source_url && (
          <>
            <span style={{ color: p.hairline }}>·</span>
            <a
              href={skill.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: p.inkMuted, textDecoration: 'none' }}
            >Source ↗</a>
          </>
        )}
      </div>

      {expanded && (
        <div style={{
          marginTop: 4, padding: '12px 14px',
          background: p.surfaceAlt,
          border: `1px solid ${p.hairlineSoft}`, borderRadius: 3,
        }}>
          <div style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: p.inkMuted, marginBottom: 6,
          }}>System prompt</div>
          <pre style={{
            margin: 0, fontFamily: MONO, fontSize: 11.5, lineHeight: 1.55,
            color: p.inkSoft, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: 360, overflow: 'auto',
          }}>{skill.system_prompt}</pre>
        </div>
      )}
    </article>
  )
}

/* =====================================================================
   Create-skill drawer — slide-in from the right with GitHub + manual tabs.
   Renders as a fixed overlay so it sits above the rail/topstrip.
   ===================================================================== */

type NewSkillState = typeof BLANK_SKILL

function CreateSkillDrawer({
  p, tab, onChangeTab,
  githubUrl, onGithubUrlChange, githubFetching, githubError, onFetchGithub,
  newSkill, onChangeNewSkill, createSaving, createError,
  onSubmit, onClose,
}: {
  p: Palette
  tab: 'github' | 'manual'
  onChangeTab: (t: 'github' | 'manual') => void
  githubUrl: string
  onGithubUrlChange: (s: string) => void
  githubFetching: boolean
  githubError: string
  onFetchGithub: () => void
  newSkill: NewSkillState
  onChangeNewSkill: (updater: (prev: NewSkillState) => NewSkillState) => void
  createSaving: boolean
  createError: string
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}) {
  // Escape closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px',
    background: p.bg, color: p.ink,
    border: `1px solid ${p.hairline}`, borderRadius: 3,
    fontFamily: SANS, fontSize: 13, outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: 4,
    fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em',
    textTransform: 'uppercase', color: p.inkMuted,
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 90,
          background: 'rgba(0,0,0,0.32)',
          backdropFilter: 'blur(2px)',
        }}
      />
      <aside
        role="dialog"
        aria-label="Create skill"
        style={{
          position: 'fixed', top: 0, right: 0, height: '100%',
          width: 460, maxWidth: '90vw',
          background: p.surface,
          borderLeft: `1px solid ${p.hairline}`,
          zIndex: 100, overflowY: 'auto',
          boxShadow: '0 0 60px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ padding: '24px 26px' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 16, marginBottom: 22,
          }}>
            <div>
              <div style={{
                fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.2em',
                textTransform: 'uppercase', color: p.inkMuted, marginBottom: 4,
              }}>Library · new skill</div>
              <h2 style={{
                fontFamily: SERIF, fontSize: 22, fontWeight: 500,
                color: p.ink, margin: 0,
              }}>New skill</h2>
              <p style={{
                fontSize: 12, color: p.inkMuted, margin: '4px 0 0',
              }}>Import from GitHub or build manually.</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 28, height: 28, lineHeight: '26px',
                background: 'transparent', border: `1px solid ${p.hairline}`,
                borderRadius: 3, color: p.inkSoft, cursor: 'pointer',
                fontFamily: MONO, fontSize: 13,
              }}
            >×</button>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 0, marginBottom: 20,
            borderBottom: `1px solid ${p.hairlineSoft}`,
            fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>
            {(['github', 'manual'] as const).map(t => (
              <button
                key={t}
                onClick={() => onChangeTab(t)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '8px 14px',
                  color: tab === t ? p.ink : p.inkMuted,
                  borderBottom: `2px solid ${tab === t ? p.accent : 'transparent'}`,
                  marginBottom: -1,
                }}
              >{t === 'github' ? 'Import from GitHub' : 'Build manually'}</button>
            ))}
          </div>

          {tab === 'github' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>GitHub file URL</label>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={e => onGithubUrlChange(e.target.value)}
                  placeholder="https://github.com/user/repo/blob/main/skill.md"
                  style={inputStyle}
                />
                <p style={{ fontSize: 11, color: p.inkMuted, margin: '6px 0 0' }}>
                  Paste a link to any raw text or markdown file containing a system prompt.
                </p>
              </div>

              {githubError && <FieldError p={p}>{githubError}</FieldError>}

              <button
                type="button"
                onClick={onFetchGithub}
                disabled={githubFetching || !githubUrl.trim()}
                style={{
                  padding: '10px 16px',
                  background: p.ink, color: p.bg,
                  border: 'none', borderRadius: 3,
                  fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  cursor: githubFetching || !githubUrl.trim() ? 'not-allowed' : 'pointer',
                  opacity: githubFetching || !githubUrl.trim() ? 0.5 : 1,
                }}
              >{githubFetching ? 'Fetching…' : 'Fetch & preview'}</button>

              <div style={{
                marginTop: 8, padding: '14px 16px',
                background: p.surfaceAlt, border: `1px solid ${p.hairlineSoft}`,
                borderRadius: 3,
              }}>
                <div style={{
                  fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em',
                  textTransform: 'uppercase', color: p.inkMuted, marginBottom: 8,
                }}>Example sources</div>
                <ul style={{
                  margin: 0, padding: 0, listStyle: 'none',
                  fontSize: 12, lineHeight: 1.7, color: p.inkSoft,
                  fontFamily: MONO,
                }}>
                  <li>github.com/ComposioHQ/awesome-claude-skills</li>
                  <li>github.com/blader/humanizer</li>
                  <li>Any raw text or markdown file with a system prompt</li>
                </ul>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Name <span style={{ color: p.accent }}>*</span></label>
                <input
                  type="text"
                  required
                  value={newSkill.name}
                  onChange={e => onChangeNewSkill(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Code Reviewer"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <input
                  type="text"
                  value={newSkill.description}
                  onChange={e => onChangeNewSkill(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Short description of what this skill does"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Engine</label>
                  <select
                    value={newSkill.engine}
                    onChange={e => onChangeNewSkill(prev => ({ ...prev, engine: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="all">All</option>
                    <option value="claude">Claude</option>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Gemini</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={newSkill.tags}
                    onChange={e => onChangeNewSkill(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="code, review, writing"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Source URL (optional)</label>
                <input
                  type="url"
                  value={newSkill.source_url}
                  onChange={e => onChangeNewSkill(prev => ({ ...prev, source_url: e.target.value }))}
                  placeholder="https://github.com/..."
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>System prompt <span style={{ color: p.accent }}>*</span></label>
                <textarea
                  required
                  rows={8}
                  value={newSkill.system_prompt}
                  onChange={e => onChangeNewSkill(prev => ({ ...prev, system_prompt: e.target.value }))}
                  placeholder="You are an expert at..."
                  style={{
                    ...inputStyle,
                    fontFamily: MONO, fontSize: 12, lineHeight: 1.5,
                    resize: 'vertical', minHeight: 160,
                  }}
                />
              </div>

              <label style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 13, color: p.inkSoft, cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={newSkill.is_public}
                  onChange={e => onChangeNewSkill(prev => ({ ...prev, is_public: e.target.checked }))}
                  style={{ accentColor: p.ink }}
                />
                Public — visible to all users
              </label>

              {createError && <FieldError p={p}>{createError}</FieldError>}

              <button
                type="submit"
                disabled={createSaving}
                style={{
                  padding: '12px 18px',
                  background: p.ink, color: p.bg,
                  border: 'none', borderRadius: 3,
                  fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  cursor: createSaving ? 'wait' : 'pointer',
                  opacity: createSaving ? 0.5 : 1,
                  marginTop: 4,
                }}
              >{createSaving ? 'Creating…' : 'Create skill'}</button>
            </form>
          )}
        </div>
      </aside>
    </>
  )
}

function FieldError({ p, children }: { p: Palette; children: React.ReactNode }) {
  return (
    <p style={{
      margin: 0, padding: '8px 12px',
      background: p.surfaceAlt,
      border: `1px solid ${p.accent}`, borderRadius: 3,
      fontSize: 12, color: p.accent,
    }}>{children}</p>
  )
}

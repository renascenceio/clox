'use client'

/**
 * /settings — profile + preferences inside the editorial Clox chrome.
 *
 * The page is opened from the avatar dropdown ("Settings"), so it must use the
 * exact same rail + topstrip + theme as /history, /gallery and /skills. All
 * Supabase persistence (profile + credits read, profile update, avatar seed
 * regenerate) is kept verbatim from the previous implementation; only the
 * shell and form styling were rebuilt.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import ChatWorkspace, { type RailRecentItem } from '@/shared/ui/chat/ChatWorkspace'
import { useChatChrome } from '@/shared/ui/chat/useChatChrome'
import { PALETTES, type Palette } from '@/shared/ui/chat/palettes'
import Avatar from '@/shared/ui/components/Avatar'
import { createClient } from '@/lib/supabase/client'
import { listChats } from '@/lib/chat-store'

const USE_CASES = [
  'Content Creation', 'Software Development', 'Research & Analysis',
  'Customer Support', 'Marketing & Sales', 'Education & Training',
  'Data Analysis', 'Personal Productivity', 'Other',
]

const COUNTRIES = [
  'United Arab Emirates', 'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'France', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'Jordan', 'Egypt', 'Lebanon', 'India', 'Singapore', 'Other',
]

type Profile = {
  first_name: string
  last_name: string
  phone: string
  company: string
  job_title: string
  country: string
  city: string
  use_case: string
  avatar_seed: string
}

const EMPTY_PROFILE: Profile = {
  first_name: '', last_name: '', phone: '', company: '',
  job_title: '', country: '', city: '', use_case: '', avatar_seed: '',
}

export default function SettingsPage() {
  const chrome = useChatChrome('settings')
  const p = PALETTES[chrome.theme]
  const mono = `'Geist Mono', ui-monospace, monospace`
  const serif = `'Newsreader', Georgia, serif`

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [balance, setBalance] = useState('0.00')
  const [previewSeed, setPreviewSeed] = useState('')
  const [form, setForm] = useState<Profile>(EMPTY_PROFILE)

  /* ---------- load profile ---------- */
  const loadProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      chrome.router.push('/login')
      return
    }

    setUserId(authUser.id)
    setEmail(authUser.email ?? '')

    const [profileRes, creditsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', authUser.id).single(),
      supabase.from('credits').select('balance_usd').eq('user_id', authUser.id).single(),
    ])

    if (profileRes.data) {
      const d = profileRes.data
      setForm({
        first_name: d.first_name || '',
        last_name:  d.last_name  || '',
        phone:      d.phone      || '',
        company:    d.company    || '',
        job_title:  d.job_title  || '',
        country:    d.country    || '',
        city:       d.city       || '',
        use_case:   d.use_case   || '',
        avatar_seed: d.avatar_seed || authUser.email || '',
      })
      setPreviewSeed(d.avatar_seed || authUser.email || '')
    }

    if (creditsRes.data?.balance_usd != null) {
      setBalance(parseFloat(String(creditsRes.data.balance_usd)).toFixed(2))
    }

    setLoading(false)
  }, [chrome.router])

  useEffect(() => { loadProfile() }, [loadProfile])

  /* ---------- handlers ---------- */
  function setField<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function regenerateAvatar() {
    const seed = `${email}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setPreviewSeed(seed)
    setField('avatar_seed', seed)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        first_name: form.first_name,
        last_name:  form.last_name,
        phone:      form.phone,
        company:    form.company,
        job_title:  form.job_title,
        country:    form.country,
        city:       form.city,
        use_case:   form.use_case,
        avatar_seed: form.avatar_seed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2400)
    }
  }

  /* ---------- recent text chats for the rail ---------- */
  const recent: RailRecentItem[] = useMemo(() => {
    return listChats()
      .filter(c => (c.modality ?? 'text') === 'text')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 6)
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
        breadcrumb="account · settings"
        title="Settings"
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
          <SettingsBody
            p={p} mono={mono} serif={serif}
            loading={loading}
            saving={saving}
            saved={saved}
            error={error}
            email={email}
            balance={balance}
            previewSeed={previewSeed}
            form={form}
            setField={setField}
            regenerateAvatar={regenerateAvatar}
            onSubmit={handleSave}
          />
        }
      />
    </div>
  )
}

/* =====================================================================
   Body — pearl-themed, hairline-bordered cards. Three sections
   (Identity → Personal → Professional) plus the sticky save bar.
   ===================================================================== */

function SettingsBody({
  p, mono, serif,
  loading, saving, saved, error,
  email, balance, previewSeed,
  form, setField, regenerateAvatar, onSubmit,
}: {
  p: Palette
  mono: string
  serif: string
  loading: boolean
  saving: boolean
  saved: boolean
  error: string
  email: string
  balance: string
  previewSeed: string
  form: Profile
  setField: <K extends keyof Profile>(key: K, value: Profile[K]) => void
  regenerateAvatar: () => void
  onSubmit: (e: React.FormEvent) => void
}) {
  if (loading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: p.inkMuted, fontFamily: mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        loading profile…
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        maxWidth: 760, margin: '0 auto',
        padding: '28px 56px 96px',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        color: p.ink,
      }}
    >
      <header style={{ marginBottom: 28, paddingBottom: 18, borderBottom: `1px solid ${p.hairlineSoft}` }}>
        <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: p.inkMuted }}>
          account
        </div>
        <h1 style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 34, lineHeight: 1.05, margin: '6px 0 8px', color: p.ink, fontWeight: 400 }}>
          Profile settings
        </h1>
        <p style={{ fontSize: 13.5, color: p.inkSoft, lineHeight: 1.55, maxWidth: 520, margin: 0 }}>
          Manage your name, contact details, and how Clox is set up for the kind of work you do.
        </p>
      </header>

      {/* Identity card */}
      <Section p={p} mono={mono} serif={serif} eyebrow="01" title="Identity">
        <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr auto', gap: 24, alignItems: 'center' }}>
          <Avatar seed={previewSeed || email} size={80} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: serif, fontSize: 18, lineHeight: 1.3, color: p.ink, marginBottom: 2 }}>
              {form.first_name || email.split('@')[0] || 'Clox user'}
              {form.last_name ? ` ${form.last_name}` : ''}
            </div>
            <div style={{ fontFamily: mono, fontSize: 11, color: p.inkMuted, letterSpacing: '0.06em', marginBottom: 12 }}>
              {email}
            </div>
            <button
              type="button"
              onClick={regenerateAvatar}
              style={{
                ...ghostBtn(p, mono),
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              <RefreshIcon /> Regenerate avatar
            </button>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.inkMuted, marginBottom: 4 }}>
              Balance
            </div>
            <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 26, color: p.accent, lineHeight: 1 }}>
              ${balance}
            </div>
          </div>
        </div>
      </Section>

      {/* Personal info */}
      <Section p={p} mono={mono} serif={serif} eyebrow="02" title="Personal">
        <Grid2>
          <Field p={p} mono={mono} label="First name">
            <Input p={p} value={form.first_name} onChange={v => setField('first_name', v)} placeholder="First name" />
          </Field>
          <Field p={p} mono={mono} label="Last name">
            <Input p={p} value={form.last_name} onChange={v => setField('last_name', v)} placeholder="Last name" />
          </Field>
        </Grid2>

        <Field p={p} mono={mono} label="Email">
          <Input p={p} value={email} onChange={() => undefined} disabled placeholder="" />
        </Field>

        <Field p={p} mono={mono} label="Phone">
          <Input p={p} value={form.phone} onChange={v => setField('phone', v)} placeholder="+971 50 000 0000" />
        </Field>

        <Grid2>
          <Field p={p} mono={mono} label="Country">
            <Select p={p} value={form.country} onChange={v => setField('country', v)} options={['', ...COUNTRIES]} placeholder="Select country" />
          </Field>
          <Field p={p} mono={mono} label="City">
            <Input p={p} value={form.city} onChange={v => setField('city', v)} placeholder="Dubai" />
          </Field>
        </Grid2>
      </Section>

      {/* Professional info */}
      <Section p={p} mono={mono} serif={serif} eyebrow="03" title="Professional">
        <Field p={p} mono={mono} label="Company / organisation">
          <Input p={p} value={form.company} onChange={v => setField('company', v)} placeholder="Acme Inc." />
        </Field>
        <Field p={p} mono={mono} label="Job title">
          <Input p={p} value={form.job_title} onChange={v => setField('job_title', v)} placeholder="CEO, Designer, Researcher…" />
        </Field>
        <Field p={p} mono={mono} label="How do you use Clox?">
          <Select p={p} value={form.use_case} onChange={v => setField('use_case', v)} options={['', ...USE_CASES]} placeholder="Select primary use case" />
        </Field>
      </Section>

      {error && (
        <div style={{
          marginTop: 18,
          background: p.surfaceAlt,
          border: `1px solid ${p.hairline}`,
          borderLeft: `3px solid ${p.accent}`,
          borderRadius: 3,
          padding: '12px 16px',
          fontFamily: mono, fontSize: 11.5, color: p.ink, letterSpacing: '0.04em',
        }}>
          {error}
        </div>
      )}

      {/* Save bar */}
      <div style={{
        marginTop: 32, paddingTop: 20,
        borderTop: `1px solid ${p.hairlineSoft}`,
        display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end',
      }}>
        {saved && (
          <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: p.accent }}>
            Saved
          </span>
        )}
        <button type="submit" disabled={saving} style={{
          fontFamily: mono, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
          background: p.ink, color: p.bg,
          border: 'none', borderRadius: 3,
          padding: '10px 22px', cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

/* =====================================================================
   Primitives
   ===================================================================== */

function Section({
  p, mono, serif, eyebrow, title, children,
}: {
  p: Palette
  mono: string
  serif: string
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section style={{
      background: p.surface,
      border: `1px solid ${p.hairline}`,
      borderRadius: 3,
      padding: '24px 28px',
      marginBottom: 22,
    }}>
      <header style={{
        display: 'flex', alignItems: 'baseline', gap: 14,
        marginBottom: 18, paddingBottom: 12,
        borderBottom: `1px solid ${p.hairlineSoft}`,
      }}>
        <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: p.inkMuted }}>
          {eyebrow}
        </span>
        <h2 style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 400, fontSize: 22, color: p.ink, margin: 0, lineHeight: 1.1 }}>
          {title}
        </h2>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </section>
  )
}

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {children}
    </div>
  )
}

function Field({
  p, mono, label, children,
}: {
  p: Palette
  mono: string
  label: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{
        fontFamily: mono, fontSize: 10, letterSpacing: '0.2em',
        textTransform: 'uppercase', color: p.inkMuted, marginBottom: 6,
      }}>{label}</div>
      {children}
    </label>
  )
}

function Input({
  p, value, onChange, placeholder, disabled,
}: {
  p: Palette
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        background: disabled ? p.surfaceAlt : p.bg,
        border: `1px solid ${p.hairline}`,
        borderRadius: 3,
        padding: '10px 12px',
        fontFamily: 'inherit', fontSize: 14,
        color: p.ink,
        outline: 'none',
        opacity: disabled ? 0.6 : 1,
      }}
      onFocus={e => { e.currentTarget.style.borderColor = p.ink }}
      onBlur={e => { e.currentTarget.style.borderColor = p.hairline }}
    />
  )
}

function Select({
  p, value, onChange, options, placeholder,
}: {
  p: Palette
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        background: p.bg,
        border: `1px solid ${p.hairline}`,
        borderRadius: 3,
        padding: '10px 12px',
        fontFamily: 'inherit', fontSize: 14,
        color: value ? p.ink : p.inkMuted,
        outline: 'none',
        appearance: 'none',
        cursor: 'pointer',
      }}
      onFocus={e => { e.currentTarget.style.borderColor = p.ink }}
      onBlur={e => { e.currentTarget.style.borderColor = p.hairline }}
    >
      {options.map((opt, i) => (
        <option key={`${opt}-${i}`} value={opt}>
          {opt === '' ? (placeholder ?? 'Select…') : opt}
        </option>
      ))}
    </select>
  )
}

function ghostBtn(p: Palette, mono: string): React.CSSProperties {
  return {
    fontFamily: mono, fontSize: 10.5, letterSpacing: '0.16em',
    textTransform: 'uppercase',
    background: 'transparent',
    color: p.ink,
    border: `1px solid ${p.hairline}`,
    borderRadius: 3,
    padding: '7px 14px',
    cursor: 'pointer',
  }
}

function RefreshIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M2 2v3h3M10 10V7H7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7a4 4 0 0 0 7 1M9 5a4 4 0 0 0-7-1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

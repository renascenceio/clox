'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar from '@/shared/ui/layout/ChatSidebar'
import Avatar from '@/shared/ui/components/Avatar'

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

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [balance, setBalance] = useState('0.00')

  const [form, setForm] = useState<Profile>({
    first_name: '',
    last_name: '',
    phone: '',
    company: '',
    job_title: '',
    country: '',
    city: '',
    use_case: '',
    avatar_seed: '',
  })

  // Preview seed for avatar regeneration (not yet saved)
  const [previewSeed, setPreviewSeed] = useState('')

  const loadProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setUserId(user.id)
    setEmail(user.email ?? '')

    const [profileRes, creditsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('credits').select('balance_usd').eq('user_id', user.id).single(),
    ])

    if (profileRes.data) {
      const p = profileRes.data
      setForm({
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        phone: p.phone || '',
        company: p.company || '',
        job_title: p.job_title || '',
        country: p.country || '',
        city: p.city || '',
        use_case: p.use_case || '',
        avatar_seed: p.avatar_seed || user.email || '',
      })
      setPreviewSeed(p.avatar_seed || user.email || '')
    }

    if (creditsRes.data?.balance_usd != null) {
      setBalance(parseFloat(creditsRes.data.balance_usd).toFixed(2))
    }

    setLoading(false)
  }, [router])

  useEffect(() => { loadProfile() }, [loadProfile])

  const regenerateAvatar = () => {
    const newSeed = `${email}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setPreviewSeed(newSeed)
    setForm(prev => ({ ...prev, avatar_seed: newSeed }))
  }

  const set = (field: keyof Profile, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        company: form.company,
        job_title: form.job_title,
        country: form.country,
        city: form.city,
        use_case: form.use_case,
        avatar_seed: form.avatar_seed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const inputClass =
    'w-full h-11 px-4 bg-white/70 dark:bg-[#2C2C2E]/70 border border-separator rounded-hig-lg text-sm font-medium text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/30 dark:focus:ring-teal/30 focus:border-brown dark:focus:border-teal transition-all'
  const selectClass = inputClass + ' cursor-pointer'
  const labelClass = 'block text-xs font-bold text-label-tertiary uppercase tracking-wider mb-1.5'

  const sidebar = <ChatSidebar />

  return (
    <AppLayout sidebar={sidebar}>
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-label-primary tracking-tight">Profile Settings</h1>
          <p className="text-sm text-label-tertiary mt-1">Manage your personal information and preferences</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brown/30 border-t-brown rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Avatar card */}
            <div className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl rounded-hig-2xl border border-separator/50 p-6 shadow-float">
              <h2 className="text-sm font-bold text-label-secondary uppercase tracking-widest mb-4">Avatar</h2>
              <div className="flex items-center gap-5">
                <div className="relative">
                  <Avatar seed={previewSeed || email} size={80} className="ring-4 ring-brown/20 dark:ring-teal/20 shadow-brown-glow" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-label-primary mb-1">
                    {form.first_name || email.split('@')[0]}
                    {form.last_name ? ` ${form.last_name}` : ''}
                  </p>
                  <p className="text-xs text-label-tertiary mb-3">{email}</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={regenerateAvatar}
                      className="flex items-center gap-2 px-4 py-2 bg-surface-tertiary dark:bg-surface border border-separator rounded-hig-lg text-sm font-medium text-label-primary hover:border-brown dark:hover:border-teal hover:text-brown dark:hover:text-teal transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate
                    </button>
                    <span className="text-xs text-label-tertiary">Generates a new avatar style</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-label-tertiary uppercase tracking-widest mb-0.5">Balance</div>
                  <div className="text-2xl font-black text-teal-600 dark:text-teal-400">${balance}</div>
                </div>
              </div>
            </div>

            {/* Personal info */}
            <div className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl rounded-hig-2xl border border-separator/50 p-6 shadow-float">
              <h2 className="text-sm font-bold text-label-secondary uppercase tracking-widest mb-4">Personal Information</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>First Name</label>
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={e => set('first_name', e.target.value)}
                      className={inputClass}
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Last Name</label>
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={e => set('last_name', e.target.value)}
                      className={inputClass}
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className={inputClass + ' opacity-50 cursor-not-allowed'}
                  />
                </div>

                <div>
                  <label className={labelClass}>Phone Number</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    className={inputClass}
                    placeholder="+971 50 000 0000"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Country</label>
                    <select
                      value={form.country}
                      onChange={e => set('country', e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={e => set('city', e.target.value)}
                      className={inputClass}
                      placeholder="Dubai"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Professional info */}
            <div className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl rounded-hig-2xl border border-separator/50 p-6 shadow-float">
              <h2 className="text-sm font-bold text-label-secondary uppercase tracking-widest mb-4">Professional Information</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Company / Organization</label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={e => set('company', e.target.value)}
                    className={inputClass}
                    placeholder="Acme Inc."
                  />
                </div>

                <div>
                  <label className={labelClass}>Job Title</label>
                  <input
                    type="text"
                    value={form.job_title}
                    onChange={e => set('job_title', e.target.value)}
                    className={inputClass}
                    placeholder="CEO, Developer, Designer..."
                  />
                </div>

                <div>
                  <label className={labelClass}>How do you use Clox?</label>
                  <select
                    value={form.use_case}
                    onChange={e => set('use_case', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Select primary use case</option>
                    {USE_CASES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-hig-lg px-4 py-3">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pb-4">
              {saved && (
                <span className="text-sm font-medium text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-6 h-11 gradient-brown-teal text-white rounded-hig-lg text-sm font-bold shadow-brown-glow hover:shadow-hig-hover hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  )
}

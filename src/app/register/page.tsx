'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthShell, Field, Notice, PrimaryButton, safeRedirect } from '@/shared/ui/auth/AuthShell'

const USE_CASES = [
  'Content creation',
  'Software development',
  'Research & analysis',
  'Customer support',
  'Marketing & sales',
  'Education & training',
  'Data analysis',
  'Personal productivity',
  'Other',
]

const COUNTRIES = [
  'United Arab Emirates', 'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'France', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'Jordan', 'Egypt', 'Lebanon', 'India', 'Singapore', 'Other',
]

type Form = {
  firstName: string
  lastName: string
  company: string
  jobTitle: string
  country: string
  city: string
  useCase: string
}

const selectClass =
  'mt-2 h-11 w-full rounded-sharp border border-hairline bg-surface px-3 text-[14.5px] text-ink focus:border-ink focus:outline-none'
const labelClass = 'flex font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted'

/**
 * Profile setup — shown right after someone confirms their email (and to
 * anyone who signs in without a name on file). Only the name is required;
 * the rest helps us tailor Omma and can be filled in later from Settings.
 */
function ProfileSetup() {
  const params = useSearchParams()
  const next = safeRedirect(params.get('next'))
  const welcome = params.get('welcome') === '1'
  const [userId, setUserId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>({ firstName: '', lastName: '', company: '', jobTitle: '', country: '', city: '', useCase: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.replace(`/login?redirect=${encodeURIComponent('/register')}`)
        return
      }
      setUserId(data.user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, company, job_title, country, city, use_case')
        .eq('id', data.user.id)
        .maybeSingle()
      const meta = data.user.user_metadata ?? {}
      setForm({
        firstName: profile?.first_name || meta.first_name || '',
        lastName: profile?.last_name || meta.last_name || '',
        company: profile?.company ?? '',
        jobTitle: profile?.job_title ?? '',
        country: profile?.country ?? '',
        city: profile?.city ?? '',
        useCase: profile?.use_case ?? '',
      })
    })
  }, [])

  const set = (field: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        company: form.company.trim() || null,
        job_title: form.jobTitle.trim() || null,
        country: form.country || null,
        city: form.city.trim() || null,
        use_case: form.useCase || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
    if (updateError) {
      setLoading(false)
      setError(updateError.message)
      return
    }
    window.location.assign(next)
  }

  return (
    <AuthShell
      eyebrow={welcome ? 'Email confirmed' : 'Your profile'}
      title={welcome ? 'You’re in. One last step.' : 'Tell us who you are.'}
      lede="Your name is all we need. The rest helps us tune Omma for your work — you can change it any time in Settings."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Field id="first-name" label="First name" autoComplete="given-name" required value={form.firstName} onChange={set('firstName')} disabled={loading || !userId} />
          <Field id="last-name" label="Last name" autoComplete="family-name" required value={form.lastName} onChange={set('lastName')} disabled={loading || !userId} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field id="company" label="Company" autoComplete="organization" value={form.company} onChange={set('company')} disabled={loading || !userId} placeholder="Optional" />
          <Field id="job-title" label="Role" autoComplete="organization-title" value={form.jobTitle} onChange={set('jobTitle')} disabled={loading || !userId} placeholder="Optional" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="country" className={labelClass}>Country</label>
            <select id="country" value={form.country} onChange={set('country')} disabled={loading || !userId} className={selectClass}>
              <option value="">Optional</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <Field id="city" label="City" autoComplete="address-level2" value={form.city} onChange={set('city')} disabled={loading || !userId} placeholder="Optional" />
        </div>
        <div>
          <label htmlFor="use-case" className={labelClass}>Mostly for</label>
          <select id="use-case" value={form.useCase} onChange={set('useCase')} disabled={loading || !userId} className={selectClass}>
            <option value="">Optional</option>
            {USE_CASES.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <p className="text-[13.5px] text-ink-soft">
          Your account starts with <span className="text-ink">$10.00</span> of credit.
        </p>
        {error ? <Notice>{error}</Notice> : null}
        <PrimaryButton type="submit" loading={loading} disabled={!userId}>
          Continue to Omma
        </PrimaryButton>
      </form>
    </AuthShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <ProfileSetup />
    </Suspense>
  )
}

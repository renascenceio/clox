'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const USE_CASES = [
  'Content Creation',
  'Software Development',
  'Research & Analysis',
  'Customer Support',
  'Marketing & Sales',
  'Education & Training',
  'Data Analysis',
  'Personal Productivity',
  'Other',
]

const COUNTRIES = [
  'United Arab Emirates', 'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'France', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'Jordan', 'Egypt', 'Lebanon', 'India', 'Singapore', 'Other',
]

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    country: '',
    city: '',
    company: '',
    jobTitle: '',
    useCase: '',
  })

  // Check if user is already logged in (came from magic link)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        // Check if profile already complete
        supabase
          .from('profiles')
          .select('first_name, last_name, company')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile?.first_name && profile?.last_name && profile?.company) {
              router.push('/text')
            }
          })
      } else {
        router.push('/login')
      }
    })
  }, [router])

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 1) { setStep(2); return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        first_name: form.firstName,
        last_name: form.lastName,
        phone: form.phone,
        country: form.country,
        city: form.city,
        company: form.company,
        job_title: form.jobTitle,
        use_case: form.useCase,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    router.push('/text')
  }

  const inputClass =
    'w-full h-11 px-4 bg-white dark:bg-[#2C2C2E] border-2 border-separator rounded-xl text-sm font-medium text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/40 dark:focus:ring-teal/40 focus:border-brown dark:focus:border-teal transition-all'
  const selectClass = inputClass + ' cursor-pointer'
  const labelClass = 'block text-xs font-bold text-label-tertiary uppercase tracking-wider mb-1.5'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-brown-50 to-teal-50 dark:from-[#1C1C1E] dark:via-[#2C2C2E] dark:to-[#1C1C1E] p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-brown/20 rounded-full filter blur-3xl animate-blob" />
        <div className="absolute -bottom-8 right-20 w-72 h-72 bg-teal/20 rounded-full filter blur-3xl animate-blob [animation-delay:3s]" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 gradient-brown-teal rounded-2xl flex items-center justify-center shadow-brown-glow mx-auto mb-3">
            <span className="text-white font-black text-xl">C</span>
          </div>
          <h1 className="text-2xl font-black text-label-primary tracking-tight">Create your account</h1>
          <p className="text-sm text-label-tertiary mt-1">Step {step} of 2 — {step === 1 ? 'Personal info' : 'Professional info'}</p>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 mb-6">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                s <= step ? 'gradient-brown-teal' : 'bg-separator'
              }`}
            />
          ))}
        </div>

        <div className="backdrop-blur-2xl bg-white/90 dark:bg-[#1C1C1E]/90 rounded-3xl p-8 shadow-2xl border border-separator/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>First Name</label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => set('firstName', e.target.value)}
                      required
                      className={inputClass}
                      placeholder="Aslan"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Last Name</label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => set('lastName', e.target.value)}
                      required
                      className={inputClass}
                      placeholder="Patov"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Phone Number</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    className={inputClass}
                    placeholder="+971 50 000 0000"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Country</label>
                    <select
                      value={form.country}
                      onChange={(e) => set('country', e.target.value)}
                      required
                      className={selectClass}
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => set('city', e.target.value)}
                      className={inputClass}
                      placeholder="Dubai"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelClass}>Company / Organization</label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => set('company', e.target.value)}
                    required
                    className={inputClass}
                    placeholder="Acme Inc."
                  />
                </div>

                <div>
                  <label className={labelClass}>Job Title</label>
                  <input
                    type="text"
                    value={form.jobTitle}
                    onChange={(e) => set('jobTitle', e.target.value)}
                    required
                    className={inputClass}
                    placeholder="CEO, Developer, Designer..."
                  />
                </div>

                <div>
                  <label className={labelClass}>How will you use Clox?</label>
                  <select
                    value={form.useCase}
                    onChange={(e) => set('useCase', e.target.value)}
                    required
                    className={selectClass}
                  >
                    <option value="">Select primary use case</option>
                    {USE_CASES.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-teal/5 dark:bg-teal/10 border border-teal/20 dark:border-teal/30 rounded-xl p-4">
                  <p className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider mb-1">Free trial included</p>
                  <p className="text-sm text-label-secondary">Your account starts with <span className="font-bold text-label-primary">$10.00</span> in credits — no payment needed.</p>
                </div>
              </>
            )}

            {error && (
              <p className="text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 h-12 bg-surface-tertiary dark:bg-[#2C2C2E] text-label-primary rounded-xl text-sm font-bold border-2 border-separator hover:border-brown/50 dark:hover:border-teal/50 transition-all"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 h-12 gradient-brown-teal text-white rounded-xl text-sm font-bold shadow-brown-glow hover:shadow-hig-hover hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : step === 1 ? (
                  'Continue'
                ) : (
                  'Complete Setup'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

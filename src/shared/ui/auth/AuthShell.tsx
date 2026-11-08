'use client'

import Link from 'next/link'
import type { ReactNode, InputHTMLAttributes } from 'react'
import CookieSettingsLink from '@/components/cookie-consent/CookieSettingsLink'

/**
 * Shared frame for every account screen (sign in, create account, reset,
 * profile setup). Same Pearl × Onyx language as the landing page: serif
 * headline, mono eyebrows, 1px hairlines, no shadows.
 */
export function AuthShell({
  eyebrow,
  title,
  lede,
  children,
  footer,
}: {
  eyebrow: string
  title: string
  lede?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <header className="border-b border-hairline-soft">
        <div className="mx-auto flex max-w-[1240px] items-center px-6 py-4 md:px-8">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="font-serif text-[22px] italic tracking-[-0.01em]">Clox</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">v0.4</span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 py-16 md:py-24">
        <div className="w-full max-w-[420px]">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-muted">{eyebrow}</p>
          <h1 className="mt-3 font-serif text-[40px] leading-[1.05] tracking-[-0.02em] text-balance">{title}</h1>
          {lede ? <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft text-pretty">{lede}</p> : null}
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8 border-t border-hairline-soft pt-6 text-[13.5px] text-ink-soft">{footer}</div> : null}
        </div>
      </main>

      <footer className="border-t border-hairline-soft">
        <nav
          aria-label="Legal"
          className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-1 px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted md:px-8"
        >
          <Link href="/privacy" className="py-2 hover:text-ink">Privacy</Link>
          <Link href="/cookies" className="py-2 hover:text-ink">Cookies</Link>
          <Link href="/terms" className="py-2 hover:text-ink">Terms</Link>
          <CookieSettingsLink className="py-2 uppercase tracking-[0.12em] hover:text-ink">Cookie settings</CookieSettingsLink>
        </nav>
      </footer>
    </div>
  )
}

export function Field({
  label,
  hint,
  id,
  ...input
}: { label: string; hint?: ReactNode; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">
          {label}
        </label>
        {hint ? <span className="text-[12.5px] text-ink-muted">{hint}</span> : null}
      </div>
      <input
        id={id}
        {...input}
        className="mt-2 h-11 w-full rounded-sharp border border-hairline bg-surface px-3.5 text-[14.5px] text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none disabled:opacity-60"
      />
    </div>
  )
}

export function PrimaryButton({ children, loading, ...rest }: { children: ReactNode; loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-sharp border border-ink bg-ink font-mono text-[11.5px] uppercase tracking-[0.1em] text-surface transition-colors hover:bg-black disabled:opacity-50"
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}

export function Notice({ tone = 'error', children }: { tone?: 'error' | 'ok'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-sharp border px-3.5 py-3 text-[13.5px] leading-relaxed ${
        tone === 'error' ? 'border-red-500/40 text-red-700 dark:text-red-300' : 'border-hairline text-ink'
      }`}
    >
      {children}
    </p>
  )
}

/** Supabase auth errors, in words a person can act on. */
export function authErrorText(message: string) {
  if (/rate limit|too many/i.test(message)) return 'We’ve sent too many emails in a short time. Please try again in a few minutes.'
  if (/registered|already exists/i.test(message)) return 'An account with this email already exists. Sign in instead.'
  if (/invalid login|invalid credentials/i.test(message)) return 'That email and password don’t match an account.'
  if (/password.*(short|least|weak)/i.test(message)) return 'Please choose a longer password.'
  if (/invalid.*email|email.*invalid/i.test(message)) return 'That email address doesn’t look right.'
  return message
}

/** Only allow same-site relative redirects (no `//evil.com`). */
export function safeRedirect(value: string | null | undefined, fallback = '/text') {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback
  return value
}

/**
 * Where a freshly signed-in person should land: the profile setup screen
 * until they've given their name, otherwise wherever they were going.
 */
export async function landingFor(
  supabase: ReturnType<typeof import('@/lib/supabase/client').createClient>,
  next: string,
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return '/login'
  const { data: profile } = await supabase.from('profiles').select('first_name, last_name').eq('id', user.id).maybeSingle()
  if (!profile?.first_name?.trim() || !profile?.last_name?.trim()) {
    return `/register?next=${encodeURIComponent(next)}`
  }
  return next
}

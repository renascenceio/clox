'use client'

/**
 * AdminShell — the editorial chrome for every super-admin page.
 *
 * Layout (matches the Pearl & Onyx reference):
 *
 *   ┌──────────┬───────────────────────────────────────────┐
 *   │  rail    │  top strip (breadcrumb · actions · ⌘K)    │
 *   │  248px   ├───────────────────────────────────────────┤
 *   │          │  page-head (eyebrow · serif h1 · lead)    │
 *   │  brand   ├───────────────────────────────────────────┤
 *   │  search  │  tabs (optional, with active 2px under)   │
 *   │  sect.s  ├───────────────────────────────────────────┤
 *   │  links   │  children (scroll area)                   │
 *   │  user    │                                           │
 *   └──────────┴───────────────────────────────────────────┘
 *
 * Pure layout/chrome — pages slot their own content (KPIs, panels, tables)
 * via children. The shell itself owns: brand, rail nav, ⌘K trigger button
 * (interactive ⌘K palette will land in a follow-up; for now the trigger is
 * an obvious affordance that does nothing).
 */

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Rail nav definition. Routes that don't exist yet are wired to '#' and get
// a muted hover treatment via the `disabled` flag — this keeps the rail
// visually complete without 404'ing the user.
// ---------------------------------------------------------------------------
type RailLink = {
  label: string
  href: string
  count?: string
  dot?: 'green' | 'amber' | 'red'
  disabled?: boolean
  icon: ReactNode
}
type RailSection = {
  heading: string
  links: RailLink[]
}

const SECTIONS: RailSection[] = [
  {
    heading: 'overview',
    links: [
      {
        label: 'Dashboard',
        href: '/admin',
        icon: (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M1.5 6.5 6.5 2l5 4.5V11a1 1 0 0 1-1 1H8.5V8.5h-4V12H2.5a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        label: 'Usage & cost',
        href: '/admin/usage',
        icon: (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 11h9M3 9V5M5 9V3M7 9V6M9 9V4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        label: 'System status',
        href: '/admin/status',
        dot: 'green',
        icon: (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1" />
            <path d="M2 6.5h9M6.5 1.5a8 5 0 0 1 0 10M6.5 1.5a8 5 0 0 0 0 10" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        ),
      },
    ],
  },
  {
    heading: 'people',
    links: [
      {
        label: 'Users',
        href: '/admin/users',
        icon: (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="4.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.1" />
            <path d="M1 11.5c0-2 1.5-3.5 3.5-3.5s3.5 1.5 3.5 3.5M9 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4M12 11.5c0-2-1.3-3.5-3-3.5" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        ),
      },
      {
        label: 'Billing',
        href: '/admin/billing',
        icon: (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M3 4h7M3 7h7M3 10h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    heading: 'platform',
    links: [
      {
        label: 'Models',
        href: '/admin/api-keys',
        icon: (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.1" />
            <path d="M6.5 1.5v1.5M6.5 10v1.5M1.5 6.5h1.5M10 6.5h1.5" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        ),
      },
      {
        label: 'Translations',
        href: '/admin/translations',
        icon: (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M3 4h7M3 7h4M5 7v4M2 11l1.5-3M11 11l-1.5-3M9.5 8 8 11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        label: 'Feature flags',
        href: '/admin/flags',
        icon: (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M3 6h7M3 4h7M3 8h4" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        ),
      },
      {
        label: 'Audit log',
        href: '/admin/audit',
        icon: (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 3h9v6H6L3 11.5V9H2z" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        ),
      },
      {
        label: 'Content moderation',
        href: '/admin/content-moderation',
        icon: (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1.5 11 4v3.5c0 2.5-2 4.3-4.5 4.5C4 11.8 2 10 2 7.5V4z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
            <path d="M5 6.5 6 7.5 8.5 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        label: 'Settings',
        href: '/admin/settings',
        icon: (
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="1.4" stroke="currentColor" strokeWidth="1.1" />
            <path d="M6.5 1.5v1.5M6.5 10v1.5M1.5 6.5h1.5M10 6.5h1.5M3 3l1 1M9 9l1 1M3 10l1-1M9 4l1-1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// AdminShell — props
// ---------------------------------------------------------------------------
export interface AdminTab {
  label: string
  pill?: { text: string; tone?: 'default' | 'amber' }
  active?: boolean
  onClick?: () => void
}

export interface AdminShellProps {
  /**
   * Breadcrumb path shown in the top strip — e.g. ['admin', 'overview']
   * Followed by the page title (rendered in serif italic).
   */
  crumb: string[]
  /** Page title shown after the breadcrumb (serif italic). */
  here: string
  /** Eyebrow above the page-head h1. Mono, uppercase, ink-muted. */
  eyebrow?: string
  /**
   * The page-head heading. Rendered in Newsreader; pass a string for a flat
   * title or a JSX node if you need an `<em>` italic emphasis word.
   */
  heading: ReactNode
  /** Optional lead paragraph under the heading. */
  lead?: string
  /** Filters / segmented controls in the top-right of the page-head. */
  headExtra?: ReactNode
  /** Tab strip. If omitted, no tabs render. */
  tabs?: AdminTab[]
  /** Right-side action buttons in the top strip (Refresh / Export / Invite). */
  actions?: ReactNode
  /** Live status hint shown left of `actions` (e.g. "last sync 14:32 · live"). */
  syncHint?: string
  /** The page body. */
  children: ReactNode
}

export default function AdminShell({
  crumb,
  here,
  eyebrow,
  heading,
  lead,
  headExtra,
  tabs,
  actions,
  syncHint,
  children,
}: AdminShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  // Email shown in the rail footer; gated server-side by AdminLayout so
  // we don't worry about the unauthenticated case here.
  const [adminEmail, setAdminEmail] = useState<string>('')

  // Server-side `requireSuperAdmin` already gates this surface, so the only
  // job here is to read the email for the rail footer.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setAdminEmail(user.email)
    })
  }, [])

  const initial = adminEmail.charAt(0).toUpperCase() || 'a'

  return (
    <div className="grid grid-cols-[248px_1fr] h-screen min-h-[720px] bg-bg text-ink font-sans">
      {/* ============================== rail ============================== */}
      <aside className="bg-rail border-r border-hairline flex flex-col overflow-hidden">
        {/* brand */}
        <div className="flex items-baseline justify-between px-[18px] pt-4 pb-3">
          <div className="font-serif italic text-[19px] tracking-[-0.01em]">Clox</div>
          <div className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-accent">admin</div>
        </div>

        {/* search */}
        <button
          type="button"
          className="mx-3.5 mb-3 flex items-center gap-2 px-2.5 py-1.5 bg-rail-soft border border-hairline-soft rounded-sharp font-mono text-[11px] text-ink-muted hover:border-hairline transition-colors"
          title="Search & jump (⌘K) — coming soon"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="4.5" cy="4.5" r="3.2" stroke="currentColor" strokeWidth="1.1" />
            <path d="m7 7 2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          <span className="flex-1 text-left">search & jump</span>
          <span>⌘K</span>
        </button>

        {/* nav sections */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar pb-2">
          {SECTIONS.map(section => (
            <div key={section.heading}>
              <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted px-[18px] pt-3.5 pb-1.5">
                {section.heading}
              </div>
              {section.links.map(link => {
                const isActive = pathname === link.href
                const baseCls =
                  'group relative flex items-center gap-2.5 mx-2 my-px px-3 py-1.5 rounded-sharp text-[13px] transition-colors'
                const stateCls = isActive
                  ? 'bg-bg font-medium text-ink'
                  : link.disabled
                    ? 'text-ink-muted cursor-default'
                    : 'text-ink hover:bg-rail-soft'
                const onClick = (e: React.MouseEvent) => {
                  if (link.disabled) {
                    e.preventDefault()
                    return
                  }
                  e.preventDefault()
                  router.push(link.href)
                }
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={onClick}
                    className={`${baseCls} ${stateCls}`}
                    aria-current={isActive ? 'page' : undefined}
                    aria-disabled={link.disabled}
                  >
                    {/* active accent bar (2px ink rule) */}
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute -left-2 top-1.5 bottom-1.5 w-[2px] bg-ink"
                      />
                    )}
                    <span className={`${isActive ? 'text-ink' : 'text-ink-soft'} flex-shrink-0`}>
                      {link.icon}
                    </span>
                    <span className="flex-1 truncate">{link.label}</span>
                    {link.count && (
                      <span className="font-mono text-[10px] text-ink-muted">{link.count}</span>
                    )}
                    {link.dot && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          link.dot === 'green'
                            ? 'bg-[rgb(47_143_95)]'
                            : link.dot === 'amber'
                              ? 'bg-[rgb(185_138_43)]'
                              : 'bg-[rgb(181_58_40)]'
                        }`}
                      />
                    )}
                  </a>
                )
              })}
            </div>
          ))}
        </nav>

        {/* user footer */}
        <div className="mt-auto px-3.5 py-3 border-t border-hairline-soft flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-ink text-bg font-serif italic text-xs flex items-center justify-center">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] truncate">{adminEmail || 'admin'}</div>
            <div className="font-mono text-[10px] text-ink-muted">superadmin</div>
          </div>
          <button
            onClick={() => router.push('/text')}
            className="w-7 h-7 inline-flex items-center justify-center border border-hairline-soft rounded-sharp text-ink-soft hover:border-ink hover:text-ink transition-colors"
            title="Return to studio"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 6h6M6 3l3 3-3 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ============================== main ============================== */}
      <main className="flex flex-col min-w-0 overflow-hidden">
        {/* top strip */}
        <div className="flex items-center justify-between px-7 py-3.5 border-b border-hairline-soft gap-6">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-ink-muted">
              {crumb.join(' / ')}
            </span>
            <span className="text-ink-muted">/</span>
            <span className="font-serif italic text-[19px] tracking-[-0.01em] truncate">{here}</span>
          </div>
          <div className="flex items-center gap-2">
            {syncHint && (
              <span className="font-mono text-[10px] text-ink-muted tracking-[0.04em] mr-2">
                {syncHint}
              </span>
            )}
            {actions}
          </div>
        </div>

        {/* page head */}
        <div className="grid grid-cols-[1fr_auto] gap-6 items-end px-7 pt-5 pb-3.5 border-b border-hairline-soft">
          <div>
            {eyebrow && (
              <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted">
                {eyebrow}
              </div>
            )}
            <h1 className="font-serif font-normal text-[32px] leading-[1.05] tracking-[-0.02em] mt-1.5 text-pretty">
              {heading}
            </h1>
            {lead && (
              <p className="text-[13.5px] text-ink-soft max-w-[540px] mt-2 leading-relaxed">
                {lead}
              </p>
            )}
          </div>
          {headExtra && <div className="flex items-center gap-2.5">{headExtra}</div>}
        </div>

        {/* tabs */}
        {tabs && tabs.length > 0 && (
          <div className="flex items-end gap-0 border-b border-hairline-soft px-7">
            {tabs.map(tab => (
              <button
                key={tab.label}
                onClick={tab.onClick}
                className={`relative px-4 py-3 text-[13px] transition-colors ${
                  tab.active ? 'text-ink font-medium' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {tab.label}
                {tab.pill && (
                  <span
                    className={`inline-block ml-1.5 px-1.5 py-px font-mono text-[10px] rounded-sharp ${
                      tab.pill.tone === 'amber'
                        ? 'bg-[rgb(185_138_43_/_0.18)] text-[rgb(185_138_43)]'
                        : 'bg-surface-alt text-ink'
                    }`}
                  >
                    {tab.pill.text}
                  </span>
                )}
                {tab.active && (
                  <span aria-hidden className="absolute left-4 right-4 -bottom-px h-[2px] bg-ink" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-7 pt-6 pb-16">
          {children}
        </div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editorial primitives — small reusable building blocks for admin pages.
// ---------------------------------------------------------------------------

/** Outline button used in the top strip and panel toolbars. */
export function AdminBtn({
  children,
  primary,
  danger,
  onClick,
  type = 'button',
  className = '',
}: {
  children: ReactNode
  primary?: boolean
  danger?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
}) {
  const tone = primary
    ? 'bg-ink text-bg border-ink hover:bg-ink/90'
    : danger
      ? 'text-[rgb(181_58_40)] border-[rgb(181_58_40_/_0.3)] hover:border-[rgb(181_58_40)] hover:bg-[rgb(181_58_40_/_0.05)]'
      : 'border-hairline hover:border-ink'
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 h-[30px] font-mono text-[10.5px] tracking-[0.08em] uppercase border bg-transparent rounded-sharp transition-colors ${tone} ${className}`}
    >
      {children}
    </button>
  )
}

/** 30×30 hairline icon button — used for refresh, export, etc. */
export function AdminIconBtn({
  children,
  title,
  onClick,
}: {
  children: ReactNode
  title: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-[30px] h-[30px] inline-flex items-center justify-center border border-hairline-soft rounded-sharp text-ink-soft hover:border-ink hover:text-ink transition-colors"
    >
      {children}
    </button>
  )
}

/** A panel — surface + 1px hairline + serif italic head. */
export function AdminPanel({
  title,
  meta,
  toolbar,
  children,
  className = '',
}: {
  title: string
  meta?: string
  toolbar?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`bg-surface border border-hairline rounded-card flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-baseline justify-between gap-3 px-[18px] py-3.5 border-b border-hairline-soft">
        <h3 className="font-serif italic font-normal text-[19px] tracking-[-0.01em] m-0">
          {title}
        </h3>
        {meta && (
          <span className="font-mono text-[10px] text-ink-muted tracking-[0.06em]">{meta}</span>
        )}
      </div>
      {toolbar}
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

/** Filter chip — mono uppercase, hairline border, ink when active. */
export function AdminFilter({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10.5px] border rounded-sharp transition-colors ${
        active
          ? 'text-ink border-ink'
          : 'text-ink-soft border-hairline-soft hover:border-hairline'
      }`}
    >
      {children}
    </button>
  )
}

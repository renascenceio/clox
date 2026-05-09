/**
 * Shared editorial shell for /privacy, /terms, /cookies.
 *
 *   - Top bar: Clox logomark + back link
 *   - Header band: numeral + eyebrow + serif italic title + lead
 *   - Sticky TOC + section column with hairline dividers
 *   - Slim mono footer with cross-links + cookie-settings link
 */

import Link from 'next/link'
import CookieSettingsLink from '@/components/cookie-consent/CookieSettingsLink'

export interface LegalSection {
  id: string
  title: string
  body: React.ReactNode
}

export default function LegalShell({
  numeral,
  eyebrow,
  title,
  lead,
  effective,
  sections,
}: {
  numeral: string
  eyebrow: string
  title: React.ReactNode
  lead: React.ReactNode
  effective: string
  sections: LegalSection[]
}) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* ---- top bar ---- */}
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-5 md:px-10">
          <Link href="/" className="font-serif italic text-[20px] text-ink hover:text-accent">
            Clox
          </Link>
          <Link
            href="/"
            className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted hover:text-ink"
          >
            ← back
          </Link>
        </div>
      </header>

      {/* ---- title band ---- */}
      <section className="border-b border-hairline-soft">
        <div className="mx-auto grid max-w-[1080px] grid-cols-[44px_1fr] gap-x-8 px-6 py-12 md:grid-cols-[80px_1fr] md:px-10 md:py-16">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted pt-2 md:pt-3">
            {numeral}
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
              {eyebrow}
            </div>
            <h1 className="mt-3 font-serif italic text-[44px] leading-[1.05] text-ink md:text-[60px]">
              {title}
            </h1>
            <p className="mt-5 max-w-[58ch] font-sans text-[16px] leading-[1.55] text-ink-soft md:text-[17px]">
              {lead}
            </p>
            <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">
              effective · {effective}
            </p>
          </div>
        </div>
      </section>

      {/* ---- body ---- */}
      <main className="mx-auto grid max-w-[1080px] grid-cols-1 gap-12 px-6 py-12 md:grid-cols-[260px_1fr] md:gap-16 md:px-10 md:py-20">
        <aside className="md:sticky md:top-12 md:self-start">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-muted">
            on this page
          </div>
          <nav className="mt-3 flex flex-col gap-2.5 border-l border-hairline-soft pl-4">
            {sections.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="group flex items-baseline gap-3 font-sans text-[13px] leading-[1.4] text-ink-soft hover:text-ink"
              >
                <span className="font-mono text-[10px] tracking-[0.06em] text-ink-muted group-hover:text-accent">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{s.title}</span>
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          {sections.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              className={`scroll-mt-24 ${i > 0 ? 'mt-12 pt-12 border-t border-hairline-soft' : ''}`}
            >
              <div className="mb-3 flex items-baseline gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 className="font-serif italic text-[24px] leading-tight text-ink md:text-[28px]">
                  {s.title}
                </h2>
              </div>
              <div className="legal-prose max-w-[68ch] font-sans text-[15px] leading-[1.7] text-ink">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* ---- footer cross-links ---- */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4 px-6 py-7 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted md:px-10">
          <span>© {new Date().getFullYear()} Clox</span>
          <nav className="flex flex-wrap gap-6">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/cookies" className="hover:text-ink">Cookies</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <CookieSettingsLink className="uppercase tracking-[0.12em] hover:text-ink">
              Cookie settings
            </CookieSettingsLink>
          </nav>
        </div>
      </footer>
    </div>
  )
}

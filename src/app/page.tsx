'use client'

/*
 * Clox — landing page.
 *
 * Editorial Pearl × Onyx surface, 1:1 to the reference HTML at
 * `user_read_only_context/text_attachments/Clox-Landing-POO0M.html`.
 *
 * Sections, top-down:
 *   i.   Hero with a live typewriter composer that cycles through real prompts
 *  ii.   Six-mode showcase — pick chat / research / image / code / voice / video and
 *        the stage panel re-renders
 * iii.   Trio of value props (Authored / Calm / Yours)
 *  iv.   Three command surfaces (`/`, `⌘K`, `⌘.`) with mock palette previews
 *   v.   Pricing tiers (Reader / Pro feature / Studio)
 *  vi.   Closing — full-bleed onyx panel + footer
 *
 * Everything below the nav is hairline-driven; no shadows, no gradients.
 */

import Link from 'next/link'
import { useEffect, useState, useRef, useCallback } from 'react'
import CookieSettingsLink from '@/components/cookie-consent/CookieSettingsLink'

// ---------------------------------------------------------------------------
// Hero — typewriter composer
// ---------------------------------------------------------------------------

type HeroFrame = {
  mode: string
  model: string
  prompt: string
  response: string
}

const HERO_FRAMES: HeroFrame[] = [
  {
    mode: 'research',
    model: 'sonnet 4.5',
    prompt: 'What are the trade-offs between progressive enhancement and SPA hydration in 2026?',
    response:
      'A short answer with a long footnote: hydration costs are now mostly amortized by streaming, but the cognitive cost of two execution models is what teams actually pay…',
  },
  {
    mode: 'chat',
    model: 'opus 4',
    prompt: 'Tighten the apology. Quantify the credit per customer in dollars.',
    response:
      'We are sorry. For 11 minutes this morning a stricter quota we pushed touched ~9% of you. Each affected account is being credited $42, prorated to the actual outage…',
  },
  {
    mode: 'image',
    model: 'sonnet 4.5',
    prompt: 'Six covers for a quarterly journal — woodcut feel, single accent color, ink on bone paper.',
    response:
      'Generating four directions in parallel — woodcut etched, ink-bleed, lino-cut soft, and engraved-script. Pick one to push further or drop a reference…',
  },
  {
    mode: 'code',
    model: 'haiku 4.5',
    prompt: 'Refactor this auth middleware to use the new session adapter — keep the API stable.',
    response:
      'Reading auth.ts, sessions.ts. The adapter expects an async iterator; the current code returns an array. Proposed diff swaps the call site and keeps signatures intact…',
  },
  {
    mode: 'voice',
    model: 'sonnet 4.5',
    prompt: 'Read me the first three paragraphs of the postmortem at a calm pace.',
    response:
      'Reading. (♪ a soft inflection, slowing on the apology, the credit figure spoken in full words rather than digits…)',
  },
  {
    mode: 'video',
    model: 'sora · 1080p',
    prompt: 'Storyboard a 30-second cold open: courier walks up to the porch, hand-off, cut to second-floor window.',
    response:
      'Sketching six shots — wide ext., medium int., cu on hands, tracking pan, cu on face, wide at sunset. Holding the pan on the upstairs window before the cut…',
  },
]

function HeroComposer() {
  const [frameIdx, setFrameIdx] = useState(0)
  const [typed, setTyped] = useState('')
  const [streamed, setStreamed] = useState('')
  const [streaming, setStreaming] = useState(false)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    const frame = HERO_FRAMES[frameIdx]
    let timer: ReturnType<typeof setTimeout> | null = null
    const sleep = (ms: number) =>
      new Promise<void>((r) => {
        timer = setTimeout(r, ms)
      })

    async function run() {
      setTyped('')
      setStreamed('')
      setStreaming(false)

      // type the prompt
      for (let c = 0; c < frame.prompt.length; c++) {
        if (cancelledRef.current) return
        setTyped(frame.prompt.slice(0, c + 1))
        await sleep(18 + Math.random() * 22)
      }
      if (cancelledRef.current) return
      await sleep(420)

      // stream the response
      setStreaming(true)
      for (let c = 0; c < frame.response.length; c++) {
        if (cancelledRef.current) return
        setStreamed(frame.response.slice(0, c + 1))
        await sleep(10 + Math.random() * 20)
      }
      if (cancelledRef.current) return
      await sleep(2400)
      setFrameIdx((i) => (i + 1) % HERO_FRAMES.length)
    }
    run()

    return () => {
      cancelledRef.current = true
      if (timer) clearTimeout(timer)
    }
  }, [frameIdx])

  const frame = HERO_FRAMES[frameIdx]

  return (
    <div className="relative pl-0 lg:border-l lg:border-hairline lg:pl-8">
      {/* decorative numerals */}
      <span
        aria-hidden
        className="absolute -top-2 left-0 select-none font-serif text-[13px] italic tracking-widest text-ink-muted/60 lg:left-8"
      >
        i.
      </span>
      <span
        aria-hidden
        className="absolute -bottom-2 right-0 select-none font-serif text-[13px] italic tracking-widest text-ink-muted/60"
      >
        — a piece of writing software
      </span>

      {/* composer card */}
      <div className="relative overflow-hidden rounded-composer border border-hairline bg-surface">
        <div className="flex gap-2 px-4 pt-3 font-mono text-[11px]">
          <Chip k="mode" v={frame.mode} pulse />
          <Chip k="model" v={frame.model} />
          <Chip k="tools" v="3" />
        </div>
        <div className="min-h-[110px] px-4 pb-14 pt-4 font-serif text-[18px] italic leading-[1.5] tracking-[-0.005em]">
          {typed}
          <span className="editorial-caret" />
        </div>
        <div className="absolute inset-x-3 bottom-2.5 flex items-center gap-1.5">
          <IconBtn label="slash">
            <span className="font-mono text-[11px] text-ink-soft">/</span>
          </IconBtn>
          <IconBtn label="attach">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M8.5 4.5 4.5 8.5a2 2 0 0 0 2.83 2.83l4.59-4.59a3.5 3.5 0 1 0-4.95-4.95L2.4 6.36a5 5 0 0 0 7.07 7.07"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
            </svg>
          </IconBtn>
          <IconBtn label="voice">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="5" y="1.5" width="3" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
              <path d="M3 6.5a3.5 3.5 0 0 0 7 0M6.5 10v1.5M5 11.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </IconBtn>
          <button
            type="button"
            className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-sharp bg-ink px-3 font-mono text-[10.5px] uppercase tracking-[0.08em] text-surface"
          >
            ↑ send
          </button>
        </div>
      </div>

      {/* response stream */}
      {streaming && (
        <div className="mt-6 min-h-[72px] border-l-2 border-ink pl-4 font-serif text-[18px] italic leading-[1.5] text-ink">
          <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.16em] not-italic text-ink-muted">
            <span className="text-accent">claude</span> · {frame.model} · 14:32
          </div>
          {streamed}
        </div>
      )}
    </div>
  )
}

function Chip({ k, v, pulse = false }: { k: string; v: string; pulse?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sharp border px-2.5 py-1 ${
        pulse ? 'border-hairline bg-surface-alt/60' : 'border-hairline-soft'
      }`}
    >
      <span className="text-ink-muted">{k}</span>
      <span className="text-ink">{v}</span>
    </span>
  )
}

function IconBtn({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-sharp border border-hairline-soft text-ink-soft transition-colors hover:border-ink hover:text-ink"
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Modes section — interactive stage
// ---------------------------------------------------------------------------

type ModeKey = 'chat' | 'research' | 'image' | 'code' | 'voice' | 'video'
const MODES: { key: ModeKey; idx: string; name: string }[] = [
  { key: 'chat', idx: '01', name: 'Chat' },
  { key: 'research', idx: '02', name: 'Research' },
  { key: 'image', idx: '03', name: 'Image' },
  { key: 'code', idx: '04', name: 'Code' },
  { key: 'voice', idx: '05', name: 'Voice' },
  { key: 'video', idx: '06', name: 'Video' },
]

function ModesShowcase() {
  const [active, setActive] = useState<ModeKey>('chat')

  return (
    <div className="grid gap-12 border-t border-hairline pt-8 lg:grid-cols-[320px_1fr] lg:gap-14">
      <div role="tablist" className="flex flex-col">
        {MODES.map((m) => {
          const isActive = m.key === active
          return (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(m.key)}
              className={`relative grid grid-cols-[28px_1fr_auto] items-baseline gap-3 border-b border-hairline-soft py-4 text-left transition-all ${
                isActive ? 'bg-surface px-4' : ''
              }`}
            >
              {isActive && (
                <span aria-hidden className="absolute bottom-4 left-0 top-4 w-0.5 bg-ink" />
              )}
              <span className="pt-1 font-mono text-[10px] tracking-[0.1em] text-ink-muted">{m.idx}</span>
              <span className="font-serif text-[22px] italic tracking-[-0.01em]">{m.name}</span>
              <span
                aria-hidden
                className={`font-mono transition-all ${
                  isActive ? 'translate-x-1 text-ink' : 'text-ink-muted'
                }`}
              >
                →
              </span>
            </button>
          )
        })}
      </div>

      <div className="relative min-h-[480px] overflow-hidden rounded-composer border border-hairline bg-surface p-8">
        {active === 'chat' && <ChatStage />}
        {active === 'research' && <ResearchStage />}
        {active === 'image' && <ImageStage />}
        {active === 'code' && <CodeStage />}
        {active === 'voice' && <VoiceStage />}
        {active === 'video' && <VideoStage />}
      </div>
    </div>
  )
}

function StageHead({ title, pill }: { title: string; pill: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
      <h3 className="m-0 font-serif text-[30px] font-normal italic tracking-[-0.01em]">{title}</h3>
      <span className="inline-flex w-fit items-center gap-2 rounded-sharp border border-hairline bg-rail-soft px-2.5 py-1 font-mono text-[10.5px] tracking-[0.06em] text-ink-soft">
        {pill}
      </span>
    </div>
  )
}

function ChatStage() {
  return (
    <div>
      <StageHead title="Chat — for thinking out loud." pill={<><span className="text-ink-muted">model</span> sonnet 4.5</>} />
      <div className="grid gap-4 text-[14.5px] leading-[1.6]">
        <ChatRow you who="elena · 14:32">
          We had an API rate-limit incident this morning — 11 minutes of degraded service for ~9% of customers. Draft something honest, not defensive.
        </ChatRow>
        <ChatRow who={<><span className="text-accent">claude</span> · sonnet 4.5 · 14:32</>}>
          Two questions before I draft. Self-inflicted, or upstream? Credits, or notification only?
        </ChatRow>
        <ChatRow you who="elena · 14:34">
          Self-inflicted — a config push tightened a quota by accident. Yes to credits, prorated.
        </ChatRow>
      </div>
    </div>
  )
}

function ChatRow({
  children,
  who,
  you = false,
}: {
  children: React.ReactNode
  who: React.ReactNode
  you?: boolean
}) {
  if (you) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%]">
          <div className="mb-1 text-right font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-muted">{who}</div>
          <div className="rounded-card bg-ink px-3.5 py-2.5 text-[14px] text-surface">{children}</div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex">
      <div className="max-w-[86%]">
        <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-muted">{who}</div>
        <div className="border-l-2 border-ink py-1 pl-3.5 font-serif text-[16px] italic leading-[1.5]">{children}</div>
      </div>
    </div>
  )
}

function ResearchStage() {
  const cites = [
    ['1', 'Streaming SSR & the cost of hydration in 2026', 'vercel.com · Jan'],
    ['2', 'Why islands won — a postmortem on full-page hydration', 'astro.build · Mar'],
    ['3', 'React Server Components: a year in production', 'github.com/remixrun'],
    ['4', 'Resumability vs hydration: numbers from real apps', 'qwik.dev'],
    ['5', 'The two-execution-model tax', 'ladybird.org · blog'],
  ] as const
  return (
    <div>
      <StageHead
        title="Research — with citations you can defend."
        pill={<><span className="text-ink-muted">model</span> opus 4 · 7 sources</>}
      />
      <p className="m-0 mb-2 text-[14.5px] text-ink-soft">
        Synthesis of seven sources on hydration costs in 2026. Each claim is anchored to a citation; click any to expand.
      </p>
      <div>
        {cites.map(([n, src, meta], i) => (
          <div
            key={n}
            className={`grid grid-cols-[28px_1fr_auto] gap-3 py-3 text-[13px] ${
              i === 0 ? '' : 'border-t border-hairline-soft'
            }`}
          >
            <span className="pt-1 font-mono text-[10px] tracking-[0.08em] text-ink-muted">[{n}]</span>
            <span className="font-serif text-[16px] italic">{src}</span>
            <span className="font-mono text-[10.5px] text-ink-muted">{meta}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ImageStage() {
  // Four directions, each rendered as a small woodcut-feel placeholder generated
  // inline so the marketing surface stays asset-free.
  const cells: Array<{ label: string; fg: string; bg: string }> = [
    { label: 'Etched', fg: '#1A1814', bg: '#F1EFE9' },
    { label: 'Ink-bleed', fg: '#2C2A24', bg: '#D5C99B' },
    { label: 'Lino', fg: '#A8472A', bg: '#FAF9F4' },
    { label: 'Engraved', fg: '#222321', bg: '#E4E2DB' },
  ]
  return (
    <div>
      <StageHead
        title="Image — composed, not conjured."
        pill={<><span className="text-ink-muted">prompt</span> woodcut journal covers</>}
      />
      <div className="grid grid-cols-4 gap-2.5">
        {cells.map((c) => (
          <div
            key={c.label}
            className="relative aspect-square overflow-hidden rounded-sharp border border-hairline-soft"
            style={{ background: c.bg }}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="block h-full w-full">
              <g fill="none" stroke={c.fg} strokeWidth="0.6">
                {Array.from({ length: 14 }).map((_, i) => (
                  <path
                    key={i}
                    d={`M${5 + i * 7} 10 Q${10 + i * 7} ${50 + Math.sin(i) * 20} ${5 + i * 7} 90`}
                  />
                ))}
              </g>
              <circle cx="50" cy="48" r="22" fill="none" stroke={c.fg} strokeWidth="0.8" />
              <circle cx="50" cy="48" r="6" fill={c.fg} />
            </svg>
            <span className="absolute bottom-1.5 left-2 rounded-sharp bg-ink/70 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.08em] text-surface">
              {c.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-6">
        {cells.map((c) => (
          <div
            key={c.label + '-row'}
            className="flex items-center justify-between border-t border-hairline-soft py-2 font-mono text-[10.5px] text-ink-soft"
          >
            <span>{c.label.toLowerCase()}</span>
            <span className="text-ink-muted">push →</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CodeStage() {
  return (
    <div>
      <StageHead
        title="Code — agents that read your repo."
        pill={<><span className="text-ink-muted">model</span> haiku 4.5 · 2 files</>}
      />
      <pre className="m-0 overflow-auto rounded-card border border-[#14130E] bg-[#14130E] px-4 py-4 font-mono text-[12px] leading-[1.7] text-[#ECE5D3]">
{`// auth.ts — proposed diff
- export function getSession(req: Request): Session[] {
-   const arr = adapter.list(req)
-   return arr
- }
+ export async function getSession(req: Request): Promise<Session[]> {
+   const out: Session[] = []
+   for await (const s of adapter.iter(req)) out.push(s)
+   return out
+ }

// sessions.ts — call sites unchanged
const sessions = await getSession(req)
log("sessions.found", sessions.length)`}
      </pre>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <CodeMetric label="files touched" value="2" />
        <CodeMetric label="signatures kept" value="all" />
        <CodeMetric label="tests passing" value="14 / 14" />
      </div>
    </div>
  )
}

function CodeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-hairline-soft pt-3">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-muted">{label}</div>
      <div className="font-serif text-[22px] italic">{value}</div>
    </div>
  )
}

function VoiceStage() {
  // 32 bars, slightly randomised delays/durations to feel alive.
  const bars = Array.from({ length: 32 }, (_, i) => ({
    delay: -(i * 0.04 + (i % 3) * 0.02),
    duration: 1 + (i % 5) * 0.1,
  }))
  return (
    <div>
      <StageHead
        title="Voice — read aloud, in your tone."
        pill={<><span className="text-ink-muted">model</span> sonnet 4.5 · live</>}
      />
      <div className="mb-6 flex h-16 items-center gap-1">
        {bars.map((b, i) => (
          <span
            key={i}
            aria-hidden
            className="block w-[3px] rounded-[1px] bg-ink"
            style={{
              animation: `landingWave ${b.duration}s ease-in-out infinite`,
              animationDelay: `${b.delay}s`,
              height: '12%',
            }}
          />
        ))}
      </div>
      <div className="border-l-2 border-ink pl-4 font-serif text-[18px] italic leading-[1.5]">
        <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.16em] not-italic text-ink-muted">
          <span className="text-accent">narrating</span> · postmortem.md · paragraphs 1–3
        </div>
        At 11:48 this morning a configuration change tightened an API rate-limit by an order of magnitude. For eleven minutes,
        roughly nine percent of authenticated traffic received a 429 response in place of the requested data…
      </div>
    </div>
  )
}

function VideoStage() {
  // Filmstrip: six 16:9 cells. The 4th is "rendering" — accent stroke
  // around it and a thin scrubbing line beneath. The aesthetic intentionally
  // mirrors a contact sheet, not a video player UI.
  const shots = [
    { num: '01', label: 'wide · ext.', dur: '0:00–0:04', state: 'done' as const },
    { num: '02', label: 'medium · int.', dur: '0:04–0:09', state: 'done' as const },
    { num: '03', label: 'cu · hands', dur: '0:09–0:12', state: 'done' as const },
    { num: '04', label: 'tracking · pan', dur: '0:12–0:18', state: 'live' as const },
    { num: '05', label: 'cu · face', dur: '0:18–0:22', state: 'queued' as const },
    { num: '06', label: 'wide · sunset', dur: '0:22–0:30', state: 'queued' as const },
  ]

  return (
    <div>
      <StageHead
        title="Video — sequence first, frames after."
        pill={<><span className="text-ink-muted">model</span> sora · 30 sec · 1080p</>}
      />
      <div className="mb-6 grid grid-cols-3 gap-3 md:grid-cols-6">
        {shots.map((s) => {
          const live = s.state === 'live'
          const done = s.state === 'done'
          return (
            <div
              key={s.num}
              className={`relative flex aspect-[16/9] flex-col justify-end overflow-hidden border ${
                live ? 'border-accent' : 'border-hairline'
              } ${done ? 'bg-rail-soft' : 'bg-bg'}`}
            >
              <span
                aria-hidden
                className={`absolute left-1.5 top-1.5 font-mono text-[9px] tracking-[0.1em] ${
                  live ? 'text-accent' : 'text-ink-muted'
                }`}
              >
                {s.num}
              </span>
              {live && (
                <span
                  aria-hidden
                  className="absolute bottom-0 left-0 h-[2px] bg-accent"
                  style={{ animation: 'landingScrub 2.4s ease-in-out infinite', width: '40%' }}
                />
              )}
              <div className="flex flex-col gap-0.5 p-1.5 pr-2">
                <span className="font-serif text-[11.5px] italic leading-tight text-ink">{s.label}</span>
                <span className="font-mono text-[8.5px] tracking-[0.06em] text-ink-muted">{s.dur}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="border-l-2 border-ink pl-4 font-serif text-[18px] italic leading-[1.5]">
        <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.16em] not-italic text-ink-muted">
          <span className="text-accent">rendering</span> · shot 04 of 06 · tracking pan
        </div>
        Camera follows the courier from the iron gate to the porch. Late afternoon light, long shadows along the
        gravel. Hold on the second-floor window before the cut to the close-up&hellip;
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-hairline-soft pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
        <span>storyboard · 6 shots · 30s total</span>
        <span><span className="text-accent">●</span> 04 rendering · 16% complete</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  // ⌘K placeholder — opens the workspace search experience once it's wired up.
  // For now the keystroke jumps straight to the chat surface.
  const onCmdK = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      window.location.href = '/text'
    }
  }, [])
  useEffect(() => {
    window.addEventListener('keydown', onCmdK)
    return () => window.removeEventListener('keydown', onCmdK)
  }, [onCmdK])

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* ============== NAV ============== */}
      <header className="sticky top-0 z-30 border-b border-hairline-soft bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center gap-8 px-6 py-4 md:px-8">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="font-serif text-[22px] italic tracking-[-0.01em]">Clox</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">v0.4</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-6 text-[13.5px] text-ink-soft md:flex">
            <a href="#modes" className="hover:text-ink">Modes</a>
            <a href="#surfaces" className="hover:text-ink">Commands</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <Link href="/skills" className="hover:text-ink">Skills</Link>
            <Link href="/admin" className="hover:text-ink">Admin</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2.5 md:ml-0">
            <Link
              href="/login"
              className="hidden items-center rounded-sharp border border-transparent px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft hover:text-ink sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/text"
              className="inline-flex items-center gap-2 rounded-sharp border border-ink bg-ink px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-surface hover:bg-black"
            >
              Open app →
            </Link>
          </div>
        </div>
      </header>

      {/* ============== HERO ============== */}
      <section className="relative mx-auto max-w-[1240px] px-6 pb-24 pt-16 md:px-8 md:pt-20">
        <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="eyebrow">Anthology · 0.4 · for considered work</p>
            <h1 className="mt-4 font-serif text-[clamp(48px,6.6vw,86px)] font-normal leading-[1.02] tracking-[-0.025em]">
              A quieter way<br />
              to think with <em className="italic text-accent">AI.</em>
            </h1>
            <p className="mt-5 max-w-[480px] text-[18px] leading-[1.55] text-ink-soft text-pretty">
              Clox is a chat workspace built around the way you actually write — mode first, model second, tools when you
              need them. No fluorescent dashboard. No emoji in the toolbar. Just paper, ink, and a cursor.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <Link
                href="/text"
                className="inline-flex items-center gap-2 rounded-sharp border border-ink bg-ink px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-surface hover:bg-black"
              >
                Try the workspace
              </Link>
              <a
                href="#modes"
                className="inline-flex items-center gap-2 rounded-sharp border border-hairline px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.08em] hover:border-ink"
              >
                See it think →
              </a>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-4 font-mono text-[11px] text-ink-muted">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-[#2F8F5F]"
                  style={{ boxShadow: '0 0 0 4px rgba(47,143,95,0.12)' }}
                />
                2,431 minds writing now
              </span>
              <span aria-hidden>·</span>
              <span>SOC 2 · GDPR</span>
              <span aria-hidden>·</span>
              <span>v0.4 · march</span>
            </div>
          </div>
          <HeroComposer />
        </div>
      </section>

      {/* ============== PROOF ============== */}
      <div className="overflow-hidden border-y border-hairline-soft bg-rail-soft py-5">
        <div className="mx-auto flex max-w-[1240px] items-center gap-9 overflow-hidden whitespace-nowrap px-6 font-mono text-[11px] tracking-[0.06em] text-ink-muted md:px-8">
          <span>used at</span>
          <Dot />
          {['Aperture', 'Marginalia & Co.', 'Northbound', 'Faraday Press', 'Stoa Studio', 'Quartermaster'].map((n, i) => (
            <span key={n} className="flex items-center gap-9">
              <span className="font-serif text-[18px] italic tracking-normal text-ink">{n}</span>
              {i < 5 && <Dot />}
            </span>
          ))}
        </div>
      </div>

      {/* ============== MODES ============== */}
      <section id="modes" className="mx-auto max-w-[1240px] px-6 py-24 md:px-8">
        <SectionHead numeral="ii." eyebrow="Five modes · one composer">
          <h2 className="font-serif text-[clamp(36px,4.2vw,56px)] font-normal leading-[1.05] tracking-[-0.02em]">
            Pick the <em className="italic text-accent">shape</em> of the answer<br />
            before you ask the question.
          </h2>
          <p className="mt-3 max-w-[540px] text-[16px] text-ink-soft">
              Mode comes first in Clox — chat, research, image, code, voice, video — because it changes what &lsquo;good&rsquo; looks like more than the model does. Click through to watch the workspace re-orient itself.
          </p>
        </SectionHead>
        <ModesShowcase />
      </section>

      {/* ============== TRIO ============== */}
      <section className="mx-auto max-w-[1240px] px-6 md:px-8">
        <div className="grid border-y border-hairline md:grid-cols-3">
          <Trio glyph="a" title="Authored, not auto-completed.">
            Outputs that read like they came from someone with taste. Citations you can defend. A cursor that knows when to wait.
          </Trio>
          <Trio glyph="b" title="Calm by default.">
            No fluorescent panels, no pop-up congratulations. Settings open only when you press <span className="font-mono">⌘.</span> — and close again when you stop looking.
          </Trio>
          <Trio glyph="c" title="Yours, on the record." last>
            Every prompt, response, and edit lives in your archive — searchable, exportable, citable. Walk away and your work walks with you.
          </Trio>
        </div>
      </section>

      {/* ============== COMMAND SURFACES ============== */}
      <section id="surfaces" className="mx-auto max-w-[1240px] px-6 py-24 md:px-8">
        <SectionHead numeral="iii." eyebrow="Three keys · zero menus">
          <h2 className="font-serif text-[clamp(36px,4.2vw,56px)] font-normal leading-[1.05] tracking-[-0.02em]">
            The whole product<br />
            lives <em className="italic text-accent">under three keys.</em>
          </h2>
          <p className="mt-3 max-w-[540px] text-[16px] text-ink-soft">
            Slash for the model. <span className="font-mono">⌘K</span> for the workspace. <span className="font-mono">⌘.</span> for the configuration. Hover any card to see it open.
          </p>
        </SectionHead>

        <div className="grid gap-6 md:grid-cols-3">
          <Surface
            keyLabel="/"
            keyHint="in the composer"
            title="Choose mode & model in one pass."
            body="Type a slash and a paged palette opens with mode first, model second, tools third. Arrow, enter, done."
            rows={[
              { kind: 'header', label: 'mode' },
              { kind: 'row', label: 'research', hint: 'web + citations', active: true },
              { kind: 'row', label: 'code', hint: 'agent + tools' },
              { kind: 'header', label: 'model' },
              { kind: 'row', label: 'sonnet 4.5', hint: 'balanced' },
            ]}
          />
          <Surface
            keyLabel="⌘ K"
            keyHint="anywhere"
            title="Jump anywhere in the workspace."
            body="Home, projects, a chat from last Tuesday, an image from a year ago. Search the whole archive in one prompt."
            rows={[
              { kind: 'header', label: 'jump to' },
              { kind: 'row', label: 'Projects', hint: 'g p' },
              { kind: 'row', label: 'Chats — incident postmortem', hint: '14:32', active: true },
              { kind: 'row', label: 'Gallery', hint: 'g g' },
              { kind: 'row', label: 'Settings', hint: '⌘,' },
            ]}
          />
          <Surface
            keyLabel="⌘ ."
            keyHint="in any chat"
            title="Configure without losing your place."
            body="System prompt, parameters, tools, knowledge. A drawer slides in from the right and disappears the second you stop using it."
            rows={[
              { kind: 'header', label: 'parameters' },
              { kind: 'row', label: 'temperature', hint: '0.6' },
              { kind: 'row', label: 'top-p', hint: '0.95' },
              { kind: 'row', label: 'max tokens', hint: '2,048' },
              { kind: 'row', label: 'seed', hint: '—' },
            ]}
          />
        </div>
      </section>

      {/* ============== PRICING ============== */}
      <section id="pricing" className="mx-auto max-w-[1240px] px-6 py-24 md:px-8">
        <SectionHead numeral="iv." eyebrow="Pricing">
          <h2 className="font-serif text-[clamp(36px,4.2vw,56px)] font-normal leading-[1.05] tracking-[-0.02em]">
            Pay for taste,<br />
            not for <em className="italic text-accent">tokens.</em>
          </h2>
          <p className="mt-3 max-w-[540px] text-[16px] text-ink-soft">
            Flat-rate plans with no rate-limit surprises. The Pro plan covers what most people actually need; the Studio plan is for teams that ship.
          </p>
        </SectionHead>

        <div className="grid border-t border-hairline md:grid-cols-3">
          <Tier
            name="Reader"
            price="0"
            unit="free · forever"
            blurb="For trying out the editorial way of thinking with an AI."
            features={['Sonnet 4.5 · 50 chats / month', 'Chat & Research modes', 'One workspace', 'Public archive']}
            cta="Start reading"
            ctaHref="/login"
          />
          <Tier
            feature
            badge="most chosen"
            name="Pro"
            price="18"
            unit="/ mo · billed annually"
            blurb="For writers, researchers, and people who actually finish things."
            features={[
              'All six modes · all current models',
              'Unlimited chats & private projects',
              'Voice in & out',
              'Knowledge — 50 docs',
              'Searchable archive · exports',
            ]}
            cta="Become pro →"
            ctaHref="/text"
          />
          <Tier
            last
            name="Studio"
            price="52"
            unit="/ seat · billed annually"
            blurb="For small teams that share voice, sources, and standards."
            features={[
              'Everything in Pro',
              'Shared knowledge & presets',
              'Roles, audit log, SSO',
              'Priority capacity',
              'Concierge onboarding',
            ]}
            cta="Talk to us"
            ctaHref="mailto:hello@clox.studio"
          />
        </div>
      </section>

      {/* ============== CLOSING ============== */}
      <section id="signin" className="bg-ink text-surface">
        <div className="mx-auto grid max-w-[1240px] items-end gap-16 px-6 py-24 md:px-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-surface/55">v.</p>
            <h2 className="mt-3 font-serif text-[clamp(48px,6vw,80px)] font-normal leading-[1.02] tracking-[-0.025em]">
              Open the door.<br />
              Sit down. <em className="italic" style={{ color: '#D27452' }}>Begin.</em>
            </h2>
          </div>
          <div>
            <p className="mb-3 max-w-[380px] text-[17px] text-surface/65">
              The first chat is on us. You&rsquo;ll know within five minutes whether Clox is the workspace you&rsquo;ve been
              asking software for, or just another reasonable opinion about chat.
            </p>
            <Link
              href="/text"
              className="inline-flex items-center gap-2 rounded-sharp border border-surface bg-surface px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-ink hover:bg-white"
            >
              Open the workspace
            </Link>
            <div className="mt-5 font-mono text-[11px] tracking-[0.06em] text-surface/55">
              no card · no onboarding · no carousel
            </div>
          </div>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="border-t border-surface/10 bg-ink text-surface/65">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-6 py-9 font-mono text-[11px] tracking-[0.04em] md:px-8">
          <div>© 2026 Clox · made on the long form</div>
          <div className="flex flex-wrap gap-6">
            <a href="#" className="hover:text-surface">Manifesto</a>
            <a href="#" className="hover:text-surface">Changelog</a>
            <a href="#" className="hover:text-surface">Status</a>
            <Link href="/privacy" className="hover:text-surface">Privacy</Link>
            <Link href="/cookies" className="hover:text-surface">Cookies</Link>
            <Link href="/terms" className="hover:text-surface">Terms</Link>
            <CookieSettingsLink className="tracking-[0.04em] hover:text-surface">
              Cookie settings
            </CookieSettingsLink>
            <Link href="/skills" className="hover:text-surface">Design system</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section head — shared 220px-numeral × content layout
// ---------------------------------------------------------------------------

function SectionHead({
  numeral,
  eyebrow,
  children,
}: {
  numeral: string
  eyebrow: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-12 grid items-end gap-12 lg:grid-cols-[220px_1fr]">
      <div className="font-serif text-[56px] italic leading-none text-ink-muted">{numeral}</div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <div className="mt-3 max-w-[760px]">{children}</div>
      </div>
    </div>
  )
}

function Dot() {
  return <span aria-hidden className="h-1 w-1 flex-shrink-0 rounded-full bg-ink-muted" />
}

// ---------------------------------------------------------------------------
// Trio
// ---------------------------------------------------------------------------

function Trio({
  glyph,
  title,
  children,
  last = false,
}: {
  glyph: string
  title: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div className={`p-8 ${last ? '' : 'border-b border-hairline-soft md:border-b-0 md:border-r'}`}>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink font-serif text-[18px] italic">
        {glyph}
      </span>
      <h3 className="mb-3 mt-3 font-serif text-[26px] font-normal italic leading-[1.15] tracking-[-0.01em]">{title}</h3>
      <p className="max-w-[320px] text-[14.5px] text-ink-soft">{children}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Surface card
// ---------------------------------------------------------------------------

type SurfaceRow =
  | { kind: 'header'; label: string }
  | { kind: 'row'; label: string; hint: string; active?: boolean }

function Surface({
  keyLabel,
  keyHint,
  title,
  body,
  rows,
}: {
  keyLabel: string
  keyHint: string
  title: string
  body: string
  rows: SurfaceRow[]
}) {
  return (
    <div className="relative flex min-h-[320px] flex-col gap-4 overflow-hidden rounded-composer border border-hairline bg-surface p-6">
      <div className="inline-flex w-fit items-center gap-1.5 rounded-sharp border border-hairline bg-rail-soft px-2.5 py-1 font-mono text-[11px]">
        <span>{keyLabel}</span>
        <span className="text-ink-muted">{keyHint}</span>
      </div>
      <h4 className="m-0 font-serif text-[22px] font-normal italic leading-[1.15] tracking-[-0.01em]">{title}</h4>
      <p className="m-0 text-[13.5px] text-ink-soft">{body}</p>

      <div className="mt-auto overflow-hidden rounded-card border border-hairline-soft bg-bg font-mono text-[10.5px]">
        {rows.map((r, i) => {
          const last = i === rows.length - 1
          if (r.kind === 'header') {
            return (
              <div
                key={i}
                className={`flex items-center gap-2.5 bg-surface-alt/60 px-3 py-1.5 ${last ? '' : 'border-b border-hairline-soft'}`}
              >
                <span className="text-[9px] uppercase tracking-[0.16em] text-ink-muted">{r.label}</span>
              </div>
            )
          }
          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 px-3 py-1.5 ${
                r.active ? 'bg-surface-alt/60' : ''
              } ${last ? '' : 'border-b border-hairline-soft'}`}
            >
              <span className="flex-1 text-ink">{r.label}</span>
              <span className="text-ink-muted">{r.hint}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pricing tier
// ---------------------------------------------------------------------------

function Tier({
  name,
  price,
  unit,
  blurb,
  features,
  cta,
  ctaHref,
  feature = false,
  badge,
  last = false,
}: {
  name: string
  price: string
  unit: string
  blurb: string
  features: string[]
  cta: string
  ctaHref: string
  feature?: boolean
  badge?: string
  last?: boolean
}) {
  const isFeature = feature
  return (
    <div
      className={`relative flex flex-col gap-4 p-8 ${
        last ? '' : 'border-b border-hairline-soft md:border-b-0 md:border-r'
      } ${isFeature ? 'bg-ink text-surface' : ''}`}
    >
      {badge && (
        <span className="absolute right-5 top-4 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{badge}</span>
      )}
      <h3
        className={`m-0 font-serif text-[26px] font-normal italic leading-none tracking-[-0.01em] ${
          isFeature ? 'text-surface' : ''
        }`}
      >
        {name}
      </h3>
      <div className="mb-3 flex items-baseline gap-1.5">
        <span className={`font-serif text-[56px] leading-none tracking-[-0.03em] ${isFeature ? 'text-surface' : ''}`}>
          {price}
        </span>
        <span className={`font-mono text-[11px] ${isFeature ? 'text-surface/55' : 'text-ink-muted'}`}>{unit}</span>
      </div>
      <p className={`m-0 text-[14px] ${isFeature ? 'text-surface/70' : 'text-ink-soft'}`}>{blurb}</p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13.5px]">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span
              aria-hidden
              className={`mt-2.5 h-px w-3 flex-shrink-0 ${isFeature ? 'bg-surface/40' : 'bg-ink-soft'}`}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`mt-auto inline-flex w-fit items-center gap-2 rounded-sharp border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.08em] ${
          isFeature ? 'border-surface bg-surface text-ink hover:bg-white' : 'border-hairline hover:border-ink'
        }`}
      >
        {cta}
      </Link>
    </div>
  )
}

import { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Clox — One studio. Every model.",
  description:
    "An editorial workspace for text, image, video and audio across every major AI model. Calm by default. Configurable on demand.",
  openGraph: {
    images: ["https://picsum.photos/seed/clox-og/1200/630"],
  },
}

// ---------------------------------------------------------------------------
// Editorial landing page — Pearl theme, hairlines over fills, accent dot only.
// Pure server component. No client interactivity beyond <Link/>.
// ---------------------------------------------------------------------------

const MODES: Array<{
  href: string
  eyebrow: string
  title: string
  blurb: string
  count: string
}> = [
  {
    href: "/text",
    eyebrow: "01 — text",
    title: "Write, reason, decide.",
    blurb:
      "GPT-5, Claude Opus 4.6, Gemini 3 Flash, DeepSeek V4, Qwen 3.5 — the most capable language models, side by side.",
    count: "30+ models",
  },
  {
    href: "/image",
    eyebrow: "02 — image",
    title: "Compose, illustrate, iterate.",
    blurb:
      "Nano Banana, Imagen 4, DALL-E 4, Midjourney v7, Stable Diffusion XL — photoreal and editorial in one composer.",
    count: "20+ models",
  },
  {
    href: "/video",
    eyebrow: "03 — video",
    title: "Frame, cut, render.",
    blurb:
      "Sora, Runway Gen-4, Kling 2.0, Luma Dream Machine — cinematic motion with director-grade controls.",
    count: "15+ models",
  },
  {
    href: "/audio",
    eyebrow: "04 — audio",
    title: "Speak, score, sing.",
    blurb:
      "Gemini TTS, ElevenLabs, Suno v4, Udio — voice that breathes, music that arrives finished.",
    count: "15+ models",
  },
]

const PRINCIPLES: Array<{ label: string; title: string; body: string }> = [
  {
    label: "P / 01",
    title: "Editorial calm.",
    body: "A page first, an interface second. Pearl background, Onyx ink, hairline rules. No glow. No noise.",
  },
  {
    label: "P / 02",
    title: "Density that breathes.",
    body: "Productivity tools tend to shout. Clox uses a 4-point grid, generous line height, and a single accent so the work is what you see.",
  },
  {
    label: "P / 03",
    title: "Configuration on demand.",
    body: "The composer holds the next turn. ⌘K jumps. ⌘. opens the drawer. Controls appear when you reach for them, never before.",
  },
  {
    label: "P / 04",
    title: "Authorship unambiguous.",
    body: "Your turn is an ink block on the right. The model's turn is a serif mark, a Terracotta byline, and a card. You always know who is speaking.",
  },
  {
    label: "P / 05",
    title: "Every model in one place.",
    body: "Western and Chinese frontier models — OpenAI, Anthropic, Google, DeepSeek, Qwen, Kimi, GLM — under a single composer.",
  },
  {
    label: "P / 06",
    title: "Yours to organise.",
    body: "Threads, projects, folders. A search that actually finds things. Exports that travel anywhere your work needs to go.",
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-ink font-sans selection:bg-accent/25">
      {/* =====================================================================
          Top strip — minimal, editorial. Wordmark + nav + launch.
          ===================================================================== */}
      <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur border-b border-hairline-soft">
        <div className="max-w-6xl mx-auto px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span aria-hidden className="font-serif italic text-2xl text-accent leading-none">
              C
            </span>
            <span className="text-[13px] text-ink tracking-tight">Clox</span>
          </Link>
          <nav className="flex items-center gap-7 font-mono text-[11px] tracking-[0.04em] text-ink-soft">
            <Link href="#modes" className="hover:text-ink transition-colors">
              modes
            </Link>
            <Link href="#principles" className="hover:text-ink transition-colors">
              principles
            </Link>
            <Link
              href="/text"
              className="px-3 py-1.5 bg-ink text-bg uppercase hover:bg-ink-soft transition-colors"
            >
              launch studio
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ===================================================================
            Hero — serif italic statement, mono eyebrow, hairline accent bar.
            =================================================================== */}
        <section className="px-8 pt-28 pb-32 border-b border-hairline-soft">
          <div className="max-w-6xl mx-auto grid grid-cols-12 gap-8">
            <div className="col-span-12 md:col-span-2 flex md:flex-col gap-4 md:gap-2">
              <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase">
                vol. i
              </span>
              <span className="hidden md:block w-8 h-px bg-ink" />
              <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase">
                a studio
              </span>
            </div>

            <div className="col-span-12 md:col-span-10 space-y-10">
              <h1 className="font-serif italic text-ink text-pretty leading-[1.02] tracking-[-0.01em] text-[clamp(3rem,7vw,5.75rem)]">
                One studio. <br />
                Every model. <br />
                <span className="text-accent">Quietly assembled.</span>
              </h1>

              <p className="max-w-xl font-sans text-lg text-ink-soft leading-relaxed text-pretty">
                Clox is an editorial workspace for working with frontier AI. Write a
                turn, swap models mid-thread, generate an image, score a clip — without
                ever leaving the page. Calm by default. Configurable on demand.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
                <Link
                  href="/text"
                  className="inline-flex items-center gap-3 px-5 py-3 bg-ink text-bg font-mono text-[11px] tracking-[0.04em] uppercase hover:bg-ink-soft transition-colors"
                >
                  start writing
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  href="#modes"
                  className="inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft hover:text-ink transition-colors"
                >
                  see the four modes
                  <span aria-hidden>↓</span>
                </Link>
              </div>

              <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-6 font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-accent" />
                  no credit card
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-accent" />
                  free tier included
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-accent" />
                  cancel anytime
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ===================================================================
            Modes — four cards, hairline grid, mono eyebrow + serif title.
            =================================================================== */}
        <section
          id="modes"
          className="px-8 pt-24 pb-12 border-b border-hairline-soft"
        >
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-12 gap-8 mb-12">
              <div className="col-span-12 md:col-span-2">
                <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase">
                  the four modes
                </div>
              </div>
              <div className="col-span-12 md:col-span-10">
                <h2 className="font-serif italic text-ink text-pretty leading-[1.05] text-[clamp(2rem,4.5vw,3.5rem)]">
                  Four ways to make. <br />
                  <span className="text-ink-soft">One composer.</span>
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-hairline border border-hairline">
              {MODES.map(mode => (
                <Link
                  key={mode.href}
                  href={mode.href}
                  className="group relative bg-surface p-10 transition-colors hover:bg-surface-alt"
                >
                  <div className="flex items-start justify-between mb-6">
                    <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase">
                      {mode.eyebrow}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.04em] text-accent uppercase">
                      {mode.count}
                    </span>
                  </div>
                  <h3 className="font-serif italic text-ink text-3xl md:text-4xl leading-[1.05] tracking-[-0.01em] mb-4">
                    {mode.title}
                  </h3>
                  <p className="text-[15px] text-ink-soft leading-relaxed max-w-md mb-8">
                    {mode.blurb}
                  </p>
                  <span className="font-mono text-[11px] tracking-[0.04em] text-ink uppercase inline-flex items-center gap-2">
                    open
                    <span
                      aria-hidden
                      className="transition-transform group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ===================================================================
            Principles — six small cards in a 3-up grid. Mono eyebrow,
            hairline left rule.
            =================================================================== */}
        <section
          id="principles"
          className="px-8 pt-24 pb-24 border-b border-hairline-soft"
        >
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-12 gap-8 mb-16">
              <div className="col-span-12 md:col-span-2">
                <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase">
                  principles
                </div>
              </div>
              <div className="col-span-12 md:col-span-10">
                <h2 className="font-serif italic text-ink text-pretty leading-[1.05] text-[clamp(2rem,4.5vw,3.5rem)]">
                  How we decided. <br />
                  <span className="text-ink-soft">What we kept out.</span>
                </h2>
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-12">
              {PRINCIPLES.map(p => (
                <li key={p.label} className="border-l border-hairline pl-5">
                  <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase mb-3">
                    {p.label}
                  </div>
                  <h3 className="font-serif italic text-ink text-2xl leading-tight mb-2">
                    {p.title}
                  </h3>
                  <p className="text-[14px] text-ink-soft leading-relaxed">{p.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ===================================================================
            Closing CTA — a single editorial pull quote and a single button.
            =================================================================== */}
        <section className="px-8 py-32">
          <div className="max-w-4xl mx-auto text-center space-y-10">
            <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase">
              ready when you are
            </div>
            <p className="font-serif italic text-ink text-pretty leading-[1.05] text-[clamp(2.5rem,6vw,4.5rem)]">
              &ldquo;The best interface is the one that gets out of the way of the
              <span className="text-accent"> work</span>.&rdquo;
            </p>
            <div className="flex items-center justify-center">
              <Link
                href="/text"
                className="inline-flex items-center gap-3 px-6 py-3 bg-ink text-bg font-mono text-[11px] tracking-[0.04em] uppercase hover:bg-ink-soft transition-colors"
              >
                launch studio
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          Footer — wordmark + ©. No links, no clutter.
          ===================================================================== */}
      <footer className="px-8 py-10 border-t border-hairline-soft">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span aria-hidden className="font-serif italic text-2xl text-accent leading-none">
              C
            </span>
            <span className="text-[13px] text-ink tracking-tight">Clox</span>
          </Link>
          <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase">
            © {new Date().getFullYear()} clox — every model, one studio
          </div>
        </div>
      </footer>
    </div>
  )
}

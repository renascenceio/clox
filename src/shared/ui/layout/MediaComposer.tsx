'use client'

/*
 * Shared composer used by every chat surface that *isn't* the text page.
 * Mirrors the editorial composer in /text — paper card, hairline, type-tabs
 * along the top, chip cluster + ink "send" along the bottom.
 *
 * The text page has a slightly different chip cluster (model name comes from
 * a richer model object), so it inlines its own composer instead of using
 * this one.
 */

import { useRouter } from 'next/navigation'

type AIType = 'text' | 'image' | 'video' | 'audio'

interface MediaComposerProps {
  activeType: AIType
  prompt: string
  onPromptChange: (v: string) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isGenerating: boolean
  /** chip labels rendered between mode + send (e.g. "flux 1.1", "16:9", "5s") */
  meta?: string[]
  /** placeholder copy for the textarea */
  placeholder: string
}

export default function MediaComposer({
  activeType,
  prompt,
  onPromptChange,
  onSubmit,
  isGenerating,
  meta = [],
  placeholder,
}: MediaComposerProps) {
  const router = useRouter()

  const handleTabChange = (type: AIType) => {
    if (type !== activeType) router.push(`/${type}`)
  }

  return (
    <div className="absolute inset-x-0 bottom-0 p-6 pointer-events-none z-30">
      <div className="max-w-[820px] mx-auto pointer-events-auto">
        <div className="bg-surface border border-hairline rounded-composer overflow-hidden">

          {/* Type tabs */}
          <div className="flex border-b border-hairline-soft">
            {(['text', 'image', 'video', 'audio'] as AIType[]).map((type, i) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTabChange(type)}
                className={`flex-1 h-10 inline-flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors ${
                  activeType === type ? 'text-ink bg-bg' : 'text-ink-muted hover:text-ink'
                } ${i < 3 ? 'border-r border-hairline-soft' : ''}`}
              >
                <span
                  aria-hidden
                  className={`inline-block w-1.5 h-1.5 rounded-full ${activeType === type ? 'bg-accent' : 'bg-ink-muted'}`}
                />
                <span>{type}</span>
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={onSubmit}>
            <textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder={placeholder}
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  const formEvent = new Event('submit', { cancelable: true }) as unknown as React.FormEvent<HTMLFormElement>
                  onSubmit(formEvent)
                }
              }}
              className="w-full min-h-[88px] max-h-[240px] px-5 pt-4 pb-2 bg-transparent text-[15px] leading-[1.55] text-ink placeholder:text-ink-muted outline-none resize-none"
            />

            <div className="flex items-center gap-2 px-4 pb-3 pt-1 flex-wrap">
              <Chip>{activeType}</Chip>
              {meta.map((m, i) => (
                <Chip key={i}>{m}</Chip>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sharp font-mono text-[10px] tracking-[0.04em] uppercase text-ink-muted hover:text-ink transition-colors"
                title="Attach reference"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
                  <path d="M7.5 2.5l-4 4a1.5 1.5 0 002.12 2.12L9.6 4.6a3 3 0 00-4.24-4.24L1.4 4.36" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                </svg>
                attach
              </button>

              <span className="ml-auto font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                ↵ generate
              </span>
              <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className="inline-flex items-center gap-1.5 h-7 px-3 bg-ink text-bg font-mono text-[10px] tracking-[0.18em] uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-ink-soft transition-colors"
              >
                {isGenerating ? 'rendering' : 'generate'}
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden>
                  <path d="M1.5 4.5h6m0 0L5 2m2.5 2.5L5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center h-7 px-2.5 border border-hairline-soft rounded-sharp font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft">
      {children}
    </span>
  )
}

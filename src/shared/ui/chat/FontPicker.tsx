'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Type, X } from 'lucide-react'
import type { Palette } from './palettes'

type LibraryFont = { family: string; kind: string; note: string; scripts: string[]; available: number[] }
type Pairing = { label: string; display: string; body: string; note: string }
type Library = { fonts: LibraryFont[]; pairings: Pairing[] }

/** Scripts people write decks in, with a short sample to preview each font
 *  in. Keys match the catalogue's script names. */
const SCRIPTS: { key: string; label: string; head: string; body: string }[] = [
  { key: 'latin', label: 'Latin', head: 'Quarterly review', body: 'Sales grew 18% on strong demand in the second half.' },
  { key: 'cyrillic', label: 'Cyrillic', head: 'Квартальный обзор', body: 'Продажи выросли на 18% во втором полугодии.' },
  { key: 'arabic', label: 'Arabic', head: 'المراجعة الربعية', body: 'نمت المبيعات بنسبة ١٨٪ في النصف الثاني من العام.' },
  { key: 'greek', label: 'Greek', head: 'Τριμηνιαία ανασκόπηση', body: 'Οι πωλήσεις αυξήθηκαν 18% το δεύτερο εξάμηνο.' },
  { key: 'hebrew', label: 'Hebrew', head: 'סקירה רבעונית', body: 'המכירות צמחו ב-18% במחצית השנייה של השנה.' },
  { key: 'japanese', label: 'Japanese', head: '四半期レビュー', body: '下半期の売上は18%増加しました。' },
  { key: 'korean', label: 'Korean', head: '분기별 검토', body: '하반기 매출이 18% 성장했습니다.' },
  { key: 'chinese-simplified', label: 'Chinese', head: '季度回顾', body: '下半年销售额增长了18%。' },
  { key: 'devanagari', label: 'Hindi', head: 'तिमाही समीक्षा', body: 'दूसरी छमाही में बिक्री 18% बढ़ी।' },
  { key: 'thai', label: 'Thai', head: 'รายงานรายไตรมาส', body: 'ยอดขายเติบโต 18% ในครึ่งปีหลัง' },
]

const RTL = new Set(['arabic', 'hebrew'])
const KIND_ORDER = ['sans', 'display', 'serif', 'mono']
const KIND_LABEL: Record<string, string> = { sans: 'Sans', display: 'Display', serif: 'Serif', mono: 'Mono' }

let libraryPromise: Promise<Library> | null = null
const loadLibrary = () =>
  (libraryPromise ??= import('@/lib/font-library.json').then(m => (m.default ?? m) as Library))

/** Google Fonts stylesheets already on the page — `text=` keeps each one to
 *  the few letters the preview shows, so 20 previews stay light. */
const loaded = new Set<string>()
function useGoogleFont(font: LibraryFont | undefined, text: string) {
  useEffect(() => {
    if (!font) return
    const key = `${font.family}|${text}`
    if (loaded.has(key)) return
    loaded.add(key)
    const weights = [400, 700].filter(w => font.available.includes(w))
    const axis = weights.length ? `:wght@${weights.join(';')}` : ''
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family).replace(/%20/g, '+')}${axis}&display=swap&text=${encodeURIComponent(text)}`
    document.head.appendChild(link)
  }, [font, text])
}

const PICKER_CSS = `
.clox-fp-chip{border:0;background:transparent;color:inherit;font:inherit;font-size:12px;padding:5px 10px;border-radius:999px;cursor:pointer;opacity:.62;white-space:nowrap;transition:background .15s ease,opacity .15s ease}
.clox-fp-chip:hover{opacity:.9}
.clox-fp-chip[aria-pressed=true]{opacity:1;background:color-mix(in oklab,currentColor 10%,transparent)}
.clox-fp-pair{display:flex;flex-direction:column;align-items:flex-start;gap:3px;width:100%;border:0;background:transparent;color:inherit;font:inherit;text-align:start;padding:10px 12px;border-radius:12px;cursor:pointer;transition:background .15s ease}
.clox-fp-pair:hover{background:color-mix(in oklab,currentColor 6%,transparent)}
.clox-fp-pair[aria-pressed=true]{background:color-mix(in oklab,currentColor 10%,transparent)}
.clox-fp-select{width:100%;height:36px;border:0;border-radius:10px;padding:0 10px;font:inherit;font-size:13px;color:inherit;background:color-mix(in oklab,currentColor 7%,transparent);cursor:pointer}
.clox-fp-chip:focus-visible,.clox-fp-pair:focus-visible,.clox-fp-select:focus-visible{outline:2px solid currentColor;outline-offset:2px}
`

function PairingRow({ pair, fonts, sample, selected, onPick, p }: {
  pair: Pairing
  fonts: Map<string, LibraryFont>
  sample: { head: string; body: string }
  selected: boolean
  onPick: () => void
  p: Palette
}) {
  useGoogleFont(fonts.get(pair.display), sample.head)
  return (
    <button type="button" className="clox-fp-pair" aria-pressed={selected} onClick={onPick}>
      <span style={{ fontFamily: `"${pair.display}", system-ui`, fontSize: 18, fontWeight: 700, lineHeight: 1.25 }}>
        {sample.head}
      </span>
      <span style={{ fontSize: 12, color: p.inkMuted }}>
        {pair.label} · {pair.display === pair.body ? pair.display : `${pair.display} + ${pair.body}`}
      </span>
    </button>
  )
}

function FontSelect({ label, value, onChange, groups }: {
  label: string
  value: string
  onChange: (v: string) => void
  groups: [string, LibraryFont[]][]
}) {
  const id = `clox-fp-${label.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 150px', minWidth: 0 }}>
      <label htmlFor={id} style={{ fontSize: 12, opacity: 0.7 }}>{label}</label>
      <select id={id} className="clox-fp-select" value={value} onChange={e => onChange(e.target.value)}>
        {groups.map(([kind, list]) => (
          <optgroup key={kind} label={KIND_LABEL[kind] ?? kind}>
            {list.map(f => <option key={f.family} value={f.family}>{f.family}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

/** "Fonts" in the preview header: pick a pairing (or each font) from the
 *  library the sandbox already has, then ask the chat to remake the file. */
export default function FontPicker({ filename, p }: { filename: string; p: Palette }) {
  const [open, setOpen] = useState(false)
  const [lib, setLib] = useState<Library | null>(null)
  const [script, setScript] = useState('latin')
  const [display, setDisplay] = useState('')
  const [body, setBody] = useState('')
  const [note, setNote] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open || lib) return
    let alive = true
    void loadLibrary().then(l => { if (alive) setLib(l) })
    return () => { alive = false }
  }, [open, lib])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (boxRef.current?.contains(t) || buttonRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const fonts = useMemo(() => new Map((lib?.fonts ?? []).map(f => [f.family, f])), [lib])
  const sample = SCRIPTS.find(s => s.key === script) ?? SCRIPTS[0]
  const scripts = useMemo(
    () => SCRIPTS.filter(s => lib?.fonts.some(f => f.scripts.includes(s.key))),
    [lib],
  )
  const fits = (family: string) => fonts.get(family)?.scripts.includes(script) ?? false
  const pairings = (lib?.pairings ?? []).filter(pr => fits(pr.display) && fits(pr.body))
  const groups = useMemo(() => {
    const list = (lib?.fonts ?? []).filter(f => f.scripts.includes(script))
    return KIND_ORDER
      .map(k => [k, list.filter(f => f.kind === k).sort((a, b) => a.family.localeCompare(b.family))] as [string, LibraryFont[]])
      .filter(([, l]) => l.length > 0)
  }, [lib, script])

  // Keep a valid pair for the chosen script: first pairing, else first fonts.
  useEffect(() => {
    if (!lib) return
    if (display && body && fits(display) && fits(body)) return
    const first = pairings[0]
    const any = groups[0]?.[1][0]?.family ?? ''
    setDisplay(first?.display ?? any)
    setBody(first?.body ?? any)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, script])

  useGoogleFont(fonts.get(display), sample.head)
  useGoogleFont(fonts.get(body), sample.body)

  const apply = () => {
    if (!display || !body) return
    const same = display === body
    const text = same
      ? `Remake ${filename} with the font ${display} for all text. Keep the content, layout and colours as they are.`
      : `Remake ${filename} with ${display} for headlines and ${body} for body text. Keep the content, layout and colours as they are.`
    const detail = { text, accepted: false }
    window.dispatchEvent(new CustomEvent('clox-ask', { detail }))
    if (detail.accepted) {
      setNote('')
      setOpen(false)
    } else {
      setNote('The chat is still working. Try again when the reply has finished.')
    }
  }

  const dir = RTL.has(script) ? 'rtl' : 'ltr'

  return (
    <>
      <style>{PICKER_CSS}</style>
      <button
        ref={buttonRef}
        type="button"
        className="clox-pv-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => { setOpen(o => !o); setNote('') }}
        title="Change fonts"
      >
        <Type size={15} strokeWidth={1.9} aria-hidden />
        Fonts
      </button>
      {open && (
        <div
          ref={boxRef}
          role="dialog"
          aria-label="Change fonts"
          style={{
            position: 'absolute', top: 58, right: 14, zIndex: 5,
            width: 'min(400px, calc(100% - 28px))', maxHeight: 'calc(100% - 76px)',
            display: 'flex', flexDirection: 'column',
            background: p.surface, color: p.ink, borderRadius: 16,
            boxShadow: '0 24px 60px -20px rgba(0,0,0,0.45), 0 2px 8px -2px rgba(0,0,0,0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 10px 6px 16px' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, flex: 1 }}>Fonts</h3>
            <button type="button" className="clox-pv-btn" onClick={() => setOpen(false)} aria-label="Close fonts">
              <X size={16} strokeWidth={1.8} aria-hidden />
            </button>
          </div>

          {!lib ? (
            <p style={{ margin: 0, padding: '10px 16px 18px', fontSize: 13, color: p.inkMuted }}>Loading the font library…</p>
          ) : (
            <>
              <div role="group" aria-label="Writing system" style={{ display: 'flex', gap: 2, padding: '0 12px 8px', overflowX: 'auto' }}>
                {scripts.map(s => (
                  <button key={s.key} type="button" className="clox-fp-chip" aria-pressed={s.key === script} onClick={() => setScript(s.key)}>
                    {s.label}
                  </button>
                ))}
              </div>

              <div style={{ overflowY: 'auto', padding: '0 4px', minHeight: 0 }}>
                {pairings.length > 0 && (
                  <section aria-label="Pairings" style={{ padding: '0 4px 4px' }}>
                    <h4 style={{ margin: '6px 8px 4px', fontSize: 11.5, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: p.inkMuted }}>
                      Pairings
                    </h4>
                    <div dir={dir} style={{ display: 'flex', flexDirection: 'column' }}>
                      {pairings.map(pr => (
                        <PairingRow
                          key={pr.label}
                          pair={pr}
                          fonts={fonts}
                          sample={sample}
                          selected={pr.display === display && pr.body === body}
                          onPick={() => { setDisplay(pr.display); setBody(pr.body) }}
                          p={p}
                        />
                      ))}
                    </div>
                  </section>
                )}

                <section aria-label="Choose each font" style={{ padding: '8px 12px 4px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 11.5, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: p.inkMuted }}>
                    Or choose each
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <FontSelect label="Headlines" value={display} onChange={setDisplay} groups={groups} />
                    <FontSelect label="Body text" value={body} onChange={setBody} groups={groups} />
                  </div>
                </section>
              </div>

              <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  dir={dir}
                  aria-label="Preview"
                  style={{ borderRadius: 12, padding: '14px 16px', background: 'color-mix(in oklab, currentColor 5%, transparent)' }}
                >
                  <div style={{ fontFamily: `"${display}", system-ui`, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{sample.head}</div>
                  <div style={{ fontFamily: `"${body}", system-ui`, fontSize: 13.5, lineHeight: 1.55, marginTop: 6, color: p.inkSoft }}>{sample.body}</div>
                </div>
                {note && <p role="status" style={{ margin: 0, fontSize: 12.5, color: p.inkMuted }}>{note}</p>}
                <button
                  type="button"
                  className="clox-pv-btn clox-pv-primary"
                  onClick={apply}
                  disabled={!display || !body}
                  style={{ background: p.ink, color: p.surface, height: 38, alignSelf: 'stretch' }}
                >
                  Remake with these fonts
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Rendered first pages, kept for the tab session so the grid redraws
 *  instantly when the user comes back. */
const rendered = new Map<string, string>()

type PdfJs = typeof import('pdfjs-dist')
let pdfjsPromise: Promise<PdfJs> | null = null
function loadPdfJs() {
  pdfjsPromise ??= import('pdfjs-dist').then(mod => {
    mod.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    return mod
  })
  return pdfjsPromise
}

/** Draws page 1 of a PDF once the card scrolls into view. */
export default function PdfThumb({ url, alt, fallback }: { url: string; alt: string; fallback: ReactNode }) {
  const [src, setSrc] = useState<string | null>(() => rendered.get(url) ?? null)
  const [failed, setFailed] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (src || failed || !box.current) return
    let cancelled = false
    const el = box.current
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return
      io.disconnect()
      ;(async () => {
        try {
          const pdfjs = await loadPdfJs()
          const doc = await pdfjs.getDocument({ url }).promise
          const page = await doc.getPage(1)
          const base = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: Math.min(2, 640 / base.width) })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          const ctx = canvas.getContext('2d')
          if (!ctx) throw new Error('no canvas')
          await page.render({ canvas, canvasContext: ctx, viewport }).promise
          const data = canvas.toDataURL('image/jpeg', 0.82)
          doc.destroy()
          rendered.set(url, data)
          if (!cancelled) setSrc(data)
        } catch {
          if (!cancelled) setFailed(true)
        }
      })()
    }, { rootMargin: '200px' })
    io.observe(el)
    return () => { cancelled = true; io.disconnect() }
  }, [url, src, failed])

  if (failed) return <>{fallback}</>
  return (
    <div ref={box} style={{ width: '100%', height: '100%' }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      ) : (
        <div aria-hidden style={{ width: '100%', height: '100%', animation: 'cloxPulse 1.4s ease-in-out infinite', background: 'rgb(127 127 127 / 0.08)' }} />
      )}
    </div>
  )
}

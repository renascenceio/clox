/**
 * BlobAvatar — Clox brand mark / AI avatar.
 *
 * A continuously-deforming amorphous blob rendered on a <canvas>.
 * Replaces the boring "circled C" used as the AI avatar in chat and
 * doubles as the brand mark to the left of the "Clox" wordmark in
 * the sidebar header.
 *
 * Behaviour
 * ─────────
 *   • Renders at 2x DPR for crisp edges on retina.
 *   • Animation is a Catmull-Rom spline through N control points, each
 *     wobbling along 3 layered sine waves with randomised phase.
 *   • Optional mouse interaction "repels" the surface (used on the
 *     chat avatars). The tiny header mark turns interaction off.
 *
 * Design tokens
 * ─────────────
 * Clox brand palette already exposes terracotta as the accent (see
 * src/app/globals.css → `--accent-rgb: 168 71 42`). We mirror that here
 * via the `color` prop default so the avatar matches the rest of the
 * surface chrome without us hard-coding hex everywhere it appears.
 */

'use client'

import { useEffect, useRef } from 'react'

type Props = {
  /** Size in CSS px (square). Default 28 matches the old "circled C". */
  size?: number
  /** Main fill colour. Default = Clox terracotta. */
  color?: string
  /** Lighter accent for halo + inner highlight. Default derived. */
  colorLight?: string
  /**
   * Mouse-reactive surface. The 28px chat avatars use this; the tiny
   * 18px header mark disables it (the cursor would never realistically
   * land on a 18px target, and skipping the listeners shaves CPU
   * when the sidebar is just sitting there).
   */
  interactive?: boolean
  /** Override the energy knob (0–2). Default 0.25 = slow breathing. */
  energy?: number
  /** Override the fluidity knob (0–80). Default 50 = mid reactivity. */
  fluidity?: number
  /** Override point count. Default 11 = mildly complex contour. */
  points?: number
  /** ARIA label (avatar). Default 'Clox'. */
  ariaLabel?: string
}

export function BlobAvatar({
  size = 28,
  // Terracotta from the design tokens. Keeping a literal hex here AND
  // referencing the token in the JSDoc above means a designer browsing
  // the file sees both the source-of-truth and the value being used.
  color = '#A8472A',
  // Soft peach derived from terracotta @ ~55% lightness — used only
  // for the halo / inner highlight; never the main mass.
  colorLight = '#E8A988',
  interactive = true,
  energy = 0.25,
  fluidity = 50,
  points = 11,
  ariaLabel = 'Clox',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * DPR
    canvas.height = size * DPR
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(DPR, DPR)

    const C = size / 2
    const R = size * 0.38 // radiusFactor — leaves a touch of breathing room
    const N = points

    // Per-point randomised phases / speeds. Re-randomised whenever the
    // component remounts (which is rare — the avatar lives for the
    // lifetime of the chat message it belongs to), so every blob on
    // screen wobbles slightly differently, which kills the "tiled"
    // feel you get when 30 messages render identical animations.
    const phases = Array.from({ length: N }, () => ({
      p1: Math.random() * Math.PI * 2,
      p2: Math.random() * Math.PI * 2,
      p3: Math.random() * Math.PI * 2,
      s1: 0.6 + Math.random() * 0.7,
      s2: 1.0 + Math.random() * 1.0,
    }))

    const mouse = { x: -9999, y: -9999, active: false }
    let time = 0
    let rafId = 0

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = (e.clientX - rect.left) * (size / rect.width)
      mouse.y = (e.clientY - rect.top) * (size / rect.height)
      mouse.active = true
    }
    const onLeave = () => {
      mouse.active = false
    }
    const onTouchMove = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect()
      const t = e.touches[0]
      if (!t) return
      mouse.x = (t.clientX - rect.left) * (size / rect.width)
      mouse.y = (t.clientY - rect.top) * (size / rect.height)
      mouse.active = true
    }

    if (interactive) {
      canvas.addEventListener('mousemove', onMove)
      canvas.addEventListener('mouseleave', onLeave)
      canvas.addEventListener('touchmove', onTouchMove, { passive: true })
      canvas.addEventListener('touchend', onLeave)
    }

    function getPoints(radiusScale: number) {
      const pts: { x: number; y: number }[] = []
      for (let i = 0; i < N; i++) {
        const angle = (i / N) * Math.PI * 2 - Math.PI / 2
        const ph = phases[i]
        const noise =
          Math.sin(time * ph.s1 * energy + ph.p1) * 18 * radiusScale +
          Math.sin(time * ph.s2 * energy + ph.p2) * 9 * radiusScale +
          Math.sin(time * 0.4 * energy + ph.p3) * 5 * radiusScale

        let x = C + Math.cos(angle) * (R * radiusScale + noise)
        let y = C + Math.sin(angle) * (R * radiusScale + noise)

        // Cursor deformation only on the outer surface — applying it
        // to the inner highlight as well would over-distort and the
        // shape would read as "broken" rather than "alive".
        if (radiusScale === 1 && mouse.active && interactive) {
          const dx = x - mouse.x
          const dy = y - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const reach = fluidity * 3.2
          if (dist < reach) {
            const inf = 1 - dist / reach
            const force = inf * inf * fluidity
            x += (dx / (dist + 0.1)) * force
            y += (dy / (dist + 0.1)) * force
          }
        }

        pts.push({ x, y })
      }
      return pts
    }

    function tracePath(pts: { x: number; y: number }[]) {
      if (!ctx) return
      const len = pts.length
      ctx.beginPath()
      for (let i = 0; i < len; i++) {
        const p0 = pts[(i - 1 + len) % len]
        const p1 = pts[i]
        const p2 = pts[(i + 1) % len]
        const p3 = pts[(i + 2) % len]
        const cp1x = p1.x + (p2.x - p0.x) / 5
        const cp1y = p1.y + (p2.y - p0.y) / 5
        const cp2x = p2.x - (p3.x - p1.x) / 5
        const cp2y = p2.y - (p3.y - p1.y) / 5
        if (i === 0) ctx.moveTo(p1.x, p1.y)
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
      }
      ctx.closePath()
    }

    function frame() {
      if (!ctx) return
      time += 0.012
      ctx.clearRect(0, 0, size, size)

      // 1 — outer halo (slightly larger, semi-transparent peach).
      ctx.globalAlpha = 0.18
      ctx.fillStyle = colorLight
      tracePath(getPoints(1.14))
      ctx.fill()

      // 2 — main terracotta body.
      ctx.globalAlpha = 1
      ctx.fillStyle = color
      tracePath(getPoints(1))
      ctx.fill()

      // 3 — inner highlight for dimensionality.
      ctx.globalAlpha = 0.22
      ctx.fillStyle = colorLight
      tracePath(getPoints(0.48))
      ctx.fill()

      ctx.globalAlpha = 1
      rafId = requestAnimationFrame(frame)
    }

    frame()

    return () => {
      cancelAnimationFrame(rafId)
      if (interactive) {
        canvas.removeEventListener('mousemove', onMove)
        canvas.removeEventListener('mouseleave', onLeave)
        canvas.removeEventListener('touchmove', onTouchMove)
        canvas.removeEventListener('touchend', onLeave)
      }
    }
  }, [size, color, colorLight, interactive, energy, fluidity, points])

  return (
    <canvas
      ref={canvasRef}
      aria-label={ariaLabel}
      role="img"
      style={{
        width: size,
        height: size,
        display: 'block',
        // Block flex children from forcing a different aspect ratio
        // when the avatar sits next to longer text (e.g. the wordmark).
        flex: `0 0 ${size}px`,
      }}
    />
  )
}

export default BlobAvatar

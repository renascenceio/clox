/**
 * Self-hosted DiceBear "Clay" avatars (animated).
 *
 * The public api.dicebear.com is for non-commercial use only, so we
 * render with @dicebear/core ourselves. The URL ends in `.svg` on
 * purpose: the auth middleware skips image extensions, so avatars
 * never pay for a Supabase session refresh.
 *
 *   /avatars/<encodeURIComponent(seed)>.svg
 *
 * Same seed → same avatar, so responses are cached forever.
 */
import { Avatar, Style } from '@dicebear/core'
import clay from '@dicebear/styles/clay.json'
import { AVATAR_BACKGROUNDS, AVATAR_BODIES, AVATAR_SCALE, AVATAR_TRANSLATE_Y } from '@/shared/ui/components/avatar-palette'

export const runtime = 'nodejs'

const style = new Style(clay as ConstructorParameters<typeof Style>[0])

export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const raw = params.file.replace(/\.svg$/i, '')
  let seed: string
  try {
    seed = decodeURIComponent(raw).slice(0, 200) || 'clox'
  } catch {
    seed = 'clox'
  }

  const svg = new Avatar(style, {
    seed,
    bodyColor: AVATAR_BODIES,
    accentColor: AVATAR_BODIES,
    backgroundColor: AVATAR_BACKGROUNDS,
    scale: AVATAR_SCALE,
    translateY: AVATAR_TRANSLATE_Y,
    animationVariant: ['fast', 'medium', 'slow'],
  }).toString()

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

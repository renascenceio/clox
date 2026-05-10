import { useMemo } from 'react'
import Image from 'next/image'

interface AvatarProps {
  seed?: string
  size?: number
  className?: string
}

/**
 * Generates a Dicebear avatar URL using a brand-aligned warm-earth palette.
 *
 * Anchored on Clox's accent — Terracotta `#A8472A` (= 168 71 42 in
 * `--accent-rgb`, see `globals.css`). The palette steps outward from
 * that anchor through sienna, copper, russet, mahogany, and warm
 * caramels so seeded avatars feel distinct without ever clashing with
 * the editorial pearl + ink chrome.
 *
 * No mints, teals, or apple-pastels — those were left over from the
 * Studio identity and read as foreign on the current chrome. Likewise
 * no cool blues or greens; the palette is intentionally narrow to keep
 * each generated avatar instantly readable as "a Clox avatar" rather
 * than a generic Dicebear default.
 *
 * The Dicebear `avataaars-neutral` style overlays its own grayscale
 * features on top, so these colours function strictly as background
 * fills — they don't conflict with the avatar geometry.
 */
const AVATAR_BG_PALETTE = [
  'A8472A', // terracotta — brand accent
  '7A2E1C', // oxblood — deep terracotta
  'C76140', // rust — lighter terracotta
  '9C5530', // sienna
  '7E4D2E', // cinnamon
  '5C3A28', // coffee — dark warm brown
  '4A2A1E', // mahogany — deepest warm brown
  '8A5C3D', // caramel
  '6E4528', // russet
  'B68768', // tan — paler warm earth
].join(',')

export default function Avatar({ seed = 'default', size = 40, className = '' }: AvatarProps) {
  const avatarUrl = useMemo(() => {
    const params = new URLSearchParams({
      seed,
      size: size.toString(),
      backgroundColor: AVATAR_BG_PALETTE,
      backgroundType: 'solid',
    })

    return `https://api.dicebear.com/7.x/avataaars-neutral/svg?${params.toString()}`
  }, [seed, size])

  return (
    <Image
      src={avatarUrl}
      alt={`Avatar for ${seed}`}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      unoptimized
    />
  )
}

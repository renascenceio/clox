import { useMemo } from 'react'
import Image from 'next/image'

interface AvatarProps {
  seed?: string
  size?: number
  className?: string
}

/**
 * Generates a Dicebear avatar URL with a varied cool-toned palette.
 * The seed picks deterministically from a range of mint/teal/blue/indigo/violet/pink
 * backgrounds so avatars feel distinct and vibrant while still reading as
 * part of the Clox Studio mint-green identity. No brown is used.
 */
const AVATAR_BG_PALETTE = [
  '00C7BE', // mint (brand)
  '30B0C7', // apple teal
  '40C8E0', // bright teal
  '5AC8FA', // apple sky blue
  '007AFF', // apple blue
  '5856D6', // apple indigo
  'AF52DE', // apple purple
  'FF2D92', // apple pink
  '34C759', // apple green
  'FFCC00', // apple yellow
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

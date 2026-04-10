import { useMemo } from 'react'
import Image from 'next/image'

interface AvatarProps {
  seed?: string
  size?: number
  className?: string
}

/**
 * Renders a Dicebear avatar when a seed is provided, otherwise renders an empty circle.
 */
export default function Avatar({ seed, size = 40, className = '' }: AvatarProps) {
  const avatarUrl = useMemo(() => {
    if (!seed) return null
    const params = new URLSearchParams({
      seed,
      size: size.toString(),
      backgroundColor: 'A2845E,5AC8C8,8B6F47,3DB1B1',
      backgroundType: 'solid',
    })
    return `https://api.dicebear.com/7.x/avataaars-neutral/svg?${params.toString()}`
  }, [seed, size])

  if (!avatarUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`rounded-full bg-surface-tertiary dark:bg-surface border border-separator/50 ${className}`}
        aria-label="Avatar"
      />
    )
  }

  return (
    <Image
      src={avatarUrl}
      alt="Avatar"
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      unoptimized
    />
  )
}

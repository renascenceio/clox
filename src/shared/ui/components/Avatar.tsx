import { useMemo } from 'react'
import Image from 'next/image'

interface AvatarProps {
  seed?: string
  size?: number
  className?: string
}

/**
 * Generates a Dicebear avatar URL with Clox Studio brown/teal colors
 * Using avataaars-neutral style with custom color palette
 */
export default function Avatar({ seed = 'default', size = 40, className = '' }: AvatarProps) {
  const avatarUrl = useMemo(() => {
    // Dicebear API v7 with avataaars-neutral style
    // Custom colors matching Clox Studio brown/teal theme
    const params = new URLSearchParams({
      seed,
      size: size.toString(),
      // Apply brown/teal color scheme
      backgroundColor: 'A2845E,5AC8C8,8B6F47,3DB1B1', // Brown and teal variants
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

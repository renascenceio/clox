import { avatarUrl } from './avatar-palette'

interface AvatarProps {
  seed?: string
  size?: number
  className?: string
}

/**
 * Animated DiceBear "Clay" avatar in electric colours, rendered by our
 * own `/avatars/<seed>.svg` route (see `src/app/avatars/[file]/route.ts`).
 * A plain <img> keeps the SVG's built-in animation running.
 */
export default function Avatar({ seed = 'default', size = 40, className = '' }: AvatarProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl(seed)}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`rounded-full ${className}`}
      style={{ width: size, height: size, flex: `0 0 ${size}px` }}
    />
  )
}

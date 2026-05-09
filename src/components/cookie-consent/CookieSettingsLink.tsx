'use client'

import type { ReactNode } from 'react'
import { openPreferences } from '@/lib/consent/store'

/**
 * Tiny inline-button helper used in the footer (and anywhere else we want a
 * one-liner "open the cookie preferences sheet" affordance). Renders as a
 * styled `<button>` so it inherits underline/colour from its parent <a>-styled
 * siblings while still being keyboard-accessible.
 */
export default function CookieSettingsLink({
  children = 'Cookie settings',
  className = '',
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={openPreferences}
      className={`bg-transparent border-0 p-0 cursor-pointer text-inherit ${className}`}
    >
      {children}
    </button>
  )
}

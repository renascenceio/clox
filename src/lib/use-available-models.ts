'use client'

import { useEffect, useState } from 'react'
import { filterAvailableModels } from '@/lib/admin-settings'

/**
 * Returns the subset of `allModels` whose provider is both enabled and has an
 * API key saved. Updates live when the admin toggles a provider or saves a key
 * (via the `admin-settings-changed` custom event dispatched by admin-settings.ts).
 *
 * Falls back to the full list when nothing is configured yet so the UI is never
 * empty during initial setup.
 */
export function useAvailableModels<T extends { provider: string }>(allModels: T[]): T[] {
  const [models, setModels] = useState<T[]>(() => allModels)

  useEffect(() => {
    const recompute = () => setModels(filterAvailableModels(allModels))
    recompute()

    const handler = () => recompute()
    window.addEventListener('admin-settings-changed', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('admin-settings-changed', handler)
      window.removeEventListener('storage', handler)
    }
  }, [allModels])

  return models
}

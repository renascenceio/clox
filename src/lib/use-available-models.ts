'use client'

import { useMemo } from 'react'
import { useProviderStatus } from '@/lib/provider-status'

/**
 * Returns ALL models, sorted so connected ones come first. Each item is
 * augmented with a `connected` flag the UI can use to render a "needs api
 * key" affordance for disconnected models.
 *
 * Why we no longer filter:
 *   The previous behaviour hid disconnected models entirely once at least
 *   one provider was connected (see `connected.length > 0 ? connected :
 *   allModels`). This made Moonshot / Kling / Kimi / etc. invisible to
 *   users who had configured *some* providers but not those — they had no
 *   way to even discover the model existed and needed a key. Showing
 *   everything and tagging the unconfigured ones is more honest and
 *   makes Super Admin → API Keys self-discoverable.
 */
export function useAvailableModels<T extends { provider: string }>(
  allModels: T[],
): Array<T & { connected: boolean }> {
  const { loading, getState } = useProviderStatus()

  return useMemo(() => {
    // While the server status is in flight, optimistically mark everything
    // connected so the picker doesn't flash "needs api key" for env-keyed
    // providers on first paint.
    if (loading) {
      return allModels.map(m => ({ ...m, connected: true }))
    }

    const tagged = allModels.map(m => ({
      ...m,
      connected: getState(m.provider).connected,
    }))

    // Stable sort: connected first, original order preserved within bands.
    const connected = tagged.filter(m => m.connected)
    const disconnected = tagged.filter(m => !m.connected)
    return [...connected, ...disconnected]
  }, [allModels, loading, getState])
}

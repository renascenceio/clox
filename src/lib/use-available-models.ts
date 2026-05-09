'use client'

import { useMemo } from 'react'
import { useProviderStatus } from '@/lib/provider-status'

/**
 * Returns the models the picker should offer, in display order.
 *
 * Visibility rules:
 *
 *  - Provider is explicitly toggled OFF in Super Admin → API Keys
 *    (`enabled === false`)  →  hide every model it powers. This is the
 *    user's deliberate signal that they don't want to see the brand at
 *    all, regardless of whether an env var or local key is also set.
 *
 *  - Provider is enabled (default) and has any working source — env var,
 *    AI Gateway, or saved local key  →  show as connected (ready to use).
 *
 *  - Provider is enabled but has no working source  →  still show, with
 *    `connected: false` so the UI can render a "needs api key" hint.
 *    This way users can discover models like Kling / Kimi / Moonshot
 *    even before they've added a key.
 *
 * Sort order: connected first, original order preserved within each band.
 *
 * Historical note: an earlier version omitted the toggle-off filter
 * entirely, which meant flipping the switch in the admin had no visible
 * effect on the picker — a frequent source of confusion in support.
 */
export function useAvailableModels<T extends { provider: string }>(
  allModels: T[],
): Array<T & { connected: boolean }> {
  const { loading, getState } = useProviderStatus()

  return useMemo(() => {
    // While the server status is in flight, optimistically mark everything
    // connected so the picker doesn't flash "needs api key" for env-keyed
    // providers on first paint. The toggle-off filter is also skipped
    // here because the admin localStorage read is synchronous — it'll be
    // re-applied as soon as `loading` flips false on the next render.
    if (loading) {
      return allModels.map(m => ({ ...m, connected: true }))
    }

    const visible: Array<T & { connected: boolean }> = []
    for (const m of allModels) {
      const state = getState(m.provider)
      // The default `enabled` is true for any provider the user hasn't
      // touched, so this filter only fires when they actively flipped
      // the switch off. We treat that as a hard hide.
      if (state.enabled === false) continue
      visible.push({ ...m, connected: state.connected })
    }

    // Stable bucketing: connected first, then "needs api key" stragglers.
    const connected = visible.filter(m => m.connected)
    const disconnected = visible.filter(m => !m.connected)
    return [...connected, ...disconnected]
  }, [allModels, loading, getState])
}

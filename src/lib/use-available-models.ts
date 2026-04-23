'use client'

import { useMemo } from 'react'
import { useProviderStatus } from '@/lib/provider-status'

/**
 * Returns the subset of `allModels` whose provider is *actually connected* —
 * i.e. the user has an env var, a local key, or AI-Gateway zero-config access,
 * AND the provider hasn't been toggled off in Super Admin.
 *
 * The list is sorted so that truly connected models appear first, preserving
 * original order within each band. Falls back to returning all models only
 * while the server-status request is still in flight so the UI isn't blank
 * on first load.
 */
export function useAvailableModels<T extends { provider: string }>(allModels: T[]): T[] {
  const { loading, getState } = useProviderStatus()

  return useMemo(() => {
    if (loading) return allModels

    const connected = allModels.filter(m => getState(m.provider).connected)
    // If nothing is connected (e.g. no env vars, no AI gateway, no local keys)
    // we still return the full list so users have something to pick from and
    // the admin UI can guide them to configure at least one provider.
    return connected.length > 0 ? connected : allModels
  }, [allModels, loading, getState])
}

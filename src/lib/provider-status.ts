'use client'

import { useEffect, useState } from 'react'
import { getAdminSettings } from '@/lib/admin-settings'

export interface ServerProviderStatus {
  hasEnvKey: boolean
  aiGatewayCapable: boolean
  envKeyName: string
}

export interface ProviderStatusResponse {
  aiGatewayConnected: boolean
  providers: Record<string, ServerProviderStatus>
}

/**
 * A provider is "connected" if any of the following is true:
 *   - its env var is set on the server (hasEnvKey)
 *   - it's reachable zero-config through the Vercel AI Gateway
 *   - the user saved an API key into Super Admin -> API Keys (localStorage)
 */
export interface ProviderConnectionState {
  connected: boolean
  source: 'env' | 'gateway' | 'local' | 'none'
  hasEnvKey: boolean
  aiGatewayCapable: boolean
  hasLocalKey: boolean
  enabled: boolean
  envKeyName: string
}

// In-memory + sessionStorage cache so we don't re-fetch on every component mount
let cachedServerStatus: ProviderStatusResponse | null = null
let inflight: Promise<ProviderStatusResponse> | null = null

const CACHE_KEY = 'clox_provider_status_v1'

function hydrateCacheFromSession(): ProviderStatusResponse | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (raw) return JSON.parse(raw) as ProviderStatusResponse
  } catch {
    /* ignore */
  }
  return null
}

async function fetchServerStatus(force = false): Promise<ProviderStatusResponse> {
  if (!force && cachedServerStatus) return cachedServerStatus
  if (!force && inflight) return inflight

  inflight = fetch('/api/providers/status', { cache: 'no-store' })
    .then(r => r.json() as Promise<ProviderStatusResponse>)
    .then(data => {
      cachedServerStatus = data
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(data))
        } catch {
          /* ignore quota errors */
        }
      }
      return data
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

/**
 * Client-side hook. Returns a map of provider-id -> ProviderConnectionState
 * that combines server env/gateway status with local admin settings.
 */
export function useProviderStatus() {
  const [serverStatus, setServerStatus] = useState<ProviderStatusResponse | null>(
    () => cachedServerStatus ?? hydrateCacheFromSession(),
  )
  // Bump this to force a re-read of localStorage admin settings.
  const [adminTick, setAdminTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchServerStatus().then(data => {
      if (!cancelled) setServerStatus(data)
    })

    const onAdminChanged = () => setAdminTick(t => t + 1)
    window.addEventListener('admin-settings-changed', onAdminChanged)
    window.addEventListener('storage', onAdminChanged)
    return () => {
      cancelled = true
      window.removeEventListener('admin-settings-changed', onAdminChanged)
      window.removeEventListener('storage', onAdminChanged)
    }
  }, [])

  const adminSettings = typeof window !== 'undefined' ? getAdminSettings() : { providers: {} }

  const getState = (providerId: string): ProviderConnectionState => {
    const server = serverStatus?.providers[providerId]
    const localEntry = adminSettings.providers[providerId]
    const hasEnvKey = Boolean(server?.hasEnvKey)
    const aiGatewayCapable = Boolean(server?.aiGatewayCapable)
    const hasLocalKey = Boolean(localEntry?.apiKey && localEntry.apiKey.trim().length > 0)
    // Default to enabled: users have to *explicitly* turn something off.
    const enabled = localEntry?.enabled ?? true

    const source: ProviderConnectionState['source'] = hasEnvKey
      ? 'env'
      : aiGatewayCapable
        ? 'gateway'
        : hasLocalKey
          ? 'local'
          : 'none'

    return {
      connected: enabled && (hasEnvKey || aiGatewayCapable || hasLocalKey),
      source,
      hasEnvKey,
      aiGatewayCapable,
      hasLocalKey,
      enabled,
      envKeyName: server?.envKeyName ?? '',
    }
  }

  return {
    loading: serverStatus === null,
    aiGatewayConnected: Boolean(serverStatus?.aiGatewayConnected),
    getState,
    // Used by admin page after the user toggles a switch or types a key.
    refresh: () => fetchServerStatus(true).then(setServerStatus),
    // Included so consumers re-render when localStorage changes.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adminTick: adminTick,
  }
}

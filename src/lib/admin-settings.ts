/**
 * Admin Settings Store
 * Manages API keys and provider enable/disable state
 * Syncs between admin dashboard and frontend
 */

export interface ProviderSettings {
  enabled: boolean
  apiKey?: string
  apiSecret?: string
  baseUrl?: string
}

export interface AdminSettings {
  providers: Record<string, ProviderSettings>
}

const STORAGE_KEY = 'clox_admin_settings'

export function getAdminSettings(): AdminSettings {
  if (typeof window === 'undefined') {
    return { providers: {} }
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('[v0] Error loading admin settings:', error)
  }
  
  return { providers: {} }
}

export function saveAdminSettings(settings: AdminSettings): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('admin-settings-changed', { detail: settings }))
  } catch (error) {
    console.error('[v0] Error saving admin settings:', error)
  }
}

export function isProviderEnabled(providerId: string): boolean {
  const settings = getAdminSettings()
  // Default to TRUE if not set - all providers enabled by default
  return settings.providers[providerId]?.enabled ?? true
}

export function getProviderApiKey(providerId: string): string | undefined {
  const settings = getAdminSettings()
  return settings.providers[providerId]?.apiKey
}

export function setProviderEnabled(providerId: string, enabled: boolean): void {
  const settings = getAdminSettings()
  if (!settings.providers[providerId]) {
    settings.providers[providerId] = { enabled }
  } else {
    settings.providers[providerId].enabled = enabled
  }
  saveAdminSettings(settings)
}

export function setProviderApiKey(providerId: string, apiKey: string, apiSecret?: string, baseUrl?: string): void {
  const settings = getAdminSettings()
  if (!settings.providers[providerId]) {
    settings.providers[providerId] = { enabled: false }
  }
  settings.providers[providerId].apiKey = apiKey
  if (apiSecret) settings.providers[providerId].apiSecret = apiSecret
  if (baseUrl) settings.providers[providerId].baseUrl = baseUrl
  saveAdminSettings(settings)
}

'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { DEFAULT_STATE, getConsentRecord, readAutomatedSignals, subscribeConsent } from './store'
import type { ConsentRecord, ConsentState } from './types'

/**
 * Live consent for any component: re-renders when the person changes their
 * choice here or in another tab. `record` is null until they decide; `state`
 * is then "necessary only".
 */
export function useConsent(): { record: ConsentRecord | null; state: ConsentState; decided: boolean; gpc: boolean } {
  const record = useSyncExternalStore(subscribeConsent, getConsentRecord, () => null)
  return useMemo(() => {
    const gpc = typeof window !== 'undefined' && readAutomatedSignals().gpc
    const base = record?.state ?? DEFAULT_STATE
    const state = gpc && base.marketing ? { ...base, marketing: false } : base
    return { record, state, decided: record !== null, gpc }
  }, [record])
}

'use client'

/**
 * Single source of truth for "user skills" across the app.
 *
 * Two surfaces consume this:
 *
 *   - `/skills` page — full library, lets the user toggle skills on/off,
 *     create new ones (super-admin), browse by engine/tag.
 *   - `/text` chat composer — Skills chip in the input bar. Shows the same
 *     library; toggling here writes to the same `user_skills` table so the
 *     two surfaces never drift out of sync.
 *
 * Backed by the Supabase tables defined in `scripts/001_clox_schema.sql`:
 *   - `public.skills`        — curated catalogue (RLS: public + owner read)
 *   - `public.user_skills`   — per-user activation flags (RLS: own rows only)
 *
 * The hook intentionally fetches once on mount and exposes a `refresh()` so
 * the composer's chip and the /skills page can both round-trip a change
 * without prop-drilling state across the page boundary.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Mirrors `public.skills`. */
export interface DbSkill {
  id: string
  name: string
  description: string | null
  /** 'claude' | 'gpt' | 'gemini' | 'all' (free-form per schema) */
  engine: string
  source_url: string | null
  system_prompt: string
  tags: string[]
  is_public: boolean
  created_at: string
}

/** Mirrors `public.user_skills` (only rows owned by the calling user). */
export interface DbUserSkill {
  id: string
  skill_id: string
  is_active: boolean
}

export interface UseUserSkillsResult {
  skills: DbSkill[]
  userSkills: DbUserSkill[]
  /** Skill ids the user currently has flagged active (`is_active = true`). */
  activeIds: string[]
  loading: boolean
  /** Re-fetch everything from Supabase. */
  refresh: () => Promise<void>
  /** Flip the active flag for one skill, upserting the user_skills row. */
  toggle: (skillId: string) => Promise<void>
  /** Set the active flag explicitly (used by the composer's "Clear all"). */
  setActive: (skillId: string, active: boolean) => Promise<void>
  /** Bulk clear — sets every active flag to false. */
  clearAll: () => Promise<void>
}

/**
 * Loads the curated skills catalogue + the user's per-skill activation
 * flags. Returns helpers that mutate `user_skills` and keep the local
 * cache consistent so neither surface needs its own copy.
 */
export function useUserSkills(): UseUserSkillsResult {
  const [skills, setSkills] = useState<DbSkill[]>([])
  const [userSkills, setUserSkills] = useState<DbUserSkill[]>([])
  const [loading, setLoading] = useState(true)
  // Cache the user id once we have it so toggle()/setActive() don't have to
  // round-trip to auth.getUser() on every click.
  const userIdRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userIdRef.current = user?.id ?? null

    const [{ data: skillsData }, { data: userSkillsData }] = await Promise.all([
      supabase.from('skills').select('*').order('name'),
      // RLS already restricts user_skills to the caller, so no .eq filter
      // is needed; the empty array fallback handles unauthenticated calls.
      user
        ? supabase.from('user_skills').select('*')
        : Promise.resolve({ data: [] as DbUserSkill[] }),
    ])

    setSkills((skillsData as DbSkill[] | null) ?? [])
    setUserSkills((userSkillsData as DbUserSkill[] | null) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  /**
   * Set the active flag for one skill. If the row doesn't exist yet we
   * insert it; otherwise we update. Both branches optimistically update
   * the local cache so the UI feels instant.
   */
  const setActive = useCallback(async (skillId: string, active: boolean) => {
    const supabase = createClient()
    const userId = userIdRef.current
    if (!userId) {
      // Re-resolve once on demand — the user might have signed in after
      // the initial load.
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userIdRef.current = user.id
    }
    const uid = userIdRef.current!

    const existing = userSkills.find(us => us.skill_id === skillId)
    if (existing) {
      // Optimistic
      setUserSkills(prev => prev.map(us =>
        us.id === existing.id ? { ...us, is_active: active } : us,
      ))
      const { error } = await supabase
        .from('user_skills')
        .update({ is_active: active })
        .eq('id', existing.id)
        .eq('user_id', uid)
      if (error) {
        // Rollback on failure.
        setUserSkills(prev => prev.map(us =>
          us.id === existing.id ? { ...us, is_active: existing.is_active } : us,
        ))
        console.error('[v0] user_skills update failed:', error.message)
      }
    } else {
      const { data, error } = await supabase
        .from('user_skills')
        .insert({ skill_id: skillId, user_id: uid, is_active: active })
        .select()
        .single()
      if (!error && data) {
        setUserSkills(prev => [...prev, data as DbUserSkill])
      } else if (error) {
        console.error('[v0] user_skills insert failed:', error.message)
      }
    }
  }, [userSkills])

  const toggle = useCallback(async (skillId: string) => {
    const existing = userSkills.find(us => us.skill_id === skillId)
    return setActive(skillId, existing ? !existing.is_active : true)
  }, [userSkills, setActive])

  const clearAll = useCallback(async () => {
    const active = userSkills.filter(us => us.is_active)
    if (active.length === 0) return
    // Optimistic — flip all active rows off.
    setUserSkills(prev => prev.map(us => us.is_active ? { ...us, is_active: false } : us))
    const supabase = createClient()
    const ids = active.map(us => us.id)
    const { error } = await supabase
      .from('user_skills')
      .update({ is_active: false })
      .in('id', ids)
    if (error) {
      // Rollback on failure.
      setUserSkills(prev => prev.map(us =>
        ids.includes(us.id) ? { ...us, is_active: true } : us,
      ))
      console.error('[v0] user_skills bulk clear failed:', error.message)
    }
  }, [userSkills])

  const activeIds = useMemo(
    () => userSkills.filter(us => us.is_active).map(us => us.skill_id),
    [userSkills],
  )

  return { skills, userSkills, activeIds, loading, refresh, toggle, setActive, clearAll }
}

/**
 * Server-side skill catalog cache + slim-index builder.
 *
 * Why this exists
 * ---------------
 * Lazy skill loading (Phase 2 of the rate-limit-relief plan) needs two
 * things on every chat request:
 *
 *   1. A SLIM INDEX — `{id, name, one-line description}` for every
 *      active skill. We splice this into the cacheable system-prompt
 *      prefix so the model knows what's in the catalogue without us
 *      having to ship every skill's multi-paragraph prose. Roughly
 *      80 tokens per skill × ~30 skills = ~2.4k tokens. That goes
 *      into Anthropic's cache prefix and OpenAI/Gemini's automatic
 *      prefix cache, so it's only billed once per ~5-minute window.
 *
 *   2. A CATALOG MAP — `id → full system_prompt`. The `read_skill`
 *      tool factory closes over this map so when the model decides
 *      it needs (e.g.) the Frontend Designer skill on top of the
 *      auto-detected one, the tool can return the full prompt as a
 *      tool result instead of having all of those skills' prose
 *      front-loaded into the system message.
 *
 * Caching strategy
 * ----------------
 * The skills table is admin-edited and changes a few times a week at
 * most, but every chat request needs to read it. We cache the result
 * in module scope with a 60-second TTL. That's tight enough that an
 * admin's prompt edit shows up in chat within ~1 minute, but loose
 * enough that a busy chat at 100 req/min only re-queries the table
 * once.
 *
 * The cache is in-memory and per-Lambda-instance (Vercel keeps warm
 * instances around for a few minutes), so a fleet of 10 simultaneous
 * functions will each cache independently. That's fine — the cost is
 * a tiny SELECT on a small table, and the alternative (Redis or a
 * shared edge cache) would be over-engineering for table this size. */

import { getServiceClient } from '@/lib/projects/server'

export interface SkillSlim {
  /** Stable UUID — what `read_skill({skill_id})` looks up. */
  id: string
  /** Human label — used in the index line and in tool-call traces. */
  name: string
  /** One-line `description` from the row, trimmed. */
  description: string
  /** Tags from the row (used by other surfaces; included for parity). */
  tags: string[]
}

export interface SkillFull extends SkillSlim {
  /** The full system prompt the model sees when this skill is loaded. */
  system_prompt: string
}

interface CacheEntry {
  fetchedAt: number
  catalog: Map<string, SkillFull>
}

let CACHE: CacheEntry | null = null
const CACHE_TTL_MS = 60 * 1000

/**
 * Load (or return cached) catalogue. Always returns a Map keyed by
 * skill id so `read_skill` can look up in O(1). Errors are logged
 * and an empty Map returned — a transient DB hiccup must not crash
 * the chat route. */
export async function loadSkillCatalog(): Promise<Map<string, SkillFull>> {
  const now = Date.now()
  if (CACHE && now - CACHE.fetchedAt < CACHE_TTL_MS) return CACHE.catalog

  try {
    const sb = getServiceClient()
    const { data, error } = await sb
      .from('skills')
      .select('id, name, description, system_prompt, tags')
      .order('name', { ascending: true })

    if (error || !data) {
      console.warn('[v0] skills-index: load failed', error?.message)
      return CACHE?.catalog ?? new Map()
    }

    const catalog = new Map<string, SkillFull>()
    for (const row of data as Array<{
      id: string
      name: string
      description: string | null
      system_prompt: string | null
      tags: string[] | null
    }>) {
      if (!row.system_prompt) continue
      catalog.set(row.id, {
        id: row.id,
        name: row.name,
        description: (row.description ?? '').trim(),
        system_prompt: row.system_prompt,
        tags: row.tags ?? [],
      })
    }
    CACHE = { fetchedAt: now, catalog }
    return catalog
  } catch (e) {
    console.warn('[v0] skills-index: load threw', (e as Error).message)
    return CACHE?.catalog ?? new Map()
  }
}

/**
 * Build the slim-index string the model sees in its system prompt.
 *
 *   (id) name — description
 *
 * One skill per line. Excludes skills whose ids appear in
 * `excludeIds` — pass the auto-detected skill's id here so we don't
 * advertise it twice (once eagerly in dynamicSystem, once in the
 * "available to load" list).
 *
 * The index is wrapped with "Available skills (call read_skill(id))"
 * preamble lines so the model unambiguously understands the
 * mechanism. */
export function buildSkillIndex(
  catalog: Map<string, SkillFull>,
  excludeIds: ReadonlyArray<string> = [],
): string {
  const exclude = new Set(excludeIds)
  // `Array.from` rather than `[...catalog.values()]` keeps us
  // compatible with the project's tsconfig target without needing
  // --downlevelIteration enabled.
  const lines = Array.from(catalog.values())
    .filter(s => !exclude.has(s.id))
    .map(s => {
      const desc = s.description ? ` — ${s.description}` : ''
      return `(${s.id}) ${s.name}${desc}`
    })

  if (lines.length === 0) return ''

  return [
    '',
    '## Available skills (load lazily via the `read_skill` tool)',
    '',
    'Each line below is a skill in the catalogue. If the user is asking',
    'for something the currently-active skills do not cover, call',
    '`read_skill({"skill_id": "<id-from-the-line>"})` to load that',
    "skill's full instructions. Tool results are returned to you as",
    'context for the rest of this turn AND are cached by the provider',
    'so subsequent turns within this chat read it back cheaply.',
    "Do NOT load a skill unless its description matches the user's",
    'intent — speculative loads waste tokens and confuse intent.',
    '',
    ...lines,
    '',
  ].join('\n')
}

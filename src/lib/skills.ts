/**
 * Skills helper module — single source of truth for the chat composer.
 *
 * Every skill in Clox now lives in `public.skills` (Supabase). This file
 * has no hard-coded skill list of its own — it just provides the helpers
 * that turn a `Skill` row into:
 *
 *  - a picker option (label + description + group), filtered by modality
 *  - a system-prompt block (for chat) or prompt prefix (for media gen)
 *
 * History: behavioural overlays used to live in `lib/skills-registry.ts`
 * as a hard-coded TS array, while curated DB skills lived in Supabase.
 * That split caused the surfaces to diverge — the /skills page showed
 * only DB rows, the composer dropdown showed both, and `Concise` ended
 * up duplicated. Migration 005 moved the 21 registry overlays into the
 * skills table with modality encoded in tags (`text`, `image`, `video`,
 * `audio`), so this module can drive ALL surfaces from one query. */

export type SkillModality = 'text' | 'image' | 'video' | 'audio'

/**
 * Minimal row shape we need from `public.skills`. Anything more (id,
 * created_at, etc.) is fine on the row but unused here.
 */
export interface SkillRow {
  id: string
  name: string
  description: string | null
  /** Full system prompt the model sees when this skill is active. */
  system_prompt: string
  /** 'all' | 'claude' | 'gpt' | 'gemini' (per the schema; free-form text). */
  engine?: string
  tags?: string[]
}

/**
 * Modality routing rule:
 *  • Text mode shows every skill that has a `text` tag, OR has NO media
 *    tag at all. The "no media tag" fallback exists so the 46+ specialty
 *    skills already in the catalogue (PDF Specialist, Frontend Designer,
 *    MCP Server Builder, …) keep working in chat without anyone having
 *    to backfill explicit `text` tags on every row.
 *  • Image / video / audio modes are strict — they only show skills
 *    explicitly tagged with that modality. Without that strictness
 *    every text-only skill would pollute the image-gen picker. */
const MEDIA_MODALITIES = new Set<SkillModality>(['image', 'video', 'audio'])

export function filterSkillsByModality(rows: SkillRow[], m: SkillModality): SkillRow[] {
  if (m === 'text') {
    return rows.filter(r => {
      const tags = r.tags ?? []
      if (tags.includes('text')) return true
      // If the row has NO media tag, treat it as text by default.
      return !tags.some(t => MEDIA_MODALITIES.has(t as SkillModality))
    })
  }
  return rows.filter(r => (r.tags ?? []).includes(m))
}

/* =====================================================================
   Picker option shape — what the composer's Skills chip consumes.
   ===================================================================== */

export interface SkillOption {
  id: string
  label: string
  description: string
  group?: string
}

/**
 * Adapt DB skill rows to picker options. The `group` field drives the
 * sectioning in the dropdown; we lift it from a recognised group tag
 * (one of `tone`, `format`, `reasoning`, `craft`, `media`) when present
 * so the 21 migrated overlays still bucket nicely. Otherwise we
 * fall back to the engine label so model-tuned curated skills are at
 * least grouped by family. */
const KNOWN_GROUP_TAGS = new Set([
  'tone',
  'format',
  'reasoning',
  'craft',
  'media',
  'overlay',
])

export function dbSkillsToOptions(rows: SkillRow[]): SkillOption[] {
  return rows.map(s => {
    const tags = s.tags ?? []
    // Prefer a recognised group tag (`tone`, `craft`, …); skip the
    // generic `overlay` umbrella unless it's the only option.
    const groupTag =
      tags.find(t => KNOWN_GROUP_TAGS.has(t) && t !== 'overlay') ??
      (tags.includes('overlay') ? 'overlay' : undefined)
    const group = groupTag
      ? (groupTag === 'overlay'
          ? 'overlay'
          : groupTag)
      : (s.engine && s.engine !== 'all' ? `library · ${s.engine}` : 'library')

    return {
      id: s.id,
      label: s.name,
      description: s.description?.trim() || (tags.length ? `#${tags.join(' #')}` : 'Skill'),
      group,
    }
  })
}

/* =====================================================================
   Prompt assembly — text chat vs media generation.
   ===================================================================== */

/**
 * Build the system-prompt block injected for text chat. We concatenate
 * each row's full `system_prompt` under a `### Name` header so multi-
 * paragraph prompts (the Anthropic-style document specialists, the
 * frontend-designer brief, …) keep their structure.
 *
 * The PREAMBLE is the critical part. Skill prompts contain "craftsmanship
 * defaults" (16:9 decks, neutral palettes, A4 PDFs, etc.) which are good
 * starting points but historically overrode whatever the user actually
 * asked for in the message. e.g. user types "make me a deck with dark
 * blue and gold colors" — the skill's "restrained palette" default
 * outranks the colour brief and the deck comes out neutral.
 *
 * The fix: we explicitly tell the model that the user's per-message
 * instructions take precedence over any defaults the skill specifies.
 * This keeps the skills useful as scaffolding while letting the user
 * steer styling without having to fight the prompt.
 *
 * Returns '' when no skills are active so callers can safely concatenate
 * unconditionally. */
export function buildSkillsBlock(rows: SkillRow[]): string {
  if (rows.length === 0) return ''
  const blocks = rows.map(s => `### ${s.name}\n${s.system_prompt.trim()}`)
  return [
    'Active skills — apply each in addition to your other instructions.',
    '',
    'PRECEDENCE: any explicit style, colour, format or content instructions',
    'in the user message OVERRIDE the defaults specified inside these',
    'skills. The skills supply scaffolding; the user supplies direction.',
    'When the user says "use dark blue and gold", the skill\'s "restrained',
    'palette" default does not apply — use dark blue and gold.',
    '',
    ...blocks,
  ].join('\n')
}

/**
 * Build the prompt prefix prepended to media-generation prompts. Image,
 * video and audio routes accept a single `prompt` string and respond
 * better to a tight directive than to a bulleted preamble — so we just
 * concatenate every active skill's `system_prompt` into one space-
 * separated string. Returns '' when nothing is active. */
export function buildSkillsPromptPrefix(rows: SkillRow[]): string {
  if (rows.length === 0) return ''
  return rows.map(s => s.system_prompt.trim()).join(' ') + ' '
}

/* =====================================================================
   Convenience: resolve an id list to rows (used by the composer to map
   the active-skill state into a row array we can hand to the builders).
   Unknown ids are silently dropped so a stale localStorage entry can't
   break submission. */
export function resolveSkills(rows: SkillRow[], ids: string[] | null | undefined): SkillRow[] {
  if (!ids || ids.length === 0) return []
  const set = new Set(ids)
  return rows.filter(r => set.has(r.id))
}

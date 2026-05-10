/**
 * Auto-detect which curated skills should be applied to a single chat
 * message based on what the user typed.
 *
 * Why this exists
 * ---------------
 * The /skills page lets users pin skills as always-on; but most of the time
 * a user just types "make me a pdf report" and would benefit from the PDF
 * Document Specialist prompt without ever opening the picker. This helper
 * matches the prompt against the catalogue's `tags` and a small phrase
 * map, and returns the most relevant skills so the chat composer can:
 *
 *   1. Inject those skills' system prompts into the request as a one-off
 *      boost (they do NOT get persisted to `user_skills`).
 *   2. Stamp the user message so the transcript can render a small badge
 *      ("Applied: HTML & CSS Crafter") above the user's bubble — exactly
 *      the affordance the user asked for in the spec.
 *
 * Strategy
 * --------
 * Two passes:
 *
 *   - DIRECT match: tokenise the prompt and look up each token against
 *     every skill's `tags`. A token is a lowercased a-z run plus digits
 *     and dashes, so "html" / "react" / "csv" / "powerpoint" all match.
 *
 *   - PHRASE map: cases where the natural word the user types isn't the
 *     same as the tag we'd want to fire. "Landing page" → tag `html`,
 *     "deck" or "slides" → tag `powerpoint`, "memo" or "white paper"
 *     → tag `pdf`. This is a tiny, hand-curated table; expand it as new
 *     skills land.
 *
 * Already-active skills are filtered out so we never double-apply, and
 * we cap the result at 3 to bound the per-message token cost (each
 * curated skill is a multi-paragraph system prompt).
 */

import type { DbSkill } from './hooks/useUserSkills'

/** Maps natural-language phrases to the skill `tags` they should fire. */
const PHRASE_TO_TAG: Array<{ patterns: RegExp[]; tag: string }> = [
  // Document family — natural words for each format.
  { patterns: [/\b(report|memo|white\s*paper|brief|whitepaper)\b/i],            tag: 'pdf' },
  { patterns: [/\b(presentation|deck|slide(?:s|deck)?)\b/i],                    tag: 'powerpoint' },
  { patterns: [/\b(spreadsheet|tabular|workbook)\b/i],                          tag: 'excel' },
  { patterns: [/\bword\s*doc(?:ument)?\b/i],                                    tag: 'word' },

  // Web / front-end.
  { patterns: [/\b(landing\s*page|web\s*page|webpage|website|static\s*site)\b/i], tag: 'html' },
  { patterns: [/\b(react\s*component|tsx\s*component|jsx\s*component)\b/i],     tag: 'react' },

  // Common engineering tasks.
  { patterns: [/\b(draft\s*(?:an?\s*)?email|reply\s*to\s*this\s*email)\b/i],    tag: 'email' },
  { patterns: [/\bcode\s*review\b/i],                                            tag: 'review' },
  { patterns: [/\b(sql\s*query|database\s*schema|select\s*from)\b/i],            tag: 'sql' },

  // Output-format hints.
  { patterns: [/\b(json\s*only|respond\s*in\s*json|valid\s*json)\b/i],           tag: 'json' },
  { patterns: [/\b(comparison\s*table|render.+table|markdown\s*table)\b/i],      tag: 'table' },
  { patterns: [/\b(brainstorm|come\s*up\s*with\s*ideas)\b/i],                    tag: 'brainstorm' },
]

/**
 * Detect skills that should auto-apply to a message. Skills the user already
 * has active are returned as an empty list (they're already in the active
 * set, no need to double-inject). Returns at most three skills, ranked by
 * how many tag overlaps they had — more specific matches win.
 */
export function detectAutoSkills(
  prompt: string,
  skills: DbSkill[],
  alreadyActiveIds: string[],
): DbSkill[] {
  if (!prompt.trim() || skills.length === 0) return []

  const triggeredTags = new Set<string>()

  // 1) Direct token-vs-tag match. Tokenise once for O(skills × tags) below.
  const tokens = new Set((prompt.toLowerCase().match(/[a-z][a-z0-9-]+/g) ?? []))
  for (const skill of skills) {
    for (const tag of skill.tags) {
      if (tokens.has(tag.toLowerCase())) triggeredTags.add(tag.toLowerCase())
    }
  }

  // 2) Phrase mapping for words that don't equal a tag verbatim.
  for (const { patterns, tag } of PHRASE_TO_TAG) {
    if (patterns.some(p => p.test(prompt))) triggeredTags.add(tag)
  }

  if (triggeredTags.size === 0) return []

  const activeSet = new Set(alreadyActiveIds)
  const matched: Array<{ skill: DbSkill; overlap: number }> = []

  for (const skill of skills) {
    if (activeSet.has(skill.id)) continue
    const overlap = skill.tags.filter(t => triggeredTags.has(t.toLowerCase())).length
    if (overlap > 0) matched.push({ skill, overlap })
  }

  // More-specific (more overlapping tags) wins; ties broken by name for
  // determinism (so the badge order is stable across rerenders).
  matched.sort((a, b) => {
    if (b.overlap !== a.overlap) return b.overlap - a.overlap
    return a.skill.name.localeCompare(b.skill.name)
  })

  return matched.slice(0, 3).map(m => m.skill)
}

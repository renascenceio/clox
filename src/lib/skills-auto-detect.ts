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

  // ── Anthropic Claude skills (seeded by migration 003) ────────────────
  // Each natural-language phrase maps to one of the catalogue tags so a
  // user typing "make me a poster" auto-fires Canvas Design without
  // having to know the skill's name.

  // Frontend Designer — UI prompts that aren't already caught by html/react.
  { patterns: [/\b(dashboard|hero\s*section|design\s*system|ui\s*kit)\b/i],     tag: 'frontend' },
  { patterns: [/\b(make\s*it\s*(?:look|feel)\s*(?:nice|good|polished|premium))\b/i], tag: 'design' },

  // Theme Factory — apply a visual theme to an existing artifact.
  { patterns: [/\b(apply\s*(?:a\s*)?theme|change\s*the\s*theme|theme\s*this|colour?\s*palette)\b/i], tag: 'theme' },

  // Brand Guidelines (Anthropic) — explicit Anthropic brand work.
  { patterns: [/\b(anthropic\s*brand|anthropic\s*colou?rs|anthropic\s*style|anthropic\s*identity)\b/i], tag: 'anthropic' },

  // Doc Co-author — substantial structured documents.
  { patterns: [/\b(prd|design\s*doc|decision\s*doc|rfc|technical\s*spec|spec\s*doc|proposal\s*doc)\b/i], tag: 'prd' },
  { patterns: [/\bproduct\s*requirements?\b/i],                                  tag: 'prd' },

  // Internal Communications — comms in idiomatic company formats.
  { patterns: [/\b(3p\s*update|progress[\s/]+plans[\s/]+problems)\b/i],          tag: 'internal' },
  { patterns: [/\b(company\s*newsletter|internal\s*newsletter|all[-\s]hands\s*update)\b/i], tag: 'newsletter' },
  { patterns: [/\b(faq\s*answer|status\s*report|leadership\s*update|incident\s*report)\b/i], tag: 'comms' },

  // Canvas Design — posters and static art pieces.
  { patterns: [/\b(poster|art\s*print|design\s*piece|art\s*movement|gallery\s*piece)\b/i], tag: 'poster' },

  // Algorithmic Art — generative / creative-coding work.
  { patterns: [/\b(generative\s*art|algorithmic\s*art|p5\.?js|flow\s*field|particle\s*system|creative\s*coding)\b/i], tag: 'generative' },

  // Slack GIF Creator — animated emoji / message GIFs.
  { patterns: [/\b(slack\s*gif|animated\s*emoji|emoji\s*gif|reaction\s*gif)\b/i], tag: 'gif' },
  // Plain "GIF" alone is too noisy ("animated GIF") — only fire when the
  // request is clearly about MAKING one, not embedding an existing one.
  { patterns: [/\b(make|create|build|design)\s+(?:an?\s+)?(?:animated\s+)?gif\b/i], tag: 'gif' },

  // Web Artifact Builder — substantial single-file React mini-apps.
  { patterns: [/\b(shadcn|self[-\s]contained\s*react|single[-\s]file\s*react|bundled\s*artifact)\b/i], tag: 'shadcn' },

  // MCP Server Builder.
  { patterns: [/\b(mcp\s*server|model\s*context\s*protocol|build\s*an?\s*mcp)\b/i], tag: 'mcp' },

  // Anthropic Product Knowledge — questions about Claude products.
  { patterns: [/\b(claude\.ai|claude\s*api|claude\s*code|claude\s*pro|claude\s*team|claude\s*enterprise|anthropic\s*pricing|claude\s*pricing|claude\s*rate\s*limits?)\b/i], tag: 'claude' },

  // Skill Author — meta: making more skills.
  { patterns: [/\b(create\s*(?:a\s*)?skill|author\s*(?:a\s*)?skill|add\s*(?:a\s*)?skill|skill\s*creator|skill\.md)\b/i], tag: 'skill' },
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

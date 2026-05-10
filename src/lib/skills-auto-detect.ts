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
  // Document family — natural words for each format. We include the
  // file-extension abbreviations (PPT, PPTX, DOCX, XLSX, PDF) explicitly
  // because users often say "make me a PPT" instead of "presentation",
  // and a bare token-vs-tag pass would miss it (the PPTX skill carries
  // tags `pptx, powerpoint, slides, …` but no `ppt`). Casing is handled
  // by the /i flag.
  { patterns: [/\b(report|memo|white\s*paper|brief|whitepaper|pdf\s*(?:doc|file|report)?)\b/i], tag: 'pdf' },
  { patterns: [/\b(presentation|deck|slide(?:s|deck)?|ppt|pptx|powerpoint|power\s*point)\b/i],  tag: 'powerpoint' },
  { patterns: [/\b(spreadsheet|tabular|workbook|xls|xlsx|excel\s*(?:sheet|file)?)\b/i],          tag: 'excel' },
  { patterns: [/\b(word\s*doc(?:ument)?|docx?|\.docx?)\b/i],                                     tag: 'word' },

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

  // ── Agentic file-handling skills (seeded by migration 004) ───────────
  // The new sandbox-backed skills both READ and WRITE files. The
  // creation-side phrases ("make me a PDF", "build a deck") already fire
  // via the base `pdf` / `powerpoint` / `excel` / `word` tags above —
  // these patterns specifically target READING / EXTRACTING / FILLING /
  // MERGING workflows so the right "read & write" skill picks itself.

  // Generic "read this file" — catches whichever uploaded type is present.
  { patterns: [/\b(read|parse|extract|summari[sz]e|analy[sz]e)\s+(?:this|the|my|attached)\s+(?:file|document|attachment)\b/i], tag: 'reading' },
  { patterns: [/\b(what(?:'s|\s+is|\s+does)\s+(?:in|this|the))\s+(?:file|pdf|spreadsheet|deck|document)\b/i], tag: 'reading' },
  { patterns: [/\bocr\b|\bscanned\s*(?:pdf|document)\b/i],                       tag: 'ocr' },

  // PDF-specific manipulation verbs.
  { patterns: [/\b(merge\s*pdfs?|split\s*(?:a\s*)?pdf|fill\s*(?:a\s*)?pdf\s*form|watermark\s*(?:a\s*)?pdf|encrypt\s*(?:a\s*)?pdf)\b/i], tag: 'pdf' },
  { patterns: [/\bextract\s+tables?\s+from\s+(?:the\s+)?pdf\b/i],                tag: 'pdf' },

  // Excel-specific verbs.
  { patterns: [/\b(pivot\s*table|sum(?:mari[sz]e)?\s*(?:this|the)\s*(?:sheet|workbook)|aggregate\s+(?:by|across))\b/i], tag: 'excel' },

  // PowerPoint-specific verbs.
  { patterns: [/\b(rebuild|update|edit|tweak)\s+(?:this|the|my)\s+(?:deck|presentation|slides?)\b/i], tag: 'powerpoint' },

  // Word-specific verbs.
  { patterns: [/\b(track\s*changes|insert\s*comment|reformat\s*(?:this|the)\s*doc)\b/i], tag: 'word' },
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

  // Cap at ONE auto-detected skill per turn.
  //
  // Earlier we returned up to 3, on the theory that "make me a PDF
  // landing page" should fire BOTH the PDF and HTML specialists. In
  // practice that stacked 4-6k tokens of overlapping prose into every
  // request: each document specialist is a multi-paragraph system
  // prompt, and a typical brief matches 2 of them. Combined with the
  // capabilities preamble (~3.5k tokens), a one-line user prompt
  // routinely landed at 8-10k input tokens and bounced off Anthropic
  // tier-1 Opus 4.6's 10k TPM ceiling.
  //
  // The single-best match is almost always the right one — the
  // overlap-count sort puts the most specific skill first, and skills
  // are written defensively enough that the runner-up's guidance is
  // either redundant or contradictory. If the user genuinely needs a
  // second skill they can pin it from /skills (those bypass this
  // helper entirely) or wait for Phase 2's lazy `read_skill` tool to
  // let the model fetch additional skills on demand. */
  return matched.slice(0, 1).map(m => m.skill)
}

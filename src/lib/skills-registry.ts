/**
 * Skills registry — a curated set of behavioural modifiers the user can
 * stack on top of any chat / generation request. Selecting a skill in the
 * composer pulls its `instructions` into the request:
 *
 *  - Text chat:    appended to the system prompt as an extra system block.
 *  - Image/video:  prepended to the prompt (so it influences composition).
 *  - Audio (TTS):  prepended as a delivery-style hint in the prompt.
 *
 * Keep instructions concise and self-contained — every selected skill
 * burns a few tokens on every request, so brevity matters. Skills are
 * purely additive: nothing here removes or contradicts the user's own
 * system prompt.
 *
 * `modalities` controls where the skill shows up in the picker. A skill
 * declared as `['text']` will not appear when the user is in image mode,
 * and vice-versa. Use `['text','image','video','audio']` for skills that
 * make sense everywhere (e.g. "creative", "formal").
 */

export type SkillModality = 'text' | 'image' | 'video' | 'audio'

export interface Skill {
  id: string
  label: string
  /** One-line description shown next to the label in the picker. */
  description: string
  /** Instruction fragment merged into the request. Phrase as a directive. */
  instructions: string
  /** Where this skill is offered. */
  modalities: SkillModality[]
  /** Optional grouping for the picker UI. */
  group?: 'tone' | 'reasoning' | 'format' | 'craft' | 'media'
}

export const SKILLS: Skill[] = [
  // ── reasoning / accuracy ──────────────────────────────────────────────
  {
    id: 'step-by-step',
    label: 'Step-by-step',
    description: 'Show reasoning explicitly, one step at a time.',
    instructions:
      'Work through the problem step by step. Number the steps. State assumptions before using them. End with a one-line conclusion.',
    modalities: ['text'],
    group: 'reasoning',
  },
  {
    id: 'cite-sources',
    label: 'Cite sources',
    description: 'Attach citations / links to factual claims.',
    instructions:
      'For every factual or quantitative claim, attach a citation in the form [n] and list the references at the end. If you do not have a verifiable source, say "unverified" instead of inventing one.',
    modalities: ['text'],
    group: 'reasoning',
  },
  {
    id: 'critique',
    label: 'Critic mode',
    description: 'Adversarial review — find weaknesses, not praise.',
    instructions:
      'Treat the user input as a draft to be critiqued. Identify the three weakest claims, structural problems, and missing evidence. Be specific. Do not soften the critique with compliments.',
    modalities: ['text'],
    group: 'reasoning',
  },
  {
    id: 'devils-advocate',
    label: "Devil's advocate",
    description: "Argue the opposite case as well as your own.",
    instructions:
      "After your primary answer, add a section titled 'Devil's advocate' that argues the strongest opposing case in good faith. Keep it shorter than the main answer.",
    modalities: ['text'],
    group: 'reasoning',
  },

  // ── tone ──────────────────────────────────────────────────────────────
  {
    id: 'concise',
    label: 'Concise',
    description: 'No preamble, no filler, no closing pleasantries.',
    instructions:
      'Be terse. No preamble, no filler phrases, no closing pleasantries, no restating the question. Aim for the shortest correct answer.',
    modalities: ['text', 'audio'],
    group: 'tone',
  },
  {
    id: 'formal',
    label: 'Formal',
    description: 'Professional register, complete sentences, no slang.',
    instructions:
      'Use a formal professional register. Complete sentences. No contractions, no slang, no emoji. Address the reader in third person where natural.',
    modalities: ['text', 'audio'],
    group: 'tone',
  },
  {
    id: 'plain-english',
    label: 'Plain English',
    description: 'Strip jargon. Aim for an 8th-grade reading level.',
    instructions:
      'Avoid jargon and acronyms; if a technical term is unavoidable, define it the first time you use it. Aim for an eighth-grade reading level. Prefer short sentences and concrete examples.',
    modalities: ['text', 'audio'],
    group: 'tone',
  },

  // ── format ────────────────────────────────────────────────────────────
  {
    id: 'bullets',
    label: 'Bullet points',
    description: 'Output as a tight bulleted list.',
    instructions:
      'Format the answer as a tight bulleted list. One idea per bullet. Avoid sub-bullets unless strictly hierarchical.',
    modalities: ['text'],
    group: 'format',
  },
  {
    id: 'json-only',
    label: 'JSON only',
    description: 'Reply with strictly valid JSON, no prose.',
    instructions:
      'Reply with strictly valid JSON only. No markdown fences, no prose before or after, no comments inside the JSON. If the user has not specified a schema, choose the most natural one and stick to it.',
    modalities: ['text'],
    group: 'format',
  },
  {
    id: 'table',
    label: 'Table',
    description: 'Where comparison helps, render a markdown table.',
    instructions:
      'When the answer involves comparison along two or more dimensions, render it as a markdown table. Otherwise reply normally.',
    modalities: ['text'],
    group: 'format',
  },

  // ── craft (writing/code) ──────────────────────────────────────────────
  {
    id: 'rewrite-clarity',
    label: 'Rewrite for clarity',
    description: 'Copy-edit pass: fix awkward phrasing, keep meaning.',
    instructions:
      "Treat the user's text as a draft. Return a rewritten version that preserves meaning and voice but fixes awkward phrasing, removes redundancy, and tightens sentence structure. List the most important changes briefly at the end.",
    modalities: ['text'],
    group: 'craft',
  },
  {
    id: 'code-review',
    label: 'Code review',
    description: 'Surface bugs, security issues, and perf problems.',
    instructions:
      'Treat code in the input as a pull request. Identify (a) correctness bugs, (b) security issues, (c) performance issues, (d) maintainability problems. Quote the offending lines. Suggest a concrete fix for each.',
    modalities: ['text'],
    group: 'craft',
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm',
    description: 'Produce 5–10 distinct angles, not one polished answer.',
    instructions:
      'Generate 5 to 10 distinct angles or options. Make them genuinely different from each other (not paraphrases). Keep each one to two sentences. Do not pick a winner unless asked.',
    modalities: ['text'],
    group: 'craft',
  },

  // ── media: image/video ────────────────────────────────────────────────
  {
    id: 'photorealistic',
    label: 'Photorealistic',
    description: 'Camera-realistic look, natural lighting, no illustration.',
    instructions:
      'Photorealistic. Sharp focus, natural lighting, plausible camera lens choice, real-world physics. Avoid illustrative or painterly rendering.',
    modalities: ['image', 'video'],
    group: 'media',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Anamorphic, 35mm look, motivated lighting, shallow DOF.',
    instructions:
      'Cinematic look. Anamorphic 2.39:1 framing instinct, 35mm lens feel, shallow depth of field, motivated lighting, gentle film grain. Composed shot, not casual snapshot.',
    modalities: ['image', 'video'],
    group: 'media',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Magazine-grade composition and colour palette.',
    instructions:
      'Editorial photography aesthetic. Magazine-grade composition, restrained colour palette, intentional negative space, subject treated with respect.',
    modalities: ['image', 'video'],
    group: 'media',
  },
  {
    id: 'minimalist',
    label: 'Minimalist',
    description: 'Strip the scene to essentials. Lots of negative space.',
    instructions:
      'Minimalist composition. Strip the scene to a single subject and one or two supporting elements. Generous negative space. Limited palette.',
    modalities: ['image', 'video'],
    group: 'media',
  },
  {
    id: 'illustrative',
    label: 'Illustrative',
    description: 'Hand-drawn / painted look rather than photo.',
    instructions:
      'Illustrative. Visible brush or line work, painted or drawn rather than photographic. Confident composition, expressive colour.',
    modalities: ['image'],
    group: 'media',
  },

  // ── media: audio ──────────────────────────────────────────────────────
  {
    id: 'warm-narration',
    label: 'Warm narration',
    description: 'Documentary VO: warm, measured, unhurried.',
    instructions:
      'Delivery: warm documentary narration. Measured pace, lower register, unhurried, light pauses between clauses.',
    modalities: ['audio'],
    group: 'media',
  },
  {
    id: 'news-anchor',
    label: 'News anchor',
    description: 'Crisp, neutral, broadcast-cadence delivery.',
    instructions:
      'Delivery: broadcast news anchor. Crisp articulation, neutral register, steady cadence, no rising inflections at the end of statements.',
    modalities: ['audio'],
    group: 'media',
  },
  {
    id: 'audiobook',
    label: 'Audiobook',
    description: 'Long-form reading: even pace, gentle character work.',
    instructions:
      'Delivery: audiobook reading. Even pace, gentle differentiation between characters in dialogue, natural breath, no over-acting.',
    modalities: ['audio'],
    group: 'media',
  },
]

/** Skills available for a given modality, in registry order. */
export function getSkillsForModality(m: SkillModality): Skill[] {
  return SKILLS.filter(s => s.modalities.includes(m))
}

/** Resolve a list of skill ids to skill records, dropping unknown ids. */
export function resolveSkills(ids: string[] | undefined | null): Skill[] {
  if (!ids || ids.length === 0) return []
  const set = new Set(ids)
  return SKILLS.filter(s => set.has(s.id))
}

/**
 * Build the merged instructions block for the selected skills. Returns an
 * empty string when nothing is selected so callers can safely concatenate
 * unconditionally. The block is wrapped with clear delimiters so it stands
 * apart from the user's own system prompt in the model's context.
 */
export function buildSkillsInstructions(ids: string[] | undefined | null): string {
  const resolved = resolveSkills(ids)
  if (resolved.length === 0) return ''
  const lines = resolved.map(s => `- ${s.label}: ${s.instructions}`)
  return [
    'Active skills (apply all of them in addition to any other instructions):',
    ...lines,
  ].join('\n')
}

/**
 * Compose a skills prefix suitable for prepending to a media generation
 * prompt. Shorter than the chat block — media providers respond better to
 * tight directives than to bulleted preambles.
 */
export function buildSkillsPromptPrefix(ids: string[] | undefined | null): string {
  const resolved = resolveSkills(ids)
  if (resolved.length === 0) return ''
  return resolved.map(s => s.instructions).join(' ') + ' '
}

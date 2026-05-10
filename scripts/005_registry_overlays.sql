-- ─── Migration 005 ─ behavioural overlays as DB skills ──────────────
-- Background:
-- Until 005, Clox had two parallel skill systems:
--   • A hard-coded TypeScript registry (`src/lib/skills-registry.ts`)
--     of 21 "overlays" — short directives like Step-by-step, Concise,
--     Cinematic — selectable in the chat composer.
--   • A DB-backed catalogue (`public.skills`) of curated long-form
--     skills, exposed on the /skills page and merged into the same
--     composer dropdown.
-- The split made /skills look incomplete (registry overlays missing)
-- and the composer dropdown look busier than /skills (overlays added).
-- It also caused subtle duplicates — `Concise` lived in both places.
--
-- This migration flattens the architecture: the 21 overlays move into
-- the same `public.skills` table the rest of the catalogue uses, with
-- modality encoded in `tags` (`text`, `image`, `video`, `audio`). The
-- accompanying TypeScript change deletes `skills-registry.ts` and
-- routes ALL surfaces — /skills page, chat composer, image gen page,
-- video gen page, audio gen page — through the same query.
--
-- Idempotent: every INSERT is guarded by WHERE NOT EXISTS by name, so
-- re-running this script (or running it on a DB where some of the
-- overlays were seeded earlier) is a safe no-op.

-- ── Reasoning / accuracy ─────────────────────────────────────────────
INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Step-by-step', 'Show reasoning explicitly, one step at a time.', 'all', NULL,
  'Work through the problem step by step. Number the steps. State assumptions before using them. End with a one-line conclusion.',
  ARRAY['overlay','reasoning','text'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Step-by-step');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Cite sources', 'Attach citations / links to factual claims.', 'all', NULL,
  'For every factual or quantitative claim, attach a citation in the form [n] and list the references at the end. If you do not have a verifiable source, say "unverified" instead of inventing one.',
  ARRAY['overlay','reasoning','text'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Cite sources');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Critic mode', 'Adversarial review — find weaknesses, not praise.', 'all', NULL,
  'Treat the user input as a draft to be critiqued. Identify the three weakest claims, structural problems, and missing evidence. Be specific. Do not soften the critique with compliments.',
  ARRAY['overlay','reasoning','text'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Critic mode');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT $$Devil's advocate$$, 'Argue the opposite case as well as your own.', 'all', NULL,
  $sp$After your primary answer, add a section titled "Devil's advocate" that argues the strongest opposing case in good faith. Keep it shorter than the main answer.$sp$,
  ARRAY['overlay','reasoning','text'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = $$Devil's advocate$$);

-- ── Tone ─────────────────────────────────────────────────────────────
INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Concise', 'No preamble, no filler, no closing pleasantries.', 'all', NULL,
  'Be terse. No preamble, no filler phrases, no closing pleasantries, no restating the question. Aim for the shortest correct answer.',
  ARRAY['overlay','tone','text','audio'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Concise');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Formal', 'Professional register, complete sentences, no slang.', 'all', NULL,
  'Use a formal professional register. Complete sentences. No contractions, no slang, no emoji. Address the reader in third person where natural.',
  ARRAY['overlay','tone','text','audio'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Formal');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Plain English', 'Strip jargon. Aim for an 8th-grade reading level.', 'all', NULL,
  'Avoid jargon and acronyms; if a technical term is unavoidable, define it the first time you use it. Aim for an eighth-grade reading level. Prefer short sentences and concrete examples.',
  ARRAY['overlay','tone','text','audio'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Plain English');

-- ── Format ───────────────────────────────────────────────────────────
INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Bullet points', 'Output as a tight bulleted list.', 'all', NULL,
  'Format the answer as a tight bulleted list. One idea per bullet. Avoid sub-bullets unless strictly hierarchical.',
  ARRAY['overlay','format','text'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Bullet points');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'JSON only', 'Reply with strictly valid JSON, no prose.', 'all', NULL,
  'Reply with strictly valid JSON only. No markdown fences, no prose before or after, no comments inside the JSON. If the user has not specified a schema, choose the most natural one and stick to it.',
  ARRAY['overlay','format','text'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'JSON only');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Table', 'Where comparison helps, render a markdown table.', 'all', NULL,
  'When the answer involves comparison along two or more dimensions, render it as a markdown table. Otherwise reply normally.',
  ARRAY['overlay','format','text'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Table');

-- ── Craft (writing/code) ─────────────────────────────────────────────
INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Rewrite for clarity', 'Copy-edit pass: fix awkward phrasing, keep meaning.', 'all', NULL,
  $sp$Treat the user's text as a draft. Return a rewritten version that preserves meaning and voice but fixes awkward phrasing, removes redundancy, and tightens sentence structure. List the most important changes briefly at the end.$sp$,
  ARRAY['overlay','craft','text'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Rewrite for clarity');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Code review', 'Surface bugs, security issues, and perf problems.', 'all', NULL,
  'Treat code in the input as a pull request. Identify (a) correctness bugs, (b) security issues, (c) performance issues, (d) maintainability problems. Quote the offending lines. Suggest a concrete fix for each.',
  ARRAY['overlay','craft','text'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Code review');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Brainstorm', 'Produce 5–10 distinct angles, not one polished answer.', 'all', NULL,
  'Generate 5 to 10 distinct angles or options. Make them genuinely different from each other (not paraphrases). Keep each one to two sentences. Do not pick a winner unless asked.',
  ARRAY['overlay','craft','text'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Brainstorm');

-- ── Media: image / video ─────────────────────────────────────────────
INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Photorealistic', 'Camera-realistic look, natural lighting, no illustration.', 'all', NULL,
  'Photorealistic. Sharp focus, natural lighting, plausible camera lens choice, real-world physics. Avoid illustrative or painterly rendering.',
  ARRAY['overlay','media','image','video'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Photorealistic');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Cinematic', 'Anamorphic, 35mm look, motivated lighting, shallow DOF.', 'all', NULL,
  'Cinematic look. Anamorphic 2.39:1 framing instinct, 35mm lens feel, shallow depth of field, motivated lighting, gentle film grain. Composed shot, not casual snapshot.',
  ARRAY['overlay','media','image','video'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Cinematic');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Editorial', 'Magazine-grade composition and colour palette.', 'all', NULL,
  'Editorial photography aesthetic. Magazine-grade composition, restrained colour palette, intentional negative space, subject treated with respect.',
  ARRAY['overlay','media','image','video'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Editorial');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Minimalist', 'Strip the scene to essentials. Lots of negative space.', 'all', NULL,
  'Minimalist composition. Strip the scene to a single subject and one or two supporting elements. Generous negative space. Limited palette.',
  ARRAY['overlay','media','image','video'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Minimalist');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Illustrative', 'Hand-drawn / painted look rather than photo.', 'all', NULL,
  'Illustrative. Visible brush or line work, painted or drawn rather than photographic. Confident composition, expressive colour.',
  ARRAY['overlay','media','image'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Illustrative');

-- ── Media: audio ─────────────────────────────────────────────────────
INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Warm narration', 'Documentary VO: warm, measured, unhurried.', 'all', NULL,
  'Delivery: warm documentary narration. Measured pace, lower register, unhurried, light pauses between clauses.',
  ARRAY['overlay','media','audio'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Warm narration');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'News anchor', 'Crisp, neutral, broadcast-cadence delivery.', 'all', NULL,
  'Delivery: broadcast news anchor. Crisp articulation, neutral register, steady cadence, no rising inflections at the end of statements.',
  ARRAY['overlay','media','audio'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'News anchor');

INSERT INTO public.skills (name, description, engine, source_url, system_prompt, tags, is_public)
SELECT 'Audiobook', 'Long-form reading: even pace, gentle character work.', 'all', NULL,
  'Delivery: audiobook reading. Even pace, gentle differentiation between characters in dialogue, natural breath, no over-acting.',
  ARRAY['overlay','media','audio'], true
WHERE NOT EXISTS (SELECT 1 FROM public.skills WHERE name = 'Audiobook');

-- ── Backfill modality tags on three pre-existing overlay-style rows
-- (Brainstorm, Concise, Plain English). They were seeded before the
-- modality-tag convention existed, so without these UPDATEs they would
-- be invisible to the new audio-mode picker. Setting tags explicitly
-- makes the rewrite idempotent — replays produce identical state. ──
UPDATE public.skills
   SET tags = ARRAY['craft','ideation','brainstorm','overlay','text']
 WHERE name = 'Brainstorm';

UPDATE public.skills
   SET tags = ARRAY['tone','brevity','overlay','text','audio']
 WHERE name = 'Concise';

UPDATE public.skills
   SET tags = ARRAY['tone','accessibility','writing','overlay','text','audio']
 WHERE name = 'Plain English';

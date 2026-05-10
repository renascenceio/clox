-- ─────────────────────────────────────────────────────────────────────
-- Migration 007 — User-brief-overrides-defaults guardrail.
--
-- Why
-- ---
-- The 6 file-handling skills (PDF/DOCX/XLSX/PPTX read+write, File Reading,
-- PDF Deep Reading) carry "craftsmanship defaults" sections — neutral
-- palettes, A4 margins, 16:9 decks, 11pt body, etc. Real symptom: a user
-- typed "make me a deck with dark blue and gold colours" and the model
-- followed the skill's "restrained palette" default instead of the user's
-- explicit colours. The deck came out neutral.
--
-- This migration prepends a PRECEDENCE paragraph to each skill's system
-- prompt. It tells the model in plain language that the user's per-message
-- instructions outrank the defaults. We complement this with a similar
-- preamble in lib/skills.ts so the same guardrail appears at TWO levels:
--
--   • The buildSkillsBlock preamble (covers every active skill, every model)
--   • The skill's own prompt (defence in depth — when the model is deep in
--     the skill's content the guardrail is still in view)
--
-- Idempotency
-- -----------
-- We guard with a sentinel substring ("PRECEDENCE"). Re-runs skip rows
-- that already contain it, so this script is safe to apply multiple times.
-- ─────────────────────────────────────────────────────────────────────

WITH guardrail AS (
  SELECT
    'PRECEDENCE'::text AS sentinel,
    E'PRECEDENCE: any explicit instructions in the user message — colours, '
    || E'fonts, layout, content focus, page count, file name, format — '
    || E'OVERRIDE the craftsmanship defaults below. Defaults are scaffolding, '
    || E'not requirements. If the user says "dark blue and gold", use dark '
    || E'blue and gold; if they say "single page", produce one page; if they '
    || E'say "no footer", drop the footer. Apply the defaults only for '
    || E'aspects the user did NOT specify.\n\n'
      AS preamble
)
UPDATE public.skills s
   SET system_prompt = (SELECT preamble FROM guardrail) || s.system_prompt
  FROM guardrail g
 WHERE s.name IN (
        'PDF (read & write)',
        'DOCX (read & write)',
        'XLSX (read & write)',
        'PPTX (read & write)',
        'File Reading',
        'PDF Deep Reading'
       )
   AND s.system_prompt NOT LIKE '%' || g.sentinel || '%';

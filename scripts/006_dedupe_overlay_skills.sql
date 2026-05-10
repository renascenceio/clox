-- Migration 006 — dedupe overlay skills.
--
-- Six skill pairs were sitting in `public.skills` with identical
-- `system_prompt` content but different names and tags:
--
--   ┌───────────────────────────┬───────────────────────────────────┐
--   │ Older (kept, 003-era)     │ Newer (deleted, 005-era)          │
--   ├───────────────────────────┼───────────────────────────────────┤
--   │ Step-by-step Reasoner     │ Step-by-step                      │
--   │ Bullet Points             │ Bullet points                     │
--   │ Critic Mode               │ Critic mode                       │
--   │ Devil's Advocate          │ Devil's advocate                  │
--   │ JSON Only                 │ JSON only                         │
--   │ Rewrite for Clarity       │ Rewrite for clarity               │
--   └───────────────────────────┴───────────────────────────────────┘
--
-- Strategy:
--   (1) Keep the older row's UUID — it's the one any in-flight
--       `user_skills` toggles point at, and `created_at` is older
--       so it'll naturally sort first in the catalogue.
--   (2) Rename it to the newer sentence-case form (better for picker
--       readability — "JSON only" reads better in a slash menu than
--       "JSON Only").
--   (3) Merge in the modality tags `overlay` and `text` so the
--       picker's `filterSkillsByModality()` still finds it. Tags
--       are deduped via `unnest` so re-runs are safe.
--   (4) Delete the newer duplicate. `user_skills.skill_id` is
--       `ON DELETE CASCADE`, so any stale toggles vanish silently.
--
-- Re-running this migration is a no-op: the UPDATEs are tolerant of
-- already-renamed rows, and the DELETE simply matches zero rows the
-- second time.

UPDATE public.skills
   SET name = 'Step-by-step',
       tags = ARRAY(SELECT DISTINCT unnest(tags || ARRAY['overlay','text']))
 WHERE id   = 'b68a737c-399d-48db-92e3-f0952e1514ab';

UPDATE public.skills
   SET name = 'Bullet points',
       tags = ARRAY(SELECT DISTINCT unnest(tags || ARRAY['overlay','text']))
 WHERE id   = 'c87b8777-c70a-4631-a8ff-42cfaf890c0b';

UPDATE public.skills
   SET name = 'Critic mode',
       tags = ARRAY(SELECT DISTINCT unnest(tags || ARRAY['overlay','text']))
 WHERE id   = 'db4e02d8-d283-4171-9599-124b541ed3f2';

UPDATE public.skills
   SET name = $$Devil's advocate$$,
       tags = ARRAY(SELECT DISTINCT unnest(tags || ARRAY['overlay','text']))
 WHERE id   = '35dfca3c-a611-444e-a873-6b176094d0fb';

UPDATE public.skills
   SET name = 'JSON only',
       tags = ARRAY(SELECT DISTINCT unnest(tags || ARRAY['overlay','text']))
 WHERE id   = '06e57e68-6dee-4991-b418-34f5e257d8b3';

UPDATE public.skills
   SET name = 'Rewrite for clarity',
       tags = ARRAY(SELECT DISTINCT unnest(tags || ARRAY['overlay','text']))
 WHERE id   = 'bf54f854-6d60-4744-8646-88328eeeee73';

DELETE FROM public.skills
 WHERE id IN (
   '1f4d9c45-a089-4616-a673-7d256bee8bef',  -- Step-by-step (newer)
   '30b4b5a2-0f89-4414-8720-1b21726829d1',  -- Bullet points (newer)
   '282ceadc-4fb9-4bf4-960e-d65ceb673df8',  -- Critic mode (newer)
   '2af955f5-2863-49c4-bea7-f408a7d4d06c',  -- Devil's advocate (newer)
   'ce8c210d-bb95-4c92-9f94-4aebe478f4cd',  -- JSON only (newer)
   '1549435b-c75a-457e-904c-7e00190eaac5'   -- Rewrite for clarity (newer)
 );

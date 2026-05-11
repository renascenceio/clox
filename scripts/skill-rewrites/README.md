# Document-skill quality system

This folder is the **single source of truth** for the document-producing
skill primers (PPTX, XLSX, PDF, DOCX). Every primer is a typed module
that composes a shared `Visual Quality Charter` (palette, typography,
spacing, decoration rules) with format-specific content (engine
selection, structural requirements, inspect/iterate recipes, failure-
mode playbook).

## Why this exists

Anthropic's on-disk skills under `/mnt/skills/skills/<name>/SKILL.md`
are intentionally generic recipe books — they describe the API surface
of python-pptx / openpyxl / reportlab / python-docx but make NO opinion
about visual quality. That's why "use the same Anthropic skill"
produced noticeably duller output here than on claude.ai — the missing
ingredient was the opinionated quality layer that turns competent code
into polished artifacts.

The DB primers in `skills` table now own that opinionated layer. Each
primer:

1. States the format's **purpose**.
2. Declares a **Visual Quality Charter** (concrete hex colours, type
   stack, spacing scale, mandatory decoration patterns) so the model
   doesn't have to guess.
3. Selects the **engine** (pptxgenjs vs python-pptx; openpyxl; reportlab
   vs pdfplumber; python-docx) and points at the **on-disk companion**
   in the snapshot for the recipe library.
4. Prescribes an **inspect-iterate workflow** so the model verifies
   the artifact before declaring success.
5. Lists the **failure modes** the model historically hits.

## Files

```
charter.ts                       ← shared header & footer
                                   (palette, type, spacing,
                                    decoration, on-disk bridge,
                                    failure-mode common section)
pptx.ts                          ← PPTX primer
xlsx.ts                          ← XLSX primer
pdf.ts                           ← PDF primer
docx.ts                          ← DOCX primer

(parent dir)
_apply-skill-rewrites.ts         ← pushes each primer into Supabase
                                   skills.system_prompt, idempotently
                                   guarded by a `charter-version: N`
                                   marker so re-runs are safe.
_verify-snapshot-engines.ts      ← regression harness: boots from the
                                   current SANDBOX_SKILLS_SNAPSHOT_ID
                                   and runs canned end-to-end snippets
                                   for each engine to prove the
                                   infrastructure works. 19 structural
                                   checks; should always be 19/19.
build-skills-snapshot.ts         ← rebuilds the sandbox snapshot
                                   (clones Anthropic skills repo,
                                   installs python deps, installs
                                   nodejs22 + pptxgenjs).
```

## Iteration loop

When tweaking a primer:

```bash
# 1. Bump the charter version in scripts/skill-rewrites/<format>.ts
#    (look for `CHARTER_VERSION = N`). This makes the idempotency
#    guard in _apply-skill-rewrites.ts re-apply.

# 2. Push to Supabase.
pnpm exec tsx scripts/_apply-skill-rewrites.ts

# 3. Make sure the snapshot infrastructure still works.
pnpm exec tsx scripts/_verify-snapshot-engines.ts

# 4. Use the live UI to generate one document per format and
#    spot-check. If a regression appears, the inspect-iterate
#    workflow inside the primer should catch it during generation;
#    if not, refine the primer and bump the version.
```

When rebuilding the snapshot itself (e.g. to upgrade a Python lib or
add a new system tool):

```bash
pnpm exec tsx scripts/build-skills-snapshot.ts
# → prints SANDBOX_SKILLS_SNAPSHOT_ID=snap_xxxxx
# → paste into Vercel project env vars; the manager picks it up
#   automatically on next /api/chat call.

# Always re-run the verification:
SANDBOX_SKILLS_SNAPSHOT_ID=snap_xxxxx pnpm exec tsx scripts/_verify-snapshot-engines.ts
```

## Charter versioning

Every primer ends with a hidden HTML comment:

```
<!-- charter-version: 1 -->
```

The apply script checks Supabase for the current marker. If the
in-DB version is the same as the script's, the UPDATE is a no-op.
If you bump the script's `CHARTER_VERSION`, the UPDATE rewrites the
whole primer. This makes the rewrite system safe to re-run
indefinitely.

## Coupling

- The python tool description in `src/lib/tools/sandbox-python.ts`
  used to carry verbose PPTX engine guidance; that has been moved
  into the PPTX primer. The python tool description now only
  describes the python tool itself (filesystem layout, timeouts,
  artifact emission), not format-specific quality rules. This keeps
  the system message lean for non-document chats.
- The auto-arm logic in `src/app/api/chat/route.ts` matches the
  user message against a keyword regex (xlsx/excel/pivot/pptx/deck
  /pdf/docx/word/csv/chart/graph) AND verifies that the catalogue
  contains a skill that mentions `/mnt/user-data/`. If both, it
  attaches the python+bash tools and bumps `maxTokens` to 16K so the
  model has room to both run the tool and write its prose
  explanation.

## Sanity checks

If a user reports "format X output looks bad":

1. Confirm `SANDBOX_SKILLS_SNAPSHOT_ID` env var is set and points at
   a recent snapshot.
2. Run `_verify-snapshot-engines.ts`. Must be 19/19.
3. Pull the primer text from Supabase and look at the
   `<!-- charter-version: N -->` marker — confirm it matches what's
   in this folder.
4. If both are current, the regression is in the model itself
   (e.g. routing to a weaker model) OR in the primer's instructions
   to the model. Reproduce in the live UI, look at the python tool
   call inputs to see what code the model wrote, and refine the
   primer.

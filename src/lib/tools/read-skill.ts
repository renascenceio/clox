/**
 * `read_skill` tool — let the model lazy-load a skill's full system
 * prompt by id, instead of having every catalog skill front-loaded
 * into the system message.
 *
 * Token-budget rationale
 * ----------------------
 * Eager loading every skill that auto-detect MIGHT match was the
 * single biggest contributor to our 10k-input-token-per-request
 * floor. Each document specialist (PDF, PPTX, DOCX, XLSX) is ~2k
 * tokens of multi-paragraph guidance, and a typical brief matches
 * 2-3 of them. By moving to a lazy `read_skill(id)` mechanism:
 *
 *   - The system prompt only carries a slim INDEX (~80 tokens per
 *     skill, ~2.4k for ~30 skills) — a one-line description that
 *     tells the model what each skill does.
 *   - When the model decides it actually needs (say) the Frontend
 *     Designer skill on top of the auto-detected PDF specialist,
 *     it calls `read_skill({skill_id: "uuid-..."})` and gets the
 *     full prompt back as a tool result.
 *   - Tool results are part of the conversation history that the
 *     provider's prompt cache reads on subsequent turns of the
 *     same chat — so the load is paid once, not every turn.
 *
 * Factory pattern
 * ---------------
 * The tool needs access to the catalog Map that the route's
 * `loadSkillCatalog()` call returns; we close over it in a factory
 * so the tool body can do an O(1) lookup without touching the
 * database. (The database fetch already happened at the top of the
 * request.) */

import { tool } from 'ai'
import { z } from 'zod'

import type { SkillFull } from '@/lib/skills-index'

export function makeReadSkillTool(catalog: Map<string, SkillFull>) {
  return tool({
    description: [
      'Load the full system prompt for a skill in the Clox skills catalogue,',
      'identified by its uuid `skill_id`. Use this when the active skill set',
      'and the slim "Available skills" index in your system prompt show that',
      'a different specialist (PDF Document Specialist, Frontend Designer,',
      'Brainstormer, Skill Author, …) would help with the current request.',
      'Returned text is authoritative for the rest of this turn — apply its',
      "instructions in addition to the active skills'. NEVER call this for a",
      'skill whose id is not in the index — the call will fail. Avoid loading',
      'speculatively; one extra skill costs ~2k tokens.',
    ].join(' '),
    parameters: z.object({
      skill_id: z
        .string()
        .min(1)
        .describe(
          'The uuid of the skill to load, copied verbatim from the ' +
            '"Available skills" index in your system prompt.',
        ),
    }),
    execute: async ({ skill_id }) => {
      const hit = catalog.get(skill_id)
      if (!hit) {
        // Returning a structured error (rather than throwing) lets the
        // model recover gracefully — it can ask the user for
        // clarification, or pick a different id from the index.
        return {
          error:
            `No skill found with id "${skill_id}". Re-check the "Available ` +
            'skills" index in your system prompt; only ids that appear there ' +
            'are loadable.',
          available_count: catalog.size,
        }
      }
      // We return a structured envelope (not a bare string) so the
      // transcript renderer can show "Loaded skill: <name>" instead
      // of dumping the entire prompt into the visible UI.
      return {
        loaded: hit.name,
        description: hit.description,
        system_prompt: hit.system_prompt,
      }
    },
  })
}

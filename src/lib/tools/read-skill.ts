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
    // Compressed late 2026: was ~1.6 KB of explanatory prose about
    // WHY speculative loads are expensive; the model just needs the
    // contract (id-from-index, one-at-a-time, ask-if-ambiguous).
    description: [
      'Load a skill\'s full system prompt by uuid `skill_id` (from the',
      '"Available skills" index in your system prompt). Returned text is',
      'authoritative for the rest of the turn. Fails if the id is not in',
      'the index.',
      '',
      'Load at most ONE skill per turn. Each call ships ~2k input tokens',
      'and counts against the provider\'s per-minute quota — three',
      'speculative loads can rate-limit the turn before any output streams.',
      'If the user listed multiple formats without a topic/audience/brief,',
      'ASK for clarification first (no tools, no loads). Once the primary',
      'deliverable is clear, load ONE matching specialist; additional ones',
      'across subsequent turns get amortised by the prompt cache.',
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

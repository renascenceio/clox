/**
 * Apply the four rewritten doc primers to the `skills` table.
 *
 * Idempotency: each rewritten primer carries a
 * "<!-- charter-version: N -->" marker as its first line. We only
 * UPDATE if the existing row's marker is missing OR carries an
 * older version. Re-running this script with the same
 * CHARTER_VERSION is a no-op. Bumping CHARTER_VERSION in charter.ts
 * and re-running re-deploys all four.
 *
 * No deletes — only string replacement on `system_prompt`. The
 * `tags` and `description` columns are left intact.
 *
 * Usage:
 *   pnpm exec tsx scripts/_apply-skill-rewrites.ts
 */
import { createClient } from '@supabase/supabase-js'
import { CHARTER_VERSION } from './skill-rewrites/charter'
import { DATA_PROMPT } from './skill-rewrites/data'
import { DOCX_PROMPT } from './skill-rewrites/docx'
import { PDF_PROMPT } from './skill-rewrites/pdf'
import { PPTX_PROMPT } from './skill-rewrites/pptx'
import { XLSX_PROMPT } from './skill-rewrites/xlsx'

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env')
  process.exit(1)
}
const sb = createClient(url, key)

// (name in DB, prompt body). The DB names are stable (used by
// `read_skill` lookups) — we never rename, only replace content.
const TARGETS: Array<{ name: string; prompt: string; description?: string }> = [
  {
    name: 'PPTX (read & write)', prompt: PPTX_PROMPT,
    description: 'Designer-grade, fully editable PowerPoint decks (native charts, speaker notes, 7 themes incl. electric) built with clox_kit; also reads existing decks.',
  },
  {
    name: 'XLSX (read & write)', prompt: XLSX_PROMPT,
    description: 'Finished-looking Excel workbooks — KPI summary, styled tables, live formulas, data bars and native charts — built with clox_kit; also reads workbooks.',
  },
  {
    name: 'PDF (read & write)', prompt: PDF_PROMPT,
    description: 'Designed PDF reports and briefs with embedded fonts, themed charts and tables (clox_kit), plus reading, splitting, merging and form-filling existing PDFs.',
  },
  {
    name: 'DOCX (read & write)', prompt: DOCX_PROMPT,
    description: 'Word documents with real styles, themed tables and chart images; also reads paragraphs, tables, comments and tracked changes.',
  },
]

// Skills that may not exist yet — inserted on first run.
const NEW_SKILLS: Array<{ name: string; prompt: string; description: string; tags: string[] }> = [
  {
    name: 'Data analysis (CSV & Excel)',
    prompt: DATA_PROMPT,
    description: 'Fast, exact analysis of uploaded CSV / Excel / JSON files (cleaning, grouping, trends) with answers backed by printed numbers, delivered as text, a workbook, a PDF brief or a deck.',
    tags: ['csv', 'data', 'analysis', 'dataset', 'pandas', 'statistics'],
  },
]

// Parses the leading "<!-- charter-version: N -->" marker. Returns
// 0 if absent (i.e. legacy primer, definitely needs an update).
function existingVersion(prompt: string): number {
  const m = prompt.match(/^<!-- charter-version: (\d+) -->/)
  return m ? Number(m[1]) : 0
}

async function main() {
  console.log('charter version (this build):', CHARTER_VERSION)

  for (const s of NEW_SKILLS) {
    const { data: row } = await sb.from('skills').select('id').eq('name', s.name).maybeSingle()
    if (row) {
      TARGETS.push({ name: s.name, prompt: s.prompt, description: s.description })
      continue
    }
    const { error } = await sb.from('skills').insert({
      name: s.name,
      description: s.description,
      system_prompt: s.prompt,
      tags: s.tags,
      engine: 'all',
      is_public: true,
      created_by: null,
    })
    console.log(error ? `✗ ${s.name}: insert failed — ${error.message}` : `+ ${s.name}: inserted (${s.prompt.length} chars)`)
  }

  for (const { name, prompt, description } of TARGETS) {
    const { data, error } = await sb
      .from('skills')
      .select('id, system_prompt')
      .eq('name', name)
      .single()
    if (error || !data) {
      console.error(`✗ ${name}: not found in DB —`, error?.message ?? 'no row')
      continue
    }
    const current = existingVersion(data.system_prompt)
    if (current >= CHARTER_VERSION) {
      console.log(`= ${name}: already at v${current} (skip)`)
      continue
    }
    const { error: upErr } = await sb
      .from('skills')
      .update(description ? { system_prompt: prompt, description } : { system_prompt: prompt })
      .eq('id', data.id)
    if (upErr) {
      console.error(`✗ ${name}: update failed —`, upErr.message)
      continue
    }
    console.log(`✓ ${name}: v${current} → v${CHARTER_VERSION} (${prompt.length} chars)`)
  }
}

void main().catch(e => { console.error(e); process.exit(1) })

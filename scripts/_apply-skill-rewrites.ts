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
const TARGETS: Array<{ name: string; prompt: string }> = [
  { name: 'PPTX (read & write)', prompt: PPTX_PROMPT },
  { name: 'XLSX (read & write)', prompt: XLSX_PROMPT },
  { name: 'PDF (read & write)',  prompt: PDF_PROMPT },
  { name: 'DOCX (read & write)', prompt: DOCX_PROMPT },
]

// Parses the leading "<!-- charter-version: N -->" marker. Returns
// 0 if absent (i.e. legacy primer, definitely needs an update).
function existingVersion(prompt: string): number {
  const m = prompt.match(/^<!-- charter-version: (\d+) -->/)
  return m ? Number(m[1]) : 0
}

async function main() {
  console.log('charter version (this build):', CHARTER_VERSION)

  for (const { name, prompt } of TARGETS) {
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
      .update({ system_prompt: prompt })
      .eq('id', data.id)
    if (upErr) {
      console.error(`✗ ${name}: update failed —`, upErr.message)
      continue
    }
    console.log(`✓ ${name}: v${current} → v${CHARTER_VERSION} (${prompt.length} chars)`)
  }
}

void main().catch(e => { console.error(e); process.exit(1) })

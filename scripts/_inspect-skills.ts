/**
 * Throwaway snapshot inspector — uses `Sandbox.create` the SAME way
 * production does (`source: { type: 'snapshot', snapshotId }`, NOT
 * the legacy `snapshotId` top-level prop), so what we see here is
 * what the model sees in production. Verifies /mnt/skills/skills/
 * is populated AND probes whether Node is installable on AL2023
 * (driving plan section 3.2).
 */
import { Sandbox } from '@vercel/sandbox'

async function main() {
  const snapshotId = process.env.SANDBOX_SKILLS_SNAPSHOT_ID
  if (!snapshotId) throw new Error('SANDBOX_SKILLS_SNAPSHOT_ID not set')
  console.log('snapshotId:', snapshotId)

  const s = await Sandbox.create({
    runtime: 'python3.13',
    timeout: 8 * 60 * 1000,
    source: { type: 'snapshot', snapshotId },
  })
  try {
    const probes = [
      'ls /mnt/skills/ 2>&1',
      'ls /mnt/skills/skills/ 2>&1',
      'ls /mnt/skills/skills/pptx/ 2>&1',
      'wc -l /mnt/skills/skills/pptx/SKILL.md /mnt/skills/skills/xlsx/SKILL.md /mnt/skills/skills/pdf/SKILL.md 2>&1',
      'find /mnt/skills/skills -name "*.md" -maxdepth 3 2>&1',
      'which node npm 2>&1 || echo "(node/npm not preinstalled)"',
      'sudo dnf list available nodejs npm 2>&1 | head -10',
      'sudo dnf list available nodejs20 nodejs22 2>&1 | head -10',
    ]
    for (const cmd of probes) {
      console.log('\n=== ' + cmd + ' ===')
      const r = await s.runCommand({ cmd: 'sh', args: ['-lc', cmd] })
      console.log((await r.stdout()).slice(0, 2000))
      const err = (await r.stderr()).slice(0, 800)
      if (err) console.log('STDERR:', err)
    }
  } finally {
    await s.stop()
  }
}
void main().catch(e => { console.error(e); process.exit(1) })

import { Sandbox } from '@vercel/sandbox'
async function main() {
  const s = await Sandbox.create({
    runtime: 'python3.13',
    timeout: 5 * 60 * 1000,
    networkPolicy: 'allow-all',
    snapshotId: process.env.SANDBOX_SKILLS_SNAPSHOT_ID!,
  })
  try {
    for (const q of [
      'ls /mnt/skills/skills/',
      'ls /mnt/skills/skills/xlsx/',
      'wc -l /mnt/skills/skills/xlsx/SKILL.md /mnt/skills/skills/pptx/SKILL.md /mnt/skills/skills/pdf/SKILL.md',
      'ls /mnt/skills/skills/xlsx/scripts/ 2>/dev/null',
      'ls /mnt/skills/skills/pptx/scripts/ 2>/dev/null',
      'ls /mnt/skills/skills/pdf/ 2>/dev/null',
      'find /mnt/skills/skills -name "*.md" | head -40',
    ]) {
      console.log('=== '+q+' ===')
      const r = await s.runCommand({ cmd: 'sh', args: ['-lc', q] })
      console.log(await r.stdout())
    }
  } finally { await s.stop() }
}
void main()

/**
 * Adds the clox font library to the skills snapshot — run after the
 * catalogue changes (scripts/fonts/build-catalogue.py):
 *
 *   set -a; . /vercel/share/.env.project; set +a
 *   pnpm exec tsx scripts/add-font-library.ts
 *
 * Boots from the current SANDBOX_SKILLS_SNAPSHOT_ID (everything the chats
 * already have), installs the text-shaping packages, downloads every
 * library family into /opt/clox-fonts (~250 MB, CJK included), proves an
 * Arabic + Japanese PDF renders with nothing fetched, then snapshots.
 * Prints the new id; the old snapshot keeps working until it is replaced.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { Sandbox } from '@vercel/sandbox'

const FONT_DIR = '/opt/clox-fonts'
const KIT_ROOT = '/tmp/clox-build'
const SHAPING_PACKAGES = ['uharfbuzz', 'fonttools', 'arabic-reshaper', 'python-bidi']

const log: string[] = []
const say = (s: string) => {
  log.push(s)
  console.log(s)
  writeFileSync('/tmp/font-snapshot.log', log.join('\n'))
}

async function kitFiles(dir: string, rel: string): Promise<{ path: string; content: Buffer }[]> {
  const out: { path: string; content: Buffer }[] = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === '__pycache__' || e.name.startsWith('.')) continue
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await kitFiles(abs, `${rel}/${e.name}`)))
    else if (/\.(py|ttf|txt)$/.test(e.name)) out.push({ path: `${KIT_ROOT}/${rel}/${e.name}`, content: await readFile(abs) })
  }
  return out
}

async function run(s: Sandbox, label: string, script: string) {
  say(`[fonts] ${label}…`)
  const r = await s.runCommand({ cmd: 'sh', args: ['-lc', script] })
  const out = (await r.stdout()).trim()
  if (out) say(out.split('\n').slice(-12).join('\n'))
  if (r.exitCode !== 0) throw new Error(`${label} → exit ${r.exitCode}\n${(await r.stderr()).slice(-3000)}`)
  return out
}

const SMOKE = `
import os, time
os.environ["CLOX_FONTS"] = "/tmp/clox-smoke-cache"
from clox_kit import Deck
t = time.time()
d = Deck("/tmp/smoke/multi", new=True, pdf=False)
d.cover("دبي مقابل أبوظبي", "دليل المستثمر", kicker="تقرير")
d.bullets("東京とドバイの比較", ["東京の平均賃貸利回りは約3.5パーセント", "円安で関心が高まっている"])
d.kpis("Рынок в цифрах", [("7,2%", "доходность"), ("+18%", "рост цен")])
d.statement("서울 부동산 시장은 안정적입니다")
d.save(); d.pdf(quiet=True)
fetched = os.listdir("/tmp/clox-smoke-cache") if os.path.isdir("/tmp/clox-smoke-cache") else []
assert not fetched, f"fonts were downloaded: {fetched}"
print("smoke ok", os.path.getsize("/tmp/smoke/multi.pdf"), "bytes", round(time.time() - t, 1), "s")
`

async function main() {
  const base = process.env.SANDBOX_SKILLS_SNAPSHOT_ID
  if (!base) throw new Error('SANDBOX_SKILLS_SNAPSHOT_ID is not set')
  say(`[fonts] booting from ${base}…`)
  const sandbox = await Sandbox.create({
    source: { type: 'snapshot', snapshotId: base },
    timeout: 30 * 60 * 1000,
    networkPolicy: 'allow-all',
  })
  try {
    await sandbox.writeFiles(await kitFiles(path.join(process.cwd(), 'sandbox-kit', 'clox_kit'), 'clox_kit'))
    await run(sandbox, 'pip install shaping packages',
      `python3 -m pip install --quiet --disable-pip-version-check ${SHAPING_PACKAGES.join(' ')} && ` +
      `python3 -c "import uharfbuzz, fontTools, arabic_reshaper, bidi; print('shaping ok', uharfbuzz.__version__)"`)
    await run(sandbox, `download library into ${FONT_DIR}`,
      `sudo mkdir -p ${FONT_DIR} && sudo chown -R "$(id -u):$(id -g)" ${FONT_DIR} && ` +
      `PYTHONPATH=${KIT_ROOT} python3 -c "from clox_kit import library; print('files', library.download('${FONT_DIR}'))" 2>&1 | tail -5 && ` +
      `du -sh ${FONT_DIR} && ls ${FONT_DIR} | wc -l`)
    await sandbox.writeFiles([{ path: '/tmp/smoke.py', content: Buffer.from(SMOKE, 'utf8') }])
    await run(sandbox, 'render Arabic/Japanese/Cyrillic/Korean deck offline',
      `cd /tmp && PYTHONPATH=${KIT_ROOT} CLOX_FONT_LIBRARY=${FONT_DIR} python3 /tmp/smoke.py`)
    await run(sandbox, 'clean build files', `rm -rf ${KIT_ROOT} /tmp/smoke /tmp/smoke.py /tmp/clox-smoke-cache ~/.clox`)

    say('[fonts] taking snapshot…')
    const snap = await sandbox.snapshot({ expiration: 0 })
    say(`SANDBOX_SKILLS_SNAPSHOT_ID=${snap.snapshotId}`)
  } catch (e) {
    say(`[fonts] failed: ${(e as Error).message}`)
    try { await sandbox.stop() } catch { /* already stopped */ }
    process.exit(1)
  }
}

void main()

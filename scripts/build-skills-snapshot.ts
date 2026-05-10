/**
 * Snapshot bootstrap — one-time script. Run it once with
 * `pnpm tsx scripts/build-skills-snapshot.ts` from a machine with a
 * valid `VERCEL_OIDC_TOKEN` (typically: `vercel link` + `vercel env
 * pull` first), then paste the printed `SANDBOX_SKILLS_SNAPSHOT_ID`
 * into the project's environment variables on Vercel.
 *
 * What it does:
 *   1. Spin up a fresh `python3.13` sandbox with PyPI/GitHub allowed
 *      so we can clone and pip-install.
 *   2. `git clone https://github.com/anthropics/skills` → /mnt/skills.
 *   3. `pip install` the union of every Python dep used across the
 *      skills (we install eagerly so individual chats never hit a
 *      cold install during a tool call).
 *   4. Create the `/mnt/user-data/{uploads,outputs}` dirs the runtime
 *      relies on.
 *   5. `sandbox.snapshot()` → prints the snapshotId.
 *
 * Re-running is safe: each run produces a new snapshot id. The old
 * one keeps working until it expires (default 30 days).
 *
 * Cost: this runs once per skill-bundle update. The created snapshot
 * lives on Vercel storage; per-chat sandboxes restoring from it is
 * the only ongoing expense.
 */

import { Sandbox } from '@vercel/sandbox'

/** Single source of truth for which Python packages every Anthropic
 *  skill might need. Pinned to the latest stable as of when this
 *  script was written; bump and re-run when upstream skills add deps.
 *  Listing them all in one `pip install` lets pip resolve the
 *  dependency graph in a single pass. */
const PYTHON_PACKAGES: string[] = [
  // PDF — pdf, pdf-reading, file-reading skills.
  'pypdf>=4.0',
  'pdfplumber>=0.11',
  'reportlab>=4.0',
  'pdf2image>=1.17',
  // Office — docx, xlsx, pptx skills.
  'python-docx>=1.1',
  'openpyxl>=3.1',
  'python-pptx>=1.0',
  // Image / GIF — slack-gif-creator, canvas-design, algorithmic-art.
  'pillow>=10',
  'imageio>=2.34',
  // OCR — pdf-reading, file-reading.
  'pytesseract>=0.3',
  // Markdown / HTML pipelines — pdf, doc-coauthoring.
  'markdownify>=0.13',
  'weasyprint>=62',
  'beautifulsoup4>=4.12',
  // Numerics — algorithmic-art, xlsx, occasional analysis.
  'numpy>=1.26',
  'pandas>=2.2',
]

const SKILLS_REPO_URL    = 'https://github.com/anthropics/skills.git'
const SKILLS_CLONE_DEPTH = 1

async function main() {
  console.log('[snapshot] creating bootstrap sandbox…')
  const sandbox = await Sandbox.create({
    runtime: 'python3.13',
    timeout: 30 * 60 * 1000,
    // Allow the URLs we need for clone + install. Once the snapshot
    // is taken every per-chat sandbox can run with a tighter network
    // policy because everything is already on disk.
    networkPolicy: 'allow-all',
  })

  try {
    // 1. Conventional folders.
    console.log('[snapshot] creating /mnt/user-data/{uploads,outputs}…')
    await runOrThrow(sandbox, 'sh', ['-lc', 'mkdir -p /mnt/user-data/uploads /mnt/user-data/outputs'])

    // 2. Clone the skills repo.
    console.log(`[snapshot] cloning ${SKILLS_REPO_URL}…`)
    await runOrThrow(sandbox, 'git', [
      'clone', '--depth', String(SKILLS_CLONE_DEPTH),
      SKILLS_REPO_URL, '/mnt/skills',
    ])

    // 3. System tools each skill might shell out to. apt-get is fine
    //    here because the sandbox is privileged during bootstrap; the
    //    snapshot captures the resulting filesystem so per-chat
    //    sandboxes see them without root.
    console.log('[snapshot] apt-get install poppler-utils tesseract-ocr libreoffice imagemagick…')
    await runOrThrow(sandbox, 'sh', ['-lc',
      'sudo apt-get update -qq && sudo apt-get install -y -qq ' +
      'poppler-utils tesseract-ocr libreoffice imagemagick',
    ])

    // 4. Python deps.
    console.log('[snapshot] pip install (this is the slow part)…')
    await runOrThrow(sandbox, 'sh', ['-lc',
      `python3 -m pip install --upgrade pip && python3 -m pip install ${PYTHON_PACKAGES.map(quote).join(' ')}`,
    ])

    // 5. Smoke test — make sure the headline imports actually work.
    console.log('[snapshot] verifying imports…')
    await runOrThrow(sandbox, 'python3', ['-c',
      'import pypdf, pdfplumber, openpyxl, docx, pptx, PIL, imageio, pandas, numpy, weasyprint; print("ok")',
    ])

    // 6. Snapshot.
    console.log('[snapshot] taking snapshot (this stops the bootstrap sandbox)…')
    const snap = await sandbox.snapshot({ expiration: 0 /* never expire */ })
    console.log('')
    console.log('==================================================================')
    console.log(' SANDBOX_SKILLS_SNAPSHOT_ID = ' + snap.snapshotId)
    console.log('==================================================================')
    console.log(' Add the value above to your Vercel project env vars (Production')
    console.log(' + Preview) so /api/chat boots per-chat sandboxes from it.')
    console.log('')
  } catch (e) {
    console.error('[snapshot] failed:', e)
    try { await sandbox.stop() } catch { /* swallow */ }
    process.exit(1)
  }
}

async function runOrThrow(s: Sandbox, cmd: string, args: string[]) {
  const r = await s.runCommand({ cmd, args })
  if (r.exitCode !== 0) {
    const stderr = await r.stderr()
    const stdout = await r.stdout()
    throw new Error(
      `${cmd} ${args.join(' ')} → exit ${r.exitCode}\nstderr:\n${stderr}\nstdout:\n${stdout}`,
    )
  }
}

/** Defensive shell-quote — pin specifiers contain `>=` etc. which sh
 *  treats fine inside single quotes. */
function quote(s: string) { return `'${s.replace(/'/g, `'\\''`)}'` }

void main()

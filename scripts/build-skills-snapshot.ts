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
  // Note: `pdf2image` is omitted on purpose. It wraps `pdftoppm`
  // from poppler, which isn't packaged for AL2023; installing the
  // Python wrapper without the binary would just give the model a
  // confusing import-succeeds-but-runtime-fails footgun.
  'pypdf>=4.0',
  'pdfplumber>=0.11',
  'reportlab>=4.0',
  // Office — docx, xlsx, pptx skills. All pure-Python, no system
  // deps. THIS is what makes the pptx skill work end-to-end.
  'python-docx>=1.1',
  'openpyxl>=3.1',
  'python-pptx>=1.0',
  // Image / GIF — slack-gif-creator, canvas-design, algorithmic-art.
  'pillow>=10',
  'imageio>=2.34',
  // Markdown / HTML pipelines — pdf, doc-coauthoring.
  // `weasyprint` is omitted: it needs pango/cairo/gdk-pixbuf at
  // runtime, which AL2023 doesn't ship, so its PDF output would
  // crash with "no library called cairo". `markdownify` +
  // `beautifulsoup4` are pure-Python and stay in.
  'markdownify>=0.13',
  'beautifulsoup4>=4.12',
  // PDF post-processing fallback. `pikepdf` is libqpdf bindings
  // and AL2023 DOES ship qpdf (installed above), so this works.
  'pikepdf>=8.0',
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
    //    `/mnt` itself is root-owned in Vercel Sandbox base images, so
    //    every write under it has to go through `sudo`. We chown the
    //    created folders back to the sandbox user so non-privileged
    //    runtime code (the per-chat python tool) can write outputs.
    console.log('[snapshot] creating /mnt/user-data/{uploads,outputs}…')
    await runOrThrow(sandbox, 'sh', ['-lc',
      'sudo mkdir -p /mnt/user-data/uploads /mnt/user-data/outputs && ' +
      'sudo chown -R "$(id -u):$(id -g)" /mnt/user-data',
    ])

    // 2. Clone the skills repo.
    //    `git clone` into `/mnt/skills` needs root too (same reason as
    //    above), but `git` itself runs fine as non-root once the
    //    target directory exists and is owned by the sandbox user.
    //    Pre-create + chown, then clone into the prepared directory.
    console.log(`[snapshot] cloning ${SKILLS_REPO_URL}…`)
    await runOrThrow(sandbox, 'sh', ['-lc',
      'sudo mkdir -p /mnt/skills && ' +
      'sudo chown -R "$(id -u):$(id -g)" /mnt/skills',
    ])
    await runOrThrow(sandbox, 'git', [
      'clone', '--depth', String(SKILLS_CLONE_DEPTH),
      SKILLS_REPO_URL, '/mnt/skills',
    ])

    // 3. System tools each skill might shell out to.
    //
    //    Vercel Sandbox runs on Amazon Linux 2023, whose default repo
    //    is intentionally minimal. We tried `tesseract`, `libreoffice`,
    //    and `poppler-utils` and only the last one is even searchable;
    //    the first two are simply not packaged. EPEL/Fedora overlays
    //    are unsupported on AL2023 and tend to break glibc.
    //
    //    Strategy: install only what AL2023 ACTUALLY ships, treat
    //    every package as best-effort, and rely on the pure-Python
    //    pip deps (pypdf, pdfplumber, python-pptx, python-docx,
    //    openpyxl, weasyprint, reportlab, pillow) for everything
    //    else. For PPTX specifically this is sufficient — the
    //    Anthropic pptx skill is pure python-pptx and needs no
    //    system binaries. The capabilities we knowingly skip:
    //      - tesseract (OCR)         → pytesseract becomes a no-op,
    //                                  but no skill MUST OCR to
    //                                  succeed; image skills still
    //                                  render fine.
    //      - libreoffice (soffice)   → cross-format conversion
    //                                  (PPTX↔PDF↔DOCX) won't work;
    //                                  the model has to emit the
    //                                  target format directly.
    //      - poppler (pdftoppm)      → pdf2image won't rasterise;
    //                                  pdfplumber's text/table
    //                                  extraction is unaffected.
    //
    //    qpdf IS available and useful for the few pdf skills that
    //    need linearisation / page splitting.
    console.log('[snapshot] dnf install qpdf (best-effort for AL2023)…')
    const SYSTEM_PACKAGES_BEST_EFFORT = ['qpdf']
    const dnfResult = await sandbox.runCommand({
      cmd: 'sh',
      args: ['-lc',
        'sudo dnf install -y -q --setopt=install_weak_deps=False ' +
        SYSTEM_PACKAGES_BEST_EFFORT.map(quote).join(' '),
      ],
    })
    if (dnfResult.exitCode !== 0) {
      const err = await dnfResult.stderr()
      console.warn('[snapshot] dnf install returned non-zero; continuing anyway:')
      console.warn(err)
    }

    // 4. Python deps.
    console.log('[snapshot] pip install (this is the slow part)…')
    await runOrThrow(sandbox, 'sh', ['-lc',
      `python3 -m pip install --upgrade pip && python3 -m pip install ${PYTHON_PACKAGES.map(quote).join(' ')}`,
    ])

    // 5. Smoke test — make sure the headline imports actually work.
    //    We skip pdf2image/pytesseract/weasyprint here because the
    //    underlying system binaries aren't available on AL2023 (see
    //    the dnf section above for why). Importing them might still
    //    succeed at the pip layer but would just crash at first use.
    console.log('[snapshot] verifying imports…')
    await runOrThrow(sandbox, 'python3', ['-c',
      'import pypdf, pdfplumber, openpyxl, docx, pptx, PIL, imageio, pandas, numpy, pikepdf; print("ok")',
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

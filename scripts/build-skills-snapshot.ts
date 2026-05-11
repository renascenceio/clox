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
    //
    //    Node 22 IS available in the AL2023 default repo (verified
    //    via `dnf list available nodejs22`). We install it as a
    //    REQUIRED package — Node powers the pptxgenjs engine the
    //    PPTX skill recommends for create-from-scratch decks, which
    //    is the engine path that produces the polished
    //    "Claude-quality" output users compare to. Without Node,
    //    pptxgenjs is unavailable and python-pptx becomes the only
    //    engine, which loses ~30% of the visual richness (shape
    //    library, theme presets, declarative chart styling).
    console.log('[snapshot] dnf install qpdf + nodejs22 + npm…')
    const SYSTEM_PACKAGES = ['qpdf', 'nodejs22', 'npm']
    const dnfResult = await sandbox.runCommand({
      cmd: 'sh',
      args: ['-lc',
        'sudo dnf install -y -q --setopt=install_weak_deps=False ' +
        SYSTEM_PACKAGES.map(quote).join(' '),
      ],
    })
    if (dnfResult.exitCode !== 0) {
      const err = await dnfResult.stderr()
      console.warn('[snapshot] dnf install returned non-zero; continuing anyway:')
      console.warn(err)
    }

    //    AL2023 ships `nodejs22` as `/usr/bin/node-22`, not on PATH
    //    as `node`. Symlink it so the PPTX primer's
    //    `require('/opt/pptxgenjs')` flow works without per-chat
    //    shell gymnastics.
    console.log('[snapshot] symlinking node-22 / npm-22 onto PATH…')
    await runOrThrow(sandbox, 'sh', ['-lc',
      'sudo ln -sf "$(command -v node-22 || command -v node22 || echo /usr/bin/node-22)" /usr/local/bin/node 2>/dev/null; ' +
      'sudo ln -sf "$(command -v npm-22 || command -v npm22 || echo /usr/bin/npm-22)" /usr/local/bin/npm 2>/dev/null; ' +
      'node --version && npm --version',
    ])

    //    Pre-install pptxgenjs into a stable system-wide location.
    //    Layout choice:
    //      /opt/pptxgenjs-pkg/                ← npm install target
    //      /opt/pptxgenjs-pkg/node_modules/pptxgenjs/  ← real package
    //      /opt/pptxgenjs   →   pkg/node_modules/pptxgenjs (symlink)
    //    So the PPTX primer can do `require('/opt/pptxgenjs')` and
    //    Node's resolver finds the symlinked package's own main entry
    //    (dist/pptxgen.cjs.js) without us having to expose npm's
    //    quirky wrapper-package-json layout to the model.
    //    Doing all of this inside the snapshot saves ~30s of `npm
    //    install` on the first deck of every new chat.
    console.log('[snapshot] npm install pptxgenjs + symlink…')
    await runOrThrow(sandbox, 'sh', ['-lc',
      'sudo mkdir -p /opt/pptxgenjs-pkg && ' +
      'sudo chown -R "$(id -u):$(id -g)" /opt/pptxgenjs-pkg && ' +
      'cd /opt/pptxgenjs-pkg && ' +
      'npm init -y >/dev/null && ' +
      'npm install --omit=dev pptxgenjs && ' +
      'sudo ln -sfn /opt/pptxgenjs-pkg/node_modules/pptxgenjs /opt/pptxgenjs',
    ])

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
    console.log('[snapshot] verifying python imports…')
    await runOrThrow(sandbox, 'python3', ['-c',
      'import pypdf, pdfplumber, openpyxl, docx, pptx, PIL, imageio, pandas, numpy, pikepdf; print("python ok")',
    ])

    //    Verify Node + pptxgenjs are reachable. Doing this in the
    //    snapshot stage prevents the silent "deck looks plain"
    //    failure mode where pptxgenjs was supposedly pre-installed
    //    but `require` actually throws at runtime.
    console.log('[snapshot] verifying pptxgenjs…')
    await runOrThrow(sandbox, 'sh', ['-lc',
      `node -e "const P=require('/opt/pptxgenjs'); const i=new P(); console.log('pptxgenjs ok, version:', require('/opt/pptxgenjs/package.json').version)"`,
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

/**
 * DOCX (read & write) — rewritten primer.
 *
 * The Anthropic repo's docx skill on disk is intentionally generic
 * (and missing the per-format depth the pptx one has — no
 * pptxgenjs-equivalent). So this primer is itself the canonical
 * guide. The bridge still mentions /mnt/skills/skills/docx/SKILL.md
 * but explicitly says "use it as supplementary reference, not as a
 * required first read" — the previous primer wasted a turn cat-ing
 * it.
 */
import { CHARTER_VERSION, FAILURE_HEADER, MOUNTS, PALETTE, PRECEDENCE, visualQualityCharter, workflow } from './charter'

const STRUCTURAL_ELEMENTS = `MANDATORY STRUCTURE for a multi-page document (≥ 2 pages):

  TITLE PAGE (own section, section break before body):
    • Title: paragraph with style "Title". Font display serif italic
      28-32pt ${PALETTE.primaryDeep}. Top spacing ~2.5 inches (use
      paragraph.paragraph_format.space_before).
    • Subtitle: paragraph style "Subtitle", body sans 14pt
      ${PALETTE.body}, 12pt gap below title.
    • Thin ${PALETTE.accentGold} horizontal rule via a 1-row 1-cell
      table with bottom border only (python-docx can\'t draw raw
      lines).
    • Date + author block at the bottom: body sans 10pt
      ${PALETTE.body}.

  BODY SECTION (after a section break — different from title section):
    • Paragraph style "Body Text" for prose. Font Inter 11pt
      ${PALETTE.ink}, line spacing 1.15, paragraph_format.
      space_after = Pt(8).
    • Headings use add_heading(text, level=N) — this writes the
      built-in Heading 1 / Heading 2 / etc styles, which Word\'s
      navigation pane and TOC depend on. Then MUTATE the style\'s
      font to your design:
        styles = doc.styles
        h1 = styles["Heading 1"]
        h1.font.name = "Newsreader"; h1.font.italic = True
        h1.font.size = Pt(18); h1.font.color.rgb = RGBColor(0x0B,0x1F,0x3A)
        h2 = styles["Heading 2"] (... size Pt(14), same colour)
    • Lists: paragraph style "List Bullet" or "List Number". Marker
      colour can\'t easily be changed via python-docx; rely on the
      built-in style and let it inherit the body text colour.
    • ≥ 1 styled table — use document.add_table with a built-in
      style like "Light Grid Accent 1" or "Medium Shading 1 Accent 1".
      Header row: bold ${PALETTE.white} on ${PALETTE.primaryDeep}
      fill (shading is XML — see playbook for the snippet).

  HEADER / FOOTER on the body section:
    • Header: doc.sections[1].header.paragraphs[0].text = "<doc title>",
      style \"Header\" (right-aligned, body sans 10pt ${PALETTE.body}).
    • Footer: page numbers via a w:fldChar element ("PAGE \\\\* MERGEFORMAT" + " of " + "NUMPAGES \\\\* MERGEFORMAT"). Centred,
      body sans 10pt ${PALETTE.body}.
    • Title section header/footer are linked OFF (first_page=True
      on title section) so cover stays clean.

  PAGE LAYOUT:
    • Margins 1 inch all sides on body section. Title section can
      use 1.5 inch top.
    • A4 page size (default for python-docx-Document() is Letter —
      override via section.page_width = Mm(210), page_height = Mm(297)).

  EVERY document with ≥ 3 body pages MUST have:
    - a working Page X of Y footer (numFields above),
    - at least one styled table OR one styled callout block,
    - a real Heading-1 style applied to each section header (so the
      Word navigation pane works).`

const ENGINE_BLOCK = `ENGINE SELECTION & ON-DISK COMPANION:

  Single engine: \`python-docx\`. Pre-installed. There is no JS
  alternative worth using for Word documents.

  /mnt/skills/skills/docx/SKILL.md exists but is short and mostly
  duplicates this primer. Read it as supplementary reference ONLY
  if a specific recipe is missing here — DO NOT cat it before
  writing code as the default first move. This primer is the
  canonical guide for DOCX work.`

const INSPECT_COMMANDS = [
  '# verify the file exists and is non-zero:',
  'bash → ls -la /mnt/user-data/outputs/<name>.docx',
  '# count headings + tables + sections:',
  'python → from docx import Document; d=Document("/mnt/user-data/outputs/<name>.docx"); print("paragraphs:", len(d.paragraphs), "tables:", len(d.tables), "sections:", len(d.sections))',
  '# verify heading hierarchy was applied:',
  'python → print([(p.style.name, p.text[:40]) for p in d.paragraphs if p.style.name.startswith("Heading")])',
  '# verify footer has a page-number field:',
  'python → f = d.sections[-1].footer.paragraphs[0]._p.xml; print("has PAGE field:", "PAGE" in f, "has NUMPAGES:", "NUMPAGES" in f)',
]

const MINIMUM_REQUIREMENTS = [
  '≥ 1 paragraph with style "Heading 1" applied',
  '≥ 1 styled table (style other than default "Table Grid")',
  'footer contains a working Page X of Y field (PAGE + NUMPAGES)',
  '≥ 2 sections (title page + body) for any doc >2 pages',
  '≥ 2 fonts visibly in use (display serif italic + body sans)',
  'file size between 15KB and 1MB',
]

const FAILURE_PLAYBOOK = `${FAILURE_HEADER}

  - heading font/colour doesn\'t change → you set font on the run
    INSIDE the heading paragraph. That works for THAT instance but
    looks wrong on subsequent headings. Better: mutate the STYLE
    object itself (doc.styles["Heading 1"].font.size = Pt(18)).
    Then every Heading 1 picks up the change.

  - shading on table header row not rendering → python-docx doesn\'t
    expose cell shading directly; you need raw XML:
      from docx.oxml.ns import qn; from docx.oxml import OxmlElement
      shd = OxmlElement("w:shd")
      shd.set(qn("w:fill"), "0B1F3A")
      cell._tc.get_or_add_tcPr().append(shd)

  - "Page X of Y" only shows X → you only inserted the PAGE field,
    not NUMPAGES. Use TWO field-char runs separated by " of ".

  - sections behave weirdly / margins reset → you added a section
    break AFTER content. Order matters: create section breaks
    BEFORE adding content to the new section. doc.add_section() with
    WD_SECTION.NEW_PAGE returns the new section; everything you add
    next belongs to that section.

  - custom style raises ValueError on save → reuse built-in styles
    (Heading 1, Heading 2, Title, Subtitle, Body Text, List Bullet)
    and mutate .font / .paragraph_format instead of registering new
    style names. Avoids the "style not found" error class entirely.`

export const DOCX_PROMPT = `<!-- charter-version: ${CHARTER_VERSION} -->
${PRECEDENCE}

You are a Word-document specialist working in the Clox python sandbox. The user has armed \`bash\` and \`python\`. ${MOUNTS}

${visualQualityCharter()}

${STRUCTURAL_ELEMENTS}

${ENGINE_BLOCK}

${workflow(INSPECT_COMMANDS, MINIMUM_REQUIREMENTS)}

${FAILURE_PLAYBOOK}`

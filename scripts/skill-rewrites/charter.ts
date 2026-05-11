/**
 * SHARED VISUAL QUALITY CHARTER — the taste layer the model doesn't
 * have natively. Every doc-producing primer (PPTX/XLSX/PDF/DOCX)
 * composes its content from these building blocks so we never drift
 * on palette, typography, spacing, or workflow shape across formats.
 *
 * EDITING THIS FILE: bump `CHARTER_VERSION` whenever any constant or
 * composer changes. The apply script (`_apply-skill-rewrites.ts`)
 * keys on this version — re-running with the same version is a
 * no-op, bumping it triggers an UPDATE on all four primers.
 */

export const CHARTER_VERSION = 1

// ─── PRECEDENCE BANNER ────────────────────────────────────────────
// Shipped at the top of every primer. The model's first job is to
// respect the user's brief. Defaults below are scaffolding — they
// only fill in what the user DIDN'T pin down.
export const PRECEDENCE = `PRECEDENCE: any explicit instructions in the user message — colours, fonts, layout, content focus, page count, file name, format — OVERRIDE the craftsmanship defaults below. Defaults are scaffolding, not requirements. If the user says "dark blue and gold", use dark blue and gold; if they say "single page", produce one page; if they say "no footer", drop the footer. Apply the defaults only for aspects the user did NOT specify.`

// ─── DEFAULT PALETTE ──────────────────────────────────────────────
// A single tasteful palette that works for pitch decks, financial
// workbooks, executive memos, and product briefs alike. Chosen
// because (a) the user's recent prompts repeatedly land on "dark
// navy + gold", (b) it photographs/screenshots well across both
// light and dark renderers, (c) every hex value is accessibility-
// safe (≥4.5:1 contrast against the matched neutral).
//
// Hex values are LITERAL — do not paraphrase them in the primer.
// The model needs the exact codes to feed RGBColor / Font / Fill.
export const PALETTE = {
  primaryDeep:   '#0B1F3A',  // deep navy — cover bg, master accent
  primaryMid:    '#1E3A5F',  // steel blue — secondary fills, chart bars
  accentGold:    '#C7A557',  // warm matte gold — KPI numbers, rules
  accentGoldLt:  '#E6D292',  // gold tint — callout fills, highlights
  ink:           '#1A1A1A',  // primary text on light backgrounds
  body:          '#4A4A4A',  // secondary text, captions
  rule:          '#C8CCD2',  // hairline rules, table gridlines
  parchment:     '#F5F1E8',  // warm canvas, alternate row stripe
  white:         '#FFFFFF',
} as const

// ─── TYPOGRAPHY ────────────────────────────────────────────────────
// Two-family stack: editorial serif for display (titles, large
// numbers, section dividers) and a neutral sans for body. Italic
// serif is the signature move — it's what makes Anthropic-style
// decks/briefs feel deliberate vs. corporate-PowerPoint.
export const TYPOGRAPHY = `Display (titles, section dividers, oversize numbers): 'Newsreader', Georgia, 'Times New Roman', serif — ITALIC.
Body (paragraphs, table cells, captions): 'Inter', 'Helvetica Neue', Arial, sans-serif — regular.
Mono (code, fixed-width data): 'JetBrains Mono', Menlo, Consolas, monospace.
NEVER use Calibri. NEVER use the default theme font. Always set fonts explicitly on every text run.`

// ─── SPACING SCALE ─────────────────────────────────────────────────
// One scale, used everywhere — gutter between KPI tiles, slide
// margins, table cell padding, paragraph spacing. Multiples of 4
// because that's the divisor every layout engine snaps to.
export const SPACING = `Spacing scale (use these values, NOT arbitrary numbers): 4, 8, 12, 16, 24, 40, 64 (px or pt, scale to the format). Inside a slide/page: 40-64 outer margin, 24 between major blocks, 16 between paragraphs, 8 between bullet items.`

// ─── PRODUCE → INSPECT → ITERATE WORKFLOW ─────────────────────────
// The uniform self-check loop. Every format-specific primer plugs
// its own structural assertions into the INSPECT block.
export function workflow(inspectCommands: string[], minimumRequirements: string[]): string {
  return `PRODUCE → INSPECT → ITERATE — every artifact must go through all three.

1. PRODUCE: write the file to /mnt/user-data/outputs/<sensible-name>.<ext>.
   The filename must reflect the user's request ("ai-trends-deck.pptx", not "output.pptx").

2. INSPECT: run THESE structural checks before declaring done.
${inspectCommands.map(c => '   ' + c).join('\n')}

   The output is "ready" only when ALL of these pass:
${minimumRequirements.map(r => '   - ' + r).join('\n')}

3. ITERATE: if any inspect check fails OR the output is structurally
   thin (one chart instead of three, one font everywhere, no
   decoration, no theme), patch the code and re-save. Run inspect
   again. Only after the second inspect goes green do you tell the
   user the file is ready.

NEVER skip step 2. NEVER declare "done" off the back of a saved file
without confirming the saved file matches the requirements.`
}

// ─── FAILURE-MODE PLAYBOOK FRAMING ─────────────────────────────────
// The header for the per-format playbook. Each primer appends its
// own 3-5 specific entries.
export const FAILURE_HEADER = `FAILURE-MODE PLAYBOOK — when something breaks, do NOT bail to "I'll explain it in text instead". Recover with one of these moves:`

// ─── MOUNT PATHS ───────────────────────────────────────────────────
// Single source of truth for the sandbox layout. If the manager
// ever changes these, only this constant moves.
export const MOUNTS = `Read uploads at /mnt/user-data/uploads/<filename>. Write deliverables to /mnt/user-data/outputs/<filename>. Files written there are auto-collected and shown to the user as download chips.`

// ─── COLOUR/TYPE PARAGRAPH HELPER ─────────────────────────────────
// Renders the palette + typography + spacing into a single VQC
// section. Used identically across all four primers so the model
// internalises the same defaults regardless of which format it
// was activated for.
export function visualQualityCharter(extras: string = ''): string {
  return `VISUAL QUALITY CHARTER — apply these defaults unless the user pinned a different brand.

PALETTE (literal hex codes — feed these to RGBColor / Fill / Font):
  primary-deep   ${PALETTE.primaryDeep}   (cover backgrounds, master accent bars)
  primary-mid    ${PALETTE.primaryMid}    (secondary fills, primary chart series)
  accent-gold    ${PALETTE.accentGold}    (KPI numbers, decorative rules, highlights)
  accent-gold-lt ${PALETTE.accentGoldLt}  (callout fills, soft highlights)
  ink            ${PALETTE.ink}           (primary text on light backgrounds)
  body           ${PALETTE.body}          (secondary text, captions, footnotes)
  rule           ${PALETTE.rule}          (hairline rules, gridlines)
  parchment      ${PALETTE.parchment}     (warm canvas, alternate row stripe)
  white          ${PALETTE.white}

TYPOGRAPHY:
${TYPOGRAPHY.split('\n').map(l => '  ' + l).join('\n')}

SPACING:
  ${SPACING}
${extras ? '\n' + extras : ''}`
}

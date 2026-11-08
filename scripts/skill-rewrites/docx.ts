/**
 * DOCX (read & write) — v3 primer. python-docx for structure; clox_kit
 * supplies the theme colours, type pairing and chart images so Word output
 * matches the decks and reports.
 */
import { CHARTER_VERSION, CHUNKING, CRAFT, MOUNTS, PRECEDENCE, THEMES } from './charter'

const API = `CREATE with python-docx, styled from a clox_kit theme:
    from docx import Document
    from docx.shared import Pt, RGBColor, Cm
    from clox_kit import theme, charts
    t = theme("studio")                       # t.accent, t.ink, t.muted, t.surface, t.rule, t.series[i] are "#RRGGBB"
    rgb = lambda h: RGBColor.from_string(h[1:])
    doc = Document()
    st = doc.styles
    st["Normal"].font.name, st["Normal"].font.size = "Aptos", Pt(10.5)
    for name, size in (("Title", 30), ("Heading 1", 18), ("Heading 2", 13)):
        s = st[name]; s.font.name = "Aptos Display"; s.font.size = Pt(size); s.font.bold = True; s.font.color.rgb = rgb(t.ink)
    sec = doc.sections[0]; sec.left_margin = sec.right_margin = Cm(2.2)
    doc.save("/mnt/user-data/outputs/<name>.docx")
  Next calls: doc = Document("/mnt/user-data/outputs/<name>.docx"), add the next 1-2 sections, save.
  Charts: path = charts.png("bar", cats, {"Revenue": vals}, "/tmp/rev.png", theme="studio", fmt="money", w=1600, h=800)
          doc.add_picture(path, width=Cm(16)) then a short italic caption paragraph.
  Tables: doc.add_table(rows, cols, style="Table Grid"); shade the header cells with t.accent (w:shd fill) and white bold text;
          right-align numbers; keep tables ≤ 8 columns.
  Accent: a kicker line above each Heading 1 in t.accent, small caps 9pt — the signature touch.
  Use real Word styles (Title / Heading 1-2 / List Bullet / List Number) so the navigation pane and TOC work.
  Page numbers: footer paragraph with a PAGE field (fldSimple w:instr="PAGE").
  Need a PDF instead? Use the PDF skill's clox_kit Report — far better typography than converting Word.

READ / EDIT:
  paragraphs + styles: for p in Document(path).paragraphs → p.style.name, p.text · tables: doc.tables → cell.text
  Comments / tracked changes live in the XML: unzip -p file.docx word/comments.xml · word/document.xml (w:ins / w:del).
  Edit = load, change runs (keep their formatting), save under a new name in outputs.`

export const DOCX_PROMPT = `<!-- charter-version: ${CHARTER_VERSION} -->
You create and edit Word documents with python-docx in the python sandbox, styled with clox_kit themes so they look designed, not default.
${PRECEDENCE}
${MOUNTS}

${CHUNKING}

${API}

${THEMES}

${CRAFT}`

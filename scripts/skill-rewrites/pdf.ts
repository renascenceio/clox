/**
 * PDF (read & write) — v3 primer. Creation through clox_kit.Report (designed
 * reports with embedded fonts) or Deck(...).pdf() for slide-style PDFs;
 * reading/manipulating stays on pypdf / pdfplumber / pikepdf.
 */
import { CHARTER_VERSION, CHUNKING, CRAFT, FAILURES, FORMATS, MOUNTS, PRECEDENCE, PREMIUM, THEMES } from './charter'

const API = `CREATE — from clox_kit import Report
r = Report("ev-market-brief", theme="editorial", title="EV Market Brief", subtitle="Q4 2026",
           author="Northwind Research", date="November 2026", size="A4"|"letter", new=True)
  new=True only on the FIRST call; later calls: r = Report("ev-market-brief") and keep adding.
Blocks (each call appends and re-renders the whole PDF with headers, footers and "page X of Y"):
  r.cover(kicker="Research note")                   # full-bleed designed cover
  r.h1("Summary", kicker="01 — Overview") · r.h2("Pricing")
  r.lead("Bigger intro paragraph.") · r.p("Body with **bold**, *italic*, \`code\`, [links](https://…).\\n\\nBlank line = new paragraph.")
  r.takeaways(["Sales up 31%", "China is 58% of volume"]) · r.bullets([...], numbered=False)
  r.kpis([("31%", "YoY growth", "+4pt"), ("17.1M", "Units"), ("$38k", "Avg. price")])
  r.chart("bar", categories, {"Units": [...]}, title=, caption="Source: IEA", fmt="1dp", height=0.45)
  r.table(columns, rows, fmt={"Share": "pct"}, highlight="Units", caption=)
  r.callout("Do this next quarter.", title="Recommendation", tone="accent"|"positive"|"negative"|"neutral")
  r.quote(text, who=) · r.image(path, caption=, width=0.8) · r.divider() · r.pagebreak()
  r.outline() · r.edit(n, text=...) · r.remove(n)

${FORMATS}

Slide-style PDF (pitch / landscape handout): build a Deck (see the PPTX skill API: d.cover/kpis/chart/…) and call d.pdf().
Charts as images for anything else: from clox_kit import charts; charts.png("line", cats, series, "/mnt/user-data/outputs/x.png", theme="studio").

READ / EDIT existing PDFs:
  text: pdfplumber.open(p).pages[i].extract_text() · tables: page.extract_tables()
  split/merge/rotate/encrypt/fill forms: pypdf (PdfReader, PdfWriter, writer.update_page_form_field_values)
  linearise / repair: pikepdf. Scanned PDF with no text layer: say so; OCR isn't available in this sandbox.
  Summarise long PDFs page-range by page-range; print only what you need (never dump a whole document).`

const SHAPE = `REPORT SHAPE: cover → h1 Summary (lead + takeaways + kpis) → 2-5 sections each with an h1, a chart or table,
and prose that interprets it → recommendation callout → sources/method as a short final section.`

export const PDF_PROMPT = `<!-- charter-version: ${CHARTER_VERSION} -->
You create and work with PDFs. For new documents use clox_kit (installed in the python sandbox): it lays out designed reports with embedded Inter / Instrument Serif / Space Grotesk fonts, themed charts, tables and running headers. Do not hand-write reportlab layouts.
${PRECEDENCE}
${MOUNTS}

${CHUNKING}

${API}

${THEMES}

${PREMIUM}

${SHAPE}

${CRAFT}

${FAILURES}

When done, summarise the document's main findings in 2-3 sentences; the PDF is shown automatically.`

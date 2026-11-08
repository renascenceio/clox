/**
 * Shared building blocks for the document-skill primers (PPTX, PDF, XLSX,
 * DOCX, Data). Since v3 the taste lives in CODE — `clox_kit`, the Python
 * design library copied into every sandbox (source: `sandbox-kit/clox_kit/`).
 * Primers teach the kit's API and the editorial rules; they no longer carry
 * hex tables and 100-line python-pptx templates. That makes them ~4× shorter
 * (cheaper per turn) and the output far more consistent.
 *
 * EDITING: bump `CHARTER_VERSION` whenever any primer changes. The apply
 * script keys on it — same version = no-op, higher = UPDATE all primers.
 */

// v1 — four primers from one charter (palette + typography as prose).
// v2 — PPTX switched from pptxgenjs to python-pptx, HARD LIMIT block.
// v3 — clox_kit: themes, embedded fonts, Deck/Report/Book/data APIs, native
//      charts, design review (`check()`), new Data skill. ~70% fewer tokens.
// v4 — Google Fonts pairings (fonts=(display, body)), "!" warnings must be fixed,
//      one chart per scale.
export const CHARTER_VERSION = 4

export const PRECEDENCE = `The user's brief wins: colours, fonts, brand, length, file name, tone and structure they specify override every default below.`

export const MOUNTS = `Uploads: /mnt/user-data/uploads/. Everything clox_kit writes goes to /mnt/user-data/outputs/ and appears in the chat as a download — never base64 files into your reply.`

export const THEMES = `THEMES (pick by audience; never default to plain white + blue):
  studio     light, electric violet + hot pink — the default; product, strategy, general
  midnight   dark, acid lime + violet — tech, launches, AI
  electric   near-black, hot pink + cyan + yellow, grotesk type — pitches, events, culture, bold asks
  editorial  warm paper, serif headlines, vermilion — essays, research, memos
  navy       white + navy + gold, serif — finance, board, legal, formal
  swiss      white, black, blaze orange, grotesk — clean, confident, design-led
  forest     soft green + mint — sustainability, health, calm finance
Brand colour: theme="studio", brand="#E4002B" (or dark=True). Fine-tune any token:
accent=, accent2=, hero= (cover/section colour), bg=, ink=, series=[...].
TYPE: any Google Font pairing — fonts=("Playfair Display", "DM Sans") (display, body; "Fraunces:600" picks the
headline weight). Files are fetched once, text is fitted with their real metrics and embedded in PDFs. Pair a
characterful display face with a quiet sans; match the mood (luxury → Playfair/Cormorant, tech → Space Grotesk/
Inter, editorial → Fraunces/Newsreader, friendly → DM Sans/Manrope). Honour any font the user names.`

export const FORMATS = `Number formats (fmt=): "money" ($4.2M), "money:€", "pct" (0.34 → 34%), "%" (34 → 34%), "int", "1dp", "k", "m".
Chart kinds: bar, barh, stacked, stacked100, barh_stacked, line, area, pie, donut, scatter.
Every list/series argument also accepts pandas Series, numpy arrays and DataFrames.`

export const CRAFT = `CRAFT — what separates a designed document from a default one:
  - Headlines are claims, not topics: "Enterprise drives 70% of revenue", not "Revenue by segment".
  - One idea per slide/section. If you need two charts, make two slides.
  - Numbers carry the story: put the key figure big (kpis) and say what changed (deltas, takeaway=).
  - Use real numbers from the user's data or your research. Never invent statistics; if you estimate, say so.
  - Vary rhythm: never three slides of the same kind in a row; use a statement/section to pace.
  - Short copy: ≤ 6 bullets, ≤ 14 words each. Detail goes in speaker notes (notes=...).
  - Charts: ≤ 8 categories (group the tail into "Other"), sorted, one highlighted message.`

export const CHUNKING = `BUILD IN SMALL CALLS — each python call adds 1-3 slides/blocks/sheets, then returns.
The kit saves after EVERY call, so a timeout or output cap never loses work.
The next call reopens by name (Deck("q3-review") / Report("brief") / Book("analysis")) and continues.
Never write a whole deck in one snippet: long snippets hit the output cap mid-JSON and cannot be resumed.`

export const FAILURES = `IF SOMETHING BREAKS — fix and continue, never fall back to describing the file in text:
  - Traceback → read the last line, fix that argument, rerun ONLY that call (state is on disk).
  - Unsure what's built → d.outline() (or r.outline()) prints every slide/block.
  - Wrong slide → d.edit(n, title=...) / d.remove(n) / d.move(n, to) / d.at(n).kpis(...) inserts.
  - Wrong look → d.restyle("navy") or d.restyle(fonts=("Fraunces", "Inter")) re-renders everything; nothing is lost.
  - A line starting with "!" after a slide is a real defect (text too long, a series on a different scale that
    will draw flat, too many rows). Fix that slide with d.edit(n, ...) before moving on.
  - ImportError for clox_kit → the sandbox is old: pip install python-pptx reportlab openpyxl pillow, then retry.`

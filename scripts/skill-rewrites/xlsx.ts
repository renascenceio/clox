/**
 * XLSX (read & write) — v3 primer, built on clox_kit.Book + clox_kit.data.
 */
import { CHARTER_VERSION, CHUNKING, FAILURES, FORMATS, MOUNTS, PRECEDENCE, THEMES } from './charter'

const API = `CREATE — from clox_kit import Book, data
b = Book("sales-analysis", theme="studio", title="Sales analysis 2026", new=True)
  new=True only on the FIRST call; later: b = Book("sales-analysis", theme="studio") reopens the .xlsx.
b.table(df_or_rows, sheet="Orders", columns=None, title=, subtitle=,
        fmt={"Revenue": "money", "Margin": "pct", "Date": "date"},
        totals=["Revenue"],              # live =SUBTOTAL row (or totals=True for every numeric column)
        bars=["Revenue"], scale=["Margin"],   # in-cell data bars / red→green colour scale
        chart=("bar", "Region", ["Revenue"]), # native Excel chart beside the table: bar|barh|line|area|pie|stacked
        note="Source: orders.csv")
  → styled header, banded rows, frozen panes, filters, auto widths, print setup. One call = one sheet.
b.col("Orders", "Revenue") → "'Orders'!$E$4:$E$1503" (data rows only) for formulas.
b.summary([("Total revenue", f"=SUM({b.col('Orders','Revenue')})", "money"), ("Orders", 1500, "int"),
           ("Top region", "West")], subtitle="Jan–Dec 2026", notes=["How it was calculated"])   # KPI cover sheet, placed first
b.chart(sheet, kind, x_col, [y_cols], anchor="H4", title=) · b.notes(["Source …", "Method …"])   # About sheet

${FORMATS}

Prefer FORMULAS for totals/ratios users will edit (=SUM, =AVERAGE, =B5/C5); compute heavy analysis in pandas
and write results as values. Keep raw data on its own sheet; analysis sheets reference it.

READ existing workbooks:
  df = data.load("/mnt/user-data/uploads/file.xlsx", sheet="Sheet1")   # cleans $, %, thousands, dates, header rows
  data.profile(df) — compact overview; never print whole frames.
  Formulas / formatting: openpyxl.load_workbook(p) (data_only=True for cached values).
  Edit in place: load with openpyxl, change cells, save under a NEW name in outputs.`

const SHAPE = `WORKBOOK SHAPE (analysis requests): Summary (KPIs, first) → one sheet per view (By region, By month …) each with a
native chart → Data (clean raw rows) → About (source, method, assumptions). Name sheets in plain words.`

export const XLSX_PROMPT = `<!-- charter-version: ${CHARTER_VERSION} -->
You build and read Excel workbooks. For new workbooks use clox_kit (installed in the python sandbox): it writes finished-looking sheets — themed headers, number formats, live total formulas, data bars, native charts and a KPI summary — with openpyxl underneath. Do not hand-style cells one by one.
${PRECEDENCE}
${MOUNTS}

${CHUNKING}

${API}

${THEMES}

${SHAPE}

Quote exact figures in your reply from what the code printed (data.md / summarize output), never from memory.

${FAILURES}`

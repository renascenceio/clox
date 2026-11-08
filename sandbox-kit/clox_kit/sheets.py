"""Excel workbooks that look finished: styled tables, live formulas, native charts.

    from clox_kit import Book, data
    df = data.load("/mnt/user-data/uploads/sales.csv")
    b = Book("sales-analysis", theme="studio", title="Sales analysis")
    b.table(df, sheet="Data", fmt={"Revenue": "money", "Margin": "pct"}, totals=["Revenue"], bars=["Revenue"])
    by = data.summarize(df, by="Region", values="Revenue")
    b.table(by, sheet="By region", fmt={"Revenue": "money"}, chart=("bar", "Region", ["Revenue"]))
    b.summary([("Total revenue", f"=SUM({b.col('Data', 'Revenue')})", "money"), ("Orders", len(df), "int")])
"""
from __future__ import annotations

import os
import re

from .charts import excel_format
from .slides import _resolve
from .theme import Theme, contrast, mix, on, theme as _theme

TITLE_FONT, BODY_FONT = "Aptos Display", "Aptos"


def _c(h):
    return h.lstrip("#").upper()


class Book:
    def __init__(self, name="workbook", theme=None, *, title=None, new=False, **theme_overrides):
        from openpyxl import Workbook, load_workbook
        self.path = _resolve(name, ".xlsx")
        self.theme: Theme = theme if isinstance(theme, Theme) else _theme(theme, **theme_overrides)
        self.title = title
        if not new and os.path.exists(self.path):
            self.wb = load_workbook(self.path)
            print(f"reopened {os.path.basename(self.path)} · sheets: {', '.join(self.wb.sheetnames)}")
        else:
            self.wb = Workbook()
            self.wb.remove(self.wb.active)
        if title:
            self.wb.properties.title = title

    def save(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        if not self.wb.sheetnames:
            self.wb.create_sheet("Sheet1")
        self.wb.save(self.path)

    def _sheet(self, name, index=None):
        name = re.sub(r"[\[\]:*?/\\]", "-", str(name))[:31]
        if name in self.wb.sheetnames:
            del self.wb[name]
        ws = self.wb.create_sheet(name, index)
        ws.sheet_view.showGridLines = False
        ws.sheet_properties.tabColor = _c(self.theme.accent)
        return ws

    # ── data table ──
    def table(self, df_or_rows, *, sheet="Data", columns=None, title=None, subtitle=None, fmt=None, totals=None,
              bars=None, scale=None, widths=None, chart=None, index=None, note=None):
        """Write a styled table.
        fmt     {col: "money" | "money:€" | "pct" | "int" | "1dp" | "date" | Excel format}
        totals  True (all numeric) or [cols] → SUM row with live formulas
        bars    [cols] → in-cell data bars;  scale [cols] → red-to-green colour scale
        chart   ("bar"|"line"|"pie"|"barh"|"stacked"|"area", x_col, [y_cols]) → native chart beside the table
        """
        from openpyxl.formatting.rule import ColorScaleRule, DataBarRule
        from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
        from openpyxl.utils import get_column_letter
        t = self.theme
        rows, cols = _rows(df_or_rows, columns)
        fmt = fmt or {}
        ws = self._sheet(sheet, index)
        r0 = 1
        ttl = title or (sheet if sheet not in ("Data", "Sheet1") else self.title)
        if ttl:
            ws.cell(1, 1, ttl).font = Font(name=TITLE_FONT, size=18, bold=True, color=_c(t.ink))
            ws.row_dimensions[1].height = 30
            r0 = 2
            if subtitle:
                ws.cell(2, 1, subtitle).font = Font(name=BODY_FONT, size=10, color=_c(t.muted))
                r0 = 3
            r0 += 1
        head_fill = t.ink if not t.dark else t.surface
        hf = PatternFill("solid", fgColor=_c(head_fill))
        zebra = PatternFill("solid", fgColor=_c(mix(t.bg if not t.dark else "#FFFFFF", t.surface if not t.dark else "#F2F2F2", 0.6)))
        thin = Side(style="thin", color=_c(t.rule))
        numeric = [all(isinstance(r[i], (int, float)) or r[i] is None for r in rows) and any(
            isinstance(r[i], (int, float)) for r in rows) for i in range(len(cols))]
        datecol = [any(hasattr(r[i], "year") for r in rows[:50]) for i in range(len(cols))]
        for ci, c in enumerate(cols, 1):
            cell = ws.cell(r0, ci, str(c))
            cell.font = Font(name=BODY_FONT, size=10, bold=True, color=_c(on(head_fill)))
            cell.fill = hf
            cell.alignment = Alignment(horizontal="right" if numeric[ci - 1] else "left", vertical="center",
                                       indent=1 if not numeric[ci - 1] else 0)
        ws.row_dimensions[r0].height = 24
        number_formats = []
        for ci, c in enumerate(cols):
            f = fmt.get(c) or fmt.get(ci)
            if f == "date" or (not f and datecol[ci]):
                number_formats.append("yyyy-mm-dd")
            elif f:
                number_formats.append(excel_format(f))
            elif numeric[ci]:
                vals = [r[ci] for r in rows if isinstance(r[ci], (int, float))]
                number_formats.append("#,##0" if all(float(v).is_integer() for v in vals) else "#,##0.00")
            else:
                number_formats.append(None)
        for ri, r in enumerate(rows, r0 + 1):
            for ci, v in enumerate(r, 1):
                cell = ws.cell(ri, ci, v)
                cell.font = Font(name=BODY_FONT, size=10, color="0B0B0F" if t.dark else _c(t.ink))
                if number_formats[ci - 1]:
                    cell.number_format = number_formats[ci - 1]
                cell.alignment = Alignment(horizontal="right" if numeric[ci - 1] else "left", vertical="center",
                                           indent=1 if not numeric[ci - 1] else 0)
                cell.border = Border(bottom=thin)
                if (ri - r0) % 2 == 0:
                    cell.fill = zebra
        last = r0 + len(rows)
        if totals:
            tr = last + 1
            tc = [c for i, c in enumerate(cols) if numeric[i]] if totals is True else totals
            ws.cell(tr, 1, "Total").font = Font(name=BODY_FONT, size=10, bold=True, color=_c(t.ink))
            for ci, c in enumerate(cols, 1):
                cell = ws.cell(tr, ci)
                cell.border = Border(top=Side(style="medium", color=_c(t.ink)))
                if c in tc:
                    L = get_column_letter(ci)
                    cell.value = f"=SUBTOTAL(109,{L}{r0 + 1}:{L}{last})"
                    cell.number_format = number_formats[ci - 1] or "#,##0"
                    cell.font = Font(name=BODY_FONT, size=10, bold=True, color=_c(t.ink))
                    cell.alignment = Alignment(horizontal="right")
        for c in (bars or []):
            if c in cols:
                L = get_column_letter(cols.index(c) + 1)
                ws.conditional_formatting.add(f"{L}{r0 + 1}:{L}{last}", DataBarRule(
                    start_type="num", start_value=0, end_type="max", color=_c(t.accent), showValue=True))
        for c in (scale or []):
            if c in cols:
                L = get_column_letter(cols.index(c) + 1)
                ws.conditional_formatting.add(f"{L}{r0 + 1}:{L}{last}", ColorScaleRule(
                    start_type="min", start_color=_c(mix("#FFFFFF", t.negative, 0.55)), mid_type="percentile",
                    mid_value=50, mid_color="FFFFFF", end_type="max", end_color=_c(mix("#FFFFFF", t.positive, 0.55))))
        for ci, c in enumerate(cols, 1):
            if widths and c in widths:
                w = widths[c]
            else:
                sample = [str(c)] + [_disp(r[ci - 1], number_formats[ci - 1]) for r in rows[:300]]
                w = min(48, max(8, max(len(s) for s in sample) * 1.1 + 3))
            ws.column_dimensions[get_column_letter(ci)].width = w
        ws.freeze_panes = ws.cell(r0 + 1, 1 if len(cols) < 6 else 2)
        if rows:
            ws.auto_filter.ref = f"A{r0}:{get_column_letter(len(cols))}{last}"
        ws.page_setup.orientation = "landscape"
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.print_title_rows = f"{r0}:{r0}"
        if note:
            ws.cell(last + (3 if totals else 2), 1, note).font = Font(name=BODY_FONT, size=9, italic=True, color=_c(t.muted))
        if chart:
            kind, x, ys = chart[0], chart[1], chart[2] if len(chart) > 2 else [c for i, c in enumerate(cols) if numeric[i]][:1]
            self._chart(ws, kind, cols, r0, last, x, ys, anchor=f"{get_column_letter(len(cols) + 2)}{r0}",
                        fmt=fmt.get(ys[0]) if ys else None, title=chart[3] if len(chart) > 3 else None)
        self.save()
        print(f"✓ sheet '{ws.title}' · {len(rows):,} rows × {len(cols)} cols · data in rows {r0 + 1}-{last}")
        return ws

    def col(self, sheet, column):
        """Absolute range of a table column (data rows only, no header/total) for formulas:
        f"=SUM({b.col('Orders', 'Revenue')})" """
        from openpyxl.utils import get_column_letter
        ws = self.wb[sheet]
        for r in range(1, 10):
            vals = [c.value for c in ws[r]]
            if column in vals and ws.cell(r, vals.index(column) + 1).font.bold:
                ci = vals.index(column) + 1
                last = r
                while ws.cell(last + 1, 1).value not in (None, "Total"):
                    last += 1
                L = get_column_letter(ci)
                return f"'{ws.title}'!${L}${r + 1}:${L}${last}"
        raise KeyError(f"column {column!r} not found on sheet {sheet!r}")

    def _chart(self, ws, kind, cols, r0, last, x, ys, anchor, fmt=None, title=None, width=18, height=9.5):
        from openpyxl.chart import AreaChart, BarChart, LineChart, PieChart, Reference
        from openpyxl.chart.shapes import GraphicalProperties
        from openpyxl.drawing.line import LineProperties
        t = self.theme
        if kind in ("pie", "donut"):
            from openpyxl.chart import DoughnutChart
            ch = DoughnutChart(holeSize=60) if kind == "donut" else PieChart()
        elif kind == "line":
            ch = LineChart()
        elif kind == "area":
            ch = AreaChart()
        else:
            ch = BarChart()
            ch.type = "bar" if kind.startswith("barh") else "col"
            if "stacked" in kind:
                ch.grouping, ch.overlap = "stacked", 100
            ch.gapWidth = 60
        xi = cols.index(x) + 1
        for y in ys:
            yi = cols.index(y) + 1
            ref = Reference(ws, min_col=yi, min_row=r0, max_row=last)
            ch.add_data(ref, titles_from_data=True)
        ch.set_categories(Reference(ws, min_col=xi, min_row=r0 + 1, max_row=last))
        for i, s in enumerate(ch.series):
            col = _c(t.color(i))
            if kind == "line":
                s.graphicalProperties.line.solidFill = col
                s.graphicalProperties.line.width = 28575
                s.smooth = False
            elif kind not in ("pie", "donut"):
                s.graphicalProperties = GraphicalProperties(solidFill=col)
                s.graphicalProperties.line = LineProperties(noFill=True)
        if kind in ("pie", "donut"):
            from openpyxl.chart.series import DataPoint
            s = ch.series[0]
            for i in range(last - r0):
                pt = DataPoint(idx=i)
                pt.graphicalProperties = GraphicalProperties(solidFill=_c(t.color(i)))
                s.dPt.append(pt)
        else:
            try:
                ch.y_axis.majorGridlines.spPr = GraphicalProperties(ln=LineProperties(solidFill=_c(t.rule)))
                ch.y_axis.number_format = excel_format(fmt) if fmt else "General"
                ch.y_axis.delete = False
                ch.x_axis.delete = False
            except Exception:
                pass
        ch.title = title
        ch.style = 2
        if len(ys) == 1 and kind not in ("pie", "donut"):
            ch.legend = None
        else:
            ch.legend.position = "b"
        ch.width, ch.height = width, height
        ws.add_chart(ch, anchor)
        return ch

    def chart(self, sheet, kind, x, ys, *, anchor=None, title=None, fmt=None):
        """Add a native chart reading an existing table sheet (header row auto-detected)."""
        ws = self.wb[sheet]
        r0 = next(r for r in range(1, 8) if ws.cell(r, 1).value is not None and ws.cell(r, 1).font.bold
                  and ws.cell(r, 1).fill.fgColor.rgb not in (None, "00000000"))
        cols = [c.value for c in ws[r0] if c.value is not None]
        last = r0
        while ws.cell(last + 1, 1).value not in (None, "Total"):
            last += 1
        from openpyxl.utils import get_column_letter
        self._chart(ws, kind, cols, r0, last, x, ys if isinstance(ys, list) else [ys],
                    anchor or f"{get_column_letter(len(cols) + 2)}{r0 + (20 if ws._charts else 0)}", fmt=fmt, title=title)
        self.save()
        print(f"✓ {kind} chart on '{sheet}'")

    # ── summary / cover sheet ──
    def summary(self, kpis, *, title=None, subtitle=None, notes=None, sheet="Summary"):
        """First sheet: big title + KPI tiles. kpis: [(label, value or "=FORMULA", fmt?)]"""
        from openpyxl.styles import Alignment, Font, PatternFill
        t = self.theme
        ws = self._sheet(sheet, 0)
        ws.column_dimensions["A"].width = 3
        ws.cell(2, 2, title or self.title or "Summary").font = Font(name=TITLE_FONT, size=26, bold=True, color=_c(t.ink))
        ws.row_dimensions[2].height = 40
        if subtitle:
            ws.cell(3, 2, subtitle).font = Font(name=BODY_FONT, size=11, color=_c(t.muted))
        fill = PatternFill("solid", fgColor=_c(t.surface if not t.dark else "#F2F2F2"))
        acc = PatternFill("solid", fgColor=_c(t.accent))
        per = 4
        for i, k in enumerate(kpis):
            label, value = k[0], k[1]
            f = k[2] if len(k) > 2 else None
            r = 5 + (i // per) * 5
            c = 2 + (i % per) * 2
            for rr in range(r, r + 4):
                ws.cell(rr, c).fill = fill
            ws.cell(r, c).fill = acc
            ws.row_dimensions[r].height = 4
            ws.cell(r + 1, c, label).font = Font(name=BODY_FONT, size=10, bold=True, color=_c(t.muted))
            vc = ws.cell(r + 2, c, value)
            vc.font = Font(name=TITLE_FONT, size=24, bold=True, color=_c(t.ink))
            vc.alignment = Alignment(horizontal="left", vertical="center", indent=0)
            if f:
                vc.number_format = excel_format(f)
            ws.row_dimensions[r + 2].height = 36
            ws.column_dimensions[chr(64 + c)].width = 24
            ws.column_dimensions[chr(65 + c)].width = 3
            for rr in range(r + 1, r + 4):
                ws.cell(rr, c).alignment = Alignment(horizontal="left", indent=1, vertical="center")
        if notes:
            r = 6 + ((len(kpis) - 1) // per + 1) * 5
            ws.cell(r, 2, "NOTES").font = Font(name=BODY_FONT, size=9, bold=True, color=_c(t.accent if contrast(t.accent, "#FFFFFF") > 2.5 else t.ink))
            for i, n in enumerate(notes if isinstance(notes, list) else [notes], 1):
                ws.cell(r + i, 2, f"•  {n}").font = Font(name=BODY_FONT, size=11, color=_c(t.ink))
        ws.page_setup.orientation = "landscape"
        ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        self.wb.active = 0
        self.save()
        print(f"✓ summary sheet · {len(kpis)} KPIs")
        return ws

    def notes(self, lines, *, sheet="About", title="About this workbook"):
        """Method / sources / definitions sheet."""
        from openpyxl.styles import Alignment, Font
        t = self.theme
        ws = self._sheet(sheet)
        ws.column_dimensions["A"].width = 3
        ws.column_dimensions["B"].width = 110
        ws.cell(2, 2, title).font = Font(name=TITLE_FONT, size=18, bold=True, color=_c(t.ink))
        for i, ln in enumerate(lines, 4):
            c = ws.cell(i, 2, ln)
            c.font = Font(name=BODY_FONT, size=11, color=_c(t.ink))
            c.alignment = Alignment(wrap_text=True, vertical="top")
        self.save()
        print(f"✓ notes sheet '{sheet}'")


def _rows(df_or_rows, columns=None):
    try:
        import pandas as pd
        if isinstance(df_or_rows, pd.Series):
            df_or_rows = df_or_rows.reset_index()
        if isinstance(df_or_rows, pd.DataFrame):
            df = df_or_rows
            if not isinstance(df.index, pd.RangeIndex):
                df = df.reset_index()
            cols = [str(c) for c in df.columns]
            rows = []
            for r in df.itertuples(index=False):
                out = []
                for v in r:
                    if v is None or (isinstance(v, float) and v != v):
                        out.append(None)
                    elif hasattr(v, "item") and not hasattr(v, "year"):
                        out.append(v.item())
                    elif hasattr(v, "to_pydatetime"):
                        out.append(v.to_pydatetime().replace(tzinfo=None))
                    else:
                        out.append(v)
                rows.append(out)
            return rows, cols
    except ImportError:
        pass
    rows = [list(r) for r in df_or_rows]
    if columns is None:
        columns, rows = [str(c) for c in rows[0]], rows[1:]
    return rows, list(columns)


def _disp(v, f):
    if v is None:
        return ""
    if isinstance(v, float):
        return f"{v:,.2f}"
    if isinstance(v, int):
        return f"{v:,}"
    return str(v)

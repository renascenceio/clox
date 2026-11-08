"""Charts in the theme: native PowerPoint charts (editable) and matplotlib PNGs
(for PDFs, Word, data reports).

    from clox_kit import charts
    charts.png("bar", ["Q1","Q2","Q3"], {"Revenue": [1.2, 1.8, 2.4]},
               "/mnt/user-data/outputs/revenue.png", theme="studio", fmt="money")

kinds: bar (columns), barh, stacked, stacked100, barh_stacked, line, area,
       pie, donut, scatter (series values = [(x, y), ...])
fmt:   None | "int" | "1dp" | "2dp" | "pct" (0.34→34%) | "%" (34→34%) |
       "money" | "money:€" | "k" | "m" | any Excel number format string
"""
from __future__ import annotations

import os

from .theme import Theme, mix, on, theme as _theme

KINDS = ("bar", "column", "barh", "stacked", "stacked100", "barh_stacked", "line", "area", "pie", "donut",
         "scatter")


def excel_format(fmt: str | None, values=None) -> str:
    if not fmt:
        return "General"
    if fmt.startswith("money"):
        sym = fmt.split(":", 1)[1] if ":" in fmt else "$"
        small = values is not None and any(v is not None and abs(float(v)) < 10 and float(v) != int(float(v))
                                           for v in values)
        num = "#,##0.00" if small else "#,##0"
        return f'"{sym}"{num}' if len(sym) > 1 else f"{sym}{num}"
    return {
        "int": "#,##0", "1dp": "#,##0.0", "2dp": "#,##0.00", "pct": "0%", "pct1": "0.0%",
        "%": '0"%"', "k": '#,##0,"k"', "m": '#,##0.0,,"m"',
    }.get(fmt, fmt)


def fmt_value(v, fmt: str | None) -> str:
    if v is None:
        return ""
    try:
        v = float(v)
    except (TypeError, ValueError):
        return str(v)
    if not fmt:
        return f"{v:,.0f}" if abs(v) >= 100 or v == int(v) else f"{v:,.1f}"
    if fmt.startswith("money"):
        sym = fmt.split(":", 1)[1] if ":" in fmt else "$"
        if abs(v) >= 1e9:
            return f"{sym}{v / 1e9:,.1f}B"
        if abs(v) >= 1e6:
            return f"{sym}{v / 1e6:,.1f}M"
        if abs(v) >= 1e4:
            return f"{sym}{v / 1e3:,.0f}k"
        if abs(v) < 10 and v != int(v):
            return f"{sym}{v:,.2f}"
        return f"{sym}{v:,.0f}"
    return {
        "int": f"{v:,.0f}", "1dp": f"{v:,.1f}", "2dp": f"{v:,.2f}", "pct": f"{v * 100:.0f}%",
        "pct1": f"{v * 100:.1f}%", "%": f"{v:.0f}%", "k": f"{v / 1e3:,.0f}k", "m": f"{v / 1e6:,.1f}m",
    }.get(fmt, f"{v:,.2f}")


def _norm(series, categories):
    if isinstance(series, dict):
        return list(series.items())
    if series and isinstance(series[0], (list, tuple)) and len(series[0]) == 2 and isinstance(series[0][0], str):
        return [(n, v) for n, v in series]
    return [("Value", list(series))]


# ─── native PowerPoint charts ──────────────────────────────────────

def pptx_chart(cv, kind, categories, series, x, y, w, h, fmt=None, labels=None, legend=None):
    from lxml import etree
    from pptx.chart.data import CategoryChartData, XyChartData
    from pptx.enum.chart import XL_CHART_TYPE as CT, XL_LABEL_POSITION, XL_LEGEND_POSITION, XL_TICK_MARK
    from pptx.oxml.ns import qn
    from pptx.util import Pt

    t: Theme = cv.t
    PT = 0.5
    kind = "bar" if kind == "column" else kind
    types = {"bar": CT.COLUMN_CLUSTERED, "barh": CT.BAR_CLUSTERED, "stacked": CT.COLUMN_STACKED,
             "stacked100": CT.COLUMN_STACKED_100, "barh_stacked": CT.BAR_STACKED, "line": CT.LINE_MARKERS,
             "area": CT.AREA, "pie": CT.PIE, "donut": CT.DOUGHNUT, "scatter": CT.XY_SCATTER}
    if kind not in types:
        raise ValueError(f"chart kind {kind!r} not in {KINDS}")
    ser = _norm(series, categories)
    xf = excel_format(fmt, [v for _, vals in ser for v in vals] if kind != "scatter" else None)
    if kind == "scatter":
        cd = XyChartData()
        for name, pts in ser:
            s = cd.add_series(name)
            for px, py in pts:
                s.add_data_point(px, py)
    else:
        cd = CategoryChartData(number_format=xf)
        cd.categories = [str(c) for c in categories]
        for name, vals in ser:
            cd.add_series(str(name), [None if v is None else float(v) for v in vals])
    gf = cv.slide.shapes.add_chart(types[kind], cv.e(x), cv.e(y), cv.e(w), cv.e(h), cd)
    ch = gf.chart
    ch.has_title = False
    body_font = cv.map.get(t.font("body"), ("Aptos",))[0]
    ch.font.name = body_font
    ch.font.size = Pt(20 * PT)
    ch.font.color.rgb = cv._rgb(t.muted)

    multi = len(ser) > 1
    pie = kind in ("pie", "donut")
    show_legend = legend if legend is not None else (multi or pie)
    ch.has_legend = bool(show_legend)
    if show_legend:
        ch.legend.position = XL_LEGEND_POSITION.TOP if not pie else XL_LEGEND_POSITION.RIGHT
        ch.legend.include_in_layout = False
        ch.legend.font.size = Pt(20 * PT)
        ch.legend.font.color.rgb = cv._rgb(t.ink)

    plot = ch.plots[0]
    if pie:
        pts = plot.series[0].points
        for i in range(len(categories)):
            pts[i].format.fill.solid()
            pts[i].format.fill.fore_color.rgb = cv._rgb(t.color(i))
            pts[i].format.line.color.rgb = cv._rgb(t.bg)
            pts[i].format.line.width = Pt(2)
        plot.has_data_labels = True
        dl = plot.data_labels
        dl.show_percentage, dl.show_value, dl.show_category_name = True, False, False
        dl.number_format, dl.number_format_is_linked = "0%", False
        dl.font.size = Pt(20 * PT)
        dl.font.bold = True
        for i in range(len(categories)):
            pts[i].data_label.font.color.rgb = cv._rgb(on(t.color(i)))
            pts[i].data_label.font.size = Pt(20 * PT)
            pts[i].data_label.font.bold = True
        if kind == "donut":
            hole = plot._element.find(qn("c:holeSize"))
            if hole is None:
                hole = etree.SubElement(plot._element, qn("c:holeSize"))
            hole.set("val", "62")
    else:
        va, ca = ch.value_axis, ch.category_axis
        va.has_major_gridlines = True
        va.major_gridlines.format.line.color.rgb = cv._rgb(t.rule)
        va.major_gridlines.format.line.width = Pt(0.75)
        va.format.line.fill.background()
        va.major_tick_mark = XL_TICK_MARK.NONE
        va.minor_tick_mark = XL_TICK_MARK.NONE
        va.tick_labels.font.size = Pt(18 * PT)
        va.tick_labels.font.color.rgb = cv._rgb(t.muted)
        if kind != "scatter":
            va.tick_labels.number_format = xf if kind != "stacked100" else "0%"
            va.tick_labels.number_format_is_linked = False
        ca.format.line.color.rgb = cv._rgb(t.rule)
        ca.major_tick_mark = XL_TICK_MARK.NONE
        ca.tick_labels.font.size = Pt(20 * PT)
        ca.tick_labels.font.color.rgb = cv._rgb(t.ink if not multi else t.muted)
        if kind in ("barh", "barh_stacked"):
            try:
                ca.reverse_order = True
            except AttributeError:
                pass
        if kind in ("bar", "barh", "stacked", "stacked100", "barh_stacked"):
            plot.gap_width = 55 if not multi else 80
            plot.overlap = 100 if "stacked" in kind else (-8 if multi else 0)
        for i, s in enumerate(plot.series):
            col = t.color(i)
            if kind in ("line", "scatter"):
                s.format.line.color.rgb = cv._rgb(col)
                s.format.line.width = Pt(3.2 * PT * 2)
                s.smooth = False
                from pptx.enum.chart import XL_MARKER_STYLE
                s.marker.style = XL_MARKER_STYLE.CIRCLE
                s.marker.size = 7 if len(categories or []) <= 12 or kind == "scatter" else 2
                s.marker.format.fill.solid()
                s.marker.format.fill.fore_color.rgb = cv._rgb(col)
                s.marker.format.line.color.rgb = cv._rgb(t.bg)
                if kind == "scatter":
                    s.format.line.fill.background()
            else:
                s.format.fill.solid()
                s.format.fill.fore_color.rgb = cv._rgb(col if kind != "area" else mix(col, t.bg, 0.15 * i))
                s.format.line.fill.background()
        want_labels = labels if labels is not None else (
            not multi and kind in ("bar", "barh") and len(categories) <= 12)
        if want_labels:
            plot.has_data_labels = True
            dl = plot.data_labels
            dl.number_format, dl.number_format_is_linked = xf, False
            dl.position = XL_LABEL_POSITION.OUTSIDE_END if "stacked" not in kind else XL_LABEL_POSITION.CENTER
            dl.font.size = Pt(20 * PT)
            dl.font.bold = True
            dl.font.color.rgb = cv._rgb(t.ink if "stacked" not in kind else on(t.color(0)))

    # Transparent chart + plot area so the slide background shows through.
    cs = ch._chartSpace
    def no_fill_sppr():
        sp = etree.Element(qn("c:spPr"))
        etree.SubElement(sp, qn("a:noFill"))
        ln = etree.SubElement(sp, qn("a:ln"))
        etree.SubElement(ln, qn("a:noFill"))
        return sp
    chart_el = cs.find(qn("c:chart"))
    for old in cs.findall(qn("c:spPr")):
        cs.remove(old)
    chart_el.addnext(no_fill_sppr())
    pa = chart_el.find(qn("c:plotArea"))
    for old in pa.findall(qn("c:spPr")):
        pa.remove(old)
    pa.append(no_fill_sppr())
    rc = cs.find(qn("c:roundedCorners"))
    if rc is None:
        rc = etree.Element(qn("c:roundedCorners"))
        cs.insert(0, rc)
    rc.set("val", "0")
    return ch


# ─── matplotlib PNG charts ─────────────────────────────────────────

_MPL_READY = False


def _mpl(t: Theme):
    global _MPL_READY
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager
    from .text import FONT_DIR
    if not _MPL_READY:
        for fn in os.listdir(FONT_DIR):
            if fn.endswith(".ttf"):
                font_manager.fontManager.addfont(os.path.join(FONT_DIR, fn))
        _MPL_READY = True
    body = {"inter": "Inter", "editorial": "Inter", "grotesk": "Inter"}[t.fonts]
    plt.rcParams.update({
        "font.family": body, "font.size": 10, "text.color": t.ink, "axes.labelcolor": t.muted,
        "xtick.color": t.muted, "ytick.color": t.muted, "axes.edgecolor": t.rule,
        "axes.facecolor": "none", "figure.facecolor": "none", "savefig.facecolor": "none",
        "axes.spines.top": False, "axes.spines.right": False, "axes.spines.left": False,
        "axes.grid": True, "axes.grid.axis": "y", "grid.color": t.rule, "grid.linewidth": 0.8,
        "xtick.major.size": 0, "ytick.major.size": 0, "axes.axisbelow": True,
        "legend.frameon": False, "axes.titleweight": "semibold", "axes.titlesize": 12,
        "axes.titlelocation": "left", "axes.titlepad": 12, "axes.prop_cycle": matplotlib.cycler(color=list(t.series)),
    })
    return plt


def png(kind, categories, series, path, theme=None, *, w=1600, h=900, fmt=None, title=None, labels=None,
        legend=None, transparent=False, dpi=300, highlight=None):
    """Render a themed chart to PNG and return its path. `w`/`h` are canvas px
    (1920 = a full slide width); the image is drawn at `dpi` for crisp output."""
    t = _theme(theme) if not isinstance(theme, Theme) else theme
    plt = _mpl(t)
    from matplotlib.ticker import FuncFormatter
    kind = "bar" if kind == "column" else kind
    ser = _norm(series, categories)
    multi = len(ser) > 1
    fig, ax = plt.subplots(figsize=(w * 0.5 / 72, h * 0.5 / 72))
    if not transparent:
        fig.patch.set_facecolor(t.bg)
        fig.patch.set_alpha(1)
    cats = [str(c) for c in (categories or [])]
    n = len(cats)
    import numpy as np
    idx = np.arange(n)
    vf = FuncFormatter(lambda v, _: fmt_value(v, fmt if fmt != "pct" or kind != "stacked100" else "pct"))

    if kind in ("pie", "donut"):
        ax.grid(False)
        vals = [float(v or 0) for v in ser[0][1]]
        cols = [t.color(i) for i in range(n)]
        wedges, _t, autot = ax.pie(
            vals, colors=cols, startangle=90, counterclock=False, autopct="%1.0f%%", pctdistance=0.78 if kind == "donut" else 0.65,
            wedgeprops=dict(width=0.42 if kind == "donut" else 1, edgecolor=t.bg, linewidth=2),
            textprops=dict(fontsize=10, fontweight="bold"))
        for a, c in zip(autot, cols):
            a.set_color(on(c))
        ax.set_aspect("equal")
        if legend is not False:
            ax.legend(wedges, cats, loc="center left", bbox_to_anchor=(1.0, 0.5), fontsize=10, labelcolor=t.ink)
    elif kind == "scatter":
        ax.grid(True, axis="both")
        for i, (name, pts) in enumerate(ser):
            xs, ys = zip(*pts) if pts else ([], [])
            ax.scatter(xs, ys, s=36, color=t.color(i), alpha=0.9, edgecolors=t.bg, linewidths=0.6, label=name)
        ax.yaxis.set_major_formatter(vf)
    elif kind in ("barh", "barh_stacked"):
        ax.grid(True, axis="x")
        ax.grid(False, axis="y")
        ax.spines["bottom"].set_visible(False)
        ax.spines["left"].set_visible(True)
        hgt = 0.62 / (1 if kind == "barh_stacked" or not multi else len(ser))
        left = np.zeros(n)
        for i, (name, vals) in enumerate(ser):
            v = np.array([float(x or 0) for x in vals])
            if kind == "barh_stacked":
                bars = ax.barh(idx, v, hgt, left=left, color=t.color(i), label=name)
                left += v
            else:
                off = (i - (len(ser) - 1) / 2) * hgt if multi else 0
                c = t.color(i) if multi or highlight is None else [t.accent if j == highlight else mix(t.accent, t.bg, 0.6) for j in range(n)]
                bars = ax.barh(idx + off, v, hgt, color=c, label=name)
                if (labels if labels is not None else not multi):
                    ax.bar_label(bars, labels=[fmt_value(x, fmt) for x in v], padding=4, fontsize=9.5, color=t.ink, fontweight="semibold")
        ax.set_yticks(idx, cats, color=t.ink)
        ax.invert_yaxis()
        ax.xaxis.set_major_formatter(vf)
    elif kind in ("bar", "stacked", "stacked100"):
        bw = 0.64 / (1 if kind != "bar" or not multi else len(ser))
        bottom = np.zeros(n)
        totals = np.sum([[float(x or 0) for x in v] for _, v in ser], axis=0) if kind == "stacked100" else None
        for i, (name, vals) in enumerate(ser):
            v = np.array([float(x or 0) for x in vals])
            if kind == "stacked100":
                v = np.divide(v, totals, out=np.zeros_like(v), where=totals != 0)
            if kind != "bar":
                bars = ax.bar(idx, v, bw, bottom=bottom, color=t.color(i), label=name)
                bottom += v
            else:
                off = (i - (len(ser) - 1) / 2) * bw if multi else 0
                c = t.color(i) if multi or highlight is None else [t.accent if j == highlight else mix(t.accent, t.bg, 0.6) for j in range(n)]
                bars = ax.bar(idx + off, v, bw, color=c, label=name)
                if (labels if labels is not None else (not multi and n <= 12)):
                    ax.bar_label(bars, labels=[fmt_value(x, fmt) for x in v], padding=3, fontsize=9.5, color=t.ink, fontweight="semibold")
        ax.set_xticks(idx, cats, color=t.ink if not multi else t.muted)
        ax.yaxis.set_major_formatter(vf if kind != "stacked100" else FuncFormatter(lambda v, _: f"{v * 100:.0f}%"))
        if n > 8:
            plt.setp(ax.get_xticklabels(), rotation=0, fontsize=8.5)
    elif kind in ("line", "area"):
        for i, (name, vals) in enumerate(ser):
            v = [None if x is None else float(x) for x in vals]
            col = t.color(i)
            if kind == "area":
                ax.fill_between(idx, [x or 0 for x in v], color=col, alpha=0.18, linewidth=0)
            ax.plot(idx, v, color=col, linewidth=2.4, label=name, marker="o" if n <= 12 else None, markersize=4.5,
                    markeredgecolor=t.bg, markeredgewidth=1.2, solid_capstyle="round")
            if not multi and n <= 12 and labels is not False and v and v[-1] is not None:
                ax.annotate(fmt_value(v[-1], fmt), (idx[-1], v[-1]), textcoords="offset points", xytext=(6, 6),
                            fontsize=9.5, color=t.ink, fontweight="semibold")
        step = max(1, n // 10)
        ax.set_xticks(idx[::step], cats[::step])
        ax.yaxis.set_major_formatter(vf)
        ax.margins(x=0.02)
    else:
        raise ValueError(f"chart kind {kind!r} not in {KINDS}")

    if title:
        ax.set_title(title, color=t.ink)
    if multi and kind not in ("pie", "donut") and legend is not False:
        ax.legend(loc="upper left", bbox_to_anchor=(0, 1.12), ncol=min(len(ser), 5), fontsize=9.5,
                  labelcolor=t.ink, handlelength=1, handleheight=1, columnspacing=1.4)
    fig.tight_layout(pad=0.4)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    fig.savefig(path, dpi=dpi, transparent=transparent)
    plt.close(fig)
    return path

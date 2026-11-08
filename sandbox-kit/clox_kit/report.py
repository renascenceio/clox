"""Designed PDF documents (reports, briefs, one-pagers) with the fonts embedded.
Built block by block across tool calls, like Deck.

    from clox_kit import Report
    r = Report("market-brief", theme="editorial", title="EV Market Brief", subtitle="Q4 2026", author="Research")
    r.cover(kicker="Research note")
    r.h1("Summary")
    r.takeaways(["Sales up 31% year on year", "China is 58% of volume", "Prices fell for the 6th quarter"])
    r.p("Battery prices kept falling in **every** region ...")
    r.kpis([("31%", "YoY growth"), ("17.1M", "Units"), ("$38k", "Avg. price")])
    r.chart("bar", years, {"Units (M)": units}, title="Global EV sales", fmt="1dp", caption="Source: IEA")
    r.table(["Region", "Units", "Share"], rows, fmt={"Share": "pct"})
"""
from __future__ import annotations

import json
import os
import re
import tempfile
from html import escape

from . import text as T
from .canvas import register_pdf_fonts
from .slides import _resolve, _state_dir, _theme_from_json, _theme_to_json, _pair, _is_num, jsonable
from .theme import Theme, contrast, mix, on, theme as _theme


def _inline(s: str) -> str:
    """Tiny markdown → reportlab markup: **bold**, *italic*, `code`, [text](url)."""
    s = escape(str(s), quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)", r"<i>\1</i>", s)
    s = re.sub(r"`(.+?)`", r'<font name="JetBrainsMono-Regular">\1</font>', s)
    s = re.sub(r"\[(.+?)\]\((https?://[^)]+)\)", r'<link href="\2"><u>\1</u></link>', s)
    return s


def _hx(c):
    from reportlab.lib.colors import HexColor
    return HexColor(c)


class Report:
    def __init__(self, name="report", theme=None, *, title=None, subtitle=None, author=None, date=None,
                 size="A4", new=False, **theme_overrides):
        self.path = _resolve(name, ".pdf")
        self._state_file = os.path.join(_state_dir(), os.path.basename(self.path) + ".json")
        st = {}
        if not new and os.path.exists(self._state_file):
            with open(self._state_file) as f:
                st = json.load(f)
        if theme is not None or theme_overrides or "theme" not in st:
            self.theme = theme if isinstance(theme, Theme) else _theme(theme, **theme_overrides)
        else:
            self.theme = _theme_from_json(st["theme"])
        self.meta = st.get("meta", {})
        for k, v in dict(title=title, subtitle=subtitle, author=author, date=date, size=size).items():
            if v is not None and (k != "size" or "size" not in self.meta or size != "A4"):
                self.meta[k] = v
        self.blocks = [] if new else st.get("blocks", [])
        if st and not new:
            print(f"reopened {os.path.basename(self.path)} · {len(self.blocks)} blocks · theme {self.theme.name}")

    # ── blocks ──
    def _add(self, _block_kind, **kw):
        kind = _block_kind
        self.blocks.append({"kind": kind, "args": {k: jsonable(v) for k, v in kw.items() if v is not None}})
        pages = self.save()
        label = kw.get("text") or kw.get("title") or ""
        label = (str(label)[:50] + "…") if len(str(label)) > 50 else label
        print(f"✓ {kind} {label} · {pages} pages")
        return self

    def cover(self, title=None, subtitle=None, *, kicker=None, meta=None, image=None):
        return self._add("cover", title=title or self.meta.get("title"), subtitle=subtitle or self.meta.get("subtitle"),
                         kicker=kicker, meta=meta or " · ".join(x for x in (self.meta.get("author"), self.meta.get("date")) if x),
                         image=image)

    def h1(self, text, *, kicker=None):
        return self._add("h1", text=text, kicker=kicker)

    def h2(self, text):
        return self._add("h2", text=text)

    def p(self, text):
        """Paragraph. Supports **bold**, *italic*, `code`, [link](https://...). Blank lines split paragraphs."""
        return self._add("p", text=text)

    def lead(self, text):
        """Larger intro paragraph."""
        return self._add("lead", text=text)

    def bullets(self, items, *, numbered=False):
        return self._add("bullets", items=items, numbered=numbered)

    def takeaways(self, items, *, title="Key takeaways"):
        return self._add("takeaways", items=items, title=title)

    def callout(self, text, *, title=None, tone="accent"):
        """tone: accent | positive | negative | neutral"""
        return self._add("callout", text=text, title=title, tone=tone)

    def kpis(self, items):
        """items: [(value, label, delta?)] — up to 4 per row."""
        return self._add("kpis", items=items)

    def table(self, columns, rows, *, fmt=None, highlight=None, title=None, caption=None, widths=None):
        return self._add("table", columns=jsonable(columns), rows=jsonable(rows), fmt=fmt, highlight=highlight,
                         title=title, caption=caption, widths=widths)

    def chart(self, kind, categories, series, *, title=None, caption=None, fmt=None, height=0.5, labels=None,
              legend=None):
        """height = fraction of content width (0.5 → half as tall as wide)."""
        return self._add("chart", kind=kind, categories=jsonable(categories) if categories is not None else [], series=series, title=title,
                         caption=caption, fmt=fmt, height=height, labels=labels, legend=legend)

    def image(self, path, *, caption=None, width=1.0):
        return self._add("image", path=path, caption=caption, width=width)

    def quote(self, text, *, who=None):
        return self._add("quote", text=text, who=who)

    def divider(self):
        return self._add("divider")

    def pagebreak(self):
        return self._add("pagebreak")

    def outline(self):
        for i, b in enumerate(self.blocks, 1):
            a = b["args"]
            print(f"{i:2d}. {b['kind']:<9} {str(a.get('text') or a.get('title') or '')[:70]}")

    def remove(self, n):
        self.blocks.pop(n - 1)
        print(f"removed block {n} · {self.save()} pages")

    def edit(self, n, **changes):
        self.blocks[n - 1]["args"].update(changes)
        print(f"✓ edited block {n} · {self.save()} pages")

    # ── render ──
    def save(self):
        from reportlab.lib.enums import TA_LEFT, TA_RIGHT
        from reportlab.lib.pagesizes import A4, letter
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.pdfbase.pdfmetrics import registerFontFamily
        from reportlab.platypus import (BaseDocTemplate, CondPageBreak, Frame, Image, KeepTogether, ListFlowable,
                                        ListItem, NextPageTemplate, PageBreak, PageTemplate, Paragraph, Spacer, Table,
                                        TableStyle)
        from .charts import fmt_value, png

        register_pdf_fonts()
        t = self.theme
        f = t.font
        registerFontFamily("Inter-Regular", normal="Inter-Regular", bold="Inter-Bold", italic="Inter-Italic",
                           boldItalic="Inter-Bold")
        page = letter if str(self.meta.get("size", "A4")).lower() == "letter" else A4
        PW, PH = page
        ML = MR = 20 * mm
        MT, MB = 24 * mm, 20 * mm
        CW = PW - ML - MR
        ink, muted, acc = _hx(t.ink), _hx(t.muted), _hx(t.accent if contrast(t.accent, t.bg) >= 2.6 else t.ink)
        serif = t.fonts == "editorial"
        S = {
            "body": ParagraphStyle("body", fontName=f("body"), fontSize=10.2, leading=15.6, textColor=ink,
                                   spaceAfter=7),
            "lead": ParagraphStyle("lead", fontName=f("body"), fontSize=13, leading=19.5, textColor=ink, spaceAfter=10),
            "h1": ParagraphStyle("h1", fontName=f("display"), fontSize=30 if serif else 23, leading=34 if serif else 28,
                                 textColor=ink, spaceBefore=6, spaceAfter=10),
            "h2": ParagraphStyle("h2", fontName=f("semibold"), fontSize=13.5, leading=18, textColor=ink, spaceBefore=10,
                                 spaceAfter=5),
            "kicker": ParagraphStyle("kicker", fontName=f("semibold"), fontSize=7.8, leading=10, textColor=acc,
                                     spaceAfter=4),
            "cap": ParagraphStyle("cap", fontName=f("body"), fontSize=8.2, leading=11.5, textColor=muted, spaceBefore=4,
                                  spaceAfter=12),
            "cell": ParagraphStyle("cell", fontName=f("body"), fontSize=8.8, leading=11.6, textColor=ink),
            "cellr": ParagraphStyle("cellr", fontName=f("body"), fontSize=8.8, leading=11.6, textColor=ink, alignment=TA_RIGHT),
            "head": ParagraphStyle("head", fontName=f("semibold"), fontSize=7.4, leading=9.5, textColor=muted),
            "headr": ParagraphStyle("headr", fontName=f("semibold"), fontSize=7.4, leading=9.5, textColor=muted,
                                    alignment=TA_RIGHT),
            "quote": ParagraphStyle("quote", fontName=f("italic") if serif else f("display_soft"), fontSize=17 if serif else 14.5,
                                    leading=23 if serif else 20.5, textColor=ink),
        }
        title = self.meta.get("title") or ""
        brand = self.meta.get("author") or ""
        has_cover = any(b["kind"] == "cover" for b in self.blocks)
        cover_args = next((b["args"] for b in self.blocks if b["kind"] == "cover"), {})

        def draw_cover(c, doc):
            c.saveState()
            c.setFillColor(_hx(t.hero))
            c.rect(0, 0, PW, PH, fill=1, stroke=0)
            o1 = t.accent2 if t.hero.lower() == t.accent.lower() else t.accent
            img = cover_args.get("image")
            if img and os.path.exists(img):
                from reportlab.lib.utils import ImageReader
                ir = ImageReader(img)
                iw, ih = ir.getSize()
                h_ = PH * 0.46
                s_ = max(PW / iw, h_ / ih)
                p_ = c.beginPath()
                p_.rect(0, PH - h_, PW, h_)
                c.clipPath(p_, stroke=0, fill=0)
                c.drawImage(ir, (PW - iw * s_) / 2, PH - h_ + (h_ - ih * s_) / 2, iw * s_, ih * s_)
                c.restoreState()
                c.saveState()
            else:
                c.setFillColor(_hx(o1))
                c.circle(PW * 0.92, PH * 0.86, PW * 0.52, fill=1, stroke=0)
                c.setFillColor(_hx(mix(t.hero, t.hero_ink, 0.08)))
                c.circle(PW * 1.02, PH * 0.42, PW * 0.24, fill=1, stroke=0)
            hink, hmut = _hx(t.hero_ink), _hx(t.hero_muted)
            x = ML
            if cover_args.get("kicker"):
                c.setFillColor(hink)
                c.setFont(f("semibold"), 9)
                c.drawString(x, PH - MT - 4, str(cover_args["kicker"]).upper())
            tw_ = CW * (0.86 if not img else 1)
            ttl = cover_args.get("title") or title
            size, lines, _ = T.fit(ttl, f("display"), tw_ * 2, PH * 0.42 * 2, 112, 48, lh=1.02)
            size_pt = size / 2
            sub = cover_args.get("subtitle")
            y = MB + 70
            if sub:
                s2, l2, _ = T.fit(sub, f("body"), tw_ * 2, 120 * 2, 32, 22, lh=1.3)
                c.setFillColor(hmut)
                for ln in reversed(l2):
                    c.setFont(f("body"), s2 / 2)
                    c.drawString(x, y, ln)
                    y += s2 / 2 * 1.3
                y += 18
            c.setFillColor(hink)
            for ln in reversed(lines):
                c.setFont(f("display"), size_pt)
                c.drawString(x, y, ln)
                y += size_pt * 1.02
            if cover_args.get("meta"):
                c.setFillColor(hmut)
                c.setFont(f("medium"), 9)
                c.drawString(x, MB, str(cover_args["meta"]))
            c.restoreState()

        def draw_page(c, doc):
            c.saveState()
            c.setFillColor(_hx(t.bg))
            c.rect(0, 0, PW, PH, fill=1, stroke=0)
            c.setFillColor(_hx(t.accent))
            c.rect(ML, PH - 13 * mm, 5, 5, fill=1, stroke=0)
            c.setFillColor(muted)
            c.setFont(f("medium"), 7.6)
            c.drawString(ML + 11, PH - 13 * mm, title[:90])
            c.setStrokeColor(_hx(t.rule))
            c.setLineWidth(0.6)
            c.line(ML, MB - 8 * mm + 6, PW - MR, MB - 8 * mm + 6)
            if brand:
                c.drawString(ML, MB - 8 * mm - 6, brand[:80])
            n = doc.page - (1 if has_cover else 0)
            c.drawRightString(PW - MR, MB - 8 * mm - 6, f"{n:02d}")
            c.restoreState()

        doc = BaseDocTemplate(self.path, pagesize=page, leftMargin=ML, rightMargin=MR, topMargin=MT, bottomMargin=MB,
                              title=title, author=brand)
        frame = Frame(ML, MB, CW, PH - MT - MB, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        templates = [PageTemplate(id="body", frames=[frame], onPage=draw_page)]
        if has_cover:
            templates.insert(0, PageTemplate(id="cover", frames=[frame], onPage=draw_cover))
        doc.addPageTemplates(templates)

        tmp = tempfile.mkdtemp()
        story = []
        if has_cover:
            story += [NextPageTemplate("body"), PageBreak()]

        def tone_colors(tone):
            base = {"positive": t.positive, "negative": t.negative, "neutral": t.muted}.get(tone, t.accent)
            return base, mix(t.bg, base, 0.1 if not t.dark else 0.18)

        for bi, b in enumerate(self.blocks):
            k, a = b["kind"], b["args"]
            if k == "cover":
                continue
            if k == "h1":
                parts = []
                if a.get("kicker"):
                    parts.append(Paragraph(escape(str(a["kicker"])).upper(), S["kicker"]))
                parts.append(Paragraph(_inline(a["text"]), S["h1"]))
                story += [CondPageBreak(120)] + [KeepTogether(parts)]
            elif k == "h2":
                story += [CondPageBreak(80), Paragraph(_inline(a["text"]), S["h2"])]
            elif k in ("p", "lead"):
                for para in re.split(r"\n\s*\n", str(a["text"]).strip()):
                    story.append(Paragraph(_inline(para.replace("\n", " ")), S[k if k == "lead" else "body"]))
            elif k == "bullets":
                items = [ListItem(Paragraph(_inline(i if isinstance(i, str) else f"**{_pair(i)[0]}** — {_pair(i)[1] or ''}"),
                                            S["body"]), leftIndent=14) for i in a["items"]]
                story.append(ListFlowable(items, bulletType="1" if a.get("numbered") else "bullet",
                                          start=None if a.get("numbered") else "■", bulletFontName=f("semibold"),
                                          bulletFontSize=6 if not a.get("numbered") else 9, bulletColor=acc,
                                          leftIndent=14, bulletOffsetY=-1 if not a.get("numbered") else 0))
                story.append(Spacer(1, 4))
            elif k in ("takeaways", "callout"):
                base, fill = tone_colors(a.get("tone", "accent"))
                inner = []
                if a.get("title"):
                    inner.append(Paragraph(escape(str(a["title"])).upper(),
                                           ParagraphStyle("ct", parent=S["kicker"], textColor=_hx(base if contrast(base, fill) > 2.4 else t.ink))))
                if k == "takeaways":
                    for i, it in enumerate(a["items"], 1):
                        inner.append(Paragraph(f'<font name="{f("semibold")}" color="{base}">{i:02d}</font>&nbsp;&nbsp;{_inline(it)}',
                                               ParagraphStyle("tk", parent=S["body"], fontSize=10.6, leading=15.5, spaceAfter=4)))
                else:
                    inner.append(Paragraph(_inline(a["text"]), ParagraphStyle("cb", parent=S["body"], spaceAfter=0)))
                tb = Table([[inner]], colWidths=[CW])
                tb.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), _hx(fill)), ("LEFTPADDING", (0, 0), (-1, -1), 16),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 16), ("TOPPADDING", (0, 0), (-1, -1), 13),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 11), ("ROUNDEDCORNERS", [min(t.radius, 14) / 2] * 4),
                    ("LINEBEFORE", (0, 0), (0, -1), 3, _hx(base)),
                ]))
                story += [Spacer(1, 4), tb, Spacer(1, 12)]
            elif k == "kpis":
                items = [_pair(i, 3) for i in a["items"]]
                per = min(4, len(items))
                gap = 8
                cw_ = (CW - gap * (per - 1)) / per
                rows_ = [items[i:i + per] for i in range(0, len(items), per)]
                any_delta = any(d_ for _, _, d_ in items)
                for row in rows_:
                    cells = []
                    for value, label, delta in row:
                        d = '<font size="8">&nbsp;</font><br/>' if any_delta else ""
                        if delta:
                            neg = str(delta).strip().startswith(("-", "−", "▼"))
                            col = t.negative if neg else t.positive
                            d = f'<font name="{f("semibold")}" size="8" color="{col}">{escape(str(delta))}</font><br/>'
                        vsize = 22 if per >= 4 else 26
                        cells.append([Paragraph(f'{d}<font name="{f("display")}" size="{vsize}">{escape(str(value))}</font>',
                                                ParagraphStyle("kv", parent=S["body"], leading=vsize * 1.08, spaceAfter=4)),
                                      Paragraph(escape(str(label or "")), ParagraphStyle("kl", parent=S["cap"], spaceBefore=0, spaceAfter=0))])
                    inner = []
                    for cell in cells:
                        ct = Table([[cell]], colWidths=[cw_])
                        ct.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), _hx(t.surface)),
                                                ("LEFTPADDING", (0, 0), (-1, -1), 13), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                                                ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                                                ("ROUNDEDCORNERS", [min(t.radius, 14) / 2] * 4)]))
                        inner.append(ct)
                    while len(inner) < per:
                        inner.append("")
                    outer = Table([inner], colWidths=[cw_ + (gap if i < per - 1 else 0) for i in range(per)])
                    outer.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), gap),
                                               ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), gap),
                                               ("VALIGN", (0, 0), (-1, -1), "TOP")]))
                    story.append(outer)
                story.append(Spacer(1, 8))
            elif k == "table":
                cols = a["columns"]
                fm = a.get("fmt") or {}
                hl = a.get("highlight")
                if isinstance(hl, str):
                    hl = cols.index(hl) if hl in cols else None

                def cell(ci, v):
                    fx = fm.get(cols[ci]) or fm.get(str(ci)) or fm.get(ci)
                    return fmt_value(v, fx) if fx else ("" if v is None else str(v))
                body = [[cell(ci, v) for ci, v in enumerate(r)] for r in a["rows"]]
                numeric = [all(_is_num(r[ci]) for r in body if r[ci] != "") and any(r[ci] for r in body)
                           for ci in range(len(cols))]
                data = [[Paragraph(escape(str(c)).upper(), S["headr" if numeric[ci] else "head"]) for ci, c in enumerate(cols)]]
                for r in body:
                    data.append([Paragraph(_inline(v), S["cellr" if numeric[ci] else "cell"]) for ci, v in enumerate(r)])
                if a.get("widths"):
                    widths = [CW * w_ / sum(a["widths"]) for w_ in a["widths"]]
                else:
                    nat = [max([T.width(str(c).upper(), f("semibold"), 7.4)] + [T.width(r[ci], f("body"), 8.8) for r in body]) + 16
                           for ci, c in enumerate(cols)]
                    nat = [min(max(n_, 40), CW * 0.5) for n_ in nat]
                    widths = [CW * n_ / sum(nat) for n_ in nat]
                tb = Table(data, colWidths=widths, repeatRows=1)
                style = [("LINEBELOW", (0, 0), (-1, 0), 0.9, ink), ("LINEBELOW", (0, 1), (-1, -2), 0.4, _hx(t.rule)),
                         ("TOPPADDING", (0, 0), (-1, -1), 5.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5.5),
                         ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                         ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]
                if hl is not None:
                    style.append(("BACKGROUND", (hl, 0), (hl, -1), _hx(mix(t.bg, t.accent, 0.1))))
                tb.setStyle(TableStyle(style))
                if a.get("title"):
                    story.append(Paragraph(_inline(a["title"]), S["h2"]))
                story += [tb]
                story.append(Paragraph(_inline(a["caption"]), S["cap"]) if a.get("caption") else Spacer(1, 12))
            elif k == "chart":
                hpx = CW * 2 * float(a.get("height", 0.5))
                out = os.path.join(tmp, f"c{bi}.png")
                png(a["kind"], a["categories"], a["series"], out, theme=t, w=CW * 2, h=hpx, fmt=a.get("fmt"),
                    labels=a.get("labels"), legend=a.get("legend"), transparent=True)
                parts = []
                if a.get("title"):
                    parts.append(Paragraph(_inline(a["title"]), S["h2"]))
                parts.append(Image(out, width=CW, height=CW * float(a.get("height", 0.5))))
                parts.append(Paragraph(_inline(a["caption"]), S["cap"]) if a.get("caption") else Spacer(1, 12))
                story.append(KeepTogether(parts))
            elif k == "image":
                from PIL import Image as PI
                iw, ih = PI.open(a["path"]).size
                wd = CW * float(a.get("width", 1.0))
                parts = [Image(a["path"], width=wd, height=wd * ih / iw)]
                parts.append(Paragraph(_inline(a["caption"]), S["cap"]) if a.get("caption") else Spacer(1, 12))
                story.append(KeepTogether(parts))
            elif k == "quote":
                inner = [Paragraph(_inline(a["text"]), S["quote"])]
                if a.get("who"):
                    inner.append(Spacer(1, 6))
                    inner.append(Paragraph(escape("— " + str(a["who"])), S["cap"]))
                tb = Table([[inner]], colWidths=[CW])
                tb.setStyle(TableStyle([("LINEBEFORE", (0, 0), (0, -1), 2.5, acc), ("LEFTPADDING", (0, 0), (-1, -1), 16),
                                        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
                story += [Spacer(1, 6), tb, Spacer(1, 14)]
            elif k == "divider":
                from reportlab.platypus.flowables import HRFlowable
                story.append(HRFlowable(width="100%", thickness=0.6, color=_hx(t.rule), spaceBefore=8, spaceAfter=14))
            elif k == "pagebreak":
                story.append(PageBreak())
        if len(story) <= (2 if has_cover else 0):
            story.append(Spacer(1, 1))
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        doc.build(story)
        with open(self._state_file, "w") as fh:
            json.dump({"theme": _theme_to_json(t), "meta": self.meta, "blocks": self.blocks}, fh)
        return doc.page

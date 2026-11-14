"""Two drawing backends with one API, so a slide is laid out once and drawn as
PowerPoint shapes or as a PDF page. Coordinates are canvas px on a 1920x1080 grid."""
from __future__ import annotations

import os

from . import text as T
from .theme import Theme, _rgb, mix

W, H = 1920, 1080
EMU = 6350          # 13.333in * 914400 / 1920
PT = 0.5            # 960pt page / 1920px

# How each layout font is named inside a .pptx: (name, bold, italic, factor[, measure_with]).
# `measure_with` = a metric-compatible open font, so text is fitted with the exact
# widths PowerPoint will use (Gelasio has Georgia's metrics). `factor` > 1 = the
# viewer's font is wider than the file we measure with, so we fit more conservatively.
OFFICE_FONTS = {
    "InterDisplay-Bold": ("Aptos Display", True, False, 1.0),
    "InterDisplay-SemiBold": ("Aptos Display", False, False, 1.0),
    "Inter-Regular": ("Aptos", False, False, 1.0),
    "Inter-Medium": ("Aptos", False, False, 1.0),
    "Inter-SemiBold": ("Aptos SemiBold", False, False, 1.02),
    "Inter-Bold": ("Aptos", True, False, 1.02),
    "Inter-Italic": ("Aptos", False, True, 1.0),
    "InstrumentSerif-Regular": ("Georgia", False, False, 1.02, "Gelasio-Regular"),
    "InstrumentSerif-Italic": ("Georgia", False, True, 1.02, "Gelasio-Italic"),
    "SpaceGrotesk-Bold": ("Aptos Display", True, False, 1.04),
    "SpaceGrotesk-Medium": ("Aptos Display", False, False, 1.04),
    "JetBrainsMono-Regular": ("Consolas", False, False, 1.0),
}
GOOGLE_FONTS = {
    "InterDisplay-Bold": ("Inter", True, False, 1.0),
    "InterDisplay-SemiBold": ("Inter", False, False, 1.0),
    "Inter-Regular": ("Inter", False, False, 1.0),
    "Inter-Medium": ("Inter Medium", False, False, 1.0),
    "Inter-SemiBold": ("Inter SemiBold", False, False, 1.0),
    "Inter-Bold": ("Inter", True, False, 1.0),
    "Inter-Italic": ("Inter", False, True, 1.0),
    "InstrumentSerif-Regular": ("Instrument Serif", False, False, 1.0),
    "InstrumentSerif-Italic": ("Instrument Serif", False, True, 1.0),
    "SpaceGrotesk-Bold": ("Space Grotesk", True, False, 1.0),
    "SpaceGrotesk-Medium": ("Space Grotesk", False, False, 1.0),
    "JetBrainsMono-Regular": ("JetBrains Mono", False, False, 1.0),
}


class Canvas:
    """Shared text fitting. Subclasses draw."""

    def __init__(self, theme: Theme):
        self.t = theme
        self.warnings: list[str] = []

    def factor(self, font: str) -> float:
        return 1.0

    def mfont(self, font: str) -> str:
        """The font file whose widths match what the viewer will actually draw."""
        return font

    def fit(self, s, font, w, h, size, min_size=None, lh=1.15, tracking=0.0, max_lines=None):
        font = T.resolve(str(s), font)[0]
        size_, lines, ok = T.fit(s, self.mfont(font), w, h, size, min_size, lh, tracking, max_lines,
                                 self.factor(font))
        if not ok:
            short = (s[:40] + "…") if len(s) > 40 else s
            self.warnings.append(f'text did not fit: "{short}" — shorten it')
        return size_, lines, ok

    def text(self, x, y, w, h, s, *, role="body", size=28, color=None, align="left", valign="top",
             lh=1.18, min_size=None, tracking=0.0, upper=False, max_lines=None):
        """Draw text fitted to the box. Returns the height actually used."""
        if s is None or s == "":
            return 0
        s = str(s)
        if upper:
            s = s.upper()
        font = self.t.font(role) if role in ("display", "display_soft", "body", "medium", "semibold", "bold",
                                              "italic", "mono") else role
        font, flow = T.resolve(s, font)
        if flow.rtl and align == "left":
            align = "right"
        if flow.shaped:
            tracking = 0.0   # spacing letters apart breaks joined scripts
        self.flow = flow
        size_, lines, _ = self.fit(s, font, w, h, size, min_size, lh, tracking, max_lines)
        used = len(lines) * size_ * lh
        top = y
        if valign == "middle":
            top = y + (h - used) / 2
        elif valign == "bottom":
            top = y + h - used
        self._draw_text(x, top, w, used, s, lines, font, size_, color or self.t.ink, align, lh, tracking)
        self.flow = T.PLAIN
        return used

    flow = T.PLAIN

    def measure(self, s, role="body", size=28, w=1000, lh=1.18, upper=False):
        if not s:
            return 0
        s = str(s).upper() if upper else str(s)
        font = T.resolve(s, self.t.font(role))[0]
        return T.block_height(s, self.mfont(font), size * self.factor(font), w, lh) / self.factor(font)


# ─── PowerPoint ────────────────────────────────────────────────────

class PptxCanvas(Canvas):
    def __init__(self, theme, prs, slide, fonts="office"):
        super().__init__(theme)
        from pptx.util import Emu
        self.Emu = Emu
        self.prs, self.slide = prs, slide
        self.map = GOOGLE_FONTS if fonts == "google" else OFFICE_FONTS

    def e(self, v):
        return self.Emu(int(round(v * EMU)))

    def entry(self, font):
        if font in self.map:
            return self.map[font]
        from .fonts import is_google, pptx_name
        if is_google(font):
            name, bold, italic = pptx_name(font)
            return (name, bold, italic, 1.0)
        return ("Aptos", False, False, 1.0)

    def factor(self, font):
        # 3% headroom: PowerPoint, Keynote and LibreOffice round and hint glyphs
        # differently, and a line measured to the last pixel wraps in one of them.
        return self.entry(font)[3] * 1.03

    def mfont(self, font):
        e = self.entry(font)
        return e[4] if len(e) > 4 else font

    def font_name(self, font):
        return self.entry(font)[0]

    def _rgb(self, hexstr):
        from pptx.dml.color import RGBColor
        return RGBColor(*_rgb(hexstr))

    def _plain(self, shape):
        # python-pptx gives autoshapes a theme style (shadow, outline). Remove it.
        from pptx.oxml.ns import qn
        st = shape._element.find(qn("p:style"))
        if st is not None:
            shape._element.remove(st)

    def _alpha(self, shape, alpha):
        if alpha is None or alpha >= 1:
            return
        from lxml import etree
        from pptx.oxml.ns import qn
        clr = shape._element.spPr.find(".//" + qn("a:srgbClr"))
        if clr is not None:
            a = etree.SubElement(clr, qn("a:alpha"))
            a.set("val", str(int(alpha * 100000)))

    def background(self, color):
        bg = self.slide.background.fill
        bg.solid()
        bg.fore_color.rgb = self._rgb(color)

    def rect(self, x, y, w, h, fill, radius=0, line=None, line_w=0, alpha=None):
        from pptx.enum.shapes import MSO_SHAPE
        from pptx.util import Pt
        kind = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
        s = self.slide.shapes.add_shape(kind, self.e(x), self.e(y), self.e(w), self.e(h))
        self._plain(s)
        if radius:
            s.adjustments[0] = min(0.5, radius / max(1, min(w, h)))
        if fill:
            s.fill.solid()
            s.fill.fore_color.rgb = self._rgb(fill)
            self._alpha(s, alpha)
        else:
            s.fill.background()
        if line:
            s.line.color.rgb = self._rgb(line)
            s.line.width = Pt(line_w * PT)
        else:
            s.line.fill.background()
        return s

    def ellipse(self, x, y, w, h, fill, line=None, line_w=0):
        from pptx.enum.shapes import MSO_SHAPE
        from pptx.util import Pt
        s = self.slide.shapes.add_shape(MSO_SHAPE.OVAL, self.e(x), self.e(y), self.e(w), self.e(h))
        self._plain(s)
        if fill:
            s.fill.solid()
            s.fill.fore_color.rgb = self._rgb(fill)
        else:
            s.fill.background()
        if line:
            s.line.color.rgb = self._rgb(line)
            s.line.width = Pt(line_w * PT)
        else:
            s.line.fill.background()
        return s

    def line(self, x1, y1, x2, y2, color, width=2):
        # A thin rectangle draws crisper than a connector at any zoom.
        if abs(y2 - y1) < 0.01:
            return self.rect(min(x1, x2), y1 - width / 2, abs(x2 - x1), width, color)
        if abs(x2 - x1) < 0.01:
            return self.rect(x1 - width / 2, min(y1, y2), width, abs(y2 - y1), color)
        from pptx.enum.shapes import MSO_CONNECTOR
        from pptx.util import Pt
        c = self.slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, self.e(x1), self.e(y1), self.e(x2), self.e(y2))
        c.line.color.rgb = self._rgb(color)
        c.line.width = Pt(width * PT)
        return c

    def _draw_text(self, x, top, w, used, s, lines, font, size, color, align, lh, tracking):
        from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
        from pptx.util import Pt
        from pptx.oxml.ns import qn
        name, bold, italic = self.entry(font)[:3]
        # Give PowerPoint a little slack so a slightly wider viewer font
        # re-wraps inside the box instead of spilling past it.
        tb = self.slide.shapes.add_textbox(self.e(x), self.e(top), self.e(w), self.e(used + size * 0.2))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.auto_size = None
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = MSO_ANCHOR.TOP
        al = {"left": PP_ALIGN.LEFT, "center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT}[align]
        for i, para in enumerate(s.split("\n")):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = al
            p.line_spacing = lh * 0.92
            if self.flow.rtl:
                p._p.get_or_add_pPr().set("rtl", "1")
            r = p.add_run()
            r.text = para
            f = r.font
            f.name = name
            f.size = Pt(size * PT)
            f.bold = bold
            f.italic = italic
            f.color.rgb = self._rgb(color)
            rpr = r._r.get_or_add_rPr()
            if tracking:
                rpr.set("spc", str(int(tracking * size * PT * 100)))
            for tag in ("a:latin", "a:ea", "a:cs"):
                el = rpr.find(qn(tag))
                if el is None:
                    from lxml import etree
                    el = etree.SubElement(rpr, qn(tag))
                el.set("typeface", name)

    def image(self, path, x, y, w, h, fit="cover", radius=0):
        from PIL import Image
        pic = self.slide.shapes.add_picture(path, self.e(x), self.e(y), self.e(w), self.e(h))
        iw, ih = Image.open(path).size
        box, img = w / h, iw / ih
        if fit == "cover":
            if img > box:
                c = (1 - box / img) / 2
                pic.crop_left = pic.crop_right = c
            else:
                c = (1 - img / box) / 2
                pic.crop_top = pic.crop_bottom = c
        else:
            # contain: shrink the frame instead of cropping
            if img > box:
                nh = w / img
                pic.top, pic.height = self.e(y + (h - nh) / 2), self.e(nh)
            else:
                nw = h * img
                pic.left, pic.width = self.e(x + (w - nw) / 2), self.e(nw)
        if radius:
            from pptx.oxml.ns import qn
            geom = pic._element.spPr.find(qn("a:prstGeom"))
            if geom is not None:
                geom.set("prst", "roundRect")
        return pic

    def chart(self, kind, categories, series, x, y, w, h, fmt=None, labels=None, legend=None, total=None):
        from .charts import pptx_chart
        pptx_chart(self, kind, categories, series, x, y, w, h, fmt=fmt, labels=labels, legend=legend)

    def notes(self, s):
        if s:
            self.slide.notes_slide.notes_text_frame.text = s


# ─── PDF ───────────────────────────────────────────────────────────

_REGISTERED: set[str] = set()


def pdf_font(name: str) -> str:
    """Register one font with reportlab the first time it is used. (The library
    holds ~600 files; parsing them all up front would cost seconds per PDF.)"""
    if name not in _REGISTERED:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        pdfmetrics.registerFont(TTFont(name, T.font_path(name)))
        _REGISTERED.add(name)
    return name


def register_pdf_fonts(theme=None):
    """The bundled fonts and every font the theme uses."""
    for fn in os.listdir(T.FONT_DIR):
        if fn.endswith(".ttf"):
            pdf_font(fn[:-4])
    if theme is not None:
        for role in ("display", "display_soft", "body", "medium", "semibold", "bold", "italic", "mono"):
            pdf_font(theme.font(role))


def pdf_family(font: str) -> str:
    """Register a fallback font as a reportlab family so <b> and <i> map onto it."""
    from reportlab.pdfbase.pdfmetrics import registerFontFamily
    pdf_font(font)
    if font.startswith("gf-"):
        fam, _, w, _ = T.style_of(font)
        bold = T._variant(fam, max(w, 700), False) or font
        registerFontFamily(font, normal=font, bold=pdf_font(bold), italic=font, boldItalic=pdf_font(bold))
    return font


def shaped_line(c, x_pt, base_pt, w_pt, text, font, size_pt, color, align, rtl):
    """One line of Arabic, Hebrew, Indic or Thai text: shaped and, for RTL
    scripts, laid out right to left (reportlab's Paragraph does the bidi work)."""
    from html import escape
    from reportlab.lib.colors import HexColor
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import Paragraph
    pdf_family(font)
    extra = size_pt * 4   # room so reportlab never re-wraps a line we already broke
    al = {"left": TA_LEFT, "center": TA_CENTER, "right": TA_RIGHT}[align]
    x0 = x_pt - (extra if align == "right" else extra / 2 if align == "center" else 0)
    st = ParagraphStyle("l", fontName=font, fontSize=size_pt, leading=size_pt, textColor=HexColor(color),
                        alignment=al, wordWrap="RTL" if rtl else None, shaping=1)
    p = Paragraph(escape(text, quote=False), st)
    p.wrap(w_pt + extra, size_pt * 4)
    # One line with leading = font size: its baseline sits on the bottom edge.
    p.drawOn(c, x0, base_pt)


def pdf_line(c, x_pt, base_pt, w_pt, text, font, size_pt, color, align="left"):
    """One line of any script on a reportlab canvas: picks a font that can write
    it, shapes it when needed, and right-aligns right-to-left text."""
    text = str(text)
    font, flow = T.resolve(text, font)
    if flow.rtl and align == "left":
        align = "right"
    if flow.shaped:
        shaped_line(c, x_pt, base_pt, w_pt, text, font, size_pt, color, align, flow.rtl)
        return
    from reportlab.lib.colors import HexColor
    c.setFillColor(HexColor(color))
    c.setFont(pdf_font(font), size_pt)
    if align == "right":
        c.drawRightString(x_pt + w_pt, base_pt, text)
    elif align == "center":
        c.drawCentredString(x_pt + w_pt / 2, base_pt, text)
    else:
        c.drawString(x_pt, base_pt, text)


class PdfCanvas(Canvas):
    def __init__(self, theme, c, tmpdir):
        super().__init__(theme)
        register_pdf_fonts(theme)
        self.c = c
        self.tmp = tmpdir

    def X(self, v):
        return v * PT

    def Y(self, v):
        return (H - v) * PT

    def _fill(self, color, alpha=None):
        r, g, b = _rgb(color)
        self.c.setFillColorRGB(r / 255, g / 255, b / 255)
        self.c.setFillAlpha(1 if alpha is None else alpha)

    def background(self, color):
        self.rect(0, 0, W, H, color)

    def rect(self, x, y, w, h, fill, radius=0, line=None, line_w=0, alpha=None):
        c = self.c
        c.saveState()
        if fill:
            self._fill(fill, alpha)
        if line:
            r, g, b = _rgb(line)
            c.setStrokeColorRGB(r / 255, g / 255, b / 255)
            c.setLineWidth(line_w * PT)
        args = (self.X(x), self.Y(y + h), w * PT, h * PT)
        if radius:
            c.roundRect(*args, min(radius, w / 2, h / 2) * PT, fill=1 if fill else 0, stroke=1 if line else 0)
        else:
            c.rect(*args, fill=1 if fill else 0, stroke=1 if line else 0)
        c.restoreState()

    def ellipse(self, x, y, w, h, fill, line=None, line_w=0):
        c = self.c
        c.saveState()
        if fill:
            self._fill(fill)
        if line:
            r, g, b = _rgb(line)
            c.setStrokeColorRGB(r / 255, g / 255, b / 255)
            c.setLineWidth(line_w * PT)
        c.ellipse(self.X(x), self.Y(y + h), self.X(x + w), self.Y(y), fill=1 if fill else 0, stroke=1 if line else 0)
        c.restoreState()

    def line(self, x1, y1, x2, y2, color, width=2):
        c = self.c
        c.saveState()
        r, g, b = _rgb(color)
        c.setStrokeColorRGB(r / 255, g / 255, b / 255)
        c.setLineWidth(width * PT)
        c.line(self.X(x1), self.Y(y1), self.X(x2), self.Y(y2))
        c.restoreState()

    def _draw_text(self, x, top, w, used, s, lines, font, size, color, align, lh, tracking):
        from reportlab.pdfbase import pdfmetrics
        c = self.c
        f = pdfmetrics.getFont(pdf_font(font))
        asc, desc = f.face.ascent / 1000, -f.face.descent / 1000
        sp = size * PT
        flow = self.flow
        c.saveState()
        self._fill(color)
        for i, ln in enumerate(lines):
            line_top = top + i * size * lh
            base = line_top + (size * lh - (asc + desc) * size) / 2 + asc * size
            if flow.shaped:
                shaped_line(c, self.X(x), self.Y(base), w * PT, ln, font, sp, color, align, flow.rtl)
                continue
            lw = pdfmetrics.stringWidth(ln, font, sp) + tracking * sp * max(0, len(ln) - 1)
            if align == "center":
                lx = self.X(x) + (w * PT - lw) / 2
            elif align == "right":
                lx = self.X(x) + w * PT - lw
            else:
                lx = self.X(x)
            to = c.beginText(lx, self.Y(base))
            to.setFont(font, sp)
            if tracking:
                to.setCharSpace(tracking * sp)
            to.textLine(ln)
            c.drawText(to)
        c.restoreState()

    def image(self, path, x, y, w, h, fit="cover", radius=0):
        from PIL import Image
        from reportlab.lib.utils import ImageReader
        c = self.c
        iw, ih = Image.open(path).size
        box, img = w / h, iw / ih
        c.saveState()
        p = c.beginPath()
        if radius:
            p.roundRect(self.X(x), self.Y(y + h), w * PT, h * PT, radius * PT)
        else:
            p.rect(self.X(x), self.Y(y + h), w * PT, h * PT)
        c.clipPath(p, stroke=0, fill=0)
        if (fit == "cover") == (img > box):
            dh, dw = h, h * img
        else:
            dw, dh = w, w / img
        dx, dy = x + (w - dw) / 2, y + (h - dh) / 2
        c.drawImage(ImageReader(path), self.X(dx), self.Y(dy + dh), dw * PT, dh * PT, mask="auto")
        c.restoreState()

    def chart(self, kind, categories, series, x, y, w, h, fmt=None, labels=None, legend=None, total=None):
        from .charts import png
        n = len(os.listdir(self.tmp)) if os.path.isdir(self.tmp) else 0
        out = os.path.join(self.tmp, f"chart-{n}.png")
        png(kind, categories, series, out, theme=self.t, w=w, h=h, fmt=fmt, labels=labels, legend=legend,
            transparent=True)
        self.image(out, x, y, w, h, fit="contain")

    def notes(self, s):
        pass

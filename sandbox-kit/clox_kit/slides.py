"""Decks that look designed. Every call adds one slide and saves, so a deck is
built across many small tool calls and nothing is lost if one fails.

    from clox_kit import Deck
    d = Deck("q3-review", theme="studio", title="Q3 Review", brand="Acme")
    d.cover("Q3 was our best quarter yet", "Board update · October 2026", kicker="Acme Inc.")
    d.kpis("The numbers", [("$4.2M", "Revenue", "+38%"), ("1,240", "Customers", "+212"), ("96%", "Retention", "+2pt")])

    # next tool call — the same line reopens the deck and continues:
    d = Deck("q3-review")
    d.chart("Revenue by month", "bar", months, {"Revenue": values}, fmt="money", takeaway="September alone beat Q1.")
    d.closing("Thank you", "Questions → cfo@acme.com")
    d.pdf()          # same deck as a PDF, fonts embedded
    d.check()        # design review: what to fix before you hand it over
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
import tempfile
from dataclasses import asdict

from .canvas import H, W, PdfCanvas, PptxCanvas
from .theme import Theme, contrast, luminance, mix, on, theme as _theme

OUT_DIR = os.environ.get("CLOX_OUT", "/mnt/user-data/outputs")
_HEX = re.compile(r"^\s*#?[0-9a-fA-F]{6}\s*$|^\s*#[0-9a-fA-F]{3}\s*$")
MX, BW = 120, 1680          # side margin, body width
BOTTOM = 944                # body content must end above this (footer below)


def _state_dir():
    for d in (os.environ.get("CLOX_STATE"), "/mnt/user-data/.clox", os.path.expanduser("~/.clox"), "/tmp/.clox"):
        if not d:
            continue
        try:
            os.makedirs(d, exist_ok=True)
            return d
        except OSError:
            continue
    return tempfile.gettempdir()


def _resolve(name: str, ext: str) -> str:
    if os.path.isabs(name):
        return name if name.endswith(ext) else name + ext
    base = re.sub(r"\.(pptx|pdf|xlsx|docx)$", "", name)
    return os.path.join(OUT_DIR, base + ext)


def _theme_to_json(t: Theme) -> dict:
    d = asdict(t)
    d["series"] = list(d["series"])
    return d


def _theme_from_json(d: dict) -> Theme:
    d = dict(d)
    d["series"] = tuple(d["series"])
    return Theme(**d)


def jsonable(v):
    """pandas / numpy / dates → plain JSON values, so slides can be saved and re-rendered."""
    pd = sys.modules.get("pandas")  # never import pandas just to check
    if pd is not None and isinstance(v, pd.DataFrame):
        return [jsonable(r) for r in v.values.tolist()]
    if hasattr(v, "tolist") and not isinstance(v, (str, bytes)):
        v = v.tolist()
    if isinstance(v, dict):
        return {str(k): jsonable(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [jsonable(x) for x in v]
    if hasattr(v, "strftime"):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and v != v:
        return None
    return v


def _pair(item, n=2):
    """Normalise "text" | (a, b) | {"title":..} into a fixed-length tuple."""
    if isinstance(item, dict):
        keys = ["value", "label", "delta"] if "value" in item else ["title", "body", "tag"]
        if "when" in item:
            keys = ["when", "what", "detail"]
        return tuple(item.get(k) for k in keys[:n])
    if isinstance(item, (list, tuple)):
        return tuple(list(item) + [None] * n)[:n]
    return (item,) + (None,) * (n - 1)


class Ctx:
    def __init__(self, deck, page, total, theme=None):
        self.deck, self.page, self.total = deck, page, total
        self.t: Theme = theme or deck.theme


# ─── shared pieces ─────────────────────────────────────────────────

def _accent_on(t: Theme, bg: str) -> str:
    if contrast(t.accent, bg) >= 2.6:
        return t.accent
    # Keep the hue: gold on white becomes bronze rather than switching to the second colour.
    toward = "#000000" if luminance(bg) > 0.35 else "#FFFFFF"
    for k in (0.18, 0.32, 0.46):
        c = mix(t.accent, toward, k)
        if contrast(c, bg) >= 2.6:
            return c
    if contrast(t.accent2, bg) >= 2.6:
        return t.accent2
    return on(bg)


def _kicker(cv, t, x, y, w, text, color, size=22):
    """Small label above a title. Luxe = smaller, lighter, widely tracked capitals."""
    if t.luxe:
        cv.text(x, y + 4, w, 30, text, role="medium", size=size * 0.78, color=color, upper=True,
                tracking=0.3, max_lines=1, min_size=13)
    else:
        cv.text(x, y, w, 34, text, role="semibold", size=size, color=color, upper=t.upper_kicker,
                tracking=0.12, max_lines=1, min_size=16)


def _mark(cv, t, x, y, color, w=56, h=8):
    """The short accent bar. Luxe draws a hairline instead."""
    if t.luxe:
        cv.rect(x, y + h / 2 - 1, 72, 2, color)
    else:
        cv.rect(x, y, w, h, color, radius=h / 2 if t.radius else 0)


def _panel(cv, t, x, y, w, h, fill, top_rule=None):
    """Card background. Luxe = no fill, a single hairline on top."""
    if t.luxe:
        cv.line(x, y, x + w, y, top_rule or t.rule, 1.5)
    else:
        cv.rect(x, y, w, h, fill, radius=t.radius)


def _header(cv, ctx, kicker, title, width=BW, x=MX, bg=None):
    t = ctx.t
    bg = bg or t.bg
    y = 104 if t.luxe else 92
    if kicker:
        _kicker(cv, t, x, y, width, kicker, _accent_on(t, bg))
        y += 56 if t.luxe else 48
    big = 1.2 if t.serif else 1.0   # serif faces read smaller at the same size
    size = (64 if t.luxe else 74) * big
    used = cv.text(x, y, width, 210 * big, title, role="display" if t.serif or not t.luxe else "display_soft",
                   size=size, min_size=40, lh=1.06 if t.luxe else 1.04,
                   color=t.ink if bg in (t.bg, t.surface) else on(bg), max_lines=2)
    return max(320 if t.luxe else 300, y + used + (88 if t.luxe else 64))


def _footer(cv, ctx, bg=None, right_x=MX + BW, color=None):
    t = ctx.t
    bg = bg or t.bg
    col = color or mix(t.ink if bg in (t.bg, t.surface) else on(bg), bg, 0.45)
    label = ctx.deck.footer_label
    lux = dict(upper=True, tracking=0.26, size=14) if t.luxe else dict(size=18)
    if label:
        cv.text(MX, 1000, 900, 30, label, role="medium", color=col, max_lines=1, **lux)
    cv.text(right_x - 200, 1000, 200, 30, f"{ctx.page:02d}", role="medium", color=col,
            align="right", max_lines=1, **lux)


def _orbs(cv, t: Theme, side="right"):
    o1 = t.accent2 if t.hero.lower() == t.accent.lower() else t.accent
    o2 = mix(t.hero, t.hero_ink, 0.08)
    if side == "right":
        cv.ellipse(1260, -300, 1020, 1020, o1)
        cv.ellipse(1540, 560, 600, 600, o2)
        cv.ellipse(1390, 380, 120, 120, t.hero)
    else:
        cv.ellipse(-360, 520, 980, 980, o1)
        cv.ellipse(-120, -260, 520, 520, o2)


def _points(cv, t, x, y, w, max_h, items, head=40, body=28, numbered=True, color=None, bg=None, spread=True,
            center=False):
    """Stacked list of (head, body). Shrinks until it fits. Returns height used."""
    bg = bg or t.bg
    ink = color or (t.ink if bg == t.bg else on(bg))
    sub = mix(ink, bg, 0.35)
    items = [_pair(i) for i in items]
    marker_w = 76 if numbered else 34
    tw = w - marker_w
    if len(items) <= 3:
        head, body = head + 4, body + 2
    for hs, bs, gap in ((head, body, 44), (head - 4, body - 2, 34), (head - 8, body - 3, 26),
                        (head - 12, body - 5, 20), (head - 16, body - 6, 16)):
        hs, bs = max(hs, 18), max(bs, 15)
        total = 0
        for h_, b_ in items:
            total += cv.measure(h_, "semibold", hs, tw, 1.16) + (10 + cv.measure(b_, "body", bs, tw, 1.3) if b_ else 0)
        total += gap * (len(items) - 1)
        if total <= max_h:
            break
    else:
        cv.warnings.append("too much text in this list ��� cut points or split the slide")
    if spread and len(items) > 1 and total < max_h:
        extra = min((max_h - total) / (len(items) - 1) * 0.5, 96 - gap) if gap < 96 else 0
        gap += max(0, extra)
        total += max(0, extra) * (len(items) - 1)
    if center and total < max_h:
        y += (max_h - total) * 0.45
    cy = y
    for i, (h_, b_) in enumerate(items):
        if numbered:
            cv.text(x, cy + 4, marker_w, hs, f"{i + 1:02d}", role="medium" if t.luxe else "semibold",
                    size=hs * (0.5 if t.luxe else 0.62), color=_accent_on(t, bg), max_lines=1,
                    tracking=0.16 if t.luxe else 0.04)
        elif t.luxe:
            cv.rect(x, cy + hs * 0.55, 18, 1.5, _accent_on(t, bg))
        else:
            cv.rect(x, cy + hs * 0.42, 12, 12, _accent_on(t, bg), radius=3)
        hh = cv.text(x + marker_w, cy, tw, hs * 4, h_, role="medium" if t.luxe else "semibold", size=hs, color=ink,
                     lh=1.16)
        cy += hh
        if b_:
            cy += 10
            cy += cv.text(x + marker_w, cy, tw, bs * 8, b_, role="body", size=bs, color=sub, lh=1.3)
        cy += gap
    return cy - y - gap


# ─── slide types ───────────────────────────────────────────────────

# Cover compositions. Each is a different layout, not a recolour — "versions of the
# title slide" must differ in structure (where the type sits, how big, what shapes).
COVER_LAYOUTS = {
    "orbs":   "colour field with large overlapping circles on the right, title bottom-left",
    "frame":  "quiet hairline frame inset from the edge, refined title (premium default)",
    "split":  "two panels: colour panel with the title, light side with an accent block and the details",
    "poster": "typographic poster: the title set huge across the slide, a colour strip with the subtitle",
    "band":   "light page crossed by a full-width colour band that carries the title",
    "grid":   "Swiss grid: rules, details at the top, accent square, big title bottom-left",
    "duo":    "two colour fields, one per side of a comparison (sides=('Dubai', 'Abu Dhabi')), title below",
    "shapes": "geometric composition (circle, half-circle, square) on the right, title on the left",
    "center": "centred, symmetrical title between fine rules — calm and formal",
    "photo":  "full-bleed photograph with a dark scrim, white title (needs image=)",
}


def default_cover_layout(t: Theme) -> str:
    if t.luxe:
        return "frame"
    return {"swiss": "grid", "editorial": "poster", "navy": "band", "forest": "split"}.get(t.name, "orbs")


def _sides(title, sides):
    if sides and len(sides) >= 2:
        return [str(sides[0]), str(sides[1])]
    m = re.split(r"\s+(?:vs\.?|versus|v\.?|×|x|or|&|and)\s+", str(title or ""), maxsplit=1, flags=re.I)
    if len(m) == 2 and all(0 < len(p.split()) <= 3 for p in m):
        return [m[0].strip(" :—-"), m[1].strip(" :—-")]
    return None


def _cover_title(cv, t, x, y, w, h, title, size, color, *, align="left", valign="bottom", max_lines=4, lh=None):
    return cv.text(x, y, w, h, title, role="display" if t.serif or not t.luxe else "display_soft",
                   size=size, min_size=56, lh=lh or (1.02 if t.luxe else 0.98), color=color, valign=valign,
                   max_lines=max_lines, align=align)


def s_cover(cv, ctx, title, subtitle=None, kicker=None, meta=None, image=None, layout=None, sides=None):
    t = ctx.t
    layout = (layout or "").lower().strip() or default_cover_layout(t)
    if layout == "photo" and not image:
        layout = "poster"
    if layout == "duo" and not _sides(title, sides):
        layout = "band"
    fn = _COVERS.get(layout)
    if fn is None:
        cv.warnings.append(f"unknown cover layout {layout!r} — use one of {', '.join(COVER_LAYOUTS)}")
        layout, fn = "orbs", None
    if fn:
        return fn(cv, t, title, subtitle, kicker, meta, image, sides)
    _cover_classic(cv, t, title, subtitle, kicker, meta, image, "orbs")


def _cover_classic(cv, t, title, subtitle, kicker, meta, image, layout):
    cv.background(t.hero)
    tw = 1120
    if image:
        cv.image(image, 1000, 0, 920, H)
        tw = 780
    elif layout == "frame":
        _frame(cv, t)
    else:
        _orbs(cv, t, "right")
    ink, mut = t.hero_ink, t.hero_muted
    if kicker:
        _kicker(cv, t, MX, 100, tw, kicker, _accent_on(t, t.hero) if t.luxe else ink)
    if meta:
        cv.text(MX, 960, tw, 34, meta, role="medium", size=22, color=mut, max_lines=1)
    sub_h = cv.measure(subtitle, "body", 34, tw, 1.3) if subtitle else 0
    bottom = 900 - (sub_h + 52 if subtitle else 0)
    if layout == "frame":
        _mark(cv, t, MX, 196, _accent_on(t, t.hero))
    cv.text(MX, 240, tw, bottom - 240, title, role="display" if t.serif or not t.luxe else "display_soft",
            size=124 if t.luxe else 140, min_size=60, lh=1.02 if t.luxe else 1.0, color=ink,
            valign="bottom", max_lines=4)
    if subtitle:
        cv.text(MX, bottom + 52, tw, sub_h + 4, subtitle, role="body", size=34, color=mut, lh=1.3)


def _frame(cv, t):
    """Luxe covers: a hairline frame inset from the edge instead of colour blobs."""
    c = mix(t.hero_ink, t.hero, 0.72)
    cv.rect(48, 48, W - 96, H - 96, None, line=c, line_w=1.2)


def _pick(t, against, avoid=()):
    """First theme colour that shows on `against` and isn't one of `avoid`."""
    av = {a.lower() for a in avoid}
    for c in (t.accent, t.accent2, t.ink, t.muted):
        if c.lower() not in av and contrast(c, against) >= 1.35:
            return c
    return mix(against, on(against), 0.3)


def _field(t):
    """The cover's colour field: the hero colour, unless it is the page colour too (midnight, noir)."""
    return t.hero if contrast(t.hero, t.bg) >= 1.35 else _pick(t, t.bg)


def _sub(cv, t, x, y, w, subtitle, color, size=32, align="left", max_lines=3):
    if not subtitle:
        return 0
    return cv.text(x, y, w, size * 1.3 * max_lines, subtitle, role="body", size=size, color=color, lh=1.3,
                   align=align, max_lines=max_lines, min_size=20)


def _cover_split(cv, t, title, subtitle, kicker, meta, image, sides):
    cv.background(t.bg)
    pw = 1080
    panel = _field(t)
    cv.rect(0, 0, pw, H, panel)
    ink, mut = on(panel), mix(on(panel), panel, 0.38)
    rx, rw = pw, W - pw
    tw = pw - MX - 110
    if image:
        cv.image(image, rx, 0, rw, H)
        if kicker:
            _kicker(cv, t, MX, 100, tw, kicker, _accent_on(t, panel))
        if meta:
            cv.text(MX, 960, tw, 34, meta, role="medium", size=22, color=mut, max_lines=1)
    else:
        blk = _pick(t, t.bg, avoid=(panel,))
        cv.rect(rx, 0, rw, 440, blk)
        if kicker:
            _kicker(cv, t, rx + 72, 340, rw - 144, kicker, on(blk))
        cv.line(rx + 72, 860, W - MX, 860, t.rule if not t.dark else mix(t.ink, t.bg, 0.7), 2)
        if meta:
            cv.text(rx + 72, 890, rw - 144 - (MX - 72), 80, meta, role="medium", size=26, color=t.ink, lh=1.25,
                    max_lines=2)
    sub_h = cv.measure(subtitle, "body", 32, tw, 1.3) if subtitle else 0
    bottom = 900 - (sub_h + 44 if subtitle else 0)
    _mark(cv, t, MX, 200, _accent_on(t, panel))
    _cover_title(cv, t, MX, 250, tw, bottom - 250, title, 120 if not t.luxe else 108, ink)
    _sub(cv, t, MX, bottom + 44, tw, subtitle, mut)


def _cover_poster(cv, t, title, subtitle, kicker, meta, image, sides):
    cv.background(t.bg)
    acc = _accent_on(t, t.bg)
    if kicker:
        _kicker(cv, t, MX, 84, 1000, kicker, acc)
    if meta:
        cv.text(MX + BW - 700, 86, 700, 34, meta, role="medium", size=22, color=t.muted, align="right", max_lines=1)
    cv.line(MX, 146, MX + BW, 146, t.ink, 3 if not t.luxe else 1.5)
    strip = _field(t)
    sh = 230 if subtitle else 120
    _cover_title(cv, t, MX - 6, 176, BW + 6, H - sh - 176 - 40, title, 250, t.ink, max_lines=3,
                 lh=0.92 if not t.luxe else 1.0)
    cv.rect(0, H - sh, W, sh, strip)
    s_ink = on(strip)
    if subtitle:
        _sub(cv, t, MX, H - sh + 58, 1300, subtitle, s_ink, size=34, max_lines=2)
    dot = _pick(t, strip, avoid=(strip,))
    d = 72
    cv.ellipse(MX + BW - d, H - sh / 2 - d / 2, d, d, dot)


def _cover_band(cv, t, title, subtitle, kicker, meta, image, sides):
    cv.background(t.bg)
    band = _field(t)
    acc = _accent_on(t, t.bg)
    if kicker:
        _kicker(cv, t, MX, 150, 1200, kicker, acc)
    y1, y2 = 300, 780
    cv.rect(0, y1, W, y2 - y1, band)
    tab = _pick(t, band, avoid=(band,))
    cv.rect(MX + BW - 120, y1 - 60, 120, 120, tab, radius=0 if t.luxe else min(t.radius, 16))
    _cover_title(cv, t, MX, y1 + 60, 1500, y2 - y1 - 120, title, 150 if not t.luxe else 128, on(band),
                 valign="middle", max_lines=3)
    if subtitle:
        _sub(cv, t, MX, y2 + 50, 1300, subtitle, t.muted, size=32, max_lines=2)
    if meta:
        cv.text(MX, 980, BW, 34, meta, role="medium", size=22, color=t.muted, max_lines=1)


def _cover_grid(cv, t, title, subtitle, kicker, meta, image, sides):
    cv.background(t.bg)
    col = BW / 4
    rule = t.ink
    cv.line(MX, 140, MX + BW, 140, rule, 2)
    cv.line(MX, 960, MX + BW, 960, rule, 2)
    for k in range(1, 4):
        cv.line(MX + k * col, 140, MX + k * col, 164, rule, 2)
    if kicker:
        _kicker(cv, t, MX, 88, col * 2 - 40, kicker, t.ink, size=20)
    if meta:
        cv.text(MX + col * 2, 90, col * 2, 32, meta, role="medium", size=20, color=t.muted, align="right",
                max_lines=1)
    sq = 300
    cv.rect(MX + BW - sq, 200, sq, sq, _pick(t, t.bg))
    if subtitle:
        _sub(cv, t, MX, 200, col * 2 - 40, subtitle, t.muted, size=30, max_lines=4)
    _cover_title(cv, t, MX - 4, 540, BW - sq - 80, 380, title, 150, t.ink, max_lines=3, lh=0.95)
    cv.text(MX, 990, 400, 30, "01", role="medium", size=18, color=t.muted, max_lines=1)


def _cover_duo(cv, t, title, subtitle, kicker, meta, image, sides):
    a_name, b_name = _sides(title, sides)
    cv.background(t.bg)
    a = _field(t)
    b = _pick(t, a, avoid=(a, t.bg))
    if contrast(b, t.bg) < 1.2:
        b = mix(a, on(a), 0.22)
    top = 700
    half = W / 2
    cv.rect(0, 0, half, top, a)
    cv.rect(half, 0, half, top, b)
    role = "display" if t.serif or not t.luxe else "display_soft"
    nw, nh = half - MX - 80, top - 130 - 70
    lines_for = lambda nm: 1 if len(nm.split()) <= 2 else 2
    size = min(cv.fit(nm, t.font(role), nw, nh, 190, 72, 0.95, 0, lines_for(nm))[0] for nm in (a_name, b_name))
    for i, (name, fill) in enumerate(((a_name, a), (b_name, b))):
        x = (MX if i == 0 else half + 80)
        cv.text(x, 130, nw, nh, name, role=role, size=size, min_size=72, lh=0.95, color=on(fill), valign="bottom",
                max_lines=lines_for(name))
    d = 150
    cv.ellipse(half - d / 2, top - d / 2, d, d, t.bg)
    cv.text(half - d / 2, top - 34, d, 60, "vs", role="italic" if t.serif else "display_soft", size=52,
            color=t.ink, align="center", max_lines=1)
    y = top + 70
    if kicker:
        _kicker(cv, t, MX, y, 1100, kicker, _accent_on(t, t.bg), size=20)
        y += 44
    used = cv.text(MX, y, 1400, 150, title, role="display_soft" if not t.serif else "display", size=64, min_size=36,
                   lh=1.05, color=t.ink, max_lines=2)
    if subtitle:
        _sub(cv, t, MX, y + used + 16, 1400, subtitle, t.muted, size=26, max_lines=1)
    if meta:
        cv.text(MX + BW - 500, 1000, 500, 30, meta, role="medium", size=20, color=t.muted, align="right",
                max_lines=1)


def _cover_shapes(cv, t, title, subtitle, kicker, meta, image, sides):
    bg = t.bg
    cv.background(bg)
    c1 = _field(t)
    c2 = _pick(t, bg, avoid=(c1,))
    c3 = t.ink if contrast(t.ink, bg) > 3 else mix(bg, on(bg), 0.5)
    cv.ellipse(1190, 110, 600, 600, c1)
    cv.rect(1060, 640, 330, 330, c3)
    cv.ellipse(1440, 720, 560, 560, c2)
    cv.ellipse(1700, 96, 96, 96, c3)
    tw = 900
    if kicker:
        _kicker(cv, t, MX, 110, tw, kicker, _accent_on(t, bg))
    sub_h = cv.measure(subtitle, "body", 30, tw, 1.3) if subtitle else 0
    bottom = 880 - (sub_h + 40 if subtitle else 0)
    _cover_title(cv, t, MX, 220, tw, bottom - 220, title, 128, t.ink)
    _sub(cv, t, MX, bottom + 40, tw, subtitle, t.muted, size=30)
    if meta:
        cv.text(MX, 980, tw, 30, meta, role="medium", size=22, color=t.muted, max_lines=1)


def _cover_center(cv, t, title, subtitle, kicker, meta, image, sides):
    field = t.hero
    cv.background(field)
    ink, mut = on(field), mix(on(field), field, 0.4)
    rule = mix(ink, field, 0.7)
    cv.line(MX, 96, MX + BW, 96, rule, 1.5)
    cv.line(MX, 984, MX + BW, 984, rule, 1.5)
    acc = _accent_on(t, field)
    role = "display" if t.serif or not t.luxe else "display_soft"
    size, lines, _ = cv.fit(str(title), t.font(role), W - 520, 400, 120, 56, 1.04, 0, 3)
    th = len(lines) * size * 1.04
    sh = cv.measure(subtitle, "body", 30, W - 720, 1.3) if subtitle else 0
    block = 34 + 34 + 46 + th + (40 + sh if subtitle else 0)
    y = (H - block) / 2
    if kicker:
        cv.text(MX, y, BW, 34, kicker, role="medium", size=20, color=acc, upper=True, tracking=0.3, align="center",
                max_lines=1)
    cv.rect(W / 2 - 36, y + 68, 72, 2, acc)
    y += 114
    _cover_title(cv, t, 260, y, W - 520, th + 4, title, size, ink, align="center", valign="top", max_lines=3,
                 lh=1.04)
    if subtitle:
        _sub(cv, t, 360, y + th + 40, W - 720, subtitle, mut, size=30, align="center", max_lines=2)
    if meta:
        cv.text(MX, 1010, BW, 30, meta, role="medium", size=18, color=mut, upper=True, tracking=0.2, align="center",
                max_lines=1)


def _cover_photo(cv, t, title, subtitle, kicker, meta, image, sides):
    cv.background("#000000")
    cv.image(image, 0, 0, W, H)
    # Stacked thin layers approximate a gradient (no gradient fills in the canvas).
    for i in range(14):
        y = 320 + i * 50
        cv.rect(0, y, W, H - y, "#000000", alpha=0.075)
    for i in range(4):
        cv.rect(0, 0, W, 220 - i * 50, "#000000", alpha=0.08)
    if kicker:
        _kicker(cv, t, MX, 84, 1100, kicker, "#FFFFFF", size=20)
    if meta:
        cv.text(MX + BW - 700, 86, 700, 30, meta, role="medium", size=20, color="#E9E9EE", align="right",
                max_lines=1)
    sub_h = cv.measure(subtitle, "body", 32, 1400, 1.3) if subtitle else 0
    bottom = 950 - (sub_h + 36 if subtitle else 0)
    _mark(cv, t, MX, bottom - 380, t.accent if contrast(t.accent, "#000000") > 3 else "#FFFFFF")
    _cover_title(cv, t, MX, bottom - 340, 1500, 340, title, 132, "#FFFFFF", max_lines=3)
    _sub(cv, t, MX, bottom + 36, 1400, subtitle, "#E9E9EE", size=32, max_lines=2)


_COVERS = {
    "split": _cover_split, "poster": _cover_poster, "band": _cover_band, "grid": _cover_grid,
    "duo": _cover_duo, "shapes": _cover_shapes, "center": _cover_center, "photo": _cover_photo,
    "orbs": lambda cv, t, ti, su, k, m, im, sd: _cover_classic(cv, t, ti, su, k, m, im, "orbs"),
    "frame": lambda cv, t, ti, su, k, m, im, sd: _cover_classic(cv, t, ti, su, k, m, im, "frame"),
}


def s_closing(cv, ctx, title="Thank you", subtitle=None, contact=None):
    t = ctx.t
    cv.background(t.hero)
    if t.luxe:
        _frame(cv, t)
    else:
        _orbs(cv, t, "left")
    x, tw = (MX, 1400) if t.luxe else (760, 1040)
    cv.text(x, 260, tw, 420, title, role="display", size=132, min_size=60, lh=1.0, color=t.hero_ink,
            valign="bottom", max_lines=3)
    y = 720
    if subtitle:
        y += cv.text(x, y, tw, 120, subtitle, role="body", size=34, color=t.hero_muted, lh=1.3) + 24
    if contact:
        cv.text(x, y, tw, 100, contact, role="semibold", size=28, color=t.hero_ink, lh=1.3)


def s_section(cv, ctx, title, number=None, subtitle=None):
    t = ctx.t
    cv.background(t.hero)
    num = number if number is not None else ctx.deck._section_no(ctx.page)
    o1 = t.accent2 if t.hero.lower() == t.accent.lower() else t.accent
    label = f"{int(num):02d}" if str(num).isdigit() else str(num)
    if t.luxe:
        _frame(cv, t)
        acc = _accent_on(t, t.hero)
        _kicker(cv, t, MX, 330, 900, f"Chapter {label}" if str(num).isdigit() else label, acc)
        _mark(cv, t, MX, 384, acc)
    else:
        cv.text(MX, 110, 900, 260, label, role="display", size=240, color=o1, lh=1.0, max_lines=1)
    sub_h = cv.measure(subtitle, "body", 32, 1400, 1.3) if subtitle else 0
    bottom = 900 - (sub_h + 32 if subtitle else 0)
    cv.text(MX, 420, 1500, bottom - 420, title, role="display" if t.serif or not t.luxe else "display_soft",
            size=104 if t.luxe else 112, min_size=56, lh=1.04 if t.luxe else 1.02,
            color=t.hero_ink, valign="bottom", max_lines=3)
    if subtitle:
        cv.text(MX, bottom + 32, 1400, sub_h + 4, subtitle, role="body", size=32, color=t.hero_muted, lh=1.3)


def s_statement(cv, ctx, text, kicker=None, attribution=None, bg=None):
    t = ctx.t
    bgc = {"hero": t.hero, "surface": t.surface, None: t.bg}.get(bg, bg)
    cv.background(bgc)
    ink = t.ink if bgc in (t.bg, t.surface) else on(bgc)
    top = 180
    if kicker:
        _kicker(cv, t, MX, 110, BW, kicker, _accent_on(t, bgc))
    _mark(cv, t, MX, top, _accent_on(t, bgc), w=120, h=10)
    att_h = 70 if attribution else 0
    cv.text(MX, top + 60, 1560, 880 - top - 60 - att_h, text, role="display", size=92 if t.luxe else 104,
            min_size=44, lh=1.1 if t.luxe else 1.05, color=ink, valign="middle")
    if attribution:
        cv.text(MX, 880 - 40, BW, 40, attribution, role="medium", size=28, color=mix(ink, bgc, 0.35), max_lines=1)
    _footer(cv, ctx, bg=bgc)


def s_bullets(cv, ctx, title, points, kicker=None, aside=None, numbered=True):
    t = ctx.t
    cv.background(t.bg)
    y0 = _header(cv, ctx, kicker, title)
    avail = BOTTOM - y0
    items = [_pair(p) for p in points]
    if len(items) > 6:
        cv.warnings.append(f"{len(items)} points is a lot — 3 to 5 reads better")
    if aside:
        lw = 1040
        _points(cv, t, MX, y0, lw, avail, items, numbered=numbered)
        ax = MX + lw + 80
        aw = MX + BW - ax
        if t.luxe:
            cv.line(ax, y0, ax, y0 + avail, t.rule, 1.5)
        else:
            cv.rect(ax, y0, aw, avail, t.surface, radius=t.radius)
        _mark(cv, t, ax + 48, y0 + 52, _accent_on(t, t.bg if t.luxe else t.surface))
        cv.text(ax + 48, y0 + 92, aw - 96, avail - 140, aside, role="display_soft", size=44, min_size=26, lh=1.14,
                color=t.ink)
    elif len(items) >= 5 and not any(b for _, b in items):
        half = math.ceil(len(items) / 2)
        cw = (BW - 80) / 2
        _points(cv, t, MX, y0, cw, avail, items[:half], numbered=numbered)
        # second column continues the numbering
        sub = [(f"{h}", b) for h, b in items[half:]]
        cy = y0
        for i, (h_, _b) in enumerate(sub):
            n = half + i + 1
            hs = 36
            cv.text(MX + cw + 80, cy + 4, 76, hs, f"{n:02d}", role="medium" if t.luxe else "semibold",
                    size=hs * (0.5 if t.luxe else 0.62), color=_accent_on(t, t.bg), max_lines=1,
                    tracking=0.16 if t.luxe else 0)
            cy += cv.text(MX + cw + 80 + 76, cy, cw - 76, hs * 4, h_, role="semibold", size=hs, lh=1.16) + 40
    else:
        _points(cv, t, MX, y0, BW if len(items) > 2 else 1300, avail, items, numbered=numbered)
    _footer(cv, ctx)


def s_kpis(cv, ctx, title, items, kicker=None, note=None, highlight=None):
    t = ctx.t
    cv.background(t.bg)
    y0 = _header(cv, ctx, kicker, title)
    items = [_pair(i, 3) for i in items]
    n = len(items)
    cols = n if n <= 4 else 3
    rows = math.ceil(n / cols)
    gap = 32
    note_h = 70 if note else 0
    cw = (BW - gap * (cols - 1)) / cols
    ch = min(500, (BOTTOM - y0 - note_h - gap * (rows - 1)) / rows)
    pad = 44 if cols < 4 else 36
    if t.luxe:
        _kpis_luxe(cv, t, items, y0, cols, cw, gap, note, highlight)
        _footer(cv, ctx)
        return
    for i, (value, label, delta) in enumerate(items):
        r, c = divmod(i, cols)
        x, y = MX + c * (cw + gap), y0 + r * (ch + gap)
        hi = highlight == i
        fill = t.accent if hi else t.surface
        if t.luxe:
            # No boxes: a hairline over each figure; the highlight is the figure in the accent colour.
            fill = t.bg
            _panel(cv, t, x, y, cw, ch, fill, top_rule=_accent_on(t, t.bg) if hi else None)
            ink = _accent_on(t, t.bg) if hi else t.ink
            sub = t.muted
            pad = 0
            hi = False
        else:
            ink = on(fill) if hi else t.ink
            sub = mix(ink, fill, 0.35)
            cv.rect(x, y, cw, ch, fill, radius=t.radius)
        top = y + (36 if t.luxe else pad)
        if delta:
            ds = str(delta)
            neg = ds.strip().startswith(("-", "−", "▼", "↓"))
            pos = ds.strip().startswith(("+", "▲", "↑"))
            dcol = ink if hi else (t.negative if neg else t.positive if pos else t.accent)
            from .text import text_width as tw
            pw = tw(ds, t.font("semibold"), 22) + 40
            if t.luxe:
                cv.text(x, top + 8, cw, 30, ds, role="medium", size=21, color=dcol, max_lines=1, tracking=0.08)
            else:
                cv.rect(x + pad, top, pw, 46, mix(fill, dcol, 0.16 if not hi else 0.2), radius=23)
                cv.text(x + pad, top + 8, pw, 30, ds, role="semibold", size=23, color=dcol, align="center", max_lines=1)
        label_h = cv.measure(label, "body", 30, cw - 2 * pad, 1.25) if label else 0
        vbot = y + ch - pad - (label_h + 14 if label else 0)
        vtop = top + (66 if delta else 0)
        cv.text(x + pad, vtop, cw - 2 * pad - (24 if t.luxe else 0), vbot - vtop, value, role="display",
                size=min(130 if t.luxe else 150, (vbot - vtop)), min_size=40, lh=1.0, color=ink, valign="bottom",
                max_lines=1)
        if label:
            cv.text(x + pad, vbot + 14, cw - 2 * pad, label_h + 4, label, role="body", size=30, color=sub, lh=1.25)
    if note:
        cv.text(MX, BOTTOM - 44, BW, 44, note, role="body", size=22, color=t.muted, max_lines=2, lh=1.25)
    _footer(cv, ctx)


def _kpis_luxe(cv, t, items, y0, cols, cw, gap, note, highlight):
    """Figures under a hairline, read top-down: number, label, change. No boxes."""
    gap = 72
    cw = (BW - gap * (cols - 1)) / cols
    rows = math.ceil(len(items) / cols)
    room = BOTTOM - y0 - (70 if note else 0)
    ch = min(470, (room - 56 * (rows - 1)) / rows)
    y_start = y0 + max(0, (room - rows * ch - 56 * (rows - 1)) * 0.5)
    for i, (value, label, delta) in enumerate(items):
        r, c = divmod(i, cols)
        x, y = MX + c * (cw + gap), y_start + r * (ch + 56)
        hi = highlight == i
        acc = _accent_on(t, t.bg)
        cv.line(x, y, x + cw, y, acc if hi else t.rule, 1.5)
        vh = min(190 if rows == 1 and cols <= 3 else 140, ch * 0.46)
        cy = y + 48
        cy += cv.text(x, cy, cw, vh * 1.05, value, role="display", size=vh, min_size=48, lh=1.0,
                      color=acc if hi else t.ink, max_lines=1) + 24
        if label:
            cy += cv.text(x, cy, cw - 24, ch - (cy - y) - 40, label, role="body", size=30 if rows == 1 else 26,
                          color=t.muted, lh=1.3) + 18
        if delta:
            ds = str(delta).strip()
            neg = ds.startswith(("-", "−", "▼", "↓"))
            pos = ds.startswith(("+", "▲", "↑"))
            cv.text(x, cy, cw, 30, ds, role="medium", size=20, color=t.negative if neg else t.positive if pos else acc,
                    max_lines=1, tracking=0.12, upper=True)
    if note:
        cv.text(MX, BOTTOM - 44, BW, 44, note, role="body", size=22, color=t.muted, max_lines=2, lh=1.25)


def s_chart(cv, ctx, title, kind, categories, series, kicker=None, takeaway=None, points=None, fmt=None,
            source=None, labels=None, legend=None):
    t = ctx.t
    cv.background(t.bg)
    y0 = _header(cv, ctx, kicker, title)
    side = bool(takeaway or points)
    cw = 1100 if side else BW
    bottom = BOTTOM - (40 if source else 0)
    if kind not in ("pie", "donut", "scatter") and isinstance(series, dict) and len(series) > 1:
        peaks = {k: max((abs(float(v)) for v in vals if v is not None), default=0) for k, vals in series.items()}
        hi, lo = max(peaks.values()), min(peaks.values())
        if lo > 0 and hi / lo > 8:
            small = min(peaks, key=peaks.get)
            cv.warnings.append(f'"{small}" is on a much smaller scale than the other series and will draw as a '
                               f"flat line — give it its own chart or a kpis/cards slide")
    cv.chart(kind, categories, series, MX - 16, y0 - 8, cw + 16, bottom - y0 + 8, fmt=fmt, labels=labels,
             legend=legend)
    if side:
        px, pw = MX + cw + 90, BW - cw - 90
        cy = y0 + 8
        if takeaway:
            _mark(cv, t, px, cy, _accent_on(t, t.bg))
            cy += 40
            cy += cv.text(px, cy, pw, 380, takeaway, role="display_soft", size=50, min_size=28, lh=1.12) + 44
        if points:
            _points(cv, t, px, cy, pw, bottom - cy, [(p, None) if isinstance(p, str) else p for p in points],
                    head=30, body=24, numbered=False, spread=False)
    if source:
        cv.text(MX, BOTTOM - 28, BW, 28, source, role="body", size=18, color=t.muted, max_lines=1)
    _footer(cv, ctx)


def s_compare(cv, ctx, title, left, right, kicker=None):
    t = ctx.t
    cv.background(t.bg)
    y0 = _header(cv, ctx, kicker, title)
    gap = 120 if t.luxe else 40
    cw = (BW - gap) / 2
    ch = BOTTOM - y0
    for i, side in enumerate((left, right)):
        if isinstance(side, (list, tuple)):
            side = {"title": side[0], "points": side[1] if len(side) > 1 else []}
        x = MX + i * (cw + gap)
        fill = t.surface if i == 0 else mix(t.bg, t.accent, 0.12 if not t.dark else 0.16)
        if t.luxe:
            fill = t.bg
            _panel(cv, t, x, y0, cw, ch, fill, top_rule=_accent_on(t, t.bg) if i == 1 else None)
        else:
            cv.rect(x, y0, cw, ch, fill, radius=t.radius)
        pad = 0 if t.luxe else 56
        cy = y0 + (44 if t.luxe else pad)
        lab = side.get("label")
        if lab:
            _kicker(cv, t, x + pad, cy, cw - 2 * pad, lab, t.muted if i == 0 else _accent_on(t, fill))
            cy += 52
        cy += cv.text(x + pad, cy, cw - 2 * pad, 220, side.get("title", ""),
                      role="display" if t.luxe and t.serif else "display_soft", size=54,
                      min_size=30, lh=1.1, max_lines=3) + 36
        pts = side.get("points") or []
        if pts:
            _points(cv, t, x + pad, cy, cw - 2 * pad, y0 + ch - pad - cy,
                    [(p, None) if isinstance(p, str) else p for p in pts], head=32, body=24, numbered=False, bg=fill, spread=False)
    _footer(cv, ctx)


def _is_num(v):
    if isinstance(v, (int, float)):
        return True
    return bool(re.fullmatch(r"[\s$€£¥+\-−~≈<>]*[\d.,]+\s*[%kKmMbBxX×pt]*\s*", str(v or "")))


def s_table(cv, ctx, title, columns, rows, kicker=None, highlight=None, highlight_row=None, fmt=None, note=None):
    from .charts import fmt_value
    from .text import text_width as tw
    t = ctx.t
    cv.background(t.bg)
    y0 = _header(cv, ctx, kicker, title)
    fmt = fmt or {}
    ncol = len(columns)
    if isinstance(highlight, str):
        highlight = columns.index(highlight) if highlight in columns else None

    def cell(ci, v):
        f = fmt.get(ci) or fmt.get(str(ci)) or fmt.get(columns[ci])
        return fmt_value(v, f) if f else ("" if v is None else str(v))

    body = [[cell(ci, v) for ci, v in enumerate(r)] for r in rows]
    numeric = [all(_is_num(r[ci]) for r in body if r[ci] != "") and any(r[ci] for r in body) for ci in range(ncol)]
    note_h = 50 if note else 0
    avail = BOTTOM - y0 - note_h
    head_h = 58
    n = max(1, len(body))
    rh = min(92, (avail - head_h) / n)
    if rh < 40:
        cv.warnings.append(f"{len(body)} rows is too many for one slide — keep it under ~12 or split")
        rh = max(rh, 30)
    fs = max(15, min(30, rh * 0.38))
    font = t.font("body")
    natural = []
    for ci in range(ncol):
        wmax = max([tw(str(columns[ci]).upper(), t.font("semibold"), 18) * 1.1] +
                   [tw(r[ci], font, fs) for r in body])
        natural.append(max(110, wmax + 48))
    scale = BW / sum(natural)
    widths = [w * scale for w in natural]
    xs = [MX + sum(widths[:i]) for i in range(ncol)]
    total_h = head_h + rh * len(body)
    if highlight is not None:
        cv.rect(xs[highlight], y0 - 12, widths[highlight], total_h + 24,
                mix(t.bg, t.accent, 0.1 if not t.dark else 0.16), radius=min(t.radius, 16))
    for ci, c in enumerate(columns):
        pad = 20
        cv.text(xs[ci] + pad, y0 + 12, widths[ci] - 2 * pad, 34, c, role="medium" if t.luxe else "semibold",
                size=17 if t.luxe else 20, color=t.muted if ci != highlight else _accent_on(t, t.bg), upper=True,
                tracking=0.22 if t.luxe else 0.08, max_lines=1,
                align="right" if numeric[ci] else "left", min_size=12)
    cv.line(MX, y0 + head_h, MX + BW, y0 + head_h, t.ink if not t.luxe else _accent_on(t, t.bg), 1.2 if t.luxe else 2)
    for ri, r in enumerate(body):
        ry = y0 + head_h + ri * rh
        if highlight_row == ri:
            cv.rect(MX, ry + 1, BW, rh - 1, mix(t.bg, t.accent, 0.1), radius=0)
            cv.rect(MX, ry + 1, 6, rh - 1, t.accent)
        for ci, v in enumerate(r):
            pad = 20
            bold = ci == 0 or ci == highlight or highlight_row == ri
            cv.text(xs[ci] + pad, ry + (rh - fs * 1.2) / 2, widths[ci] - 2 * pad, fs * 1.25, v,
                    role="semibold" if bold else "body", size=fs, color=t.ink, max_lines=1,
                    align="right" if numeric[ci] else "left", min_size=12)
        if ri < len(body) - 1:
            cv.line(MX, ry + rh, MX + BW, ry + rh, t.rule, 1 if t.luxe else 1.5)
    if note:
        cv.text(MX, BOTTOM - 36, BW, 36, note, role="body", size=20, color=t.muted, max_lines=1)
    _footer(cv, ctx)


def s_timeline(cv, ctx, title, steps, kicker=None, current=None):
    t = ctx.t
    cv.background(t.bg)
    y0 = _header(cv, ctx, kicker, title)
    steps = [_pair(s, 3) for s in steps]
    n = len(steps)
    cw = BW / n
    ly = y0 + max(120, (BOTTOM - y0) * 0.3)
    lw = 1.5 if t.luxe else 4
    cv.line(MX, ly, MX + BW, ly, t.rule, lw)
    acc = _accent_on(t, t.bg)
    room = BOTTOM - (ly + 52)
    for ws, ds in ((46, 30), (42, 29), (38, 28), (34, 26), (32, 24), (30, 22), (26, 20)):
        tallest = max(cv.measure(what, "semibold", ws, cw - 40, 1.15) + 14 +
                      (cv.measure(detail, "body", ds, cw - 40, 1.3) if detail else 0) for _, what, detail in steps)
        if tallest <= room * 0.85 and max(cv.measure(what, "semibold", ws, cw - 40, 1.15) for _, what, _ in steps) <= ws * 1.15 * 2:
            break
    for i, (when, what, detail) in enumerate(steps):
        x = MX + i * cw
        done = current is None or i <= current
        if current is not None and i <= current:
            cv.line(x, ly, min(x + cw, MX + BW) if i < current else x, ly, acc, lw)
        d = (18 if i == current else 12) if t.luxe else (34 if i == current else 26)
        cv.ellipse(x - 2, ly - d / 2, d, d, acc if done else t.bg, line=acc, line_w=1.5 if t.luxe else 4)
        if when:
            _kicker(cv, t, x, ly - 84, cw - 32, when, acc, size=24)
        cy = ly + 52
        cy += cv.text(x, cy, cw - 40, ws * 1.15 * 3, what, role="medium" if t.luxe else "semibold", size=ws, lh=1.15,
                      max_lines=3) + 14
        if detail:
            cv.text(x, cy, cw - 40, BOTTOM - cy, detail, role="body", size=ds, color=t.muted, lh=1.3)
    _footer(cv, ctx)


def s_cards(cv, ctx, title, cards, kicker=None, numbered=False):
    t = ctx.t
    cv.background(t.bg)
    y0 = _header(cv, ctx, kicker, title)
    cards = [_pair(c, 3) for c in cards]
    n = len(cards)
    cols = {1: 1, 2: 2, 3: 3, 4: 2 if not numbered else 4, 5: 3, 6: 3}.get(n, 4)
    rows = math.ceil(n / cols)
    gap = 32
    cw = (BW - gap * (cols - 1)) / cols
    ch = (BOTTOM - y0 - gap * (rows - 1)) / rows
    pad = 52 if cols <= 3 else 40
    if t.luxe:
        gap, pad = 64, 0
        cw = (BW - gap * (cols - 1)) / cols
        ch = (BOTTOM - y0 - gap * (rows - 1)) / rows
    acc = _accent_on(t, t.bg if t.luxe else t.surface)
    inner = cw - 2 * pad
    any_tag = any(tag for _, _, tag in cards)
    room = ch - 2 * pad - (150 if numbered else 60) - (44 if any_tag else 0)

    def block_at(hs, bs):
        # Same text block height on every card so titles line up across the row.
        return max(cv.measure(h_, "semibold", hs, inner, 1.15) + (16 + cv.measure(b_, "body", bs, inner, 1.32) if b_ else 0)
                   for h_, b_, _ in cards)

    # Largest type that still fits the card — small text in a big empty card reads as unfinished.
    for hs, bs in ((52, 32), (48, 31), (44, 30), (40, 28), (36, 27), (34, 25), (32, 24), (30, 23), (28, 22)):
        if cols > 3 and hs > 36:
            continue
        if rows > 1 and hs > 44:
            continue
        block = block_at(hs, bs)
        if block <= room * (0.62 if rows == 1 else 0.9):
            break
    if rows == 1:
        ch = min(ch, max(block + 2 * pad + (190 if numbered else 120), (BOTTOM - y0) * 0.92))
    for i, (head, body, tag) in enumerate(cards):
        r, c = divmod(i, cols)
        x, y = MX + c * (cw + gap), y0 + r * (ch + gap)
        if t.luxe and rows == 1:
            y += max(0, (BOTTOM - y0 - block - (190 if numbered else 120)) * 0.45)
        _panel(cv, t, x, y, cw, ch, t.surface)
        cy = y + pad
        if numbered:
            cv.text(x + pad, cy - 6 + (40 if t.luxe else 0), inner, 120, f"{i + 1:02d}", role="display",
                    size=(72 if rows == 1 else 52) if t.luxe else (96 if rows == 1 else 64), color=acc, lh=1.0,
                    max_lines=1)
        elif not t.luxe:
            _mark(cv, t, x + pad, cy, acc, h=10)
        if tag:
            cv.text(x + pad, cy + (130 if numbered and rows == 1 else 44), inner, 30, tag, role="semibold", size=20,
                    color=t.muted, upper=True, tracking=0.1, max_lines=1)
        top_free = y + pad + (150 if numbered else 60) + (44 if tag else 0)
        by = max(top_free, y + ch - pad - block)
        if t.luxe:
            by = y + (150 if numbered else 44) + (44 if tag else 0)
        by += cv.text(x + pad, by, inner, ch * 0.5, head, role="medium" if t.luxe else "semibold", size=hs, lh=1.15,
                      max_lines=3) + 16
        if body:
            cv.text(x + pad, by, inner, y + ch - pad - by + 2, body, role="body", size=bs, color=t.muted, lh=1.32)
    _footer(cv, ctx)


def s_quote(cv, ctx, text, who=None, role=None, kicker=None):
    t = ctx.t
    cv.background(t.surface)
    if t.luxe:
        _mark(cv, t, MX, 260, _accent_on(t, t.surface))
    else:
        cv.text(MX - 6, 40, 400, 360, "\u201C", role="display", size=360, color=_accent_on(t, t.surface), lh=1.0,
                max_lines=1)
    font = "italic" if t.fonts == "editorial" else "display_soft"
    cv.text(MX, 330, 1560, 480, text, role=font, size=84 if t.fonts == "editorial" else 74, min_size=36, lh=1.14, valign="top")
    if who:
        cv.text(MX, 850, BW, 40, who, role="semibold", size=30, max_lines=1)
    if role:
        cv.text(MX, 896, BW, 36, role, role="body", size=24, color=t.muted, max_lines=1)
    _footer(cv, ctx, bg=t.surface)


def s_image(cv, ctx, image, title, caption=None, points=None, kicker=None, layout="split"):
    t = ctx.t
    if layout == "full":
        cv.background("#000000")
        cv.image(image, 0, 0, W, H)
        cv.rect(0, 540, W, 540, "#000000", alpha=0.55)
        if kicker:
            cv.text(MX, 660, BW, 34, kicker, role="semibold", size=22, color="#FFFFFF", upper=True, tracking=0.12)
        cv.text(MX, 700, 1500, 200, title, role="display", size=84, min_size=44, lh=1.04, color="#FFFFFF",
                valign="bottom", max_lines=2)
        if caption:
            cv.text(MX, 920, 1500, 60, caption, role="body", size=28, color="#E8E8EE", max_lines=2)
        return
    cv.background(t.bg)
    cv.image(image, 1000, 0, 920, H)
    lw = 760
    y0 = _header(cv, ctx, kicker, title, width=lw)
    if caption:
        y0 += cv.text(MX, y0, lw, 300, caption, role="body", size=28, color=t.muted, lh=1.35) + 36
    if points:
        _points(cv, t, MX, y0, lw, BOTTOM - y0, [(p, None) if isinstance(p, str) else p for p in points],
                head=28, body=22, numbered=False)
    _footer(cv, ctx, right_x=MX + lw)


def s_agenda(cv, ctx, items, title="Agenda", kicker=None):
    t = ctx.t
    cv.background(t.bg)
    y0 = _header(cv, ctx, kicker, title)
    items = [_pair(i) for i in items]
    n = len(items)
    cols = 1 if n <= 5 else 2
    per = math.ceil(n / cols)
    cw = (BW - 80 * (cols - 1)) / cols
    rh = min(160, (BOTTOM - y0) / per)
    acc = _accent_on(t, t.bg)
    for i, (label, detail) in enumerate(items):
        c, r = divmod(i, per)
        x, y = MX + c * (cw + 80), y0 + r * rh
        cv.line(x, y, x + cw, y, t.rule, 1 if t.luxe else 2)
        cv.text(x, y + 26, 120, 64, f"{i + 1:02d}", role="display_soft", size=50, color=acc, max_lines=1)
        cv.text(x + 140, y + 28, cw - 140, 56, label, role="medium" if t.luxe else "semibold",
                size=42 if cols == 1 else 34, max_lines=1,
                min_size=24)
        if detail and rh > 110:
            cv.text(x + 140, y + 88, cw - 140, rh - 96, detail, role="body", size=27, color=t.muted, max_lines=1)
    _footer(cv, ctx)


def s_text(cv, ctx, title, body, kicker=None, columns=1):
    t = ctx.t
    cv.background(t.bg)
    y0 = _header(cv, ctx, kicker, title)
    paras = body if isinstance(body, (list, tuple)) else [body]
    cols = max(1, min(2, columns))
    cw = (BW - 80 * (cols - 1)) / cols if cols > 1 else 1240
    per = math.ceil(len(paras) / cols)
    for c in range(cols):
        chunk = "\n\n".join(str(p) for p in paras[c * per:(c + 1) * per])
        cv.text(MX + c * (cw + 80), y0, cw, BOTTOM - y0, chunk, role="body", size=32, min_size=20, lh=1.42,
                color=t.ink)
    _footer(cv, ctx)


def s_stat(cv, ctx, value, label, context=None, kicker=None, source=None, bg="hero"):
    """One figure, as large as the slide allows, with what it means beside it."""
    t = ctx.t
    bgc = {"hero": t.hero, "surface": t.surface, "bg": t.bg, None: t.hero}.get(bg, bg)
    cv.background(bgc)
    ink = t.ink if bgc in (t.bg, t.surface) else on(bgc)
    mut = mix(ink, bgc, 0.38)
    acc = _accent_on(t, bgc)
    if t.luxe and bgc == t.hero:
        _frame(cv, t)
    if kicker:
        _kicker(cv, t, MX, 112, BW, kicker, acc)
    lw = 1060 if context else BW
    label_h = cv.measure(label, "display_soft", 52, lw, 1.14) if label else 0
    vbot = 860 - (min(label_h, 130) + 40 if label else 0)
    cv.text(MX - 8, 190, lw + 8, vbot - 190, value, role="display", size=380 if not t.luxe else 320, min_size=120,
            lh=0.92, color=acc, valign="bottom", max_lines=1)
    if label:
        cv.text(MX, vbot + 40, lw, 140, label, role="display_soft", size=52, min_size=30, lh=1.14, color=ink,
                max_lines=2)
    if context:
        x = MX + lw + 100
        w = MX + BW - x
        if t.luxe:
            cv.line(x - 52, 260, x - 52, 880, mix(ink, bgc, 0.75), 1.2)
        else:
            _mark(cv, t, x, 300, acc)
        cv.text(x, 350, w, 520, context, role="body", size=34, min_size=22, lh=1.38, color=mut)
    if source:
        cv.text(MX, 948, BW, 30, source, role="body", size=18, color=mut, max_lines=1)
    _footer(cv, ctx, bg=bgc)


def s_feature(cv, ctx, title, points, kicker=None, statement=None):
    """Colour panel on the left with the headline, the argument on the right."""
    t = ctx.t
    cv.background(t.bg)
    pw = 860
    panel = t.hero if t.hero.lower() != t.bg.lower() else t.surface
    cv.rect(0, 0, pw, H, panel)
    pink = on(panel) if panel == t.hero else t.ink
    pmut = mix(pink, panel, 0.38)
    acc = _accent_on(t, panel)
    tw_ = pw - MX - 90
    y = 112
    if kicker:
        _kicker(cv, t, MX, y, tw_, kicker, acc)
        y += 64
    _mark(cv, t, MX, y, acc)
    st_h = cv.measure(statement, "body", 30, tw_, 1.36) if statement else 0
    cv.text(MX, y + 48, tw_, 900 - y - 48 - (st_h + 40 if statement else 0), title,
            role="display" if t.serif or not t.luxe else "display_soft", size=104 if not t.luxe else 92,
            min_size=44, lh=1.04, color=pink, max_lines=6)
    if statement:
        cv.text(MX, 940 - st_h, tw_, st_h + 4, statement, role="body", size=30, color=pmut, lh=1.36)
    x = pw + 110
    w = W - x - MX
    items = [(p, None) if isinstance(p, str) else p for p in points]
    _points(cv, t, x, 120, w, BOTTOM - 120, items, head=46, body=31, numbered=True, spread=True, center=True)
    col = mix(t.ink, t.bg, 0.45)
    lux = dict(upper=True, tracking=0.26, size=14) if t.luxe else dict(size=18)
    cv.text(MX + BW - 200, 1000, 200, 30, f"{ctx.page:02d}", role="medium", color=col, align="right",
            max_lines=1, **lux)


KINDS = {
    "cover": s_cover, "closing": s_closing, "section": s_section, "statement": s_statement,
    "bullets": s_bullets, "kpis": s_kpis, "chart": s_chart, "compare": s_compare, "table": s_table,
    "timeline": s_timeline, "cards": s_cards, "quote": s_quote, "image": s_image, "agenda": s_agenda,
    "text": s_text, "stat": s_stat, "feature": s_feature,
}
VISUAL = {"chart", "kpis", "table", "timeline", "cards", "image", "compare", "stat", "feature"}


class Deck:
    """A deck you build one slide at a time. Re-create it with the same name to continue."""

    def __init__(self, name: str = "deck", theme=None, *, title=None, brand=None, fonts=None, pdf=None,
                 new=False, **theme_overrides):
        self.path = _resolve(name, ".pptx")
        self.pdf_path = self.path[:-5] + ".pdf"
        self._state_file = os.path.join(_state_dir(), os.path.basename(self.path) + ".json")
        state = {}
        if not new and os.path.exists(self._state_file):
            with open(self._state_file) as f:
                state = json.load(f)
        if theme is not None or theme_overrides or "theme" not in state:
            self.theme = _theme(theme, **theme_overrides) if not isinstance(theme, Theme) else theme
        else:
            self.theme = _theme_from_json(state["theme"])
        self.title = title if title is not None else state.get("title")
        self.brand = brand if brand is not None else state.get("brand")
        if brand and _HEX.match(str(brand)) and theme is None and "accent" not in theme_overrides:
            self.theme = _theme(self.theme, accent=brand)   # Deck(brand="#C9A84C") = brand colour, not a label
        if fonts is not None and fonts not in ("office", "google"):
            # Real typefaces, e.g. ("Playfair Display", "DM Sans") — fetched from Google Fonts.
            self.theme = _theme(self.theme, fonts=fonts)
            fonts = "google"
        self.fonts = fonts or state.get("fonts", "office")
        self.make_pdf = pdf if pdf is not None else state.get("pdf")   # None = PDF at check()/edits, True = every save
        self.slides: list[dict] = state.get("slides", []) if not new else []
        self._insert_at = None
        if state and not new:
            print(f"reopened {os.path.basename(self.path)} · {len(self.slides)} slides · theme {self.theme.name}")

    @property
    def footer_label(self) -> str:
        """Brand name in the footer — never a colour code passed as brand."""
        brand = "" if self.brand and _HEX.match(str(self.brand)) else (self.brand or "")
        return str(brand or self.title or "")

    # ── persistence ──
    def _save_state(self):
        with open(self._state_file, "w") as f:
            json.dump({"theme": _theme_to_json(self.theme), "title": self.title, "brand": self.brand,
                       "fonts": self.fonts, "pdf": self.make_pdf, "slides": self.slides}, f)

    def _slide_theme(self, spec):
        return _theme_from_json(spec["theme"]) if spec.get("theme") else self.theme

    def _section_no(self, page):
        return sum(1 for s in self.slides[:page] if s["kind"] == "section")

    def _add(self, _slide_kind, **kw):
        kind = _slide_kind
        kw = {k: jsonable(v) for k, v in kw.items() if v is not None}
        spec = {"kind": kind, "args": kw}
        if self._insert_at is not None:
            self.slides.insert(self._insert_at, spec)
            n = self._insert_at + 1
            self._insert_at = None
        else:
            self.slides.append(spec)
            n = len(self.slides)
        warnings = self.save()
        label = kw.get("title") or kw.get("text") or ""
        label = (label[:60] + "…") if len(str(label)) > 60 else label
        print(f"✓ slide {n}/{len(self.slides)} {kind}: {label}")
        for w in warnings.get(n, []):
            print(f"  ! {w}")
        return self

    def save(self):
        """Render every slide to .pptx (and .pdf when pdf=True). Returns {slide: [warnings]}."""
        from pptx import Presentation
        from pptx.util import Emu
        prs = Presentation()
        prs.slide_width, prs.slide_height = Emu(12192000), Emu(6858000)
        prs.part._element.sldSz.attrib.pop("type", None)   # template says "screen4x3"; the size is 16:9
        if self.title:
            prs.core_properties.title = self.title
        warnings = {}
        total = len(self.slides)
        for i, spec in enumerate(self.slides):
            slide = prs.slides.add_slide(prs.slide_layouts[6])
            th = self._slide_theme(spec)
            cv = PptxCanvas(th, prs, slide, self.fonts)
            args = dict(spec["args"])
            notes = args.pop("notes", None)
            KINDS[spec["kind"]](cv, Ctx(self, i + 1, total, th), **args)
            cv.notes(notes)
            if cv.warnings:
                warnings[i + 1] = sorted(set(cv.warnings))
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        prs.save(self.path)
        self._save_state()
        if self.make_pdf:
            self.pdf(quiet=True)
        return warnings

    def pdf(self, path=None, quiet=False):
        """Export the deck as a 16:9 PDF with the real fonts embedded."""
        from reportlab.pdfgen import canvas as rl
        out = path or self.pdf_path
        c = rl.Canvas(out, pagesize=(W * 0.5, H * 0.5))
        c.setTitle(self.title or os.path.basename(out))
        if self.footer_label:
            c.setAuthor(self.footer_label)
        total = len(self.slides)
        with tempfile.TemporaryDirectory() as tmp:
            for i, spec in enumerate(self.slides):
                th = self._slide_theme(spec)
                cv = PdfCanvas(th, c, tmp)
                args = dict(spec["args"])
                args.pop("notes", None)
                KINDS[spec["kind"]](cv, Ctx(self, i + 1, total, th), **args)
                c.showPage()
            c.save()
        if not quiet:
            print(f"✓ {os.path.basename(out)} · {total} pages")
        return out

    def _refresh_pdf(self):
        """Keep the preview PDF in step after an edit (save() already did it when pdf=True)."""
        if self.make_pdf is None and os.path.exists(self.pdf_path):
            self.pdf(quiet=True)

    # ── editing ──
    def at(self, n: int):
        """Insert the next slide at position n (1-based): d.at(3).kpis(...)"""
        self._insert_at = max(0, min(len(self.slides), n - 1))
        return self

    def remove(self, n: int):
        self.slides.pop(n - 1)
        self.save()
        self._refresh_pdf()
        print(f"removed slide {n} · {len(self.slides)} left")

    def move(self, n: int, to: int):
        s = self.slides.pop(n - 1)
        self.slides.insert(to - 1, s)
        self.save()
        self._refresh_pdf()
        print(f"moved slide {n} → {to}")

    def edit(self, n: int, **changes):
        """Change arguments of slide n, e.g. d.edit(4, title="Sharper title")."""
        self.slides[n - 1]["args"].update({k: v for k, v in changes.items()})
        w = self.save()
        self._refresh_pdf()
        print(f"✓ edited slide {n}")
        for x in w.get(n, []):
            print(f"  ! {x}")

    def restyle(self, theme=None, **overrides):
        """Switch theme for the whole deck and re-render."""
        self.theme = _theme(theme or self.theme, **overrides)
        self.save()
        self._refresh_pdf()
        print(f"✓ theme → {self.theme.name}")

    def outline(self):
        for i, s in enumerate(self.slides, 1):
            a = s["args"]
            print(f"{i:2d}. {s['kind']:<9} {a.get('title') or a.get('text') or ''}")

    def check(self):
        """Design review of the whole deck. Fix what it lists before handing over."""
        issues = []
        kinds = [s["kind"] for s in self.slides]
        if not kinds:
            print("empty deck")
            return
        if kinds[0] != "cover":
            issues.append("start with d.cover(...)")
        covers = [s for s in self.slides if s["kind"] == "cover"]
        if len(covers) >= 2:
            lays = [(s["args"].get("layout") or default_cover_layout(self._slide_theme(s))) for s in covers]
            if len(set(lays)) < len(lays):
                issues.append(f"{len(covers)} cover slides but only {len(set(lays))} layout(s) ({', '.join(lays)}) — "
                              "options must differ in composition, not colour: d.cover_options(...) or "
                              f"layout= one of {', '.join(COVER_LAYOUTS)}")
        if len(kinds) >= 6 and not {"section", "statement", "stat", "feature"} & set(kinds):
            issues.append("add a section, statement, stat or feature slide to pace a longer deck")
        plain = 0
        for k in kinds[1:-1]:
            plain = 0 if k in ("section", "stat", "feature", "statement", "quote", "image") else plain + 1
            if plain == 5:
                issues.append("five plain content slides in a row — break the run with d.stat(...), "
                              "d.feature(...) or d.section(...)")
                break
        if not VISUAL & set(kinds):
            issues.append("no chart / kpis / table / cards — add at least one visual slide")
        run = 1
        for a, b in zip(kinds, kinds[1:]):
            run = run + 1 if a == b else 1
            if run == 3 and a not in ("section",):
                issues.append(f"three '{a}' slides in a row — vary the layout")
        for i, s in enumerate(self.slides, 1):
            if s["kind"] not in ("cover", "closing", "section", "agenda", "statement") and not s["args"].get("notes"):
                issues.append(f"slide {i}: add speaker notes (notes=...)")
            title = str(s["args"].get("title") or "")
            if len(title) > 90:
                issues.append(f"slide {i}: title is {len(title)} chars — headline it")
            if self.theme.luxe:
                # Premium reads as restraint: few items, short words, room around everything.
                a = s["args"]
                n = len(a.get("points") or a.get("items") or a.get("cards") or a.get("steps") or [])
                if n > 4 and s["kind"] in ("bullets", "cards", "kpis", "timeline"):
                    issues.append(f"slide {i}: {n} items — a premium deck shows at most 4; split or cut")
                if len(title) > 60:
                    issues.append(f"slide {i}: premium titles are short (≤60 chars, this is {len(title)})")
        if self.theme.luxe and len(kinds) >= 5 and not {"statement", "quote", "image"} & set(kinds):
            issues.append("premium decks need breathing room — add a statement, quote or full image slide")
        warnings = self.save()
        for n, ws in warnings.items():
            issues += [f"slide {n}: {w}" for w in ws]
        if self.make_pdf is None:
            self.pdf(quiet=True)   # the chat shows this PDF as the deck's preview
        if issues:
            print("fix before handing over:")
            for x in issues:
                print("  -", x)
        else:
            print(f"✓ {len(kinds)} slides look good · {os.path.basename(self.path)}")
        return issues

    # ── slide types ──
    def cover(self, title, subtitle=None, *, kicker=None, meta=None, image=None, layout=None, sides=None,
              notes=None):
        """layout: one of COVER_LAYOUTS (orbs, frame, split, poster, band, grid, duo, shapes, center, photo).
        None = the theme's own. sides=("Dubai", "Abu Dhabi") for layout="duo" (else read from "A vs B")."""
        if not self.title:
            self.title = title
        return self._add("cover", title=title, subtitle=subtitle, kicker=kicker, meta=meta, image=image,
                         layout=layout, sides=list(sides) if sides else None, notes=notes)

    def cover_options(self, title, subtitle=None, *, kicker=None, meta=None, image=None, sides=None, n=5,
                      layouts=None, themes=None):
        """Several genuinely different title slides in a separate file (<name>-cover-options.pptx/.pdf).
        Each option is a different COMPOSITION; themes=[...] also varies the palette per option.
        Pick one, then: d.cover(..., layout="poster") or d.edit(1, layout="poster")."""
        if layouts is None:
            order = [default_cover_layout(self.theme)]
            if _sides(title, sides):
                order.append("duo")
            if image:
                order.append("photo")
            for k in ("poster", "split", "shapes", "grid", "band", "center", "orbs", "frame"):
                if k not in order:
                    order.append(k)
            layouts = order[:max(1, n)]
        base = os.path.basename(self.path)[:-5]
        opts = Deck(f"{base}-cover-options", theme=self.theme, title=f"{self.title or title} — cover options",
                    brand=self.brand, new=True)
        opts.fonts = self.fonts
        names = []
        for i, lay in enumerate(layouts):
            args = {k: jsonable(v) for k, v in dict(title=title, subtitle=subtitle, kicker=kicker, meta=meta,
                                                     image=image, layout=lay, sides=list(sides) if sides else None,
                                                     notes=f"Option {i + 1}: {lay} — {COVER_LAYOUTS.get(lay, '')}"
                                                     ).items() if v is not None}
            spec = {"kind": "cover", "args": args}
            th = themes[i % len(themes)] if themes else None
            if th is not None:
                th = _theme(th) if not isinstance(th, Theme) else th
                spec["theme"] = _theme_to_json(th)   # this option has its own palette
            names.append(th.name if th is not None else None)
            opts.slides.append(spec)
        warnings = opts.save()
        opts.pdf(quiet=True)
        print("cover options (" + os.path.basename(opts.path) + "):")
        for i, lay in enumerate(layouts, 1):
            th = f" · {names[i - 1]}" if names[i - 1] else ""
            print(f"  {i}. {lay}{th} — {COVER_LAYOUTS.get(lay, '')}")
            for w in warnings.get(i, []):
                print(f"     ! {w}")
        print('apply one: d.cover(..., layout="<name>") on a new deck, or d.edit(1, layout="<name>")')
        return opts

    def section(self, title, subtitle=None, *, number=None, notes=None):
        return self._add("section", title=title, subtitle=subtitle, number=number, notes=notes)

    def statement(self, text, *, kicker=None, attribution=None, bg=None, notes=None):
        """One big idea, full-slide. bg: None | 'surface' | 'hero' | '#hex'."""
        return self._add("statement", text=text, kicker=kicker, attribution=attribution, bg=bg, notes=notes)

    def bullets(self, title, points=None, *, items=None, kicker=None, aside=None, numbered=True, notes=None):
        points = points if points is not None else items
        """points: ["text", ...] or [("Headline", "one-line detail"), ...]. aside = a callout on the right."""
        return self._add("bullets", title=title, points=points, kicker=kicker, aside=aside, numbered=numbered,
                         notes=notes)

    def kpis(self, title, items, *, kicker=None, note=None, highlight=None, notes=None):
        """items: [(value, label, delta?)] — 2 to 6. highlight = index of the hero card."""
        return self._add("kpis", title=title, items=items, kicker=kicker, note=note, highlight=highlight, notes=notes)

    def chart(self, title, kind, categories, series, *, kicker=None, takeaway=None, points=None, fmt=None,
              source=None, labels=None, legend=None, notes=None):
        """Native, editable chart. series: {"name": [values]} or [values]. See clox_kit.charts for kinds/fmt."""
        return self._add("chart", title=title, kind=kind, categories=jsonable(categories) if categories is not None else [], series=series,
                         kicker=kicker, takeaway=takeaway, points=points, fmt=fmt, source=source, labels=labels,
                         legend=legend, notes=notes)

    def compare(self, title, left, right, *, kicker=None, notes=None):
        """left/right: {"label": "Today", "title": "...", "points": [...]}. Right side is emphasised."""
        return self._add("compare", title=title, left=left, right=right, kicker=kicker, notes=notes)

    def table(self, title, columns, rows, *, kicker=None, highlight=None, highlight_row=None, fmt=None, note=None,
              notes=None):
        """highlight = column (index or name) to emphasise. fmt = {col: "money" | "pct" | ...}."""
        return self._add("table", title=title, columns=jsonable(columns), rows=jsonable(rows), kicker=kicker,
                         highlight=highlight, highlight_row=highlight_row, fmt=fmt, note=note, notes=notes)

    def timeline(self, title, steps=None, *, items=None, kicker=None, current=None, notes=None):
        steps = steps if steps is not None else items
        """steps: [(when, what, detail?)] — 3 to 6. current = index reached so far."""
        return self._add("timeline", title=title, steps=steps, kicker=kicker, current=current, notes=notes)

    def cards(self, title, cards=None, *, items=None, kicker=None, numbered=False, notes=None):
        """cards: [(title, body, tag?)] — 2 to 6. numbered=True for a process / steps slide.
        items= is accepted as another name for cards= (kpis/agenda use items)."""
        cards = cards if cards is not None else items
        return self._add("cards", title=title, cards=cards, kicker=kicker, numbered=numbered, notes=notes)

    def process(self, title, steps=None, *, items=None, kicker=None, notes=None):
        steps = steps if steps is not None else items
        return self.cards(title, steps, kicker=kicker, numbered=True, notes=notes)

    def quote(self, text, who=None, role=None, *, kicker=None, notes=None):
        return self._add("quote", text=text, who=who, role=role, kicker=kicker, notes=notes)

    def stat(self, value, label, *, context=None, kicker=None, source=None, bg="hero", notes=None):
        """One huge figure ("AED 1.2T", "71%") + what it is + a sentence on why it matters.
        bg: 'hero' (default) | 'bg' | 'surface' | '#hex'."""
        return self._add("stat", value=value, label=label, context=context, kicker=kicker, source=source, bg=bg,
                         notes=notes)

    def feature(self, title, points=None, *, items=None, kicker=None, statement=None, notes=None):
        """Headline on a colour panel (left) + 2-4 points (right). Breaks up runs of white slides."""
        points = points if points is not None else items
        return self._add("feature", title=title, points=points, kicker=kicker, statement=statement, notes=notes)

    def image(self, image, title, *, caption=None, points=None, kicker=None, layout="split", notes=None):
        """layout 'split' (photo right, text left) or 'full' (full-bleed with caption)."""
        return self._add("image", image=image, title=title, caption=caption, points=points, kicker=kicker,
                         layout=layout, notes=notes)

    def agenda(self, items, *, title="Agenda", kicker=None, notes=None):
        return self._add("agenda", items=items, title=title, kicker=kicker, notes=notes)

    def text(self, title, body, *, kicker=None, columns=1, notes=None):
        """Prose slide. body: a string or a list of paragraphs."""
        return self._add("text", title=title, body=body, kicker=kicker, columns=columns, notes=notes)

    def closing(self, title="Thank you", subtitle=None, *, contact=None, notes=None):
        return self._add("closing", title=title, subtitle=subtitle, contact=contact, notes=notes)

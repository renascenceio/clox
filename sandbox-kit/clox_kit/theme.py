"""Themes: one palette + one type pairing, shared by decks, PDFs, sheets and charts.

    from clox_kit import theme
    t = theme("studio")                      # a built-in
    t = theme("midnight", accent="#00E5FF")  # built-in with overrides
    t = theme(brand="#E4002B", dark=False)   # build one from a brand colour
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace


def _rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _hex(rgb) -> str:
    return "#%02X%02X%02X" % tuple(max(0, min(255, round(c))) for c in rgb)


def mix(a: str, b: str, t: float) -> str:
    """Blend colour a towards b by t (0..1). Used instead of transparency."""
    ra, rb = _rgb(a), _rgb(b)
    return _hex(tuple(x + (y - x) * t for x, y in zip(ra, rb)))


def luminance(h: str) -> float:
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = _rgb(h)
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a: str, b: str) -> float:
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def on(color: str, light: str = "#FFFFFF", dark: str = "#0B0B0F") -> str:
    """Readable text colour on top of `color`."""
    return light if contrast(color, light) >= contrast(color, dark) else dark


# Font roles → files in ./fonts. `display` is the headline face.
FONT_SETS = {
    "inter": {
        "display": "InterDisplay-Bold", "display_soft": "InterDisplay-SemiBold",
        "body": "Inter-Regular", "medium": "Inter-Medium", "semibold": "Inter-SemiBold",
        "bold": "Inter-Bold", "italic": "Inter-Italic", "mono": "JetBrainsMono-Regular",
    },
    "editorial": {
        "display": "InstrumentSerif-Regular", "display_soft": "InstrumentSerif-Italic",
        "body": "Inter-Regular", "medium": "Inter-Medium", "semibold": "Inter-SemiBold",
        "bold": "Inter-Bold", "italic": "InstrumentSerif-Italic", "mono": "JetBrainsMono-Regular",
    },
    "grotesk": {
        "display": "SpaceGrotesk-Bold", "display_soft": "SpaceGrotesk-Medium",
        "body": "Inter-Regular", "medium": "Inter-Medium", "semibold": "Inter-SemiBold",
        "bold": "Inter-Bold", "italic": "Inter-Italic", "mono": "JetBrainsMono-Regular",
    },
}


@dataclass(frozen=True)
class Theme:
    name: str
    bg: str            # page / slide background
    surface: str       # cards, table stripes
    ink: str           # primary text
    muted: str         # secondary text
    rule: str          # hairlines
    accent: str        # the one loud colour
    accent2: str       # supporting colour
    hero: str          # cover / section background
    series: tuple      # chart colours, in order
    fonts: str = "inter"
    dark: bool = False
    positive: str = "#00B37A"
    negative: str = "#FF3B5C"
    radius: int = 28   # card corner radius in canvas px (1920x1080 grid)
    upper_kicker: bool = True
    # "bold" = filled cards, chunky accent bars, big type (the default).
    # "luxe" = premium: no filled panels, hairlines, airy spacing, lighter
    #          headline weight, widely tracked small caps, accent used sparingly.
    style: str = "bold"
    extra: dict = field(default_factory=dict)

    @property
    def luxe(self) -> bool:
        return self.style == "luxe"

    @property
    def hero_ink(self) -> str:
        return on(self.hero)

    @property
    def hero_muted(self) -> str:
        return mix(self.hero_ink, self.hero, 0.38)

    @property
    def accent_ink(self) -> str:
        return on(self.accent)

    def font(self, role: str) -> str:
        if self.fonts not in FONT_SETS:
            from .fonts import ensure
            ensure(self.fonts)
        return FONT_SETS[self.fonts].get(role, FONT_SETS[self.fonts]["body"])

    @property
    def serif(self) -> bool:
        """Headlines in a serif face — lets layouts give them a little more size."""
        if self.fonts == "editorial":
            return True
        if self.fonts.startswith("gf:"):
            fam = self.fonts[3:].split("|")[0].lower()
            return any(k in fam for k in ("serif", "playfair", "fraunces", "garamond", "lora", "merriweather",
                                          "libre baskerville", "dm serif", "cormorant", "newsreader", "gelasio",
                                          "crimson", "spectral", "bodoni", "prata", "young serif"))
        return False

    def color(self, i: int) -> str:
        return self.series[i % len(self.series)]


THEMES: dict[str, Theme] = {
    # Light, airy, one electric violet accent. The default.
    "studio": Theme(
        name="studio", bg="#FAFAF7", surface="#F0EFEA", ink="#0B0B0F", muted="#5E5E6B",
        rule="#E3E1DA", accent="#5B2CFF", accent2="#FF3D8B", hero="#5B2CFF",
        series=("#5B2CFF", "#00B3FF", "#FF3D8B", "#FFB800", "#00C48C", "#8A8A99"),
    ),
    # Dark, acid-lime accent. Great for tech / product launches.
    "midnight": Theme(
        name="midnight", bg="#0B0B12", surface="#16161F", ink="#F4F4F7", muted="#9C9CB0",
        rule="#262634", accent="#C6FF3D", accent2="#7B5CFF", hero="#0B0B12",
        series=("#C6FF3D", "#7B5CFF", "#00E5FF", "#FF4FD8", "#FFB000", "#6E6E85"),
        dark=True, positive="#3DFFA2", negative="#FF5470",
    ),
    # Loud and vivid: hot pink + cyan on near-black. Pitches, events, culture.
    "electric": Theme(
        name="electric", bg="#0A0A0F", surface="#17131F", ink="#FFFFFF", muted="#A9A3BD",
        rule="#2A2238", accent="#FF2EC4", accent2="#00E5FF", hero="#2B12FF",
        series=("#FF2EC4", "#00E5FF", "#FFE600", "#7C4DFF", "#00FF9C", "#FF7A00"),
        fonts="grotesk", dark=True, positive="#00FF9C", negative="#FF4D6D",
    ),
    # Warm paper, serif headlines, vermilion. Strategy memos, essays, reports.
    "editorial": Theme(
        name="editorial", bg="#F5F1E8", surface="#ECE6D9", ink="#17140F", muted="#6B6357",
        rule="#DCD3C2", accent="#E8461E", accent2="#1F4FFF", hero="#17140F",
        series=("#E8461E", "#1F4FFF", "#17140F", "#C9A227", "#3A8F6B", "#9A8F7E"),
        fonts="editorial", radius=6, upper_kicker=True,
    ),
    # Navy + gold. Finance, board packs, formal.
    "navy": Theme(
        name="navy", bg="#FFFFFF", surface="#F3F5F8", ink="#0B1F3A", muted="#566477",
        rule="#DDE2EA", accent="#C7A557", accent2="#2F6BFF", hero="#0B1F3A",
        series=("#0B1F3A", "#C7A557", "#2F6BFF", "#7FA3C9", "#3BA57E", "#9AA5B4"),
        fonts="editorial", radius=10,
    ),
    # Swiss: white, black, one blaze orange. Clean and confident.
    "swiss": Theme(
        name="swiss", bg="#FFFFFF", surface="#F2F2F2", ink="#000000", muted="#5C5C5C",
        rule="#E0E0E0", accent="#FF4F00", accent2="#000000", hero="#FF4F00",
        series=("#000000", "#FF4F00", "#8C8C8C", "#FFB199", "#3D3D3D", "#C8C8C8"),
        fonts="grotesk", radius=0,
    ),
    # Premium, dark: black, ivory type, champagne-gold hairlines. Luxury, hospitality, private banking.
    "noir": Theme(
        name="noir", bg="#0E0D0B", surface="#171512", ink="#F2EDE4", muted="#A39B8E",
        rule="#2E2A24", accent="#C8A96B", accent2="#8C8273", hero="#0E0D0B",
        series=("#C8A96B", "#F2EDE4", "#8C8273", "#6B5A3E", "#D9CBB0", "#4A453D"),
        fonts="editorial", dark=True, radius=0, style="luxe", positive="#9DBF8A", negative="#C9786B",
    ),
    # Premium, light: warm ivory, deep ink, bronze. Real estate, fashion, wealth, fine dining.
    "ivory": Theme(
        name="ivory", bg="#F6F2EA", surface="#EEE8DC", ink="#1B1814", muted="#6F665A",
        rule="#DDD4C4", accent="#8C6A3F", accent2="#1B1814", hero="#1B1814",
        series=("#1B1814", "#8C6A3F", "#B8A07A", "#6F665A", "#D8C7A8", "#3E4A3F"),
        fonts="editorial", radius=0, style="luxe", positive="#4F7A4A", negative="#A4453A",
    ),
    # Deep green + mint. Sustainability, health, finance-with-calm.
    "forest": Theme(
        name="forest", bg="#F6F8F5", surface="#E9EFE8", ink="#0C2A20", muted="#55685F",
        rule="#D7E0D6", accent="#00C875", accent2="#0C2A20", hero="#0C2A20",
        series=("#0C2A20", "#00C875", "#7BD8B0", "#F2B33D", "#3D6BFF", "#9DB0A6"),
        radius=20,
    ),
}


def theme(name: str | Theme | None = None, *, brand: str | None = None, dark: bool | None = None,
          **overrides) -> Theme:
    """Pick a theme. `brand="#hex"` builds one around a brand colour."""
    if isinstance(name, Theme):
        base = name
    elif brand and not name:
        base = THEMES["midnight" if dark else "studio"]
        overrides.setdefault("accent", brand)
        overrides.setdefault("hero", brand if not dark else base.hero)
        overrides.setdefault("series", (brand,) + tuple(c for c in base.series if c != base.accent))
    else:
        key = (name or "studio").lower().strip()
        if key not in THEMES:
            raise ValueError(f"unknown theme {name!r}; choose from {', '.join(THEMES)}")
        base = THEMES[key]
    if brand and name:
        overrides.setdefault("accent", brand)
    if "fonts" in overrides and overrides["fonts"] not in FONT_SETS:
        from .fonts import key_for
        try:
            overrides["fonts"] = key_for(overrides["fonts"]) or base.fonts
        except (OSError, ValueError) as e:
            # A font that can't be fetched must not stop the deck: keep the
            # theme's own fonts and say so (lines starting "!" are defects).
            print(f"! fonts {overrides['fonts']!r} not used, kept the theme's fonts: {e}")
            overrides["fonts"] = base.fonts
    if "series" in overrides and not isinstance(overrides["series"], tuple):
        overrides["series"] = tuple(overrides["series"])
    return replace(base, **overrides) if overrides else base

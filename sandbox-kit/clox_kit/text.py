"""Text measurement with the real font files, so layouts fit before they are drawn.

Also decides, for any piece of text, which font can actually write it: Arabic in
an Inter deck, Japanese in a Fraunces report or Cyrillic in Space Grotesk switch
to a matching font from the built-in library (see library.py) — same weight,
serif for serif, sans for sans — and report whether the text runs right to left
and needs shaping (Arabic, Hebrew, Indic, Thai)."""
from __future__ import annotations

import os
import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache

from PIL import ImageFont

FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")


def font_path(name: str) -> str:
    """Bundled fonts live beside the kit; Google fonts in the library or the download cache."""
    if name.startswith("gf-"):
        from .fonts import cache_dir, find
        return find(name) or os.path.join(cache_dir(), name + ".ttf")
    return os.path.join(FONT_DIR, name + ".ttf")


_MEASURE = 200   # measure once at a large size and scale: exact, and one file handle per font


@lru_cache(maxsize=96)
def _font(name: str):
    f = ImageFont.truetype(font_path(name), _MEASURE)
    return f


def width(text: str, font: str, size: float) -> float:
    if not text:
        return 0.0
    return _font(font).getlength(text) * (size / _MEASURE)


# ─── scripts ───────────────────────────────────────────────────────

_RANGES = (
    (0x0370, 0x03FF, "greek"), (0x1F00, 0x1FFF, "greek"),
    (0x0400, 0x052F, "cyrillic"), (0x1C80, 0x1C8F, "cyrillic"), (0x2DE0, 0x2DFF, "cyrillic"), (0xA640, 0xA69F, "cyrillic"),
    (0x0530, 0x058F, "armenian"), (0x0590, 0x05FF, "hebrew"), (0xFB1D, 0xFB4F, "hebrew"),
    (0x0600, 0x06FF, "arabic"), (0x0750, 0x077F, "arabic"), (0x0870, 0x08FF, "arabic"),
    (0xFB50, 0xFDFF, "arabic"), (0xFE70, 0xFEFF, "arabic"),
    (0x0900, 0x097F, "devanagari"), (0x0980, 0x09FF, "bengali"), (0x0B80, 0x0BFF, "tamil"),
    (0x0E00, 0x0E7F, "thai"), (0x10A0, 0x10FF, "georgian"),
    (0x1100, 0x11FF, "korean"), (0x3130, 0x318F, "korean"), (0xAC00, 0xD7AF, "korean"),
    (0x3040, 0x30FF, "kana"), (0x31F0, 0x31FF, "kana"), (0xFF66, 0xFF9F, "kana"),
    (0x2E80, 0x2FFF, "han"), (0x3000, 0x303F, "han"), (0x3400, 0x4DBF, "han"), (0x4E00, 0x9FFF, "han"),
    (0xF900, 0xFAFF, "han"), (0xFF00, 0xFF65, "han"), (0x20000, 0x2FFFF, "han"),
    (0x00C0, 0x024F, "latin"), (0x1E00, 0x1EFF, "latin"),
)
SHAPED = {"arabic", "hebrew", "devanagari", "bengali", "tamil", "thai"}
RTL = {"arabic", "hebrew"}

# Library fonts to switch to, best first, by script and by style.
FALLBACKS = {
    "arabic": {"sans": ["IBM Plex Sans Arabic", "Noto Sans Arabic", "Rubik"],
               "serif": ["Amiri", "Noto Naskh Arabic", "IBM Plex Sans Arabic"]},
    "hebrew": {"sans": ["Heebo", "Noto Sans Hebrew", "Rubik"], "serif": ["Frank Ruhl Libre", "Heebo"]},
    "cyrillic": {"sans": ["Inter", "Onest", "Noto Sans"], "serif": ["Lora", "PT Serif", "Noto Serif"]},
    "greek": {"sans": ["Inter", "Noto Sans"], "serif": ["Literata", "Noto Serif"]},
    "latin": {"sans": ["Inter", "Noto Sans"], "serif": ["Literata", "Noto Serif"]},
    "japanese": {"sans": ["Noto Sans JP"], "serif": ["Noto Serif JP", "Noto Sans JP"]},
    "korean": {"sans": ["Noto Sans KR"], "serif": ["Noto Serif KR", "Noto Sans KR"]},
    "chinese": {"sans": ["Noto Sans SC", "Noto Sans TC"], "serif": ["Noto Serif SC", "Noto Serif TC", "Noto Sans SC"]},
    "devanagari": {"sans": ["Noto Sans Devanagari", "Poppins"], "serif": ["Noto Serif Devanagari", "Noto Sans Devanagari"]},
    "bengali": {"sans": ["Noto Sans Bengali"], "serif": ["Noto Sans Bengali"]},
    "tamil": {"sans": ["Noto Sans Tamil"], "serif": ["Noto Sans Tamil"]},
    "thai": {"sans": ["Kanit", "Noto Sans Thai"], "serif": ["Noto Sans Thai"]},
    "armenian": {"sans": ["Noto Sans Armenian"], "serif": ["Noto Sans Armenian"]},
    "georgian": {"sans": ["Noto Sans Georgian"], "serif": ["Noto Sans Georgian"]},
}
_LAST = {"sans": ["Noto Sans"], "serif": ["Noto Serif", "Noto Sans"]}


def script_of(ch: str) -> str | None:
    o = ord(ch)
    if o < 0x0370 and not (0x00C0 <= o <= 0x024F):
        return None
    for a, b, name in _RANGES:
        if a <= o <= b:
            return name
    return None


def scripts(text: str) -> dict[str, int]:
    """Counts of letters per script ('kana' + 'han' are folded into japanese / chinese)."""
    out: dict[str, int] = {}
    for ch in text:
        s = script_of(ch)
        if s:
            out[s] = out.get(s, 0) + 1
    if "han" in out or "kana" in out:
        key = "japanese" if "kana" in out else ("korean" if "korean" in out else "chinese")
        n = out.pop("han", 0) + out.pop("kana", 0)
        out[key] = out.get(key, 0) + n
    if len(out) > 1:
        out.pop("latin", None)   # accented Latin beside another script: the other one decides
    return out


def base_rtl(text: str) -> bool:
    """Direction of the paragraph. Unicode says "the first strong letter", but
    'Golden Visa للمستثمرين ابتداءً من 2 مليون درهم' is an Arabic sentence that
    starts with an English name — so the script with more letters decides."""
    r = l = 0
    for ch in text:
        d = unicodedata.bidirectional(ch)
        if d in ("R", "AL"):
            r += 1
        elif d == "L":
            l += 1
    return r > l


@dataclass(frozen=True)
class Flow:
    rtl: bool = False      # draw right to left, align to the right
    shaped: bool = False   # letters join / reorder: needs a shaping engine
    cjk: bool = False      # Chinese / Japanese: lines may break between any two characters


PLAIN = Flow()


@lru_cache(maxsize=512)
def _cmap(stem: str) -> frozenset:
    try:
        from fontTools.ttLib import TTFont
        return frozenset((TTFont(font_path(stem), lazy=True).getBestCmap() or {}).keys())
    except Exception:
        return frozenset()


def _needs(ch: str) -> bool:
    """Characters worth switching fonts for: letters and their marks, not symbols."""
    return unicodedata.category(ch)[0] in "LM" and ord(ch) > 0x7F


_BUNDLED = {"InterDisplay": ("Inter", "sans"), "Inter": ("Inter", "sans"), "InstrumentSerif": ("Instrument Serif", "serif"),
            "SpaceGrotesk": ("Space Grotesk", "sans"), "JetBrainsMono": ("JetBrains Mono", "mono"),
            "Gelasio": ("Gelasio", "serif")}
_WEIGHT_WORDS = {"Thin": 100, "ExtraLight": 200, "Light": 300, "Regular": 400, "Italic": 400, "Medium": 500,
                 "SemiBold": 600, "Bold": 700, "ExtraBold": 800, "Black": 900}


def style_of(stem: str) -> tuple[str, str, int, bool]:
    """(family, kind sans|serif|mono|display, weight, italic) of a font stem."""
    m = re.match(r"gf-(.+)-(\d{3})(i?)$", stem)
    if m:
        from .fonts import family
        from .library import kind_of
        fam = family(stem)
        kind = kind_of(fam)
        if not kind:
            low = fam.lower()
            kind = "serif" if ("serif" in low and "sans" not in low) or any(
                k in low for k in ("garamond", "playfair", "fraunces", "bodoni", "caslon", "baskerville")) else "sans"
        return fam, kind, int(m.group(2)), bool(m.group(3))
    base, _, sub = stem.partition("-")
    fam, kind = _BUNDLED.get(base, (base, "sans"))
    return fam, kind, _WEIGHT_WORDS.get(sub, 400), "Italic" in sub


def _variant(family: str, weight: int, italic: bool) -> str | None:
    from .fonts import fetch
    from .library import known
    info = known(family)
    baked = (info or {}).get("weights") or [400, 700]
    w = min(baked, key=lambda x: (abs(x - weight), -x))
    try:
        have = fetch(family, (w,), italic=italic and w == 400 and bool((info or {}).get("italic")))
    except Exception:
        return None
    return have.get((w, True)) if italic and (w, True) in have else have.get((w, False)) or next(iter(have.values()), None)


@lru_cache(maxsize=2048)
def _resolve(stem: str, chars: frozenset, main: str) -> str:
    have = _cmap(stem)
    if not have or chars <= have:
        return stem
    _, kind, weight, italic = style_of(stem)
    style = "serif" if kind == "serif" else "sans"
    table = FALLBACKS.get(main, {})
    order = table.get(style, []) + table.get("sans", []) + _LAST[style]
    best, best_n = stem, len(chars & have)
    seen = set()
    for fam in order:
        if fam in seen:
            continue
        seen.add(fam)
        cand = _variant(fam, weight, italic)
        if not cand:
            continue
        got = len(chars & _cmap(cand))
        if got == len(chars):
            return cand
        if got > best_n:
            best, best_n = cand, got
    return best


def resolve(text: str, font: str) -> tuple[str, Flow]:
    """The font that can write `text` (the given one when it can) and how to lay it out."""
    if not text or text.isascii():
        return font, PLAIN
    found = scripts(text)
    flow = Flow(rtl=base_rtl(text), shaped=bool(SHAPED & set(found)),
                cjk=bool({"japanese", "chinese"} & set(found)))
    need = frozenset(ord(c) for c in text if _needs(c))
    if not need:
        return font, flow
    main = max(found, key=found.get) if found else "latin"
    return _resolve(font, need, main), flow


def text_width(text: str, font: str, size: float) -> float:
    """Width of `text` in the font that will actually draw it."""
    return width(text, resolve(text, font)[0], size)


# ─── wrapping ──────────────────────────────────────────────────────

_CJ = re.compile("[\u2e80-\u2fff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]")
_NO_START = set("、。，．！？：；）」』】〕〉》ー・々〻ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?,.:;)]}%")
_NO_END = set("「『（【〔〈《([{")


def _pieces(word: str) -> list[str]:
    """Chinese and Japanese break between characters (no spaces between words)."""
    if not _CJ.search(word):
        return [word]
    out, cur = [], ""
    for ch in word:
        if cur and (_CJ.match(ch) or _CJ.match(cur[-1])) and ch not in _NO_START and cur[-1] not in _NO_END:
            out.append(cur)
            cur = ch
        else:
            cur += ch
    if cur:
        out.append(cur)
    return out


def wrap(text: str, font: str, size: float, max_w: float, tracking: float = 0.0) -> list[str]:
    """Greedy word wrap. Keeps explicit newlines."""
    lines: list[str] = []
    for para in str(text).split("\n"):
        cur = ""
        for wi, word in enumerate(para.split(" ")):
            for pi, piece in enumerate(_pieces(word)):
                sep = " " if (pi == 0 and wi > 0) else ""
                trial = piece if not cur else cur + sep + piece
                tw = width(trial, font, size) + tracking * size * len(trial)
                if tw <= max_w or not cur:
                    cur = trial
                else:
                    lines.append(cur)
                    cur = piece
        lines.append(cur)
    return lines


def fit(text: str, font: str, max_w: float, max_h: float, size: float, min_size: float | None = None,
        lh: float = 1.15, tracking: float = 0.0, max_lines: int | None = None, factor: float = 1.0):
    """Largest size ≤ `size` at which `text` fits the box.

    Returns (size, lines, ok). `factor` > 1 makes the check stricter (used when the
    viewer's font is wider than the one we measure with)."""
    min_size = min_size or max(10, size * 0.5)
    s = float(size)
    step = 1.0 if size < 60 else 2.0
    while True:
        lines = wrap(text, font, s * factor, max_w, tracking)
        widest = max((width(l, font, s * factor) for l in lines), default=0)
        h = len(lines) * s * lh
        if (h <= max_h + 0.5 and widest <= max_w + 0.5 and (not max_lines or len(lines) <= max_lines)):
            return s, wrap(text, font, s, max_w, tracking), True
        if s - step < min_size:
            return min_size, wrap(text, font, min_size, max_w, tracking), False
        s -= step


def block_height(text: str, font: str, size: float, max_w: float, lh: float = 1.2) -> float:
    return len(wrap(text, font, size, max_w)) * size * lh

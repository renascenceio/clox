"""Text measurement with the real font files, so layouts fit before they are drawn."""
from __future__ import annotations

import os
from functools import lru_cache

from PIL import ImageFont

FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")


def font_path(name: str) -> str:
    return os.path.join(FONT_DIR, name + ".ttf")


@lru_cache(maxsize=256)
def _font(name: str, size: int):
    return ImageFont.truetype(font_path(name), max(1, int(size)))


def width(text: str, font: str, size: float) -> float:
    if not text:
        return 0.0
    # Measure at an integer size and scale: PIL only takes ints.
    s = max(1, int(round(size)))
    return _font(font, s).getlength(text) * (size / s)


def wrap(text: str, font: str, size: float, max_w: float, tracking: float = 0.0) -> list[str]:
    """Greedy word wrap. Keeps explicit newlines."""
    lines: list[str] = []
    for para in str(text).split("\n"):
        words = para.split(" ")
        cur = ""
        for w in words:
            trial = w if not cur else cur + " " + w
            tw = width(trial, font, size) + tracking * size * len(trial)
            if tw <= max_w or not cur:
                cur = trial
            else:
                lines.append(cur)
                cur = w
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

"""The built-in font library: ~130 Google families already on disk in every
sandbox (/opt/clox-fonts), covering Latin, Cyrillic, Greek, Arabic, Hebrew,
Japanese, Korean, Chinese, Devanagari, Thai and more. Nothing to download.

    from clox_kit import library
    library.show()                          # what's there, grouped
    library.show(script="arabic")           # fonts that write Arabic
    library.find(kind="serif", script="cyrillic")
    library.pairings()                      # tried display + body pairs

Use any of them as theme fonts:  Deck(..., fonts=("Fraunces", "Inter")).
Text in a script the chosen fonts can't write (Arabic in an Inter deck,
Japanese in a Fraunces report) switches to a matching library font on its own.
"""
from __future__ import annotations

import os
import sys

from .library_data import FONTS, PAIRINGS

_BY_NAME = {f["family"].lower(): f for f in FONTS}
_BY_SLUG = {f["family"].lower().replace(" ", ""): f for f in FONTS}


def known(family: str) -> dict | None:
    k = family.strip().lower()
    return _BY_NAME.get(k) or _BY_SLUG.get(k.replace(" ", "").replace("-", ""))


def canonical(family: str) -> str:
    """'ibm plex sans arabic' → 'IBM Plex Sans Arabic' (Google is case-sensitive)."""
    f = known(family)
    return f["family"] if f else family.strip()


def kind_of(family: str) -> str | None:
    f = known(family)
    return f["kind"] if f else None


def find(kind: str | None = None, script: str | None = None) -> list[str]:
    script = _script_alias(script)
    return [f["family"] for f in FONTS
            if (not kind or f["kind"] == kind) and (not script or script in f["scripts"])]


def _script_alias(s: str | None) -> str | None:
    if not s:
        return None
    s = s.lower().strip()
    return {"ru": "cyrillic", "russian": "cyrillic", "uk": "cyrillic", "ukrainian": "cyrillic",
            "ar": "arabic", "fa": "arabic", "persian": "arabic", "farsi": "arabic", "urdu": "arabic",
            "he": "hebrew", "ja": "japanese", "jp": "japanese", "ko": "korean", "kr": "korean",
            "zh": "chinese-simplified", "chinese": "chinese-simplified", "cn": "chinese-simplified",
            "zh-tw": "chinese-traditional", "tw": "chinese-traditional", "hk": "chinese-traditional",
            "hi": "devanagari", "hindi": "devanagari", "th": "thai", "el": "greek", "vi": "vietnamese",
            }.get(s, s)


def pairings(script: str | None = None) -> list[tuple[str, str, str, str]]:
    script = _script_alias(script)
    if not script:
        return list(PAIRINGS)
    return [p for p in PAIRINGS if script in known(p[1])["scripts"] and script in known(p[2])["scripts"]]


def installed() -> bool:
    from .fonts import library_dir
    return library_dir() is not None


def show(script: str | None = None, kind: str | None = None):
    """Print the library, grouped by kind, with the scripts each font writes."""
    script = _script_alias(script)
    rows = [f for f in FONTS if (not kind or f["kind"] == kind) and (not script or script in f["scripts"])]
    where = "on disk" if installed() else "downloaded on first use (library not baked into this image)"
    print(f"{len(rows)} fonts · {where}")
    for k in ("sans", "serif", "display", "mono"):
        group = [f for f in rows if f["kind"] == k]
        if not group:
            continue
        print(f"\n{k.upper()}")
        for f in group:
            extra = [s for s in f["scripts"] if s not in ("latin", "vietnamese")]
            print(f"  {f['family']:<24} {f['note']}" + (f"  [{', '.join(extra)}]" if extra else ""))
    ps = pairings(script)
    if ps:
        print("\nPAIRINGS  fonts=(display, body)")
        for label, d, b, note in ps:
            print(f"  {label:<18} ({d!r}, {b!r})  {note}")


def download(dest: str, families: list[str] | None = None) -> int:
    """Bake the library into `dest` (run once when building the sandbox image)."""
    from .fonts import fetch
    os.makedirs(dest, exist_ok=True)
    total = 0
    for f in FONTS:
        if families and f["family"] not in families:
            continue
        got = fetch(f["family"], tuple(f["weights"]), italic=f["italic"], dest=dest)
        total += len(got)
        print(f"{f['family']}: {len(got)} files", file=sys.stderr)
    return total

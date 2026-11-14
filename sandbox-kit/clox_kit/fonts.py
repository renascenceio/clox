"""Any Google Font, on demand. Files are downloaded once, cached, and then used
for measuring (so text fits), embedding (PDF), charts (matplotlib) and naming
(PowerPoint shows them by family name — Google Slides has every one of them).

    from clox_kit import Deck
    d = Deck("pitch", theme="navy", fonts=("Playfair Display", "DM Sans"))
    d = Deck("pitch", theme="studio", fonts="Fraunces:600 + Manrope")   # display weight 600

    from clox_kit import fonts
    fonts.pair("Space Grotesk", "Inter")   # → key usable as theme(fonts=...)
"""
from __future__ import annotations

import io
import os
import re
import urllib.error
import urllib.parse
import urllib.request

PREFIX = "gf:"
WEIGHTS = (400, 500, 600, 700)
_NAMES: dict[str, tuple[str, bool, bool]] = {}   # stem -> (family name inside the file, bold, italic)
_FAMILY: dict[str, str] = {}                      # stem -> Google family


def library_dir() -> str | None:
    """The font library baked into the sandbox image (see library.py), if any."""
    for d in (os.environ.get("CLOX_FONT_LIBRARY"), "/opt/clox-fonts"):
        if d and os.path.isdir(d):
            return d
    return None


def find(stem: str) -> str | None:
    """Path of a Google font file: the built-in library first, then the download cache."""
    lib = library_dir()
    if lib:
        p = os.path.join(lib, stem + ".ttf")
        if os.path.exists(p):
            return p
    try:
        p = os.path.join(cache_dir(), stem + ".ttf")
    except OSError:
        return None
    return p if os.path.exists(p) else None


def cache_dir() -> str:
    for d in (os.environ.get("CLOX_FONTS"), os.path.expanduser("~/.clox/fonts"), "/tmp/.clox/fonts"):
        if not d:
            continue
        try:
            os.makedirs(d, exist_ok=True)
            return d
        except OSError:
            continue
    raise OSError("no writable folder for fonts")


def _slug(family: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", family)


def _stem(family: str, weight: int, italic: bool) -> str:
    return f"gf-{_slug(family)}-{weight}{'i' if italic else ''}"


def _get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "clox-kit/1 (python)"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read()
    except urllib.error.HTTPError:
        raise
    except urllib.error.URLError as e:
        raise OSError(f"can't reach Google Fonts from here ({e.reason})") from e


def _css(family: str, variants: list[tuple[int, bool]]) -> str:
    spec = ";".join(f"{1 if i else 0},{w}" for w, i in sorted(variants, key=lambda v: (v[1], v[0])))
    q = urllib.parse.quote_plus(family) + ":ital,wght@" + spec
    return _get(f"https://fonts.googleapis.com/css2?family={q}").decode("utf-8", "replace")


_FACE = re.compile(r"font-style:\s*(\w+);\s*font-weight:\s*(\d+);[^}]*?src:\s*url\(([^)]+\.ttf)\)", re.S)


def _remember(stem: str, family: str):
    path = find(stem) or os.path.join(cache_dir(), stem + ".ttf")
    try:
        from fontTools.ttLib import TTFont
        names = TTFont(path, lazy=True)["name"]
        fam = names.getDebugName(1) or family
        sub = (names.getDebugName(2) or "").lower()
    except Exception:
        fam, sub = family, ""
    _NAMES[stem] = (fam, "bold" in sub, "italic" in sub)
    _FAMILY[stem] = family


def _download(family: str, missing: list[tuple[int, bool]], out: dict, dest: str) -> bool:
    faces: list[tuple[str, str, str]] = []
    try:
        faces = _FACE.findall(_css(family, missing))
    except urllib.error.HTTPError as e:
        if e.code != 400:
            raise
        # Google answers 400 when ANY variant is missing — ask one at a time.
        for v in missing:
            try:
                faces += _FACE.findall(_css(family, [v]))
            except urllib.error.HTTPError:
                continue
    for style, w, url in faces:
        key = (int(w), style == "italic")
        stem = _stem(family, *key)
        tmp = os.path.join(dest, stem + ".ttf.part")
        with open(tmp, "wb") as f:
            f.write(_get(url))
        os.replace(tmp, os.path.join(dest, stem + ".ttf"))
        out[key] = stem
    return bool(faces)


def fetch(family: str, weights=WEIGHTS, italic: bool = True, dest: str | None = None) -> dict[tuple[int, bool], str]:
    """The family's static TTFs — from the built-in library when it has them,
    else downloaded once into the cache. Returns {(weight, italic): stem}."""
    from .library import canonical, known
    family = canonical(family.strip())
    want = [(w, False) for w in weights] + ([(400, True)] if italic else [])
    info = known(family)
    if info:
        # We know which weights Google has; never ask for the others.
        want = [(w, i) for w, i in want if w in (info["italics"] if i else info["available"])] or want
    out: dict[tuple[int, bool], str] = {}
    missing = []
    for w, i in want:
        stem = _stem(family, w, i)
        if find(stem) and not dest:
            out[(w, i)] = stem
        else:
            missing.append((w, i))
    if missing:
        target = dest or cache_dir()
        if out:
            # The library has this family, just not every weight. Fetch the
            # extras when the network allows; otherwise use what is on disk.
            try:
                _download(family, missing, out, target)
            except (OSError, urllib.error.HTTPError):
                pass
        elif not _download(family, missing, out, target):
            raise ValueError(f"Google Fonts has no family called {family!r} — check the spelling on fonts.google.com")
    if dest:
        return out
    for stem in out.values():
        if stem not in _NAMES:
            _remember(stem, family)
    return out


def _pick(have: dict, prefs, italic=False):
    for w in prefs:
        if (w, italic) in have:
            return have[(w, italic)]
    return next(iter(have.values()))


def _parse(spec: str) -> tuple[str, int | None]:
    m = re.match(r"\s*(.+?)\s*(?::\s*(\d{3}))?\s*$", spec)
    return m.group(1), int(m.group(2)) if m.group(2) else None


def pair(display: str, body: str | None = None) -> str:
    """Register a display + body pairing and return its theme key."""
    from .theme import FONT_SETS
    body = body or display
    key = f"{PREFIX}{display.strip()}|{body.strip()}"
    if key in FONT_SETS:
        return key
    dfam, dw = _parse(display)
    bfam, _ = _parse(body)
    dweights = tuple(sorted({dw, 400, 500, 600, 700} - {None}))
    dh = fetch(dfam, dweights)
    bh = dh if bfam == dfam else fetch(bfam)
    main = (dw,) if dw else (700, 600, 800, 400)
    disp = _pick(dh, main)
    dweight = next(w for (w, i), s in dh.items() if s == disp)
    soft = _pick(dh, [w for w in (600, 500, 400) if w < dweight] or [dweight])
    FONT_SETS[key] = {
        "display": disp, "display_soft": soft,
        "body": _pick(bh, (400, 500)), "medium": _pick(bh, (500, 400)),
        "semibold": _pick(bh, (600, 700, 500)), "bold": _pick(bh, (700, 600)),
        "italic": _pick(bh, (400,), italic=True) if (400, True) in bh else _pick(bh, (400,)),
        "mono": "JetBrainsMono-Regular",
    }
    return key


def key_for(fonts) -> str | None:
    """("A", "B") | "A + B" | "A" → a registered theme key; None for built-in names."""
    from .theme import FONT_SETS
    if fonts is None:
        return None
    if isinstance(fonts, (list, tuple)):
        return pair(*[str(f) for f in fonts][:2])
    s = str(fonts).strip()
    if s in FONT_SETS or s in ("office", "google"):
        return s if s in FONT_SETS else None
    if s.startswith(PREFIX):
        return ensure(s)
    return pair(*[p.strip() for p in re.split(r"\s*[+/&]\s*", s, maxsplit=1)])


def ensure(key: str) -> str:
    """Re-register a saved pairing (decks remember the key, not the files)."""
    from .theme import FONT_SETS
    if key.startswith(PREFIX) and key not in FONT_SETS:
        display, _, body = key[len(PREFIX):].partition("|")
        pair(display, body or display)
    return key


def is_google(stem: str) -> bool:
    return stem.startswith("gf-")


def pptx_name(stem: str) -> tuple[str, bool, bool]:
    if stem not in _NAMES:
        _remember(stem, stem)
    return _NAMES[stem]


def family(stem: str) -> str:
    return _FAMILY.get(stem) or pptx_name(stem)[0]


def all_files() -> list[str]:
    d = cache_dir()
    return [os.path.join(d, f) for f in sorted(os.listdir(d)) if f.endswith(".ttf")]

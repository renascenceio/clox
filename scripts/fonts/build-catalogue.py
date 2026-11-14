"""Build the clox font library catalogue from the curated list below + Google
Fonts metadata (real weights and scripts, never typed by hand).

    python3 scripts/fonts/build-catalogue.py

Writes:
  sandbox-kit/clox_kit/library_data.py   what the kit and the snapshot use
  src/lib/font-library.json              what the font picker in the app shows

Then rebuild the sandbox snapshot (scripts/build-skills-snapshot.ts or
scripts/add-font-library.ts) so the files are on disk in every chat.
"""
from __future__ import annotations

import json
import os
import pprint
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# family, kind (sans | serif | display | mono), one line on what it is for.
CURATED: list[tuple[str, str, str]] = [
    # ── Modern sans ──────────────────────────────────────────────
    ("Inter", "sans", "Neutral workhorse, superb at every size"),
    ("Inter Tight", "sans", "Inter cut tighter for big headlines"),
    ("Geist", "sans", "Crisp, technical, very current"),
    ("Manrope", "sans", "Geometric and warm, great for product decks"),
    ("DM Sans", "sans", "Low-contrast geometric, friendly and clear"),
    ("Plus Jakarta Sans", "sans", "Modern geometric with soft curves"),
    ("Outfit", "sans", "Rounded geometric, bold display feel"),
    ("Sora", "sans", "Wide, techy geometric"),
    ("Figtree", "sans", "Clean and friendly, easy to read"),
    ("Onest", "sans", "Modern grotesque with strong Cyrillic"),
    ("Urbanist", "sans", "Sharp geometric, fashion and real estate"),
    ("Work Sans", "sans", "Grotesque with character at large sizes"),
    ("IBM Plex Sans", "sans", "Engineered, corporate, very legible"),
    ("Albert Sans", "sans", "Scandinavian geometric"),
    ("Hanken Grotesk", "sans", "Quiet grotesque for long text"),
    ("Instrument Sans", "sans", "Precise neo-grotesque"),
    ("Schibsted Grotesk", "sans", "Newsroom grotesque, punchy"),
    ("Bricolage Grotesque", "sans", "Quirky grotesque with personality"),
    ("Space Grotesk", "sans", "Retro-tech grotesque"),
    ("Archivo", "sans", "Sturdy grotesque, great in bold"),
    ("Mona Sans", "sans", "Strong, versatile grotesque"),
    ("Host Grotesk", "sans", "Calm contemporary grotesque"),
    ("Familjen Grotesk", "sans", "Grotesque with lively details"),
    ("Red Hat Display", "sans", "Confident display sans"),
    ("Epilogue", "sans", "Elegant grotesque for editorial work"),
    ("Public Sans", "sans", "Strong, neutral, institutional"),
    ("Lexend", "sans", "Built for reading ease"),
    ("Montserrat", "sans", "Classic geometric, wide caps"),
    ("Poppins", "sans", "Geometric, very popular, Devanagari too"),
    ("Rubik", "sans", "Soft rounded corners; Latin, Cyrillic, Arabic, Hebrew"),
    ("Golos Text", "sans", "Modern Cyrillic-first grotesque"),
    ("Commissioner", "sans", "Flexible grotesque, Cyrillic and Greek"),
    ("Geologica", "sans", "Geometric with Cyrillic and Greek"),
    ("Raleway", "sans", "Elegant thin-to-bold sans"),
    ("Jost", "sans", "Futura-like geometric"),
    ("Source Sans 3", "sans", "Clear humanist, huge language range"),
    ("Libre Franklin", "sans", "American gothic, newspaper feel"),
    ("Barlow", "sans", "Slightly rounded, California road-sign feel"),
    ("Open Sans", "sans", "Universal humanist, Hebrew and Greek too"),
    ("Roboto", "sans", "Android's sans, every language"),
    ("PT Sans", "sans", "Humanist with excellent Cyrillic"),
    ("Noto Sans", "sans", "Universal fallback: Latin, Cyrillic, Greek, Vietnamese"),
    # ── Display ─────────────────────────────────────────────────
    ("Syne", "display", "Art-gallery display, wide and bold"),
    ("Unbounded", "display", "Wide, rounded, loud; Cyrillic too"),
    ("Funnel Display", "display", "Modern display grotesque"),
    ("Bebas Neue", "display", "Tall condensed caps for posters"),
    ("Anton", "display", "Heavy condensed headline face"),
    ("Archivo Black", "display", "Ultra-bold grotesque"),
    ("Oswald", "display", "Condensed gothic, Cyrillic too"),
    ("Alumni Sans", "display", "Tall condensed, elegant in light weights"),
    ("Tenor Sans", "display", "Refined small-caps feel, luxury"),
    ("Italiana", "display", "Thin high-fashion display"),
    ("Cinzel", "display", "Roman inscription capitals"),
    ("Marcellus", "display", "Flared classical capitals"),
    # ── Serif ───────────────────────────────────────────────────
    ("Playfair Display", "serif", "High-contrast editorial serif"),
    ("Fraunces", "serif", "Soft, characterful old-style display serif"),
    ("Cormorant Garamond", "serif", "Delicate Garamond for luxury"),
    ("DM Serif Display", "serif", "Bold high-contrast headline serif"),
    ("Instrument Serif", "serif", "Condensed modern editorial serif"),
    ("Newsreader", "serif", "Made for reading news and reports"),
    ("EB Garamond", "serif", "Classic book Garamond"),
    ("Libre Caslon Text", "serif", "Traditional Caslon for long text"),
    ("Lora", "serif", "Balanced contemporary serif"),
    ("Young Serif", "serif", "Warm heavy old-style display"),
    ("Gloock", "serif", "Dramatic high-contrast display serif"),
    ("Bodoni Moda", "serif", "Fashion Bodoni"),
    ("Spectral", "serif", "Elegant screen-first serif"),
    ("Source Serif 4", "serif", "Robust serif for reports"),
    ("Literata", "serif", "Book serif with wide language support"),
    ("Crimson Pro", "serif", "Classic book serif, compact"),
    ("Libre Baskerville", "serif", "Baskerville for body text"),
    ("Merriweather", "serif", "Sturdy serif, very readable"),
    ("PT Serif", "serif", "Humanist serif with excellent Cyrillic"),
    ("IBM Plex Serif", "serif", "Engineered companion to Plex Sans"),
    ("Petrona", "serif", "Lively contemporary text serif"),
    ("Prata", "serif", "Didone display with Cyrillic"),
    ("Gilda Display", "serif", "Graceful didone for hospitality"),
    ("Roboto Slab", "serif", "Friendly slab serif"),
    ("Zilla Slab", "serif", "Contemporary slab with flair"),
    ("Noto Serif", "serif", "Universal serif fallback"),
    ("Noto Serif Display", "serif", "High-contrast universal display serif"),
    # ── Mono ────────────────────────────────────────────────────
    ("JetBrains Mono", "mono", "Code and data, very clear"),
    ("IBM Plex Mono", "mono", "Engineered mono"),
    ("Geist Mono", "mono", "Technical mono to pair with Geist"),
    ("DM Mono", "mono", "Soft geometric mono"),
    ("Space Mono", "mono", "Retro mono with character"),
    # ── Arabic ──────────────────────────────────────────────────
    ("IBM Plex Sans Arabic", "sans", "Modern corporate Arabic with matching Latin"),
    ("Noto Sans Arabic", "sans", "Clean universal Arabic sans"),
    ("Noto Kufi Arabic", "sans", "Geometric Kufi for headlines"),
    ("Noto Naskh Arabic", "serif", "Traditional Naskh for reading"),
    ("Readex Pro", "sans", "Modern Arabic + Latin, very legible"),
    ("Alexandria", "sans", "Geometric Arabic + Latin, contemporary"),
    ("Cairo", "sans", "Popular modern Arabic + Latin"),
    ("Tajawal", "sans", "Light, airy Arabic + Latin"),
    ("Almarai", "sans", "Simple, crisp Arabic"),
    ("Vazirmatn", "sans", "Arabic and Persian, neutral"),
    ("Changa", "sans", "Condensed Kufi-style display"),
    ("Reem Kufi", "display", "Elegant Fatimid Kufi display"),
    ("Amiri", "serif", "Classical Naskh book face, Latin too"),
    ("Markazi Text", "serif", "Editorial Arabic serif"),
    # ── Hebrew ──────────────────────────────────────────────────
    ("Noto Sans Hebrew", "sans", "Universal Hebrew sans"),
    ("Heebo", "sans", "Modern Hebrew + Latin"),
    ("Frank Ruhl Libre", "serif", "Classic Hebrew serif"),
    # ── Japanese, Korean, Chinese ───────────────────────────────
    ("Noto Sans JP", "sans", "Japanese gothic, standard choice"),
    ("Noto Serif JP", "serif", "Japanese mincho"),
    ("Zen Kaku Gothic New", "sans", "Modern Japanese gothic"),
    ("IBM Plex Sans JP", "sans", "Corporate Japanese to pair with Plex"),
    ("Noto Sans KR", "sans", "Korean gothic, standard choice"),
    ("Noto Serif KR", "serif", "Korean myeongjo"),
    ("IBM Plex Sans KR", "sans", "Corporate Korean to pair with Plex"),
    ("Noto Sans SC", "sans", "Simplified Chinese sans"),
    ("Noto Serif SC", "serif", "Simplified Chinese serif"),
    ("Noto Sans TC", "sans", "Traditional Chinese sans"),
    ("Noto Serif TC", "serif", "Traditional Chinese serif"),
    # ── Other scripts ───────────────────────────────────────────
    ("Noto Sans Devanagari", "sans", "Hindi, Marathi, Nepali"),
    ("Noto Serif Devanagari", "serif", "Devanagari serif"),
    ("Noto Sans Bengali", "sans", "Bengali"),
    ("Noto Sans Tamil", "sans", "Tamil"),
    ("Noto Sans Thai", "sans", "Thai"),
    ("Kanit", "sans", "Modern Thai + Latin"),
    ("Noto Sans Armenian", "sans", "Armenian"),
    ("Noto Sans Georgian", "sans", "Georgian"),
    # ── Same widths as Office fonts (used to measure them) ─────
    ("Carlito", "sans", "Same widths as Calibri"),
    ("Caladea", "serif", "Same widths as Cambria"),
    ("Arimo", "sans", "Same widths as Arial"),
    ("Tinos", "serif", "Same widths as Times New Roman"),
    ("Gelasio", "serif", "Same widths as Georgia"),
]

# Suggested pairings for the picker and the model. (label, display, body, note)
PAIRINGS: list[tuple[str, str, str, str]] = [
    ("Clean", "Inter Tight", "Inter", "Modern, neutral, works for anything"),
    ("Product", "Manrope", "Inter", "Friendly tech and SaaS"),
    ("Technical", "Geist", "Geist", "Developer tools, data, AI"),
    ("Swiss", "Instrument Sans", "Instrument Sans", "Grid-led, confident"),
    ("Startup", "Bricolage Grotesque", "DM Sans", "Pitch decks with personality"),
    ("Bold", "Syne", "Manrope", "Culture, events, agencies"),
    ("Poster", "Bebas Neue", "Inter", "Huge condensed headlines"),
    ("Editorial", "Fraunces", "Inter", "Essays, strategy, thought leadership"),
    ("Magazine", "Playfair Display", "Source Serif 4", "Long reads, reports"),
    ("Newsroom", "Newsreader", "Schibsted Grotesk", "Research and briefings"),
    ("Luxury", "Cormorant Garamond", "Manrope", "Real estate, hospitality, wealth"),
    ("Fashion", "Bodoni Moda", "Jost", "High contrast, fashion and beauty"),
    ("Classic", "EB Garamond", "EB Garamond", "Books, formal documents"),
    ("Corporate", "IBM Plex Sans", "IBM Plex Sans", "Board packs, finance"),
    ("Arabic modern", "Readex Pro", "IBM Plex Sans Arabic", "Arabic + English, contemporary"),
    ("Arabic corporate", "IBM Plex Sans Arabic", "IBM Plex Sans Arabic", "Government and business"),
    ("Arabic geometric", "Alexandria", "Tajawal", "Bold, modern Gulf brands"),
    ("Arabic classic", "Amiri", "Noto Naskh Arabic", "Formal and traditional"),
    ("Cyrillic modern", "Unbounded", "Onest", "Bold Russian/Ukrainian decks"),
    ("Cyrillic editorial", "Playfair Display", "PT Serif", "Russian editorial"),
    ("Japanese", "Zen Kaku Gothic New", "Noto Sans JP", "Clean Japanese"),
    ("Japanese classic", "Noto Serif JP", "Noto Sans JP", "Formal Japanese"),
    ("Korean", "Noto Sans KR", "Noto Sans KR", "Clean Korean"),
    ("Chinese", "Noto Sans SC", "Noto Sans SC", "Simplified Chinese"),
]

# What to keep on disk. The kit asks for 400-700 + 400 italic; 300/800 cover
# light luxury headlines and heavy poster ones.
LATIN_WEIGHTS = (300, 400, 500, 600, 700, 800)
BIG_WEIGHTS = (400, 700)          # CJK families are 5-12 MB per weight
BIG_SCRIPTS = {"japanese", "korean", "chinese-simplified", "chinese-traditional"}

SCRIPT_NAMES = {
    "latin": "latin", "latin-ext": "latin", "vietnamese": "vietnamese",
    "cyrillic": "cyrillic", "cyrillic-ext": "cyrillic", "greek": "greek", "greek-ext": "greek",
    "arabic": "arabic", "hebrew": "hebrew", "japanese": "japanese", "korean": "korean",
    "chinese-simplified": "chinese-simplified", "chinese-traditional": "chinese-traditional",
    "devanagari": "devanagari", "bengali": "bengali", "tamil": "tamil", "thai": "thai",
    "armenian": "armenian", "georgian": "georgian",
}


def metadata() -> dict:
    req = urllib.request.Request("https://fonts.google.com/metadata/fonts", headers={"User-Agent": "clox"})
    raw = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
    if raw.startswith(")]}'"):
        raw = raw[4:]
    return {f["family"]: f for f in json.loads(raw)["familyMetadataList"]}


def main():
    meta = metadata()
    fonts = []
    for family, kind, note in CURATED:
        m = meta.get(family)
        if not m:
            raise SystemExit(f"Google Fonts has no family {family!r}")
        styles = set(m["fonts"])
        scripts = sorted({SCRIPT_NAMES[s] for s in m["subsets"] if s in SCRIPT_NAMES} | {"latin"})
        big = bool(BIG_SCRIPTS & set(m["subsets"]))
        want = BIG_WEIGHTS if big else LATIN_WEIGHTS
        weights = [w for w in want if str(w) in styles] or [int(min(styles, key=lambda s: abs(int(s.rstrip("i")) - 400)).rstrip("i"))]
        italic = (not big) and "400i" in styles
        available = sorted({int(s.rstrip("i")) for s in styles if s.rstrip("i").isdigit()})
        fonts.append({
            "family": family, "kind": kind, "note": note, "scripts": scripts,
            "weights": weights, "italic": italic, "available": available,
            "italics": sorted(int(s[:-1]) for s in styles if s.endswith("i") and s[:-1].isdigit()),
        })
    names = {f["family"] for f in fonts}
    for label, d, b, _ in PAIRINGS:
        for fam in (d, b):
            if fam not in names:
                raise SystemExit(f"pairing {label!r} uses {fam!r}, which is not in the library")

    py = os.path.join(ROOT, "sandbox-kit", "clox_kit", "library_data.py")
    with open(py, "w") as f:
        f.write('"""GENERATED by scripts/fonts/build-catalogue.py — edit the list there, then re-run."""\n\n')
        f.write("FONTS = " + pprint.pformat(fonts, width=110, sort_dicts=False) + "\n\n")
        f.write("PAIRINGS = " + pprint.pformat(PAIRINGS, width=110) + "\n")
    js = os.path.join(ROOT, "src", "lib", "font-library.json")
    with open(js, "w") as f:
        json.dump({
            "fonts": [{k: v for k, v in x.items() if k in ("family", "kind", "note", "scripts", "available")} for x in fonts],
            "pairings": [{"label": l, "display": d, "body": b, "note": n} for l, d, b, n in PAIRINGS],
        }, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"{len(fonts)} families, {len(PAIRINGS)} pairings")


if __name__ == "__main__":
    main()

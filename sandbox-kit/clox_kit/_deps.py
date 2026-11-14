"""Install heavy optional packages the first time something imports them.

The sandbox image ships the document libraries; pandas / matplotlib / numpy
are only needed for data work and PNG charts, so they're fetched on demand
(wheels only, ~5-15 s once per sandbox) instead of slowing every boot.
"""
from __future__ import annotations

import importlib
import importlib.machinery
import subprocess
import sys

_PIP_NAMES = {
    "pandas": "pandas",
    "numpy": "numpy",
    "matplotlib": "matplotlib",
    "pdfplumber": "pdfplumber",
    "xlrd": "xlrd",
    "fontTools": "fonttools",
    "arabic_reshaper": "arabic-reshaper",
    "bidi": "python-bidi",
}
_tried: set[str] = set()


def ensure(module: str, pip_name: str | None = None):
    """Import `module`, installing it once if missing. Returns the module or None.
    For packages other libraries import optionally at load time (reportlab
    looks for uharfbuzz once, on import) — the caller hands it over itself."""
    try:
        return importlib.import_module(module)
    except ImportError:
        pass
    if module in _tried:
        return None
    _tried.add(module)
    print(f"[clox_kit] installing {pip_name or module} (one time, a few seconds)…", file=sys.stderr, flush=True)
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "--prefer-binary",
                        "--disable-pip-version-check", pip_name or module], check=True, timeout=150)
        importlib.invalidate_caches()
        return importlib.import_module(module)
    except Exception as e:  # noqa: BLE001
        print(f"[clox_kit] could not install {pip_name or module}: {e}", file=sys.stderr)
        return None


class _AutoInstall:
    """Last entry on sys.meta_path: only asked when a module wasn't found."""

    def find_spec(self, name, path=None, target=None):
        top = name.split(".")[0]
        if name != top or top not in _PIP_NAMES or top in _tried:
            return None
        _tried.add(top)
        print(f"[clox_kit] installing {top} (one time, a few seconds)…", file=sys.stderr, flush=True)
        try:
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "--quiet", "--prefer-binary",
                 "--disable-pip-version-check", _PIP_NAMES[top]],
                check=True, timeout=150,
            )
        except Exception as e:  # noqa: BLE001
            print(f"[clox_kit] could not install {top}: {e}", file=sys.stderr)
            return None
        importlib.invalidate_caches()
        return importlib.machinery.PathFinder.find_spec(name, path)


def install_hook() -> None:
    if not any(isinstance(f, _AutoInstall) for f in sys.meta_path):
        sys.meta_path.append(_AutoInstall())

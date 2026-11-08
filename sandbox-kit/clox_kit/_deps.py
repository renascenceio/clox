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
}
_tried: set[str] = set()


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

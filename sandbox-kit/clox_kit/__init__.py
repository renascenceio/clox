"""clox_kit — designed decks, PDFs, spreadsheets and charts in a few lines.

    from clox_kit import Deck, Report, Book, charts, data, theme, THEMES
"""
from ._deps import install_hook

install_hook()

from . import charts, data  # noqa: E402
from .report import Report
from .sheets import Book
from .slides import Deck
from .theme import THEMES, Theme, mix, on, theme

__all__ = ["Deck", "Report", "Book", "charts", "data", "theme", "THEMES", "Theme", "mix", "on"]
__version__ = "1.0.0"

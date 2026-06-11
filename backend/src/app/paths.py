"""Filesystem locations of bundled assets (demo dataset, fonts)."""

from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
ASSETS_DIR = BACKEND_DIR / "assets"
FONTS_DIR = ASSETS_DIR / "fonts"
DEMO_XLSX = ASSETS_DIR / "demo.xlsx"

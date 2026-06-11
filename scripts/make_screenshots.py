# /// script
# requires-python = ">=3.12"
# dependencies = ["playwright>=1.50"]
# ///
"""Generate the thesis screenshots (plan stage 8) for all pages in both languages.

Boots the real stack (backend on :8000 with a throwaway SQLite DB, Vite dev server
on :5173), seeds the demo dataset, runs an evaluation, then captures full-page
screenshots into docs/screenshots/.

Run from the repository root:
    uv run --with playwright playwright install chromium   # once
    uv run scripts/make_screenshots.py
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "screenshots"
API = "http://localhost:8000"
WEB = "http://localhost:5173"
PAGES = ["regions", "panel", "dashboard", "parameters"]
LANGS = ["uk", "en"]


def wait_for(url: str, timeout: float = 60.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2):
                return
        except Exception:
            time.sleep(0.5)
    raise TimeoutError(f"{url} not ready within {timeout}s")


def post(url: str, ok_statuses: tuple[int, ...] = (200, 201, 409)) -> int:
    req = urllib.request.Request(url, method="POST", data=b"{}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status
    except urllib.error.HTTPError as e:  # 409 demo-already-imported is fine
        if e.code in ok_statuses:
            return e.code
        raise


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="travel-risk-shots-")
    api_proc = subprocess.Popen(
        ["uv", "run", "--project", "backend", "uvicorn", "app.main:app", "--port", "8000"],
        cwd=ROOT,
        env={**os.environ, "DATABASE_URL": f"sqlite:///{tmp}/app.db"},
    )
    web_proc = subprocess.Popen(["npm", "run", "dev", "--", "--port", "5173"], cwd=ROOT / "frontend")
    try:
        wait_for(f"{API}/api/health")
        wait_for(WEB)
        post(f"{API}/api/import/demo")
        post(f"{API}/api/evaluations")

        with sync_playwright() as p:
            browser = p.chromium.launch()
            for lang in LANGS:
                ctx = browser.new_context(viewport={"width": 1440, "height": 900})
                page = ctx.new_page()
                page.goto(WEB)
                page.evaluate(f"localStorage.setItem('travel-risk-lang', '{lang}')")
                for name in PAGES:
                    page.goto(f"{WEB}/{name}")
                    page.wait_for_load_state("networkidle")
                    if name == "panel":
                        # run an evaluation so the per-module step-cards are visible
                        page.get_by_role("button").filter(
                            has_text="всі регіони" if lang == "uk" else "all regions"
                        ).first.click()
                        # "Run all" opens a confirmation dialog; confirm it
                        page.get_by_role("alertdialog").get_by_role("button").last.click()
                        page.wait_for_selector(".step-card", timeout=30_000)
                        page.wait_for_load_state("networkidle")
                    page.wait_for_timeout(1200)  # let charts animate in
                    path = OUT / f"{name}-{lang}.png"
                    page.screenshot(path=str(path), full_page=True)
                    print(f"saved {path.relative_to(ROOT)}")
                ctx.close()
            browser.close()
    finally:
        api_proc.terminate()
        web_proc.terminate()
        api_proc.wait(timeout=10)
        web_proc.wait(timeout=10)


if __name__ == "__main__":
    sys.exit(main())

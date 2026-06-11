"""Uvicorn entry point: `uv run --project backend uvicorn app.main:app`."""

from app.factory import create_app

app = create_app()

"""Dump the OpenAPI schema to backend/openapi.json for contract review.

Usage: uv run --project backend python backend/scripts/dump_openapi.py
"""

import json
from pathlib import Path

from app.factory import create_app


def main() -> None:
    schema = create_app("sqlite:///:memory:").openapi()
    target = Path(__file__).resolve().parents[1] / "openapi.json"
    target.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {target}")


if __name__ == "__main__":
    main()

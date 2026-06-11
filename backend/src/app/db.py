"""Database engine construction and the per-request session dependency."""

import os
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from fastapi import Request
from sqlalchemy import create_engine, event, make_url
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

DEFAULT_DATABASE_URL = "sqlite:///./data/app.db"


def build_engine(database_url: str | None = None) -> Engine:
    """Create the SQLAlchemy engine, ensuring the SQLite data directory exists."""
    url = make_url(database_url or os.environ.get("DATABASE_URL") or DEFAULT_DATABASE_URL)
    connect_args: dict[str, object] = {}
    is_sqlite = url.get_backend_name() == "sqlite"
    if is_sqlite:
        if url.database and url.database != ":memory:":
            Path(url.database).expanduser().parent.mkdir(parents=True, exist_ok=True)
        # FastAPI's TestClient and threaded servers touch the connection pool
        # from multiple threads; SQLite forbids that by default.
        connect_args["check_same_thread"] = False
    engine = create_engine(url, connect_args=connect_args)
    if is_sqlite:

        @event.listens_for(engine, "connect")
        def _set_sqlite_pragmas(dbapi_connection: Any, _record: Any) -> None:
            # WAL + busy_timeout so concurrent writers (threadpool requests or,
            # if ever deployed so, multiple workers) wait instead of failing
            # with "database is locked".
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.close()

    return engine


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency yielding a session bound to the app's engine."""
    with Session(request.app.state.engine) as session:
        yield session

"""Application factory: engine, lifespan (create_all + seed), CORS, routers.

Deployment note: run a SINGLE uvicorn worker (the Dockerfile default). The app
uses one SQLite file; WAL + busy_timeout are enabled in db.py, but the design
assumes write concurrency stays within one process.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app import __version__
from app.db import build_engine
from app.models import Base
from app.routers import (
    configs,
    criteria,
    evaluations,
    health,
    imports,
    regions,
    respondents,
    rulesets,
)
from app.seed import seed_defaults

#: Dev origin by default; override with a comma-separated CORS_ORIGINS env var.
#: (The Docker web image proxies /api same-origin via nginx, so it needs none.)
DEFAULT_CORS_ORIGINS = "http://localhost:5173"


def cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def create_app(database_url: str | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        Base.metadata.create_all(app.state.engine)
        with Session(app.state.engine) as session:
            seed_defaults(session)
        yield

    app = FastAPI(
        title="Travel Risk API",
        description="Backend of the tourism travel safety risk assessment platform",
        version=__version__,
        lifespan=lifespan,
    )
    app.state.engine = build_engine(database_url)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for router in (
        health.router,
        regions.router,
        respondents.router,
        imports.router,
        criteria.router,
        configs.router,
        rulesets.router,
        evaluations.router,
    ):
        app.include_router(router, prefix="/api")
    return app

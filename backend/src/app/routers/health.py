"""Health and meta endpoints."""

from fastapi import APIRouter
from tourism_risk import __version__ as core_version

from app import __version__ as app_version

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/meta")
def meta() -> dict[str, str]:
    return {"app_version": app_version, "core_version": core_version}

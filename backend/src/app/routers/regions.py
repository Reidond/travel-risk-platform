"""Region CRUD endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_session

router = APIRouter(tags=["regions"])


def region_or_404(session: Session, region_id: int) -> models.Region:
    region = session.get(models.Region, region_id)
    if region is None:
        raise HTTPException(status_code=404, detail=f"region {region_id} not found")
    return region


def _latest_results(session: Session, region_ids: list[int]) -> dict[int, dict[str, Any]]:
    """Latest evaluation result (mu, risk_class, evaluated_at) per region id."""
    if not region_ids:
        return {}
    stmt = (
        select(
            models.EvaluationResult.region_id,
            models.EvaluationResult.mu,
            models.EvaluationResult.risk_class,
            models.EvaluationRun.created_at,
        )
        .join(models.EvaluationRun)
        .where(models.EvaluationResult.region_id.in_(region_ids))
        .order_by(models.EvaluationRun.created_at.asc(), models.EvaluationRun.id.asc())
    )
    latest: dict[int, dict[str, Any]] = {}
    for region_id, mu, risk_class, created_at in session.execute(stmt):
        latest[region_id] = {"mu": mu, "risk_class": risk_class, "evaluated_at": created_at}
    return latest


def region_to_out(
    session: Session,
    region: models.Region,
    latest: dict[int, dict[str, Any]] | None = None,
) -> schemas.RegionOut:
    if latest is None:
        latest = _latest_results(session, [region.id])
    count = session.scalar(
        select(func.count())
        .select_from(models.Respondent)
        .where(models.Respondent.region_id == region.id)
    )
    return schemas.RegionOut(
        id=region.id,
        name_uk=region.name_uk,
        name_en=region.name_en,
        xi=region.xi,
        delta_level=region.delta_level,
        respondent_count=int(count or 0),
        latest_result=latest.get(region.id),  # type: ignore[arg-type]
    )


@router.get("/regions")
def list_regions(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    total = session.scalar(select(func.count()).select_from(models.Region)) or 0
    regions = list(
        session.scalars(
            select(models.Region).order_by(models.Region.id).offset(offset).limit(limit)
        )
    )
    latest = _latest_results(session, [region.id for region in regions])
    items = [region_to_out(session, region, latest) for region in regions]
    return {"items": items, "total": int(total)}


@router.post("/regions", status_code=201)
def create_region(
    payload: schemas.RegionCreate,
    session: Session = Depends(get_session),
) -> schemas.RegionOut:
    region = models.Region(**payload.model_dump())
    session.add(region)
    session.commit()
    session.refresh(region)
    return region_to_out(session, region)


@router.get("/regions/{region_id}")
def get_region(
    region_id: int,
    session: Session = Depends(get_session),
) -> schemas.RegionOut:
    return region_to_out(session, region_or_404(session, region_id))


@router.patch("/regions/{region_id}")
def patch_region(
    region_id: int,
    payload: schemas.RegionPatch,
    session: Session = Depends(get_session),
) -> schemas.RegionOut:
    region = region_or_404(session, region_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(region, field, value)
    session.commit()
    session.refresh(region)
    return region_to_out(session, region)


@router.delete("/regions/{region_id}", status_code=204)
def delete_region(region_id: int, session: Session = Depends(get_session)) -> Response:
    region = region_or_404(session, region_id)
    session.delete(region)  # ORM cascade deletes respondents
    session.commit()
    return Response(status_code=204)

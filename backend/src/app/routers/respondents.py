"""Respondent (questionnaire) CRUD endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.core_bridge import criteria_codes, load_groups
from app.db import get_session
from app.routers.regions import region_or_404

router = APIRouter(tags=["respondents"])


def validate_ratings(session: Session, ratings: dict[str, int]) -> None:
    """Ratings must cover exactly the active criteria codes (values 1-5)."""
    codes = set(criteria_codes(load_groups(session)))
    missing = sorted(codes - ratings.keys())
    extra = sorted(ratings.keys() - codes)
    problems: list[str] = []
    if missing:
        problems.append(f"missing ratings for criteria: {', '.join(missing)}")
    if extra:
        problems.append(f"unknown criteria codes: {', '.join(extra)}")
    if problems:
        raise HTTPException(status_code=422, detail="; ".join(problems))


@router.get("/regions/{region_id}/respondents")
def list_respondents(
    region_id: int,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=1000),
    year: str | None = None,
    month: str | None = None,
    accommodation: str | None = None,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    region_or_404(session, region_id)
    stmt = select(models.Respondent).where(models.Respondent.region_id == region_id)
    if year is not None:
        stmt = stmt.where(models.Respondent.year == year)
    if month is not None:
        stmt = stmt.where(models.Respondent.month == month)
    if accommodation is not None:
        stmt = stmt.where(models.Respondent.accommodation == accommodation)
    total = session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = session.scalars(stmt.order_by(models.Respondent.id).offset(offset).limit(limit))
    items = [schemas.RespondentOut.model_validate(row) for row in rows]
    return {"items": items, "total": int(total)}


@router.post("/regions/{region_id}/respondents", status_code=201)
def create_respondent(
    region_id: int,
    payload: schemas.RespondentCreate,
    session: Session = Depends(get_session),
) -> schemas.RespondentOut:
    region_or_404(session, region_id)
    validate_ratings(session, payload.ratings)
    respondent = models.Respondent(region_id=region_id, **payload.model_dump())
    session.add(respondent)
    session.commit()
    session.refresh(respondent)
    return schemas.RespondentOut.model_validate(respondent)


def _respondent_or_404(session: Session, respondent_id: int) -> models.Respondent:
    respondent = session.get(models.Respondent, respondent_id)
    if respondent is None:
        raise HTTPException(status_code=404, detail=f"respondent {respondent_id} not found")
    return respondent


@router.patch("/respondents/{respondent_id}")
def patch_respondent(
    respondent_id: int,
    payload: schemas.RespondentPatch,
    session: Session = Depends(get_session),
) -> schemas.RespondentOut:
    respondent = _respondent_or_404(session, respondent_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("ratings") is not None:
        validate_ratings(session, data["ratings"])
    for field, value in data.items():
        setattr(respondent, field, value)
    session.commit()
    session.refresh(respondent)
    return schemas.RespondentOut.model_validate(respondent)


@router.delete("/respondents/{respondent_id}", status_code=204)
def delete_respondent(respondent_id: int, session: Session = Depends(get_session)) -> Response:
    respondent = _respondent_or_404(session, respondent_id)
    session.delete(respondent)
    session.commit()
    return Response(status_code=204)

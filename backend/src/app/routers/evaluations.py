"""Evaluation run endpoints: run the T5 operator, history, drill-down, export."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.db import get_session
from app.services.evaluator import run_evaluation, run_to_dict
from app.services.exports import build_pdf, build_xlsx

router = APIRouter(tags=["evaluations"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _run_or_404(session: Session, evaluation_id: int) -> models.EvaluationRun:
    run = session.scalars(
        select(models.EvaluationRun)
        .options(selectinload(models.EvaluationRun.results))
        .where(models.EvaluationRun.id == evaluation_id)
    ).first()
    if run is None:
        raise HTTPException(status_code=404, detail=f"evaluation {evaluation_id} not found")
    return run


@router.post("/evaluations", status_code=201)
def create_evaluation(
    payload: schemas.EvaluationCreate,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    run = run_evaluation(session, payload.region_ids, payload.comment)
    return run_to_dict(run)


@router.get("/evaluations")
def list_evaluations(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    total = session.scalar(select(func.count()).select_from(models.EvaluationRun)) or 0
    runs = session.scalars(
        select(models.EvaluationRun)
        .options(selectinload(models.EvaluationRun.results))
        .order_by(models.EvaluationRun.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return {"items": [run_to_dict(run) for run in runs], "total": int(total)}


@router.get("/evaluations/{evaluation_id}")
def get_evaluation(
    evaluation_id: int,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    return run_to_dict(_run_or_404(session, evaluation_id))


@router.get("/evaluations/{evaluation_id}/regions/{region_id}/individuals")
def list_individuals(
    evaluation_id: int,
    region_id: int,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=1000),
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    run = _run_or_404(session, evaluation_id)
    result = next((r for r in run.results if r.region_id == region_id), None)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"evaluation {evaluation_id} has no result for region {region_id}",
        )
    individuals = result.individuals
    return {
        "items": individuals[offset : offset + limit],
        "total": len(individuals),
    }


@router.delete("/evaluations/{evaluation_id}", status_code=204)
def delete_evaluation(evaluation_id: int, session: Session = Depends(get_session)) -> Response:
    run = _run_or_404(session, evaluation_id)
    session.delete(run)
    session.commit()
    return Response(status_code=204)


@router.get("/evaluations/{evaluation_id}/export")
def export_evaluation(
    evaluation_id: int,
    format: str = Query(default="xlsx", pattern="^(xlsx|pdf)$"),
    lang: str = Query(default="uk", pattern="^(uk|en)$"),
    session: Session = Depends(get_session),
) -> Response:
    run = _run_or_404(session, evaluation_id)
    if format == "xlsx":
        content = build_xlsx(run, lang)
        media_type = XLSX_MEDIA_TYPE
    else:
        content = build_pdf(run, lang)
        media_type = "application/pdf"
    filename = f"evaluation_{evaluation_id}_{lang}.{format}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

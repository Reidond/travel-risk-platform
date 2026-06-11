"""Versioned M_R1 rule-set endpoints (DM-editable If-Then builder)."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.core_bridge import active_ruleset, default_rules_payload, load_groups
from app.db import get_session

router = APIRouter(tags=["rulesets"])


@router.get("/rulesets")
def list_rulesets(session: Session = Depends(get_session)) -> dict[str, Any]:
    rows = list(
        session.scalars(
            select(models.RuleSetVersion).order_by(models.RuleSetVersion.version.desc())
        )
    )
    return {
        "items": [schemas.RuleSetOut.model_validate(row) for row in rows],
        "total": len(rows),
    }


@router.get("/rulesets/active")
def get_active_ruleset(session: Session = Depends(get_session)) -> schemas.RuleSetOut:
    return schemas.RuleSetOut.model_validate(active_ruleset(session))


def _next_version(session: Session) -> int:
    return (session.scalar(select(func.max(models.RuleSetVersion.version))) or 0) + 1


def _deactivate_all(session: Session) -> None:
    for row in session.scalars(select(models.RuleSetVersion).where(models.RuleSetVersion.active)):
        row.active = False


def _create_version(
    session: Session,
    rules: list[dict[str, Any]],
    default_output: str,
    comment: str | None,
) -> models.RuleSetVersion:
    _deactivate_all(session)
    row = models.RuleSetVersion(
        version=_next_version(session),
        active=True,
        comment=comment,
        rules=rules,
        default_output=default_output,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.post("/rulesets", status_code=201)
def create_ruleset(
    payload: schemas.RuleSetCreate,
    session: Session = Depends(get_session),
) -> schemas.RuleSetOut:
    n_groups = len(load_groups(session))
    for index, rule in enumerate(payload.rules, start=1):
        if len(rule.pattern) > n_groups:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"rule {index} pattern has {len(rule.pattern)} slots but only "
                    f"{n_groups} criteria groups are configured"
                ),
            )
    rules = [rule.model_dump() for rule in payload.rules]
    row = _create_version(session, rules, payload.default_output, payload.comment)
    return schemas.RuleSetOut.model_validate(row)


@router.post("/rulesets/reset-default", status_code=201)
def reset_default_ruleset(session: Session = Depends(get_session)) -> schemas.RuleSetOut:
    rules, default_output = default_rules_payload()
    row = _create_version(session, rules, default_output, "Article preset (reset to default)")
    return schemas.RuleSetOut.model_validate(row)

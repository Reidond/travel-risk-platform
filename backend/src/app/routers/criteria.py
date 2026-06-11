"""Criteria configuration endpoints (GET + full-replacement PUT)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.core_bridge import load_groups
from app.db import get_session

router = APIRouter(tags=["criteria"])


@router.get("/criteria")
def get_criteria(session: Session = Depends(get_session)) -> schemas.CriteriaOut:
    groups = load_groups(session)
    return schemas.CriteriaOut(
        groups=[
            schemas.CriteriaGroupOut(
                id=group.id,
                code=group.code,
                name_uk=group.name_uk,
                name_en=group.name_en,
                criteria=[
                    schemas.CriterionPayload(
                        code=criterion.code,
                        text_uk=criterion.text_uk,
                        text_en=criterion.text_en,
                    )
                    for criterion in group.criteria
                ],
            )
            for group in groups
        ]
    )


def _validate_payload(payload: schemas.CriteriaPayload) -> list[str]:
    group_codes = [group.code for group in payload.groups]
    if len(set(group_codes)) != len(group_codes):
        raise HTTPException(status_code=422, detail="group codes must be unique")
    codes = [criterion.code for group in payload.groups for criterion in group.criteria]
    if len(set(codes)) != len(codes):
        raise HTTPException(status_code=422, detail="criterion codes must be unique")
    return codes


@router.put("/criteria")
def put_criteria(
    payload: schemas.CriteriaPayload,
    session: Session = Depends(get_session),
) -> schemas.CriteriaOut:
    new_codes = _validate_payload(payload)

    respondent_count = session.scalar(select(func.count()).select_from(models.Respondent)) or 0
    if respondent_count > 0:
        existing_codes = {
            criterion.code for group in load_groups(session) for criterion in group.criteria
        }
        if set(new_codes) != existing_codes:
            raise HTTPException(
                status_code=409,
                detail=(
                    "cannot change criterion codes while respondents exist "
                    f"({respondent_count} respondents reference the current codes); "
                    "label-only edits are allowed, or delete the respondents first"
                ),
            )

    for group in load_groups(session):
        session.delete(group)
    session.flush()

    for group_pos, group_payload in enumerate(payload.groups):
        group = models.CriteriaGroup(
            code=group_payload.code,
            name_uk=group_payload.name_uk,
            name_en=group_payload.name_en,
            position=group_pos,
        )
        for crit_pos, criterion_payload in enumerate(group_payload.criteria):
            group.criteria.append(
                models.Criterion(
                    code=criterion_payload.code,
                    text_uk=criterion_payload.text_uk,
                    text_en=criterion_payload.text_en,
                    position=crit_pos,
                )
            )
        session.add(group)
    session.commit()
    return get_criteria(session)

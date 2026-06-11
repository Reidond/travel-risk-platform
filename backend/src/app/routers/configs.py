"""Versioned platform configuration endpoints + membership-curve sampling.

The curves endpoint samples the CORE library functions (z_spline,
s_membership, cone_membership) — the math is never reimplemented here.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from tourism_risk import cone_membership, s_membership, z_spline

from app import models, schemas
from app.core_bridge import active_config, active_ruleset, build_model_config, load_groups
from app.db import get_session

router = APIRouter(tags=["config"])

CURVE_POINTS = 201


@router.get("/config")
def get_active_config(session: Session = Depends(get_session)) -> schemas.ConfigOut:
    return schemas.ConfigOut.model_validate(active_config(session))


@router.get("/config/versions")
def list_config_versions(session: Session = Depends(get_session)) -> dict[str, Any]:
    rows = list(
        session.scalars(
            select(models.PlatformConfig).order_by(models.PlatformConfig.version.desc())
        )
    )
    return {
        "items": [schemas.ConfigOut.model_validate(row) for row in rows],
        "total": len(rows),
    }


@router.post("/config", status_code=201)
def create_config(
    payload: schemas.ConfigCreate,
    session: Session = Depends(get_session),
) -> schemas.ConfigOut:
    params = payload.params.model_dump()
    ruleset = active_ruleset(session)
    try:
        build_model_config(params, load_groups(session), ruleset.rules, ruleset.default_output)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"invalid parameters: {exc}") from exc

    max_version = session.scalar(select(func.max(models.PlatformConfig.version))) or 0
    for row in session.scalars(select(models.PlatformConfig).where(models.PlatformConfig.active)):
        row.active = False
    config = models.PlatformConfig(
        version=max_version + 1,
        active=True,
        comment=payload.comment,
        params=params,
    )
    session.add(config)
    session.commit()
    session.refresh(config)
    return schemas.ConfigOut.model_validate(config)


@router.post("/config/versions/{version}/activate")
def activate_config(
    version: int,
    session: Session = Depends(get_session),
) -> schemas.ConfigOut:
    target = session.scalars(
        select(models.PlatformConfig).where(models.PlatformConfig.version == version)
    ).first()
    if target is None:
        raise HTTPException(status_code=404, detail=f"config version {version} not found")
    for row in session.scalars(select(models.PlatformConfig).where(models.PlatformConfig.active)):
        row.active = False
    target.active = True
    session.commit()
    session.refresh(target)
    return schemas.ConfigOut.model_validate(target)


def _sample(start: float, stop: float, count: int) -> list[float]:
    step = (stop - start) / (count - 1)
    # round away float-step artifacts (e.g. 110.00000000000001) — these are axis labels
    return [round(start + index * step, 9) for index in range(count)]


@router.get("/config/curves")
def config_curves(
    version: int | None = None,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    if version is None:
        config = active_config(session)
    else:
        config = session.scalars(
            select(models.PlatformConfig).where(models.PlatformConfig.version == version)
        ).first()
        if config is None:
            raise HTTPException(status_code=404, detail=f"config version {version} not found")

    params = config.params
    a = float(params["z_spline"]["a"])
    b = float(params["z_spline"]["b"])
    boundaries = [float(value) for value in params["fuzzification_boundaries"]]
    a1, a6 = boundaries[0], boundaries[-1]
    cone_base = tuple(float(value) for value in params["cone"]["base"])
    cone_scale = tuple(float(value) for value in params["cone"]["scale"])

    return {
        "z_spline": [
            [delta_value, z_spline(delta_value, a, b)]
            for delta_value in _sample(0.0, 110.0, CURVE_POINTS)
        ],
        "s_shape": [
            [omega_value, s_membership(omega_value, a1, a6)]
            for omega_value in _sample(a1, a6, CURVE_POINTS)
        ],
        "cone": {
            "xi_fixed": [
                [phi_value, cone_membership(phi_value, 1.0, cone_base, cone_scale)]
                for phi_value in _sample(0.0, 1.0, CURVE_POINTS)
            ],
            "phi_fixed": [
                [xi_value, cone_membership(1.0, xi_value, cone_base, cone_scale)]
                for xi_value in _sample(0.0, 1.0, CURVE_POINTS)
            ],
        },
    }

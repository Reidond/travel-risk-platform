"""Evaluation runs: map DB state onto core-library calls and persist results."""

from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from tourism_risk import RegionResult, evaluate_region

from app import models, schemas
from app.core_bridge import (
    TERM_ORDER,
    active_config,
    active_ruleset,
    build_model_config,
    criteria_codes,
    load_groups,
    ordered_ratings,
)

#: Hard cap on respondents per region in one run (memory/latency DoS guard:
#: individuals are persisted as one JSON blob and exported to xlsx in memory).
MAX_RESPONDENTS_PER_REGION = 10_000


def _load_regions(session: Session, region_ids: list[int] | None) -> list[models.Region]:
    stmt = (
        select(models.Region)
        .options(selectinload(models.Region.respondents))
        .order_by(models.Region.id)
    )
    if region_ids is not None:
        stmt = stmt.where(models.Region.id.in_(region_ids))
    regions = list(session.scalars(stmt))
    if region_ids is not None:
        found = {region.id for region in regions}
        missing = [rid for rid in region_ids if rid not in found]
        if missing:
            raise HTTPException(
                status_code=404,
                detail=f"regions not found: {', '.join(str(rid) for rid in missing)}",
            )
    return regions


def _check_evaluable(regions: list[models.Region]) -> None:
    offenders: list[dict[str, Any]] = []
    for region in regions:
        missing: list[str] = []
        if region.xi is None:
            missing.append("xi")
        if region.delta_level is None:
            missing.append("delta_level")
        if len(region.respondents) == 0:
            missing.append("respondents")
        if missing:
            offenders.append(
                {
                    "region_id": region.id,
                    "name_uk": region.name_uk,
                    "name_en": region.name_en,
                    "missing": missing,
                }
            )
    if offenders:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "some regions are not ready for evaluation",
                "offenders": offenders,
            },
        )
    if not regions:
        raise HTTPException(
            status_code=409,
            detail={"message": "no regions to evaluate", "offenders": []},
        )
    oversized = [r for r in regions if len(r.respondents) > MAX_RESPONDENTS_PER_REGION]
    if oversized:
        names = ", ".join(f"{r.name_uk} (id {r.id}, n={len(r.respondents)})" for r in oversized)
        raise HTTPException(
            status_code=422,
            detail=(
                f"regions exceed the {MAX_RESPONDENTS_PER_REGION} respondents-per-region "
                f"evaluation limit: {names}"
            ),
        )


def _individuals_payload(
    respondents: list[models.Respondent],
    region_result: RegionResult,
    group_codes: list[str],
) -> list[dict[str, Any]]:
    individuals: list[dict[str, Any]] = []
    for respondent, individual in zip(respondents, region_result.respondents, strict=True):
        individuals.append(
            {
                "respondent_id": respondent.id,
                "ext_id": respondent.ext_id,
                "theta": dict(zip(group_codes, individual.theta, strict=True)),
                "terms": dict(zip(group_codes, individual.group_terms, strict=True)),
                "r_star": individual.risk_term.name,
                "chi": individual.chi,
            }
        )
    return individuals


def run_evaluation(
    session: Session,
    region_ids: list[int] | None,
    comment: str | None,
) -> models.EvaluationRun:
    regions = _load_regions(session, region_ids)
    _check_evaluable(regions)

    config_row = active_config(session)
    ruleset_row = active_ruleset(session)
    groups = load_groups(session)
    codes = criteria_codes(groups)
    group_codes = [group.code for group in groups]

    try:
        model_config = build_model_config(
            config_row.params, groups, ruleset_row.rules, ruleset_row.default_output
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422, detail=f"active configuration is invalid: {exc}"
        ) from exc

    run = models.EvaluationRun(
        comment=comment,
        # Copy + annotate with the version (mirrors ruleset_snapshot) so the UI
        # can fetch matching /api/config/curves for historical runs. The spread
        # also avoids sharing the JSON dict with the PlatformConfig row.
        config_snapshot={**config_row.params, "version": config_row.version},
        ruleset_snapshot={
            "version": ruleset_row.version,
            "rules": ruleset_row.rules,
            "default_output": ruleset_row.default_output,
        },
    )

    for region in regions:
        respondents = sorted(region.respondents, key=lambda r: r.id)
        try:
            ratings_matrix = [ordered_ratings(r.ratings, codes) for r in respondents]
        except KeyError as exc:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"region {region.id} has respondents whose ratings lack "
                    f"criterion {exc.args[0]!r}; update criteria or respondent data"
                ),
            ) from exc
        try:
            result = evaluate_region(
                respondent_ratings=ratings_matrix,
                xi=float(region.xi),  # type: ignore[arg-type]
                delta_level=int(str(region.delta_level)[1:]),
                config=model_config,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=422, detail=f"evaluation failed for region {region.id}: {exc}"
            ) from exc

        distribution = dict.fromkeys(TERM_ORDER, 0)
        for individual in result.respondents:
            distribution[individual.risk_term.name] += 1

        run.results.append(
            models.EvaluationResult(
                region_id=region.id,
                region_name_uk=region.name_uk,
                region_name_en=region.name_en,
                n=len(respondents),
                xi=result.xi,
                delta_level=str(region.delta_level),
                delta=result.delta,
                phi=result.phi,
                m_s=result.m_s,
                omega=result.omega,
                mu=result.mu,
                risk_class=result.risk_class.name,
                r_star_distribution=distribution,
                individuals=_individuals_payload(respondents, result, group_codes),
            )
        )

    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def run_to_dict(run: models.EvaluationRun) -> dict[str, Any]:
    """Contract response shape for an evaluation run (without individuals)."""
    return {
        "id": run.id,
        # Aware UTC so the JSON boundary serializes with an offset, not naive.
        "created_at": schemas.as_utc(run.created_at),
        "comment": run.comment,
        "config_snapshot": run.config_snapshot,
        "ruleset_snapshot": run.ruleset_snapshot,
        "results": [
            {
                "region": {
                    "id": result.region_id,
                    "name_uk": result.region_name_uk,
                    "name_en": result.region_name_en,
                },
                "n": result.n,
                "xi": result.xi,
                "delta_level": result.delta_level,
                "delta": result.delta,
                "phi": result.phi,
                "m_s": result.m_s,
                "omega": result.omega,
                "mu": result.mu,
                "risk_class": result.risk_class,
                "r_star_distribution": result.r_star_distribution,
            }
            for result in run.results
        ],
    }

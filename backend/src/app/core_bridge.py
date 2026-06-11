"""Bridge between DB/JSON representations and the tourism-risk core library.

The core library is the single source of math truth — this module only
converts shapes (JSON params <-> ModelConfig) and never reimplements math.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from tourism_risk import (
    DEFAULT_CONFIG,
    ModelConfig,
    RiskTerm,
    Rule,
    RuleSet,
)
from tourism_risk import (
    CriteriaGroup as CoreGroup,
)

from app import models

#: Risk-term order shared by the chi-scale JSON object and rule outputs.
TERM_ORDER: tuple[str, ...] = ("L", "BA", "A", "AA", "H")

DELTA_LEVELS: tuple[str, ...] = ("D1", "D2", "D3", "D4", "D5")


def default_params() -> dict[str, Any]:
    """Contract-shaped JSON params derived from the core DEFAULT_CONFIG."""
    cfg = DEFAULT_CONFIG
    return {
        "term_multipliers": list(cfg.term_multipliers),
        "chi_scale": dict(zip(TERM_ORDER, cfg.chi_scale, strict=True)),
        "z_spline": {"a": cfg.zspline_a, "b": cfg.zspline_b},
        "cone": {"base": list(cfg.cone_base), "scale": list(cfg.cone_scale)},
        "fuzzification_boundaries": list(cfg.fuzz_boundaries),
        "risk_thresholds": list(cfg.risk_thresholds),
    }


def default_rules_payload() -> tuple[list[dict[str, Any]], str]:
    """Article-preset rules in contract JSON shape."""
    rules = [
        {"pattern": list(rule.pattern), "output": rule.output.name}
        for rule in DEFAULT_CONFIG.rules.rules
    ]
    return rules, DEFAULT_CONFIG.rules.default.name


def load_groups(session: Session) -> list[models.CriteriaGroup]:
    """Active criteria groups with criteria, in configured order."""
    stmt = (
        select(models.CriteriaGroup)
        .options(selectinload(models.CriteriaGroup.criteria))
        .order_by(models.CriteriaGroup.position)
    )
    return list(session.scalars(stmt))


def criteria_codes(groups: list[models.CriteriaGroup]) -> list[str]:
    """Flat criterion codes in group order — the canonical rating order."""
    return [criterion.code for group in groups for criterion in group.criteria]


def core_groups(groups: list[models.CriteriaGroup]) -> tuple[CoreGroup, ...]:
    return tuple(
        CoreGroup(
            id=group.code,
            name=group.name_en,
            criteria=tuple(criterion.code for criterion in group.criteria),
        )
        for group in groups
    )


def core_ruleset(rules: list[dict[str, Any]], default_output: str) -> RuleSet:
    return RuleSet(
        rules=tuple(
            Rule(pattern=tuple(rule["pattern"]), output=RiskTerm[rule["output"]]) for rule in rules
        ),
        default=RiskTerm[default_output],
    )


def build_model_config(
    params: dict[str, Any],
    groups: list[models.CriteriaGroup],
    rules: list[dict[str, Any]],
    default_output: str,
) -> ModelConfig:
    """Assemble a core ModelConfig; raises ValueError on invalid combinations."""
    chi_scale = params["chi_scale"]
    return ModelConfig(
        groups=core_groups(groups),
        rules=core_ruleset(rules, default_output),
        term_multipliers=tuple(params["term_multipliers"]),
        chi_scale=tuple(chi_scale[term] for term in TERM_ORDER),
        zspline_a=params["z_spline"]["a"],
        zspline_b=params["z_spline"]["b"],
        cone_base=tuple(params["cone"]["base"]),
        cone_scale=tuple(params["cone"]["scale"]),
        fuzz_boundaries=tuple(params["fuzzification_boundaries"]),
        risk_thresholds=tuple(params["risk_thresholds"]),
    )


def active_config(session: Session) -> models.PlatformConfig:
    row = session.scalars(select(models.PlatformConfig).where(models.PlatformConfig.active)).first()
    if row is None:  # pragma: no cover - seeded on startup
        raise RuntimeError("no active platform configuration")
    return row


def active_ruleset(session: Session) -> models.RuleSetVersion:
    row = session.scalars(select(models.RuleSetVersion).where(models.RuleSetVersion.active)).first()
    if row is None:  # pragma: no cover - seeded on startup
        raise RuntimeError("no active rule set")
    return row


def ordered_ratings(ratings: dict[str, Any], codes: list[str]) -> tuple[int, ...]:
    """Ratings map keyed by criterion code -> flat tuple in criteria order."""
    return tuple(int(ratings[code]) for code in codes)

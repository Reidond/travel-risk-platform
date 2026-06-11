"""End-to-end evaluation pipeline for the T5 operator (eq. 4.2-4.9).

Combines M_I -> M_R1 (per respondent) and M_R2 -> M_R3 (per region),
retaining every intermediate value in the result objects.
"""

from __future__ import annotations

from collections.abc import Sequence

from tourism_risk.individual import evaluate_rules, group_sums, group_term
from tourism_risk.models import (
    ExpertSafetyLevel,
    IndividualResult,
    ModelConfig,
    RegionResult,
)
from tourism_risk.national import omega, risk_class, s_membership
from tourism_risk.regional import chi, cone_membership, delta, z_spline

__all__ = [
    "evaluate_region",
    "evaluate_respondent",
]


def evaluate_respondent(ratings: Sequence[int], config: ModelConfig) -> IndividualResult:
    """Evaluate one respondent: M_I + M_R1 (eq. 4.2-4.5).

    ``ratings`` is the flat sequence of integer ratings 1..5 in group order
    (17 values for the default preset). Returns an :class:`IndividualResult`
    carrying theta_g, the group terms, r*(e), the fired rule index and chi(e).
    """
    theta = group_sums(ratings, config)
    group_terms = tuple(
        group_term(theta_g, group.size, config.term_multipliers)
        for theta_g, group in zip(theta, config.groups, strict=True)
    )
    risk_term, matched_rule_index = evaluate_rules(group_terms, config.rules)
    return IndividualResult(
        ratings=tuple(int(rating) for rating in ratings),
        theta=theta,
        group_terms=group_terms,
        risk_term=risk_term,
        matched_rule_index=matched_rule_index,
        chi=chi(risk_term, config),
    )


def evaluate_region(
    respondent_ratings: Sequence[Sequence[int]],
    xi: float,
    delta_level: ExpertSafetyLevel | int,
    config: ModelConfig,
    weights: Sequence[float] | None = None,
) -> RegionResult:
    """Evaluate one region end-to-end: M_I -> M_R1 -> M_R2 -> M_R3 (eq. 4.2-4.9).

    Parameters:

    - ``respondent_ratings`` — one flat rating sequence per respondent.
    - ``xi`` — predicted level of repeat visits Xi(R) in [0, 1] (DM input).
    - ``delta_level`` — expert safety level Delta(R) (DM input).
    - ``config`` — model parameterisation (see :class:`ModelConfig`).
    - ``weights`` — optional per-respondent weights for the delta mean.

    Returns a :class:`RegionResult` with every intermediate retained:
    per-respondent results, delta, phi, m_S, omega, mu_R and the risk class.
    """
    if len(respondent_ratings) == 0:
        raise ValueError("evaluate_region requires at least one respondent")
    expert_level = ExpertSafetyLevel(delta_level)

    respondents = tuple(evaluate_respondent(ratings, config) for ratings in respondent_ratings)
    delta_value = delta([result.chi for result in respondents], weights)
    phi_value = z_spline(delta_value, config.zspline_a, config.zspline_b)
    m_s_value = cone_membership(phi_value, xi, config.cone_base, config.cone_scale)
    omega_value = omega(m_s_value, expert_level, config.fuzz_boundaries)
    mu_value = s_membership(omega_value, config.fuzz_boundaries[0], config.fuzz_boundaries[-1])
    return RegionResult(
        respondents=respondents,
        weights=None if weights is None else tuple(float(weight) for weight in weights),
        delta=delta_value,
        phi=phi_value,
        xi=xi,
        m_s=m_s_value,
        expert_level=expert_level,
        omega=omega_value,
        mu=mu_value,
        risk_class=risk_class(mu_value, config.risk_thresholds),
    )

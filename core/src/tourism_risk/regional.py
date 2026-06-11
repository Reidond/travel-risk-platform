"""Module M_R2 (regional level) — eq. 4.5-4.7.

Converts individual risk terms r*(e) to the percentage scale chi (eq. 4.5),
averages them into the regional value delta(R), maps delta through the
quadratic Z-spline phi (eq. 4.6) and combines phi with the predicted level of
repeat visits Xi(R) through a cone-shaped membership function into the
regional feeling-of-safety level m_S(R) (eq. 4.7).
"""

from __future__ import annotations

import math
from collections.abc import Sequence

from tourism_risk.models import ModelConfig, RiskTerm

__all__ = [
    "chi",
    "cone_membership",
    "delta",
    "z_spline",
]


def chi(term: RiskTerm, config: ModelConfig) -> float:
    """Percentage value chi(e) of an individual risk term (eq. 4.5).

    Default scale: L -> 15, BA -> 30, A -> 50, AA -> 80, H -> 100
    (configurable through ``config.chi_scale``).
    """
    return config.chi_scale[int(term) - 1]


def delta(values: Sequence[float], weights: Sequence[float] | None = None) -> float:
    """Regional mean delta(R) = (1/n) * sum_j chi(e_j) (eq. 4.5).

    Equal weights by default; with ``weights`` the weighted mean
    sum(w_j * chi_j) / sum(w_j) is used. Raises :class:`ValueError` for an
    empty sample, mismatched weight count, negative weights, or zero total
    weight.
    """
    if len(values) == 0:
        raise ValueError("delta requires at least one respondent value")
    if weights is None:
        return sum(values) / len(values)
    if len(weights) != len(values):
        raise ValueError(
            f"weights count ({len(weights)}) must match respondent count ({len(values)})"
        )
    if any(weight < 0 for weight in weights):
        raise ValueError("weights must be non-negative")
    total = sum(weights)
    if total == 0:
        raise ValueError("at least one weight must be positive")
    return sum(weight * value for weight, value in zip(weights, values, strict=True)) / total


def z_spline(delta_value: float, a: float, b: float) -> float:
    """Quadratic Z-spline phi(delta) on [a, b] (eq. 4.6).

    ::

        phi = 1                                  if delta <= a
            = 1 - (delta-a)^2 / (2*((b-a)/2)^2)  if a < delta <= (a+b)/2
            = (b-delta)^2 / (2*((b-a)/2)^2)      if (a+b)/2 < delta < b
            = 0                                  if delta >= b

    Defaults a=60, b=100 give denominator 800. Both middle branches yield 0.5
    at the midpoint (a+b)/2, so the spline is continuous.
    """
    if delta_value <= a:
        return 1.0
    if delta_value >= b:
        return 0.0
    denominator = 2.0 * ((b - a) / 2.0) ** 2
    midpoint = (a + b) / 2.0
    if delta_value <= midpoint:
        return 1.0 - (delta_value - a) ** 2 / denominator
    return (b - delta_value) ** 2 / denominator


def cone_membership(
    phi: float,
    xi: float,
    base: tuple[float, float] = (1.0, 1.0),
    scale: tuple[float, float] = (2.0, 2.0),
) -> float:
    """Cone-shaped membership function m_S(R) (eq. 4.7).

    With the default base point (1, 1) and scaling (2, 2):

        m_S(R) = 1 - (1/2) * sqrt((phi(R) - 1)^2 + (Xi(R) - 1)^2)

    Xi(R) in [0, 1] is the predicted level of repeat visits, entered manually
    by the DM. Raises :class:`ValueError` if Xi is outside [0, 1].
    """
    if not 0.0 <= xi <= 1.0:
        raise ValueError(f"xi must be within [0, 1], got {xi}")
    base_phi, base_xi = base
    scale_phi, scale_xi = scale
    return 1.0 - math.sqrt(((phi - base_phi) / scale_phi) ** 2 + ((xi - base_xi) / scale_xi) ** 2)

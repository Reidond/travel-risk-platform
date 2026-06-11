"""Module M_R3 (national level) — eq. 4.8-4.9.

Fuzzifies the regional feeling-of-safety level m_S(R) with the expert safety
level Delta(R) into omega(R) (eq. 4.8), maps omega through an S-shaped
membership function into the quantitative risk estimate mu_R(R) (eq. 4.9),
and interprets mu_R linguistically as a risk class T_R in {R1..R5}.
"""

from __future__ import annotations

from bisect import bisect_right
from collections.abc import Sequence

from tourism_risk.models import ExpertSafetyLevel, RiskClass

__all__ = [
    "omega",
    "risk_class",
    "s_membership",
]


def omega(
    m_s: float,
    expert_level: ExpertSafetyLevel | int,
    boundaries: Sequence[float],
) -> float:
    """Fuzzification omega(R) = a_{k+1} * m_S(R) for Delta(R) = Delta_k (eq. 4.8).

    With the default boundaries a1..a6 = (0, 20, 40, 60, 80, 100):
    D1 -> a2 = 20, D2 -> a3 = 40, D3 -> a4 = 60, D4 -> a5 = 80, D5 -> a6 = 100.
    Raises :class:`ValueError` for an invalid expert level.
    """
    level = ExpertSafetyLevel(expert_level)
    return boundaries[int(level)] * m_s


def s_membership(omega_value: float, a1: float, a6: float) -> float:
    """S-shaped membership function mu_R(omega) on [a1, a6] (eq. 4.9).

    ::

        mu_R = 0                              if omega <= a1
             = 2 * ((omega-a1) / (a6-a1))^2   if a1 < omega <= (a1+a6)/2
             = 1 - 2 * ((a6-omega)/(a6-a1))^2 if (a1+a6)/2 < omega < a6
             = 1                              if omega >= a6
    """
    if omega_value <= a1:
        return 0.0
    if omega_value >= a6:
        return 1.0
    span = a6 - a1
    midpoint = (a1 + a6) / 2.0
    if omega_value <= midpoint:
        return 2.0 * ((omega_value - a1) / span) ** 2
    return 1.0 - 2.0 * ((a6 - omega_value) / span) ** 2


def risk_class(mu: float, thresholds: Sequence[float]) -> RiskClass:
    """Linguistic interpretation T_R of mu_R (thesis section 4.4).

    Default thresholds (0.2, 0.4, 0.6, 0.8):
    [0, 0.2) -> R1 very high risk; [0.2, 0.4) -> R2 high; [0.4, 0.6) -> R3
    medium; [0.6, 0.8) -> R4 low; [0.8, 1] -> R5 very low risk.
    Raises :class:`ValueError` if mu is outside [0, 1].
    """
    if not 0.0 <= mu <= 1.0:
        raise ValueError(f"mu must be within [0, 1], got {mu}")
    return RiskClass(bisect_right(list(thresholds), mu) + 1)

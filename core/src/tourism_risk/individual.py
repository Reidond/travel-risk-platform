"""Modules M_I (information) and M_R1 (individual level) — eq. 4.2-4.4.

Maps a respondent's linguistic ratings l1..l5 to numeric values tau (eq. 4.2),
sums them per criteria group into theta_g, converts each theta_g to a term
level T_g through the characteristic function (eq. 4.3), and aggregates the
group terms into the individual risk term r*(e) via "If-Then" rules (eq. 4.4).
"""

from __future__ import annotations

from bisect import bisect_right
from collections.abc import Sequence

from tourism_risk.models import ModelConfig, RiskTerm, Rule, RuleSet

__all__ = [
    "evaluate_rules",
    "group_sums",
    "group_term",
    "rule_matches",
    "tau",
]

_RATING_MIN = 1
_RATING_MAX = 5


def tau(rating: int) -> int:
    """Map a linguistic rating l_k to its numeric value tau(l_k) = k (eq. 4.2).

    Ratings must be integers in 1..5 (l1 "completely disagree" .. l5
    "completely agree"). Raises :class:`ValueError` otherwise.
    """
    if isinstance(rating, bool) or not isinstance(rating, int):
        raise ValueError(
            f"rating must be an integer in {_RATING_MIN}..{_RATING_MAX}, got {rating!r}"
        )
    if not _RATING_MIN <= rating <= _RATING_MAX:
        raise ValueError(f"rating must be in {_RATING_MIN}..{_RATING_MAX}, got {rating}")
    return rating


def group_sums(ratings: Sequence[int], config: ModelConfig) -> tuple[int, ...]:
    """Group sums theta_g = sum_i tau_gi (eq. 4.2).

    ``ratings`` is the flat sequence of a respondent's ratings in group order
    (default preset: K11..K15, K21..K27, K31..K35 — 17 values). Raises
    :class:`ValueError` on a wrong criteria count or out-of-range ratings.
    """
    expected = config.criteria_count
    if len(ratings) != expected:
        raise ValueError(
            f"expected {expected} ratings ({len(config.groups)} groups), got {len(ratings)}"
        )
    values = [tau(rating) for rating in ratings]
    sums: list[int] = []
    position = 0
    for group in config.groups:
        sums.append(sum(values[position : position + group.size]))
        position += group.size
    return tuple(sums)


def group_term(theta: float, group_size: int, multipliers: Sequence[float]) -> int:
    """Characteristic function: theta_g -> term level T_k, k in 1..5 (eq. 4.3).

    Boundaries are multiples of the group size m_g. With the default
    multipliers (1, 2, 3, 4): T1 if theta < m_g; T2 if m_g <= theta < 2*m_g;
    T3 if 2*m_g <= theta < 3*m_g; T4 if 3*m_g <= theta < 4*m_g;
    T5 if theta >= 4*m_g (strict boundaries; theta = 4*m_g maps to T5).

    Note: since every tau >= 1 implies theta_g >= m_g, T1 is unreachable with
    the default multipliers — a documented quirk of the source model.
    """
    if group_size < 1:
        raise ValueError(f"group size must be >= 1, got {group_size}")
    boundaries = [multiplier * group_size for multiplier in multipliers]
    return bisect_right(boundaries, theta) + 1


def rule_matches(terms: Sequence[int], pattern: Sequence[int]) -> bool:
    """Check whether group terms satisfy a rule pattern (eq. 4.4 semantics).

    A rule fires iff the group terms can be assigned *injectively* to the
    pattern slots, each assigned term >= its slot level ("not below").
    Implemented by sorting both sides descending and greedily matching the
    largest slot with the largest unused term — correct by Hall's theorem
    for this interval-matching problem.
    """
    if len(pattern) > len(terms):
        return False
    sorted_terms = sorted(terms, reverse=True)
    sorted_slots = sorted(pattern, reverse=True)
    return all(term >= slot for term, slot in zip(sorted_terms, sorted_slots, strict=False))


def evaluate_rules(terms: Sequence[int], ruleset: RuleSet) -> tuple[RiskTerm, int | None]:
    """Aggregate group terms into the individual risk term r*(e) (eq. 4.4).

    Rules are evaluated top-down; the first matching rule wins. Returns the
    output term and the 0-based index of the fired rule, or
    ``(ruleset.default, None)`` when no rule matches.
    """
    for index, rule in enumerate(ruleset.rules):
        _validate_rule_arity(rule, len(terms), index)
        if rule_matches(terms, rule.pattern):
            return rule.output, index
    return ruleset.default, None


def _validate_rule_arity(rule: Rule, group_count: int, index: int) -> None:
    if len(rule.pattern) > group_count:
        raise ValueError(
            f"rule {index + 1} pattern has {len(rule.pattern)} slots but only "
            f"{group_count} group terms were provided"
        )

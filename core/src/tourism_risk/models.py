"""Value objects and configuration for the tourism travel safety risk model.

Data model behind the operator

    T5(R, E, Xi, Delta, M_I, M_R1, M_R2, M_R3) -> Y(f5) = {mu_R, T_R}

(thesis, chapter 4). Every numeric constant of the model is a configurable
field of :class:`ModelConfig` — nothing is hard-coded in the computation
modules. The article defaults live in :mod:`tourism_risk.presets`.
"""

from __future__ import annotations

import enum
import itertools
from dataclasses import dataclass, field


class RiskTerm(enum.IntEnum):
    """Aggregated individual risk term r*(e) (eq. 4.4), low -> high risk.

    L  — low, BA — below average, A — average, AA — above average, H — high.
    The integer value (1..5) orders the terms by increasing risk.
    """

    L = 1
    BA = 2
    A = 3
    AA = 4
    H = 5


class ExpertSafetyLevel(enum.IntEnum):
    """Expert level of safety of the regional tourism system Delta(R) (eq. 4.8).

    D1 (lowest safety) .. D5 (highest safety); entered manually by the DM.
    """

    D1 = 1
    D2 = 2
    D3 = 3
    D4 = 4
    D5 = 5


class RiskClass(enum.IntEnum):
    """Linguistic interpretation T_R of the national-level estimate mu_R (eq. 4.9).

    R1 — very high risk, R2 — high, R3 — medium, R4 — low, R5 — very low risk.
    """

    R1 = 1
    R2 = 2
    R3 = 3
    R4 = 4
    R5 = 5


#: Number of term levels T1..T5 used by the characteristic function (eq. 4.3).
TERM_LEVEL_COUNT = 5


@dataclass(frozen=True, slots=True)
class CriteriaGroup:
    """A group of questionnaire criteria G_g (thesis section 4.2).

    ``criteria`` holds the criterion identifiers (e.g. ``("K11", ..., "K15")``);
    the group size m_g used by eq. 4.2/4.3 is ``len(criteria)``.
    """

    id: str
    name: str
    criteria: tuple[str, ...]

    def __post_init__(self) -> None:
        _freeze(self, "criteria")
        if not self.id:
            raise ValueError("criteria group id must be a non-empty string")
        if len(self.criteria) < 1:
            raise ValueError(f"criteria group {self.id!r} must contain at least one criterion")
        if len(set(self.criteria)) != len(self.criteria):
            raise ValueError(f"criteria group {self.id!r} contains duplicate criterion ids")

    @property
    def size(self) -> int:
        """Group size m_g — the number of criteria in the group."""
        return len(self.criteria)


@dataclass(frozen=True, slots=True)
class Rule:
    """One "If-Then" aggregation rule of module M_R1 (eq. 4.4).

    ``pattern`` is a multiset of minimum term levels (slots), e.g. ``(5, 4, 4)``
    means "one group not below T5 and two distinct groups not below T4".
    A rule fires iff the respondent's group terms can be assigned injectively
    to the slots with each assigned term >= its slot level.
    """

    pattern: tuple[int, ...]
    output: RiskTerm

    def __post_init__(self) -> None:
        _freeze(self, "pattern")
        if not isinstance(self.output, RiskTerm):
            raise ValueError(f"rule output must be a RiskTerm, got {self.output!r}")
        if len(self.pattern) == 0:
            raise ValueError("rule pattern must not be empty")
        for level in self.pattern:
            if isinstance(level, bool) or not isinstance(level, int):
                raise ValueError(f"rule pattern levels must be integers, got {level!r}")
            if not 1 <= level <= TERM_LEVEL_COUNT:
                raise ValueError(
                    f"rule pattern levels must be in 1..{TERM_LEVEL_COUNT}, got {level}"
                )


@dataclass(frozen=True, slots=True)
class RuleSet:
    """Ordered M_R1 rules with a default output (eq. 4.4).

    Rules are evaluated top-down; the first matching rule wins. If no rule
    matches, ``default`` is returned (article default: H — high risk).
    """

    rules: tuple[Rule, ...]
    default: RiskTerm

    def __post_init__(self) -> None:
        _freeze(self, "rules")
        for index, rule in enumerate(self.rules):
            if not isinstance(rule, Rule):
                raise ValueError(f"rule set entry {index + 1} must be a Rule, got {rule!r}")
        if not isinstance(self.default, RiskTerm):
            raise ValueError(f"rule set default must be a RiskTerm, got {self.default!r}")


@dataclass(frozen=True, slots=True)
class ModelConfig:
    """Complete, immutable parameterisation of the T5 operator pipeline.

    Fields (article defaults in :data:`tourism_risk.presets.DEFAULT_CONFIG`):

    - ``groups`` — criteria groups G1..Gn (eq. 4.2).
    - ``rules`` — M_R1 aggregation rule set (eq. 4.4).
    - ``term_multipliers`` — boundary multipliers of the characteristic
      function (eq. 4.3): T_k boundaries are ``multiplier * m_g``;
      default ``(1, 2, 3, 4)`` yields T1: theta < m_g, ..., T5: theta >= 4*m_g.
    - ``chi_scale`` — percentage scale chi for terms L..H (eq. 4.5);
      default ``(15, 30, 50, 80, 100)``.
    - ``zspline_a`` / ``zspline_b`` — quadratic Z-spline parameters (eq. 4.6);
      defaults a=60, b=100.
    - ``cone_base`` / ``cone_scale`` — cone-shaped membership function base
      point and scaling (eq. 4.7); defaults (1, 1) and (2, 2).
    - ``fuzz_boundaries`` — interval boundaries a1..a6 for fuzzification
      (eq. 4.8) and the S-shaped membership function (eq. 4.9);
      default ``(0, 20, 40, 60, 80, 100)``.
    - ``risk_thresholds`` — upper bounds of risk classes R1..R4 on mu_R;
      default ``(0.2, 0.4, 0.6, 0.8)`` gives [0, 0.2) -> R1 ... [0.8, 1] -> R5.
    """

    groups: tuple[CriteriaGroup, ...]
    rules: RuleSet
    term_multipliers: tuple[float, float, float, float] = (1.0, 2.0, 3.0, 4.0)
    chi_scale: tuple[float, float, float, float, float] = (15.0, 30.0, 50.0, 80.0, 100.0)
    zspline_a: float = 60.0
    zspline_b: float = 100.0
    cone_base: tuple[float, float] = (1.0, 1.0)
    cone_scale: tuple[float, float] = (2.0, 2.0)
    fuzz_boundaries: tuple[float, float, float, float, float, float] = (
        0.0,
        20.0,
        40.0,
        60.0,
        80.0,
        100.0,
    )
    risk_thresholds: tuple[float, float, float, float] = (0.2, 0.4, 0.6, 0.8)

    def __post_init__(self) -> None:
        _freeze(
            self,
            "groups",
            "term_multipliers",
            "chi_scale",
            "cone_base",
            "cone_scale",
            "fuzz_boundaries",
            "risk_thresholds",
        )
        if len(self.groups) < 1:
            raise ValueError("config must define at least one criteria group")
        group_ids = [g.id for g in self.groups]
        if len(set(group_ids)) != len(group_ids):
            raise ValueError("criteria group ids must be unique")

        if len(self.term_multipliers) != TERM_LEVEL_COUNT - 1:
            raise ValueError(
                f"term_multipliers must have {TERM_LEVEL_COUNT - 1} values, "
                f"got {len(self.term_multipliers)}"
            )
        if self.term_multipliers[0] <= 0:
            raise ValueError("term_multipliers must be positive")
        if not _strictly_increasing(self.term_multipliers):
            raise ValueError("term_multipliers must be strictly increasing")

        if len(self.chi_scale) != len(RiskTerm):
            raise ValueError(f"chi_scale must have {len(RiskTerm)} values (one per risk term)")
        if any(value <= 0 for value in self.chi_scale):
            raise ValueError("chi_scale values must be positive")

        if not self.zspline_a < self.zspline_b:
            raise ValueError(
                f"zspline parameters must satisfy a < b, got a={self.zspline_a}, b={self.zspline_b}"
            )

        if len(self.cone_base) != 2:
            raise ValueError(f"cone_base must have exactly 2 components, got {len(self.cone_base)}")
        if len(self.cone_scale) != 2:
            raise ValueError(
                f"cone_scale must have exactly 2 components, got {len(self.cone_scale)}"
            )
        if self.cone_scale[0] == 0 or self.cone_scale[1] == 0:
            raise ValueError("cone_scale components must be non-zero")

        if len(self.fuzz_boundaries) != 6:
            raise ValueError("fuzz_boundaries must have exactly 6 values (a1..a6)")
        if not _strictly_increasing(self.fuzz_boundaries):
            raise ValueError("fuzz_boundaries must be strictly increasing")

        if len(self.risk_thresholds) != len(RiskClass) - 1:
            raise ValueError(
                f"risk_thresholds must have {len(RiskClass) - 1} values "
                f"(upper bounds of classes R1..R{len(RiskClass) - 1}), "
                f"got {len(self.risk_thresholds)}"
            )
        if not _strictly_increasing(self.risk_thresholds):
            raise ValueError("risk_thresholds must be strictly increasing")
        if self.risk_thresholds[0] <= 0 or self.risk_thresholds[-1] >= 1:
            raise ValueError("risk_thresholds must lie strictly inside (0, 1)")

        for index, rule in enumerate(self.rules.rules):
            if len(rule.pattern) > len(self.groups):
                raise ValueError(
                    f"rule {index + 1} pattern has {len(rule.pattern)} slots but the "
                    f"config defines only {len(self.groups)} criteria groups"
                )

    @property
    def criteria_count(self) -> int:
        """Total number of questionnaire criteria across all groups."""
        return sum(group.size for group in self.groups)


@dataclass(frozen=True, slots=True)
class IndividualResult:
    """All M_I + M_R1 intermediates for one respondent (eq. 4.2-4.5).

    - ``ratings`` — validated numeric ratings tau (flat, group order).
    - ``theta`` — group sums theta_g (eq. 4.2).
    - ``group_terms`` — term levels T_g as integers 1..5 (eq. 4.3).
    - ``risk_term`` — aggregated individual risk term r*(e) (eq. 4.4).
    - ``matched_rule_index`` — 0-based index of the rule that fired,
      or ``None`` when the rule-set default was used.
    - ``chi`` — percentage value chi(e) of the risk term (eq. 4.5).
    """

    ratings: tuple[int, ...]
    theta: tuple[int, ...]
    group_terms: tuple[int, ...]
    risk_term: RiskTerm
    matched_rule_index: int | None
    chi: float


@dataclass(frozen=True, slots=True)
class RegionResult:
    """All M_R2 + M_R3 intermediates for one region (eq. 4.5-4.9).

    - ``respondents`` — per-respondent individual results (with chi values).
    - ``weights`` — respondent weights used for ``delta`` (``None`` = equal).
    - ``delta`` — regional mean of chi values (eq. 4.5).
    - ``phi`` — quadratic Z-spline value (eq. 4.6).
    - ``xi`` — predicted level of repeat visits Xi(R), DM input.
    - ``m_s`` — cone-shaped membership value, regional feeling of safety (eq. 4.7).
    - ``expert_level`` — expert safety level Delta(R), DM input.
    - ``omega`` — fuzzified value omega(R) (eq. 4.8).
    - ``mu`` — S-shaped membership value mu_R(R) (eq. 4.9).
    - ``risk_class`` — linguistic interpretation T_R.
    """

    respondents: tuple[IndividualResult, ...] = field(repr=False)
    weights: tuple[float, ...] | None
    delta: float
    phi: float
    xi: float
    m_s: float
    expert_level: ExpertSafetyLevel
    omega: float
    mu: float
    risk_class: RiskClass


def _strictly_increasing(values: tuple[float, ...]) -> bool:
    return all(left < right for left, right in itertools.pairwise(values))


def _freeze(instance: object, *field_names: str) -> None:
    """Coerce sequence fields of a frozen dataclass to tuples (in ``__post_init__``).

    Frozen dataclasses block attribute reassignment but do not copy field
    contents, so a caller-held list could mutate an already-validated value
    object. Coercing to tuples severs that aliasing; ``object.__setattr__`` is
    the documented escape hatch for frozen-dataclass initialisation.
    """
    for name in field_names:
        object.__setattr__(instance, name, tuple(getattr(instance, name)))

"""tourism-risk — computational core for tourism travel safety risk assessment.

Implements the operator T5(R, E, Xi, Delta, M_I, M_R1, M_R2, M_R3) ->
Y(f5) = {mu_R, T_R} from the intelligent analytical platform for assessing
the safety risk of tourist travel (thesis chapter 4, eq. 4.2-4.9).

Quick start::

    from tourism_risk import DEFAULT_CONFIG, evaluate_region

    result = evaluate_region(
        respondent_ratings=[[5, 5, 1, 1, 1, *([1] * 7), 2, 2, 2, 1, 1]],
        xi=0.85,
        delta_level=5,
        config=DEFAULT_CONFIG,
    )
    print(result.mu, result.risk_class)
"""

from tourism_risk.individual import (
    evaluate_rules,
    group_sums,
    group_term,
    rule_matches,
    tau,
)
from tourism_risk.models import (
    CriteriaGroup,
    ExpertSafetyLevel,
    IndividualResult,
    ModelConfig,
    RegionResult,
    RiskClass,
    RiskTerm,
    Rule,
    RuleSet,
)
from tourism_risk.national import omega, risk_class, s_membership
from tourism_risk.pipeline import evaluate_region, evaluate_respondent
from tourism_risk.presets import DEFAULT_CONFIG, DEFAULT_GROUPS, DEFAULT_RULES
from tourism_risk.regional import chi, cone_membership, delta, z_spline

__version__ = "0.1.0"

__all__ = [
    "DEFAULT_CONFIG",
    "DEFAULT_GROUPS",
    "DEFAULT_RULES",
    "CriteriaGroup",
    "ExpertSafetyLevel",
    "IndividualResult",
    "ModelConfig",
    "RegionResult",
    "RiskClass",
    "RiskTerm",
    "Rule",
    "RuleSet",
    "__version__",
    "chi",
    "cone_membership",
    "delta",
    "evaluate_region",
    "evaluate_respondent",
    "evaluate_rules",
    "group_sums",
    "group_term",
    "omega",
    "risk_class",
    "rule_matches",
    "s_membership",
    "tau",
    "z_spline",
]

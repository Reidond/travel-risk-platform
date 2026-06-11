"""Article defaults — the published preset of the model (thesis chapter 4).

Three criteria groups (5/7/5 criteria, codes K11..K35), the five aggregation
rules of eq. 4.4 and the published scales/boundaries. Note: rule 4 uses the
pattern (3, 2, 2) — the variant validated against the article's own worked
example (r*(e1) = AA) — not the prose variant (3, 3, 2); see the documented
discrepancy #1 in the mathematical specification.
"""

from __future__ import annotations

from tourism_risk.models import CriteriaGroup, ModelConfig, RiskTerm, Rule, RuleSet

__all__ = [
    "DEFAULT_CONFIG",
    "DEFAULT_GROUPS",
    "DEFAULT_RULES",
]

#: Article criteria groups: G1 infrastructure safety (K11-K15), G2 social and
#: ecological safety (K21-K27), G3 medical safety (K31-K35).
DEFAULT_GROUPS: tuple[CriteriaGroup, ...] = (
    CriteriaGroup(
        id="G1",
        name="Infrastructure safety",
        criteria=("K11", "K12", "K13", "K14", "K15"),
    ),
    CriteriaGroup(
        id="G2",
        name="Social and ecological safety",
        criteria=("K21", "K22", "K23", "K24", "K25", "K26", "K27"),
    ),
    CriteriaGroup(
        id="G3",
        name="Medical safety",
        criteria=("K31", "K32", "K33", "K34", "K35"),
    ),
)

#: Article aggregation rules (eq. 4.4), top-down, first match wins, default H.
DEFAULT_RULES: RuleSet = RuleSet(
    rules=(
        Rule(pattern=(5, 4, 4), output=RiskTerm.L),
        Rule(pattern=(5, 4, 3), output=RiskTerm.BA),
        Rule(pattern=(4, 3, 2), output=RiskTerm.A),
        Rule(pattern=(3, 2, 2), output=RiskTerm.AA),
    ),
    default=RiskTerm.H,
)

#: The complete article preset: groups, rules, chi scale 15/30/50/80/100,
#: Z-spline a=60 b=100, cone base (1,1) scale (2,2), boundaries a1..a6 =
#: (0, 20, 40, 60, 80, 100) and risk-class thresholds (0.2, 0.4, 0.6, 0.8).
DEFAULT_CONFIG: ModelConfig = ModelConfig(groups=DEFAULT_GROUPS, rules=DEFAULT_RULES)

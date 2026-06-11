"""M_R1 rule-engine semantics: injectivity, ordering, default, custom rule sets."""

from __future__ import annotations

import pytest

from tests.conftest import E1_RATINGS
from tourism_risk import (
    DEFAULT_CONFIG,
    DEFAULT_RULES,
    ModelConfig,
    RiskTerm,
    Rule,
    RuleSet,
    evaluate_respondent,
    evaluate_rules,
    rule_matches,
)


class TestInjectiveMatching:
    def test_each_slot_needs_a_distinct_group(self):
        # One group at T5 cannot serve both the T5 slot and the T4 slot.
        assert not rule_matches((5, 4, 2), (5, 4, 3))

    def test_terms_exceeding_all_slots_match(self):
        assert rule_matches((5, 5, 5), (5, 4, 4))

    def test_exact_terms_match_their_own_pattern(self):
        assert rule_matches((3, 2, 2), (3, 2, 2))

    def test_order_of_terms_is_irrelevant(self):
        assert rule_matches((2, 3, 4), (4, 3, 2))
        assert rule_matches((4, 2, 3), (4, 3, 2))

    def test_pattern_shorter_than_terms_ignores_extra_groups(self):
        assert rule_matches((5, 1, 1), (5,))
        assert rule_matches((5, 4, 1), (5, 4))

    def test_pattern_longer_than_terms_never_matches(self):
        assert not rule_matches((5, 5), (5, 5, 5))


class TestRuleEvaluation:
    def test_first_match_wins_top_down(self):
        ruleset = RuleSet(
            rules=(
                Rule(pattern=(2, 2, 2), output=RiskTerm.L),
                Rule(pattern=(5, 5, 5), output=RiskTerm.H),
            ),
            default=RiskTerm.A,
        )
        # (5,5,5) satisfies both rules; the first one must win.
        assert evaluate_rules((5, 5, 5), ruleset) == (RiskTerm.L, 0)

    def test_default_h_when_no_rule_matches(self):
        # All-T2 terms match no default rule -> default H.
        assert evaluate_rules((2, 2, 2), DEFAULT_RULES) == (RiskTerm.H, None)

    @pytest.mark.parametrize(
        ("terms", "expected", "rule_index"),
        [
            ((5, 4, 4), RiskTerm.L, 0),
            ((5, 4, 3), RiskTerm.BA, 1),
            ((4, 3, 2), RiskTerm.A, 2),
            ((3, 2, 2), RiskTerm.AA, 3),
            ((2, 2, 3), RiskTerm.AA, 3),
            ((2, 2, 2), RiskTerm.H, None),
        ],
    )
    def test_default_preset_outputs(self, terms, expected, rule_index):
        assert evaluate_rules(terms, DEFAULT_RULES) == (expected, rule_index)


class TestCustomRuleSets:
    def test_prose_variant_of_rule_4_changes_e1_to_h(self):
        """Discrepancy #1: prose pattern (3, 3, 2) instead of (3, 2, 2).

        e1 has terms (T3, T2, T2): under the article's worked example
        (default preset) r*(e1) = AA, under the prose variant no rule
        matches and the default H applies.
        """
        prose_rules = RuleSet(
            rules=(
                Rule(pattern=(5, 4, 4), output=RiskTerm.L),
                Rule(pattern=(5, 4, 3), output=RiskTerm.BA),
                Rule(pattern=(4, 3, 2), output=RiskTerm.A),
                Rule(pattern=(3, 3, 2), output=RiskTerm.AA),
            ),
            default=RiskTerm.H,
        )
        prose_config = ModelConfig(groups=DEFAULT_CONFIG.groups, rules=prose_rules)

        default_result = evaluate_respondent(E1_RATINGS, DEFAULT_CONFIG)
        prose_result = evaluate_respondent(E1_RATINGS, prose_config)

        assert default_result.risk_term is RiskTerm.AA
        assert prose_result.risk_term is RiskTerm.H
        assert prose_result.matched_rule_index is None

    def test_custom_default_output(self):
        ruleset = RuleSet(rules=(), default=RiskTerm.BA)
        assert evaluate_rules((1, 1, 1), ruleset) == (RiskTerm.BA, None)

    def test_short_patterns_with_three_groups(self):
        ruleset = RuleSet(
            rules=(Rule(pattern=(5,), output=RiskTerm.L),),
            default=RiskTerm.H,
        )
        assert evaluate_rules((5, 2, 2), ruleset) == (RiskTerm.L, 0)
        assert evaluate_rules((4, 4, 4), ruleset) == (RiskTerm.H, None)

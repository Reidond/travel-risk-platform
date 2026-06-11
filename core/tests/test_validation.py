"""Validation tests: every invalid input class raises a clear ValueError."""

from __future__ import annotations

import pytest

from tests.conftest import E1_RATINGS
from tourism_risk import (
    DEFAULT_CONFIG,
    DEFAULT_GROUPS,
    DEFAULT_RULES,
    CriteriaGroup,
    ModelConfig,
    RiskTerm,
    Rule,
    RuleSet,
    cone_membership,
    delta,
    evaluate_region,
    evaluate_respondent,
    omega,
    risk_class,
    tau,
)


class TestRatingValidation:
    @pytest.mark.parametrize("bad", [0, 6, -1, 100])
    def test_out_of_range_rating(self, bad):
        with pytest.raises(ValueError, match="rating"):
            tau(bad)

    @pytest.mark.parametrize("bad", [2.5, "3", None, True, False])
    def test_non_integer_rating(self, bad):
        with pytest.raises(ValueError, match="rating"):
            tau(bad)

    def test_out_of_range_rating_inside_respondent(self):
        ratings = list(E1_RATINGS)
        ratings[3] = 6
        with pytest.raises(ValueError, match="rating"):
            evaluate_respondent(ratings, DEFAULT_CONFIG)

    @pytest.mark.parametrize("count", [0, 16, 18])
    def test_wrong_criteria_count(self, count):
        with pytest.raises(ValueError, match="expected 17 ratings"):
            evaluate_respondent([3] * count, DEFAULT_CONFIG)


class TestXiValidation:
    @pytest.mark.parametrize("bad_xi", [-0.01, 1.01, 2.0, -5.0])
    def test_xi_outside_unit_interval(self, bad_xi):
        with pytest.raises(ValueError, match="xi"):
            cone_membership(0.5, bad_xi)

    def test_xi_outside_unit_interval_in_region(self):
        with pytest.raises(ValueError, match="xi"):
            evaluate_region([E1_RATINGS], 1.5, 5, DEFAULT_CONFIG)

    @pytest.mark.parametrize("ok_xi", [0.0, 1.0, 0.85])
    def test_boundary_xi_accepted(self, ok_xi):
        cone_membership(0.5, ok_xi)  # must not raise


class TestConfigValidation:
    def test_non_increasing_fuzz_boundaries(self):
        with pytest.raises(ValueError, match="fuzz_boundaries"):
            ModelConfig(
                groups=DEFAULT_GROUPS,
                rules=DEFAULT_RULES,
                fuzz_boundaries=(0, 20, 20, 60, 80, 100),
            )

    def test_non_increasing_term_multipliers(self):
        with pytest.raises(ValueError, match="term_multipliers"):
            ModelConfig(
                groups=DEFAULT_GROUPS,
                rules=DEFAULT_RULES,
                term_multipliers=(1, 3, 2, 4),
            )

    def test_non_increasing_risk_thresholds(self):
        with pytest.raises(ValueError, match="risk_thresholds"):
            ModelConfig(
                groups=DEFAULT_GROUPS,
                rules=DEFAULT_RULES,
                risk_thresholds=(0.4, 0.2, 0.6, 0.8),
            )

    @pytest.mark.parametrize(
        "bad_thresholds",
        [
            (0.1, 0.2, 0.3, 0.4, 0.5),  # 5 thresholds: risk_class would crash (6th class)
            (0.2, 0.4, 0.6),  # 3 thresholds: R5 silently unreachable
            (0.5,),
            (),
        ],
    )
    def test_wrong_risk_threshold_count(self, bad_thresholds):
        with pytest.raises(ValueError, match="risk_thresholds must have 4 values"):
            ModelConfig(
                groups=DEFAULT_GROUPS,
                rules=DEFAULT_RULES,
                risk_thresholds=bad_thresholds,
            )

    @pytest.mark.parametrize("bad_cone", [(2.0,), (2.0, 2.0, 2.0), ()])
    def test_wrong_cone_scale_arity(self, bad_cone):
        with pytest.raises(ValueError, match="cone_scale must have exactly 2"):
            ModelConfig(groups=DEFAULT_GROUPS, rules=DEFAULT_RULES, cone_scale=bad_cone)

    @pytest.mark.parametrize("bad_cone", [(1.0,), (1.0, 1.0, 1.0), ()])
    def test_wrong_cone_base_arity(self, bad_cone):
        with pytest.raises(ValueError, match="cone_base must have exactly 2"):
            ModelConfig(groups=DEFAULT_GROUPS, rules=DEFAULT_RULES, cone_base=bad_cone)

    def test_zspline_a_not_below_b(self):
        with pytest.raises(ValueError, match="a < b"):
            ModelConfig(
                groups=DEFAULT_GROUPS,
                rules=DEFAULT_RULES,
                zspline_a=100,
                zspline_b=60,
            )

    def test_non_positive_chi_scale(self):
        with pytest.raises(ValueError, match="chi_scale"):
            ModelConfig(
                groups=DEFAULT_GROUPS,
                rules=DEFAULT_RULES,
                chi_scale=(0, 30, 50, 80, 100),
            )

    def test_no_groups(self):
        with pytest.raises(ValueError, match="group"):
            ModelConfig(groups=(), rules=DEFAULT_RULES)

    def test_empty_criteria_group(self):
        with pytest.raises(ValueError, match="criterion"):
            CriteriaGroup(id="G1", name="empty", criteria=())


class TestRulePatternValidation:
    def test_empty_pattern(self):
        with pytest.raises(ValueError, match="pattern"):
            Rule(pattern=(), output=RiskTerm.L)

    @pytest.mark.parametrize("bad_level", [0, 6, -1])
    def test_pattern_level_out_of_range(self, bad_level):
        with pytest.raises(ValueError, match="pattern levels"):
            Rule(pattern=(bad_level,), output=RiskTerm.L)

    def test_pattern_level_not_integer(self):
        with pytest.raises(ValueError, match="pattern levels"):
            Rule(pattern=(3.5,), output=RiskTerm.L)

    def test_pattern_longer_than_group_count(self):
        too_long = RuleSet(
            rules=(Rule(pattern=(3, 3, 3, 3), output=RiskTerm.L),),
            default=RiskTerm.H,
        )
        with pytest.raises(ValueError, match="slots"):
            ModelConfig(groups=DEFAULT_GROUPS, rules=too_long)

    @pytest.mark.parametrize("bad_output", ["H", 5, None, 3.0])
    def test_rule_output_not_a_risk_term(self, bad_output):
        with pytest.raises(ValueError, match="rule output"):
            Rule(pattern=(3, 2, 2), output=bad_output)


class TestRuleSetValidation:
    @pytest.mark.parametrize("bad_default", ["H", 5, None, 3.0])
    def test_default_not_a_risk_term(self, bad_default):
        with pytest.raises(ValueError, match="default must be a RiskTerm"):
            RuleSet(rules=(), default=bad_default)

    @pytest.mark.parametrize("bad_rule", ["rule", (3, 2, 2), None])
    def test_non_rule_entry(self, bad_rule):
        with pytest.raises(ValueError, match="must be a Rule"):
            RuleSet(rules=(bad_rule,), default=RiskTerm.H)

    def test_empty_rules_with_valid_default_accepted(self):
        # An empty rule set is legal: every respondent gets the default term.
        rule_set = RuleSet(rules=(), default=RiskTerm.H)
        assert rule_set.default is RiskTerm.H


class TestConfigImmutability:
    """List inputs are coerced to tuples so caller-side mutation cannot
    invalidate an already-validated value object."""

    def test_risk_thresholds_list_is_copied(self):
        thresholds = [0.2, 0.4, 0.6, 0.8]
        config = ModelConfig(groups=DEFAULT_GROUPS, rules=DEFAULT_RULES, risk_thresholds=thresholds)
        thresholds[0] = -99.0
        assert config.risk_thresholds == (0.2, 0.4, 0.6, 0.8)
        assert isinstance(config.risk_thresholds, tuple)

    def test_rule_pattern_list_is_copied(self):
        pattern = [3, 2, 2]
        rule = Rule(pattern=pattern, output=RiskTerm.AA)
        pattern[0] = 99
        assert rule.pattern == (3, 2, 2)
        assert isinstance(rule.pattern, tuple)

    def test_rule_list_is_copied(self):
        rules = [Rule(pattern=(5, 4, 4), output=RiskTerm.L)]
        rule_set = RuleSet(rules=rules, default=RiskTerm.H)
        rules.append(Rule(pattern=(3, 2, 2), output=RiskTerm.AA))
        assert len(rule_set.rules) == 1
        assert isinstance(rule_set.rules, tuple)

    def test_criteria_list_is_copied(self):
        criteria = ["C1", "C2"]
        group = CriteriaGroup(id="G1", name="g", criteria=criteria)
        criteria.append("C3")
        assert group.criteria == ("C1", "C2")
        assert isinstance(group.criteria, tuple)

    def test_all_config_sequence_fields_are_tuples(self):
        config = ModelConfig(
            groups=list(DEFAULT_GROUPS),
            rules=DEFAULT_RULES,
            term_multipliers=[1.0, 2.0, 3.0, 4.0],
            chi_scale=[15.0, 30.0, 50.0, 80.0, 100.0],
            cone_base=[1.0, 1.0],
            cone_scale=[2.0, 2.0],
            fuzz_boundaries=[0.0, 20.0, 40.0, 60.0, 80.0, 100.0],
            risk_thresholds=[0.2, 0.4, 0.6, 0.8],
        )
        for name in (
            "groups",
            "term_multipliers",
            "chi_scale",
            "cone_base",
            "cone_scale",
            "fuzz_boundaries",
            "risk_thresholds",
        ):
            assert isinstance(getattr(config, name), tuple), name


class TestDeltaAndWeightsValidation:
    def test_empty_sample(self):
        with pytest.raises(ValueError, match="at least one"):
            delta([])

    def test_weight_count_mismatch(self):
        with pytest.raises(ValueError, match="weights count"):
            delta([80.0, 50.0], weights=[1.0])

    def test_negative_weight(self):
        with pytest.raises(ValueError, match="non-negative"):
            delta([80.0, 50.0], weights=[1.0, -1.0])

    def test_all_zero_weights(self):
        with pytest.raises(ValueError, match="positive"):
            delta([80.0, 50.0], weights=[0.0, 0.0])

    def test_region_with_no_respondents(self):
        with pytest.raises(ValueError, match="at least one respondent"):
            evaluate_region([], 0.85, 5, DEFAULT_CONFIG)


class TestExpertLevelAndMuValidation:
    @pytest.mark.parametrize("bad_level", [0, 6, -3])
    def test_invalid_expert_level(self, bad_level):
        with pytest.raises(ValueError):
            omega(0.5, bad_level, DEFAULT_CONFIG.fuzz_boundaries)

    @pytest.mark.parametrize("bad_mu", [-0.1, 1.1])
    def test_mu_outside_unit_interval(self, bad_mu):
        with pytest.raises(ValueError, match="mu"):
            risk_class(bad_mu, DEFAULT_CONFIG.risk_thresholds)

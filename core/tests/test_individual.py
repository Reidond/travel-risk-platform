"""M_I + M_R1 tests: control respondents, characteristic-function boundaries."""

from __future__ import annotations

import pytest

from tests.conftest import E1_RATINGS, E210_RATINGS, E251_RATINGS
from tourism_risk import (
    DEFAULT_CONFIG,
    RiskTerm,
    evaluate_respondent,
    group_sums,
    group_term,
    tau,
)

CONTROL_CASES = [
    pytest.param(E1_RATINGS, (13, 7, 8), (3, 2, 2), RiskTerm.AA, id="e1"),
    pytest.param(E210_RATINGS, (12, 15, 17), (3, 3, 4), RiskTerm.A, id="e210"),
    pytest.param(E251_RATINGS, (7, 13, 12), (2, 2, 3), RiskTerm.AA, id="e251"),
]


@pytest.mark.parametrize(("ratings", "theta", "terms", "risk_term"), CONTROL_CASES)
def test_control_respondents_full_chain(ratings, theta, terms, risk_term):
    result = evaluate_respondent(ratings, DEFAULT_CONFIG)
    assert result.theta == theta
    assert result.group_terms == terms
    assert result.risk_term is risk_term


@pytest.mark.parametrize(
    ("ratings", "theta"),
    [
        (E1_RATINGS, (13, 7, 8)),
        (E210_RATINGS, (12, 15, 17)),
        (E251_RATINGS, (7, 13, 12)),
    ],
)
def test_group_sums_theta(ratings, theta):
    assert group_sums(ratings, DEFAULT_CONFIG) == theta


def test_tau_identity_mapping():
    assert [tau(k) for k in range(1, 6)] == [1, 2, 3, 4, 5]


@pytest.mark.parametrize(
    ("theta", "expected_term"),
    [
        (4, 1),  # theta < m -> T1 (only reachable with theta < m, see below)
        (5, 2),  # theta = m -> T2 (strict lower boundary belongs to T2)
        (9, 2),  # m <= theta < 2m -> T2
        (10, 3),  # theta = 2m -> T3
        (14, 3),
        (15, 4),  # theta = 3m -> T4
        (19, 4),
        (20, 5),  # theta = 4m -> T5 (boundary maps UP per strict inequalities)
        (25, 5),
    ],
)
def test_characteristic_function_boundaries_group_size_5(theta, expected_term):
    assert group_term(theta, 5, DEFAULT_CONFIG.term_multipliers) == expected_term


def test_theta_equal_4m_gives_t5_for_all_default_groups():
    for group in DEFAULT_CONFIG.groups:
        assert group_term(4 * group.size, group.size, DEFAULT_CONFIG.term_multipliers) == 5


def test_t1_unreachable_with_default_multipliers_all_minimum_ratings_give_t2():
    """Documented quirk: theta_g >= m_g always (tau >= 1), so T1 never fires.

    Verified against the article's own example: e1 G2 all-l1 -> theta = 7 = m2 -> T2.
    """
    all_minimum = [1] * DEFAULT_CONFIG.criteria_count
    result = evaluate_respondent(all_minimum, DEFAULT_CONFIG)
    assert result.group_terms == (2, 2, 2)
    minimal_theta = group_sums(all_minimum, DEFAULT_CONFIG)
    for theta, group in zip(minimal_theta, DEFAULT_CONFIG.groups, strict=True):
        assert theta == group.size  # the smallest reachable theta is exactly m_g


def test_all_maximum_ratings_give_t5_and_low_risk():
    all_maximum = [5] * DEFAULT_CONFIG.criteria_count
    result = evaluate_respondent(all_maximum, DEFAULT_CONFIG)
    assert result.group_terms == (5, 5, 5)
    assert result.risk_term is RiskTerm.L


def test_individual_result_carries_all_intermediates():
    result = evaluate_respondent(E1_RATINGS, DEFAULT_CONFIG)
    assert result.ratings == tuple(E1_RATINGS)
    assert result.matched_rule_index == 3  # rule 4, pattern (3, 2, 2)
    assert result.chi == 80.0  # AA -> 80 on the default chi scale

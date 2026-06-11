"""M_R3 tests: fuzzification, S-shaped MF and risk-class oracles (spec section 4)."""

from __future__ import annotations

import itertools

import pytest

from tourism_risk import (
    DEFAULT_CONFIG,
    ExpertSafetyLevel,
    RiskClass,
    omega,
    risk_class,
    s_membership,
)

BOUNDARIES = DEFAULT_CONFIG.fuzz_boundaries  # (0, 20, 40, 60, 80, 100)
A1, A6 = BOUNDARIES[0], BOUNDARIES[-1]
THRESHOLDS = DEFAULT_CONFIG.risk_thresholds
TOL = 0.005


class TestOmegaFuzzification:
    """omega(R) = a_{k+1} * m_S(R) for Delta_k (eq. 4.8); oracles from spec 4.1."""

    @pytest.mark.parametrize(
        ("m_s", "level", "expected"),
        [
            (0.74, ExpertSafetyLevel.D5, 74.0),
            (0.875, ExpertSafetyLevel.D4, 70.0),
            (0.56, ExpertSafetyLevel.D4, 44.8),
        ],
    )
    def test_oracle_values(self, m_s, level, expected):
        assert omega(m_s, level, BOUNDARIES) == pytest.approx(expected, abs=TOL)

    @pytest.mark.parametrize(
        ("level", "multiplier"),
        [
            (ExpertSafetyLevel.D1, 20.0),
            (ExpertSafetyLevel.D2, 40.0),
            (ExpertSafetyLevel.D3, 60.0),
            (ExpertSafetyLevel.D4, 80.0),
            (ExpertSafetyLevel.D5, 100.0),
        ],
    )
    def test_level_k_uses_boundary_a_k_plus_1(self, level, multiplier):
        assert omega(1.0, level, BOUNDARIES) == multiplier

    def test_accepts_plain_int_levels(self):
        assert omega(0.74, 5, BOUNDARIES) == pytest.approx(74.0)


class TestSMembershipOracles:
    @pytest.mark.parametrize(
        ("omega_value", "expected"),
        [
            (74.0, 0.8648),
            (70.0, 0.82),
            (44.8, 0.401408),
        ],
    )
    def test_oracle_values(self, omega_value, expected):
        assert s_membership(omega_value, A1, A6) == pytest.approx(expected, abs=TOL)


class TestSMembershipBoundaries:
    def test_at_a1_is_zero(self):
        assert s_membership(A1, A1, A6) == 0.0
        assert s_membership(A1 - 10, A1, A6) == 0.0

    def test_midpoint_both_branches_give_half(self):
        midpoint = (A1 + A6) / 2  # 50
        rising = 2 * ((midpoint - A1) / (A6 - A1)) ** 2
        saturating = 1 - 2 * ((A6 - midpoint) / (A6 - A1)) ** 2
        assert rising == pytest.approx(0.5)
        assert saturating == pytest.approx(0.5)
        assert s_membership(midpoint, A1, A6) == pytest.approx(0.5)

    def test_at_a6_is_one(self):
        assert s_membership(A6, A1, A6) == 1.0
        assert s_membership(A6 + 10, A1, A6) == 1.0

    def test_monotone_nondecreasing(self):
        samples = [s_membership(float(value), A1, A6) for value in range(0, 101, 5)]
        assert all(left <= right for left, right in itertools.pairwise(samples))


class TestRiskClassInterpretation:
    @pytest.mark.parametrize(
        ("mu", "expected"),
        [
            (0.8648, RiskClass.R5),
            (0.82, RiskClass.R5),
            (0.401408, RiskClass.R3),
        ],
    )
    def test_oracle_values(self, mu, expected):
        assert risk_class(mu, THRESHOLDS) is expected

    @pytest.mark.parametrize(
        ("mu", "expected"),
        [
            (0.0, RiskClass.R1),
            (0.19999, RiskClass.R1),
            (0.2, RiskClass.R2),  # threshold belongs to the upper class
            (0.39999, RiskClass.R2),
            (0.4, RiskClass.R3),
            (0.59999, RiskClass.R3),
            (0.6, RiskClass.R4),
            (0.79999, RiskClass.R4),
            (0.8, RiskClass.R5),
            (1.0, RiskClass.R5),  # exactly 1.0 is included in [0.8, 1]
        ],
    )
    def test_threshold_edges(self, mu, expected):
        assert risk_class(mu, THRESHOLDS) is expected

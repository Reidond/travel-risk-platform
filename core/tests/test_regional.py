"""M_R2 tests: chi scale, delta mean, Z-spline and cone MF oracles (spec section 3)."""

from __future__ import annotations

import itertools

import pytest

from tourism_risk import DEFAULT_CONFIG, RiskTerm, chi, cone_membership, delta, z_spline

A = DEFAULT_CONFIG.zspline_a  # 60
B = DEFAULT_CONFIG.zspline_b  # 100
TOL = 0.005


class TestChiScale:
    @pytest.mark.parametrize(
        ("term", "expected"),
        [
            (RiskTerm.L, 15.0),
            (RiskTerm.BA, 30.0),
            (RiskTerm.A, 50.0),
            (RiskTerm.AA, 80.0),
            (RiskTerm.H, 100.0),
        ],
    )
    def test_default_mapping(self, term, expected):
        assert chi(term, DEFAULT_CONFIG) == expected


class TestDelta:
    def test_equal_weights_mean(self):
        assert delta([80.0, 50.0, 80.0]) == pytest.approx(70.0)

    def test_weighted_mean(self):
        # (2*80 + 1*50 + 1*100) / 4 = 77.5
        assert delta([80.0, 50.0, 100.0], weights=[2.0, 1.0, 1.0]) == pytest.approx(77.5)

    def test_uniform_weights_equal_unweighted(self):
        values = [15.0, 30.0, 50.0, 80.0, 100.0]
        assert delta(values, weights=[3.0] * 5) == pytest.approx(delta(values))

    def test_zero_weight_excludes_respondent(self):
        assert delta([80.0, 999.0], weights=[1.0, 0.0]) == pytest.approx(80.0)


class TestZSplineOracles:
    """Exact oracle values from spec section 3.2 (a=60, b=100)."""

    @pytest.mark.parametrize(
        ("delta_value", "expected"),
        [
            (69.73, 0.8816589),
            (79.54, 0.5227355),
            (87.89, 0.1833151),
            (89.78, 0.1305605),
        ],
    )
    def test_oracle_values(self, delta_value, expected):
        assert z_spline(delta_value, A, B) == pytest.approx(expected, abs=TOL)

    def test_published_phi_for_r1_is_a_rounding_of_exact_value(self):
        """Discrepancy #2: article publishes phi(79.54) = 0.5; exact is 0.5227."""
        assert z_spline(79.54, A, B) == pytest.approx(0.5227355, abs=TOL)
        assert round(z_spline(79.54, A, B), 1) == 0.5

    def test_published_phi_for_r3_matches_transposed_delta(self):
        """Discrepancy #2: published 0.13 corresponds to delta = 89.78, not 87.89."""
        assert z_spline(89.78, A, B) == pytest.approx(0.13, abs=TOL)


class TestZSplineBoundaries:
    def test_at_or_below_a_is_one(self):
        assert z_spline(A, A, B) == 1.0
        assert z_spline(0.0, A, B) == 1.0
        assert z_spline(A - 1e-9, A, B) == 1.0

    def test_midpoint_continuity_both_branches_give_half(self):
        midpoint = (A + B) / 2  # 80
        denominator = 2 * ((B - A) / 2) ** 2  # 800
        falling = 1 - (midpoint - A) ** 2 / denominator
        rising = (B - midpoint) ** 2 / denominator
        assert falling == pytest.approx(0.5)
        assert rising == pytest.approx(0.5)
        assert z_spline(midpoint, A, B) == pytest.approx(0.5)

    def test_at_or_above_b_is_zero(self):
        assert z_spline(B, A, B) == 0.0
        assert z_spline(B + 50, A, B) == 0.0

    def test_monotone_decreasing_inside_support(self):
        samples = [z_spline(60 + step, A, B) for step in range(41)]
        assert all(left >= right for left, right in itertools.pairwise(samples))


class TestConeMembershipOracles:
    """Oracles from spec section 3.3 (published phi inputs, base (1,1), scale (2,2))."""

    @pytest.mark.parametrize(
        ("phi", "xi", "expected"),
        [
            (0.5, 0.85, 0.7389923),
            (0.88, 0.78, 0.8747004),
            (0.13, 0.88, 0.5608815),
        ],
    )
    def test_oracle_values(self, phi, xi, expected):
        assert cone_membership(phi, xi, DEFAULT_CONFIG.cone_base, DEFAULT_CONFIG.cone_scale) == (
            pytest.approx(expected, abs=TOL)
        )

    def test_published_roundings(self):
        assert round(cone_membership(0.5, 0.85), 2) == 0.74
        assert round(cone_membership(0.88, 0.78), 3) == 0.875
        assert round(cone_membership(0.13, 0.88), 2) == 0.56

    def test_apex_gives_one(self):
        assert cone_membership(1.0, 1.0) == pytest.approx(1.0)

    def test_default_base_and_scale_match_config(self):
        assert cone_membership(0.5, 0.85) == cone_membership(
            0.5, 0.85, DEFAULT_CONFIG.cone_base, DEFAULT_CONFIG.cone_scale
        )

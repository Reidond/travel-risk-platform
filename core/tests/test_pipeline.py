"""End-to-end pipeline tests: published rounded chain and full region evaluation."""

from __future__ import annotations

import pytest

from tests.conftest import E1_RATINGS, E210_RATINGS, E251_RATINGS
from tourism_risk import (
    DEFAULT_CONFIG,
    ExpertSafetyLevel,
    RiskClass,
    RiskTerm,
    cone_membership,
    evaluate_region,
    evaluate_respondent,
    omega,
    risk_class,
    s_membership,
    z_spline,
)

TOL = 0.005


class TestPublishedChain:
    """Reproduce the article's worked example by feeding *published* step inputs.

    The published values carry roundings (phi = 0.5 / 0.88 / 0.13, see
    documented discrepancy #2), so each step is fed the published input of the
    previous step, exactly as in the article.
    """

    @pytest.mark.parametrize(
        ("delta_pub", "phi_pub", "xi", "m_s_pub", "level", "omega_pub", "mu_pub", "class_pub"),
        [
            # R1 Zakarpattia, R2 Ivano-Frankivsk, R3 Lviv oblast (plan section 8)
            (79.54, 0.5, 0.85, 0.74, ExpertSafetyLevel.D5, 74.0, 0.8648, RiskClass.R5),
            (69.73, 0.88, 0.78, 0.875, ExpertSafetyLevel.D4, 70.0, 0.82, RiskClass.R5),
            (87.89, 0.13, 0.88, 0.56, ExpertSafetyLevel.D4, 44.8, 0.401408, RiskClass.R3),
        ],
        ids=["R1-Zakarpattia", "R2-Ivano-Frankivsk", "R3-Lviv"],
    )
    def test_published_chain(
        self, delta_pub, phi_pub, xi, m_s_pub, level, omega_pub, mu_pub, class_pub
    ):
        config = DEFAULT_CONFIG
        # phi from the published delta agrees with the published phi only after
        # the author's rounding (R1) / digit transposition (R3) — assert m_S
        # onward from the published phi, per spec section 3.2.
        m_s = cone_membership(phi_pub, xi, config.cone_base, config.cone_scale)
        assert m_s == pytest.approx(m_s_pub, abs=TOL)

        omega_value = omega(m_s_pub, level, config.fuzz_boundaries)
        assert omega_value == pytest.approx(omega_pub, abs=TOL)

        mu = s_membership(omega_pub, config.fuzz_boundaries[0], config.fuzz_boundaries[-1])
        assert mu == pytest.approx(mu_pub, abs=TOL)

        assert risk_class(mu, config.risk_thresholds) is class_pub

    def test_published_phi_inputs_from_exact_spline(self):
        # phi(69.73) rounds to the published 0.88 for R2.
        assert round(z_spline(69.73, DEFAULT_CONFIG.zspline_a, DEFAULT_CONFIG.zspline_b), 2) == (
            0.88
        )


class TestEvaluateRegion:
    def test_region_of_three_control_respondents_end_to_end(self):
        result = evaluate_region(
            respondent_ratings=[E1_RATINGS, E210_RATINGS, E251_RATINGS],
            xi=0.85,
            delta_level=ExpertSafetyLevel.D5,
            config=DEFAULT_CONFIG,
        )
        # Individual stage: AA / A / AA -> chi 80 / 50 / 80.
        assert [r.risk_term for r in result.respondents] == [
            RiskTerm.AA,
            RiskTerm.A,
            RiskTerm.AA,
        ]
        assert [r.chi for r in result.respondents] == [80.0, 50.0, 80.0]
        # Regional stage: delta = 70, phi = 1 - 100/800 = 0.875.
        assert result.delta == pytest.approx(70.0)
        assert result.phi == pytest.approx(0.875)
        assert result.m_s == pytest.approx(0.9023719, abs=TOL)
        # National stage: D5 -> omega = 100 * m_S; S-shape; class.
        assert result.omega == pytest.approx(90.23719, abs=TOL)
        assert result.mu == pytest.approx(0.9809375, abs=TOL)
        assert result.risk_class is RiskClass.R5
        # DM inputs retained.
        assert result.xi == 0.85
        assert result.expert_level is ExpertSafetyLevel.D5
        assert result.weights is None

    def test_region_retains_every_respondent_intermediate(self):
        result = evaluate_region([E1_RATINGS], 0.85, 5, DEFAULT_CONFIG)
        respondent = result.respondents[0]
        standalone = evaluate_respondent(E1_RATINGS, DEFAULT_CONFIG)
        assert respondent == standalone
        assert respondent.theta == (13, 7, 8)
        assert respondent.group_terms == (3, 2, 2)
        assert respondent.matched_rule_index == 3

    def test_weighted_region(self):
        # Weights shift delta: (1*80 + 3*50 + 0*80) / 4 = 57.5 -> phi = 1.
        result = evaluate_region(
            respondent_ratings=[E1_RATINGS, E210_RATINGS, E251_RATINGS],
            xi=1.0,
            delta_level=ExpertSafetyLevel.D5,
            config=DEFAULT_CONFIG,
            weights=[1.0, 3.0, 0.0],
        )
        assert result.weights == (1.0, 3.0, 0.0)
        assert result.delta == pytest.approx(57.5)
        assert result.phi == 1.0
        assert result.m_s == pytest.approx(1.0)  # at the cone apex (phi=1, xi=1)
        assert result.omega == pytest.approx(100.0)
        assert result.mu == 1.0
        assert result.risk_class is RiskClass.R5

    def test_accepts_int_delta_level(self):
        by_enum = evaluate_region([E1_RATINGS], 0.85, ExpertSafetyLevel.D4, DEFAULT_CONFIG)
        by_int = evaluate_region([E1_RATINGS], 0.85, 4, DEFAULT_CONFIG)
        assert by_enum == by_int

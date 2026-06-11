"""Platform config versioning, activation and curve sampling."""

import pytest
from tourism_risk import DEFAULT_CONFIG, cone_membership, s_membership, z_spline


def test_default_config_seeded(client):
    body = client.get("/api/config").json()
    assert body["version"] == 1
    assert body["active"] is True
    params = body["params"]
    assert params["term_multipliers"] == [1, 2, 3, 4]
    assert params["chi_scale"] == {"L": 15, "BA": 30, "A": 50, "AA": 80, "H": 100}
    assert params["z_spline"] == {"a": 60, "b": 100}
    assert params["cone"] == {"base": [1, 1], "scale": [2, 2]}
    assert params["fuzzification_boundaries"] == [0, 20, 40, 60, 80, 100]
    assert params["risk_thresholds"] == [0.2, 0.4, 0.6, 0.8]


def _params(**overrides):
    base = {
        "term_multipliers": [1, 2, 3, 4],
        "chi_scale": {"L": 15, "BA": 30, "A": 50, "AA": 80, "H": 100},
        "z_spline": {"a": 60, "b": 100},
        "cone": {"base": [1, 1], "scale": [2, 2]},
        "fuzzification_boundaries": [0, 20, 40, 60, 80, 100],
        "risk_thresholds": [0.2, 0.4, 0.6, 0.8],
    }
    base.update(overrides)
    return base


def test_config_versioning_and_activation(client):
    created = client.post(
        "/api/config",
        json={"params": _params(z_spline={"a": 50, "b": 90}), "comment": "tighter spline"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["version"] == 2
    assert created.json()["active"] is True

    active = client.get("/api/config").json()
    assert active["version"] == 2
    assert active["params"]["z_spline"] == {"a": 50, "b": 90}

    versions = client.get("/api/config/versions").json()
    assert versions["total"] == 2
    assert [item["version"] for item in versions["items"]] == [2, 1]
    assert [item["active"] for item in versions["items"]] == [True, False]

    reactivated = client.post("/api/config/versions/1/activate")
    assert reactivated.status_code == 200
    assert client.get("/api/config").json()["version"] == 1
    assert client.post("/api/config/versions/99/activate").status_code == 404


def test_config_validation_rejects_bad_params(client):
    # a >= b violates the Z-spline constraint (MATH_SPEC §6, validated by the core).
    response = client.post("/api/config", json={"params": _params(z_spline={"a": 100, "b": 60})})
    assert response.status_code == 422
    # Non-increasing boundaries.
    response = client.post(
        "/api/config",
        json={"params": _params(fuzzification_boundaries=[0, 20, 20, 60, 80, 100])},
    )
    assert response.status_code == 422
    # Thresholds outside (0, 1).
    response = client.post(
        "/api/config", json={"params": _params(risk_thresholds=[0.2, 0.4, 0.6, 1.5])}
    )
    assert response.status_code == 422


def test_curves_sample_the_core_functions(client):
    body = client.get("/api/config/curves").json()

    assert len(body["z_spline"]) == 201
    assert body["z_spline"][0] == [0.0, 1.0]
    delta_value, phi_value = body["z_spline"][100]
    assert phi_value == pytest.approx(z_spline(delta_value, 60.0, 100.0))

    assert len(body["s_shape"]) == 201
    omega_value, mu_value = body["s_shape"][150]
    assert mu_value == pytest.approx(s_membership(omega_value, 0.0, 100.0))
    assert body["s_shape"][0] == [0.0, 0.0]
    assert body["s_shape"][-1] == [100.0, 1.0]

    cone = body["cone"]
    assert len(cone["xi_fixed"]) == 201 and len(cone["phi_fixed"]) == 201
    phi_value, m_s_value = cone["xi_fixed"][42]
    assert m_s_value == pytest.approx(
        cone_membership(phi_value, 1.0, DEFAULT_CONFIG.cone_base, DEFAULT_CONFIG.cone_scale)
    )
    xi_value, m_s_value = cone["phi_fixed"][42]
    assert m_s_value == pytest.approx(
        cone_membership(1.0, xi_value, DEFAULT_CONFIG.cone_base, DEFAULT_CONFIG.cone_scale)
    )

    # Sampling respects the requested version's parameters.
    client.post("/api/config", json={"params": _params(z_spline={"a": 50, "b": 90})})
    curves_v2 = client.get("/api/config/curves", params={"version": 2}).json()
    delta_value, phi_value = curves_v2["z_spline"][100]
    assert phi_value == pytest.approx(z_spline(delta_value, 50.0, 90.0))
    assert client.get("/api/config/curves", params={"version": 99}).status_code == 404

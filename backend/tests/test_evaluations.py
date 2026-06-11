"""Evaluation runs: the MATH_SPEC §2.2 control chain, 409 cases, drill-down."""

import pytest
from tourism_risk import DEFAULT_CONFIG, evaluate_region

from tests.conftest import E1, E210, E251, create_control_region, ratings_map


def test_control_chain_matches_core_library(client):
    """THE CONTROL TEST: xi=0.85, D5 + the three article Table 1 respondents."""
    region_id = create_control_region(client)
    response = client.post("/api/evaluations", json={"region_ids": [region_id]})
    assert response.status_code == 201, response.text
    run = response.json()

    assert run["config_snapshot"]["z_spline"] == {"a": 60, "b": 100}
    assert run["config_snapshot"]["version"] == 1  # traceability to the config version
    assert run["ruleset_snapshot"]["default_output"] == "H"
    assert len(run["results"]) == 1
    result = run["results"][0]
    assert result["region"]["id"] == region_id
    assert result["n"] == 3
    assert result["xi"] == 0.85
    assert result["delta_level"] == "D5"

    # Per-respondent published terms: r*(e1)=AA, r*(e210)=A, r*(e251)=AA.
    individuals = client.get(f"/api/evaluations/{run['id']}/regions/{region_id}/individuals").json()
    assert individuals["total"] == 3
    by_ext = {item["ext_id"]: item for item in individuals["items"]}
    assert by_ext["e1"]["r_star"] == "AA"
    assert by_ext["e210"]["r_star"] == "A"
    assert by_ext["e251"]["r_star"] == "AA"
    assert by_ext["e1"]["theta"] == {"G1": 13, "G2": 7, "G3": 8}
    assert by_ext["e1"]["terms"] == {"G1": 3, "G2": 2, "G3": 2}
    assert by_ext["e210"]["theta"] == {"G1": 12, "G2": 15, "G3": 17}
    assert by_ext["e210"]["terms"] == {"G1": 3, "G2": 3, "G3": 4}
    assert by_ext["e251"]["theta"] == {"G1": 7, "G2": 13, "G3": 12}
    assert by_ext["e251"]["terms"] == {"G1": 2, "G2": 2, "G3": 3}
    assert result["r_star_distribution"] == {"L": 0, "BA": 0, "A": 1, "AA": 2, "H": 0}

    # delta = mean of chi values (AA->80, A->50, AA->80).
    chis = [by_ext[key]["chi"] for key in ("e1", "e210", "e251")]
    assert chis == [80.0, 50.0, 80.0]
    assert result["delta"] == pytest.approx(sum(chis) / 3)

    # Full chain must equal the core library's own outputs.
    expected = evaluate_region(
        respondent_ratings=[E1, E210, E251],
        xi=0.85,
        delta_level=5,
        config=DEFAULT_CONFIG,
    )
    assert result["delta"] == pytest.approx(expected.delta)
    assert result["phi"] == pytest.approx(expected.phi)
    assert result["m_s"] == pytest.approx(expected.m_s)
    assert result["omega"] == pytest.approx(expected.omega)
    assert result["mu"] == pytest.approx(expected.mu)
    assert result["risk_class"] == expected.risk_class.name


def test_evaluation_rejects_oversized_region(client, monkeypatch):
    monkeypatch.setattr("app.services.evaluator.MAX_RESPONDENTS_PER_REGION", 2)
    region_id = create_control_region(client)  # 3 respondents > cap of 2
    response = client.post("/api/evaluations", json={"region_ids": [region_id]})
    assert response.status_code == 422
    assert "respondents-per-region" in response.json()["detail"]


def test_evaluation_409_lists_offenders(client):
    ready_id = create_control_region(client)
    no_xi = client.post(
        "/api/regions", json={"name_uk": "Без Ξ", "name_en": "No xi", "delta_level": "D3"}
    ).json()["id"]
    client.post(f"/api/regions/{no_xi}/respondents", json={"ratings": ratings_map(E1)})
    no_delta = client.post(
        "/api/regions", json={"name_uk": "Без Δ", "name_en": "No delta", "xi": 0.5}
    ).json()["id"]
    client.post(f"/api/regions/{no_delta}/respondents", json={"ratings": ratings_map(E1)})
    empty = client.post(
        "/api/regions",
        json={"name_uk": "Порожній", "name_en": "Empty", "xi": 0.5, "delta_level": "D3"},
    ).json()["id"]

    response = client.post("/api/evaluations", json={"region_ids": None})
    assert response.status_code == 409
    offenders = {o["region_id"]: o["missing"] for o in response.json()["detail"]["offenders"]}
    assert ready_id not in offenders
    assert offenders[no_xi] == ["xi"]
    assert offenders[no_delta] == ["delta_level"]
    assert offenders[empty] == ["respondents"]

    # Evaluating only the ready region works.
    assert client.post("/api/evaluations", json={"region_ids": [ready_id]}).status_code == 201
    # Unknown region id -> 404; no regions at all -> 409.
    assert client.post("/api/evaluations", json={"region_ids": [9999]}).status_code == 404
    assert client.post("/api/evaluations", json={"region_ids": []}).status_code == 409


def test_evaluation_history_and_delete(client):
    region_id = create_control_region(client)
    first = client.post(
        "/api/evaluations", json={"region_ids": [region_id], "comment": "first"}
    ).json()
    second = client.post("/api/evaluations", json={}).json()

    listed = client.get("/api/evaluations").json()
    assert listed["total"] == 2
    assert [item["id"] for item in listed["items"]] == [second["id"], first["id"]]
    assert listed["items"][1]["comment"] == "first"
    # History items carry results but never the heavy individuals payload.
    assert "results" in listed["items"][0]
    assert "individuals" not in listed["items"][0]["results"][0]

    fetched = client.get(f"/api/evaluations/{first['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["results"][0]["risk_class"] == first["results"][0]["risk_class"]

    # latest_result appears on the region list after a run.
    region = client.get(f"/api/regions/{region_id}").json()
    assert region["latest_result"] is not None
    assert region["latest_result"]["mu"] == pytest.approx(second["results"][0]["mu"])

    assert client.delete(f"/api/evaluations/{first['id']}").status_code == 204
    assert client.get(f"/api/evaluations/{first['id']}").status_code == 404
    assert client.get("/api/evaluations").json()["total"] == 1


def test_individuals_pagination(client):
    region_id = create_control_region(client)
    run = client.post("/api/evaluations", json={"region_ids": [region_id]}).json()

    page = client.get(
        f"/api/evaluations/{run['id']}/regions/{region_id}/individuals",
        params={"offset": 1, "limit": 1},
    ).json()
    assert page["total"] == 3
    assert len(page["items"]) == 1
    assert page["items"][0]["ext_id"] == "e210"

    tail = client.get(
        f"/api/evaluations/{run['id']}/regions/{region_id}/individuals",
        params={"offset": 2, "limit": 10},
    ).json()
    assert [item["ext_id"] for item in tail["items"]] == ["e251"]

    missing = client.get(f"/api/evaluations/{run['id']}/regions/9999/individuals")
    assert missing.status_code == 404


def test_evaluation_uses_active_config_and_ruleset(client):
    region_id = create_control_region(client)
    # Make every respondent come out as the default term H (single impossible rule).
    client.post(
        "/api/rulesets",
        json={"rules": [{"pattern": [5, 5, 5], "output": "L"}], "default_output": "H"},
    )
    run = client.post("/api/evaluations", json={"region_ids": [region_id]}).json()
    result = run["results"][0]
    assert result["r_star_distribution"]["H"] == 3
    assert result["delta"] == pytest.approx(100.0)  # all chi = 100
    assert run["ruleset_snapshot"]["rules"] == [{"pattern": [5, 5, 5], "output": "L"}]

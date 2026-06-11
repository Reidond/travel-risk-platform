"""Respondent CRUD incl. ratings validation against active criteria."""

import pytest

from tests.conftest import E1, E210, create_control_region, ratings_map


@pytest.fixture
def region_id(client) -> int:
    return client.post("/api/regions", json={"name_uk": "Р", "name_en": "R"}).json()["id"]


def test_respondent_crud_roundtrip(client, region_id):
    created = client.post(
        f"/api/regions/{region_id}/respondents",
        json={
            "ext_id": "e1",
            "year": "2023 рік",
            "month": "Липень",
            "accommodation": "Готель",
            "ratings": ratings_map(E1),
        },
    )
    assert created.status_code == 201
    respondent = created.json()
    assert respondent["ratings"]["K11"] == 5

    listed = client.get(f"/api/regions/{region_id}/respondents").json()
    assert listed["total"] == 1

    patched = client.patch(
        f"/api/respondents/{respondent['id']}",
        json={"ratings": ratings_map(E210), "accommodation": "Хостел"},
    )
    assert patched.status_code == 200
    assert patched.json()["ratings"]["K11"] == 4
    assert patched.json()["accommodation"] == "Хостел"

    assert client.delete(f"/api/respondents/{respondent['id']}").status_code == 204
    assert client.delete(f"/api/respondents/{respondent['id']}").status_code == 404


def test_ratings_must_cover_active_criteria(client, region_id):
    incomplete = ratings_map(E1)
    del incomplete["K35"]
    response = client.post(
        f"/api/regions/{region_id}/respondents",
        json={"ratings": incomplete},
    )
    assert response.status_code == 422
    assert "K35" in response.json()["detail"]

    extra = ratings_map(E1) | {"K99": 3}
    response = client.post(
        f"/api/regions/{region_id}/respondents",
        json={"ratings": extra},
    )
    assert response.status_code == 422
    assert "K99" in response.json()["detail"]


def test_ratings_range_validation(client, region_id):
    bad = ratings_map(E1) | {"K11": 6}
    assert (
        client.post(f"/api/regions/{region_id}/respondents", json={"ratings": bad}).status_code
        == 422
    )
    bad = ratings_map(E1) | {"K11": 0}
    assert (
        client.post(f"/api/regions/{region_id}/respondents", json={"ratings": bad}).status_code
        == 422
    )


def test_patch_ratings_explicit_null_rejected(client):
    """Explicit ratings:null must 422 without corrupting the stored row.

    Regression: a JSON null used to slip through exclude_unset, COMMIT a
    'null' into the NOT NULL ratings column, then 500 — breaking the region's
    respondents list and evaluation until the row was deleted.
    """
    region_id = create_control_region(client)
    respondent_id = client.get(f"/api/regions/{region_id}/respondents").json()["items"][0]["id"]

    response = client.patch(f"/api/respondents/{respondent_id}", json={"ratings": None})
    assert response.status_code == 422

    # The respondent still lists fine…
    listed = client.get(f"/api/regions/{region_id}/respondents")
    assert listed.status_code == 200
    assert listed.json()["total"] == 3
    assert listed.json()["items"][0]["ratings"]["K11"] == 5
    # …and the region still evaluates fine.
    assert client.post("/api/evaluations", json={"region_ids": [region_id]}).status_code == 201


def test_respondent_filters_and_paging(client, region_id):
    for index in range(5):
        client.post(
            f"/api/regions/{region_id}/respondents",
            json={
                "ext_id": f"e{index}",
                "year": "2022 рік" if index % 2 == 0 else "2023 рік",
                "accommodation": "Готель" if index < 2 else "Кемпінг",
                "ratings": ratings_map(E1),
            },
        )
    by_year = client.get(f"/api/regions/{region_id}/respondents", params={"year": "2022 рік"})
    assert by_year.json()["total"] == 3
    by_accommodation = client.get(
        f"/api/regions/{region_id}/respondents", params={"accommodation": "Готель"}
    )
    assert by_accommodation.json()["total"] == 2
    page = client.get(
        f"/api/regions/{region_id}/respondents", params={"offset": 4, "limit": 2}
    ).json()
    assert page["total"] == 5
    assert len(page["items"]) == 1

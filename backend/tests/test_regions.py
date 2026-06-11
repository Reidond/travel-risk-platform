"""Region CRUD: validation, cascade delete, latest_result."""

from tests.conftest import E1, create_control_region, ratings_map


def test_region_crud_roundtrip(client):
    created = client.post(
        "/api/regions",
        json={"name_uk": "Тестова область", "name_en": "Test Oblast"},
    )
    assert created.status_code == 201
    region = created.json()
    assert region["xi"] is None
    assert region["delta_level"] is None
    assert region["respondent_count"] == 0
    assert region["latest_result"] is None

    listed = client.get("/api/regions").json()
    assert listed["total"] == 1
    assert listed["items"][0]["name_uk"] == "Тестова область"

    patched = client.patch(
        f"/api/regions/{region['id']}",
        json={"xi": 0.5, "delta_level": "D3", "name_en": "Renamed Oblast"},
    )
    assert patched.status_code == 200
    assert patched.json()["xi"] == 0.5
    assert patched.json()["delta_level"] == "D3"
    assert patched.json()["name_en"] == "Renamed Oblast"

    fetched = client.get(f"/api/regions/{region['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["delta_level"] == "D3"

    deleted = client.delete(f"/api/regions/{region['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/regions/{region['id']}").status_code == 404


def test_region_validation(client):
    assert (
        client.post("/api/regions", json={"name_uk": "X", "name_en": "X", "xi": 1.5}).status_code
        == 422
    )
    assert (
        client.post(
            "/api/regions", json={"name_uk": "X", "name_en": "X", "delta_level": "D9"}
        ).status_code
        == 422
    )
    assert client.patch("/api/regions/999", json={"xi": 0.5}).status_code == 404
    assert client.delete("/api/regions/999").status_code == 404


def test_patch_region_explicit_null_name_rejected(client):
    """Explicit null names must 422 (used to 500 with an IntegrityError)."""
    region = client.post(
        "/api/regions",
        json={"name_uk": "Х", "name_en": "X", "xi": 0.5, "delta_level": "D3"},
    ).json()

    assert client.patch(f"/api/regions/{region['id']}", json={"name_uk": None}).status_code == 422
    assert client.patch(f"/api/regions/{region['id']}", json={"name_en": None}).status_code == 422

    # xi/delta_level nulls stay legal — they mean "clear the DM input".
    cleared = client.patch(f"/api/regions/{region['id']}", json={"xi": None, "delta_level": None})
    assert cleared.status_code == 200
    assert cleared.json()["xi"] is None
    assert cleared.json()["delta_level"] is None
    assert cleared.json()["name_uk"] == "Х"


def test_new_region_does_not_inherit_deleted_regions_result(client):
    """Regression: SQLite used to recycle a deleted region's rowid, so a new
    region joined against the old EvaluationResult.region_id snapshot and
    showed the deleted region's latest_result badge."""
    region_id = create_control_region(client)
    assert client.post("/api/evaluations", json={"region_ids": None}).status_code == 201
    assert client.delete(f"/api/regions/{region_id}").status_code == 204

    created = client.post("/api/regions", json={"name_uk": "Новий", "name_en": "New"})
    assert created.status_code == 201
    new_region = created.json()
    assert new_region["id"] != region_id  # ids are never reused
    assert new_region["latest_result"] is None

    # The run itself survives region deletion (snapshot semantics).
    runs = client.get("/api/evaluations").json()
    assert runs["total"] == 1
    assert runs["items"][0]["results"][0]["region"]["id"] == region_id


def test_region_delete_cascades_respondents(client):
    region_id = client.post("/api/regions", json={"name_uk": "А", "name_en": "A"}).json()["id"]
    respondent = client.post(
        f"/api/regions/{region_id}/respondents",
        json={"ext_id": "e1", "ratings": ratings_map(E1)},
    ).json()

    assert client.delete(f"/api/regions/{region_id}").status_code == 204
    # Respondent gone together with the region.
    assert client.delete(f"/api/respondents/{respondent['id']}").status_code == 404
    assert client.get(f"/api/regions/{region_id}/respondents").status_code == 404

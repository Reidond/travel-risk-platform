"""Criteria configuration: defaults, full replacement, 409 protection."""

from tests.conftest import CRITERIA_CODES, E1, ratings_map


def test_default_criteria_seeded(client):
    body = client.get("/api/criteria").json()
    codes = [group["code"] for group in body["groups"]]
    assert codes == ["G1", "G2", "G3"]
    flat = [c["code"] for group in body["groups"] for c in group["criteria"]]
    assert flat == CRITERIA_CODES
    sizes = [len(group["criteria"]) for group in body["groups"]]
    assert sizes == [5, 7, 5]
    k11 = body["groups"][0]["criteria"][0]
    assert k11["text_uk"].startswith("Інформація")
    assert k11["text_en"]


def _label_edit_payload(client) -> dict:
    body = client.get("/api/criteria").json()
    for group in body["groups"]:
        group.pop("id", None)
    body["groups"][0]["name_en"] = "Edited group label"
    body["groups"][0]["criteria"][0]["text_en"] = "Edited criterion label"
    return body


def test_put_criteria_label_edits_always_allowed(client):
    region_id = client.post("/api/regions", json={"name_uk": "Р", "name_en": "R"}).json()["id"]
    client.post(f"/api/regions/{region_id}/respondents", json={"ratings": ratings_map(E1)})
    response = client.put("/api/criteria", json=_label_edit_payload(client))
    assert response.status_code == 200, response.text
    assert response.json()["groups"][0]["name_en"] == "Edited group label"
    assert response.json()["groups"][0]["criteria"][0]["text_en"] == "Edited criterion label"


def test_put_criteria_structural_change_blocked_with_respondents(client):
    region_id = client.post("/api/regions", json={"name_uk": "Р", "name_en": "R"}).json()["id"]
    client.post(f"/api/regions/{region_id}/respondents", json={"ratings": ratings_map(E1)})
    payload = _label_edit_payload(client)
    payload["groups"][0]["criteria"][0]["code"] = "K99"
    response = client.put("/api/criteria", json=payload)
    assert response.status_code == 409
    assert "respondents" in response.json()["detail"]


def test_put_criteria_structural_change_allowed_without_respondents(client):
    payload = {
        "groups": [
            {
                "code": "G1",
                "name_uk": "Транспорт",
                "name_en": "Transport",
                "criteria": [
                    {"code": "C1", "text_uk": "т1", "text_en": "t1"},
                    {"code": "C2", "text_uk": "т2", "text_en": "t2"},
                ],
            },
            {
                "code": "G2",
                "name_uk": "Здоров'я",
                "name_en": "Health",
                "criteria": [{"code": "C3", "text_uk": "т3", "text_en": "t3"}],
            },
        ]
    }
    response = client.put("/api/criteria", json=payload)
    assert response.status_code == 200, response.text
    body = client.get("/api/criteria").json()
    assert [group["code"] for group in body["groups"]] == ["G1", "G2"]
    flat = [c["code"] for group in body["groups"] for c in group["criteria"]]
    assert flat == ["C1", "C2", "C3"]


def test_put_criteria_rejects_duplicates(client):
    payload = _label_edit_payload(client)
    payload["groups"][0]["criteria"][1]["code"] = payload["groups"][0]["criteria"][0]["code"]
    assert client.put("/api/criteria", json=payload).status_code == 422

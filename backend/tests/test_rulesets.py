"""Rule-set versioning, validation and reset-to-default."""

ARTICLE_RULES = [
    {"pattern": [5, 4, 4], "output": "L"},
    {"pattern": [5, 4, 3], "output": "BA"},
    {"pattern": [4, 3, 2], "output": "A"},
    {"pattern": [3, 2, 2], "output": "AA"},
]


def test_default_ruleset_seeded(client):
    body = client.get("/api/rulesets/active").json()
    assert body["version"] == 1
    assert body["rules"] == ARTICLE_RULES
    assert body["default_output"] == "H"


def test_ruleset_versioning(client):
    prose_variant = [
        {"pattern": [5, 4, 4], "output": "L"},
        {"pattern": [5, 4, 3], "output": "BA"},
        {"pattern": [4, 3, 2], "output": "A"},
        {"pattern": [3, 3, 2], "output": "AA"},
    ]
    created = client.post(
        "/api/rulesets",
        json={"rules": prose_variant, "default_output": "H", "comment": "prose rule 4"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["version"] == 2
    assert created.json()["active"] is True

    active = client.get("/api/rulesets/active").json()
    assert active["version"] == 2
    assert active["rules"][3] == {"pattern": [3, 3, 2], "output": "AA"}

    listed = client.get("/api/rulesets").json()
    assert listed["total"] == 2
    assert [item["version"] for item in listed["items"]] == [2, 1]
    assert [item["active"] for item in listed["items"]] == [True, False]


def test_ruleset_validation(client):
    # Pattern longer than the number of groups (3).
    response = client.post(
        "/api/rulesets",
        json={"rules": [{"pattern": [5, 4, 4, 3], "output": "L"}], "default_output": "H"},
    )
    assert response.status_code == 422
    # Levels out of 1..5.
    response = client.post(
        "/api/rulesets",
        json={"rules": [{"pattern": [6, 4], "output": "L"}], "default_output": "H"},
    )
    assert response.status_code == 422
    # Invalid output term.
    response = client.post(
        "/api/rulesets",
        json={"rules": [{"pattern": [5, 4], "output": "XX"}], "default_output": "H"},
    )
    assert response.status_code == 422
    # More than 10 rules.
    response = client.post(
        "/api/rulesets",
        json={
            "rules": [{"pattern": [5], "output": "L"}] * 11,
            "default_output": "H",
        },
    )
    assert response.status_code == 422


def test_reset_default_creates_new_article_preset_version(client):
    client.post(
        "/api/rulesets",
        json={"rules": [{"pattern": [5], "output": "L"}], "default_output": "H"},
    )
    reset = client.post("/api/rulesets/reset-default")
    assert reset.status_code == 201
    body = reset.json()
    assert body["version"] == 3
    assert body["active"] is True
    assert body["rules"] == ARTICLE_RULES
    assert body["default_output"] == "H"

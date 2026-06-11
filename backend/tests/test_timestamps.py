"""All API datetimes must serialize as offset-aware UTC ISO strings.

Regression: timestamps used to serialize naive ("2026-06-10T21:38:24.502248"),
which JS `new Date(...)` parses as LOCAL time, shifting every UI timestamp by
the viewer's UTC offset.
"""

from datetime import UTC, datetime

from tests.conftest import create_control_region


def assert_utc_aware(value: str) -> None:
    assert value.endswith(("Z", "+00:00")), f"naive/offset-less timestamp: {value!r}"
    parsed = datetime.fromisoformat(value)
    assert parsed.utcoffset() is not None
    assert parsed.astimezone(UTC).utcoffset().total_seconds() == 0


def test_api_datetimes_are_offset_aware_utc(client):
    region_id = create_control_region(client)
    run = client.post("/api/evaluations", json={"region_ids": [region_id]}).json()

    # Evaluations (create, list, get).
    assert_utc_aware(run["created_at"])
    assert_utc_aware(client.get("/api/evaluations").json()["items"][0]["created_at"])
    assert_utc_aware(client.get(f"/api/evaluations/{run['id']}").json()["created_at"])

    # Regions latest_result.
    region = client.get(f"/api/regions/{region_id}").json()
    assert_utc_aware(region["latest_result"]["evaluated_at"])
    listed = client.get("/api/regions").json()["items"][0]
    assert_utc_aware(listed["latest_result"]["evaluated_at"])

    # Config (active + versions).
    assert_utc_aware(client.get("/api/config").json()["created_at"])
    assert_utc_aware(client.get("/api/config/versions").json()["items"][0]["created_at"])

    # Rulesets (active + list).
    assert_utc_aware(client.get("/api/rulesets/active").json()["created_at"])
    assert_utc_aware(client.get("/api/rulesets").json()["items"][0]["created_at"])

"""Health and meta endpoints."""

from tourism_risk import __version__ as core_version


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_meta_reports_versions(client):
    response = client.get("/api/meta")
    assert response.status_code == 200
    body = response.json()
    assert body["core_version"] == core_version
    assert body["app_version"]

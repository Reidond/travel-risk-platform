"""Import endpoints: xlsx + csv, bad rows, targeting, auto-create, demo."""

from tests.conftest import import_row, make_csv, make_xlsx

GOOD_RATINGS = [4] * 17

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _upload(client, content: bytes, filename: str, region_id: int | None = None):
    mime = XLSX_MIME if filename.endswith(".xlsx") else "text/csv"
    data = {} if region_id is None else {"region_id": str(region_id)}
    return client.post("/api/import", files={"file": (filename, content, mime)}, data=data)


def test_xlsx_import_happy_path_auto_creates_regions(client):
    content = make_xlsx(
        [
            import_row("e1", GOOD_RATINGS, rayon="Ужгородський (Закарпатська область)"),
            import_row("e2", GOOD_RATINGS, rayon="Львівський (Львівська область)"),
            import_row("e3", GOOD_RATINGS, rayon="Тячівський (Закарпатська область)"),
        ]
    )
    response = _upload(client, content, "data.xlsx")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["imported"] == 3
    assert body["skipped"] == 0
    assert body["errors"] == []
    names = {region["name_uk"] for region in body["created_regions"]}
    assert names == {"Закарпатська область", "Львівська область"}
    # Auto-created regions get transliterated English names and null DM inputs.
    zak = next(r for r in body["created_regions"] if r["name_uk"] == "Закарпатська область")
    assert zak["name_en"] == "Zakarpatska oblast"
    assert zak["xi"] is None and zak["delta_level"] is None
    assert zak["respondent_count"] == 2


def test_csv_import_happy_path(client):
    content = make_csv([import_row("e1", GOOD_RATINGS), import_row("e2", GOOD_RATINGS)])
    response = _upload(client, content, "data.csv")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["imported"] == 2
    assert body["errors"] == []
    assert len(body["created_regions"]) == 1


def test_import_collects_row_errors(client):
    out_of_range = [9, *GOOD_RATINGS[1:]]
    missing_value = [None, *GOOD_RATINGS[1:]]
    content = make_xlsx(
        [
            import_row("e1", GOOD_RATINGS),
            import_row("e2", out_of_range),
            import_row("e3", missing_value),
            import_row("e4", GOOD_RATINGS, rayon="Без області"),
        ]
    )
    response = _upload(client, content, "data.xlsx")
    body = response.json()
    assert body["imported"] == 1
    assert body["skipped"] == 3
    rows = {error["row"]: error["message"] for error in body["errors"]}
    assert set(rows) == {3, 4, 5}  # header is row 1
    assert "out of range" in rows[3]
    assert "missing rating" in rows[4]
    assert "oblast" in rows[5]


def test_import_with_region_id_targets_that_region(client):
    region_id = client.post("/api/regions", json={"name_uk": "Ціль", "name_en": "Target"}).json()[
        "id"
    ]
    content = make_csv([import_row("e1", GOOD_RATINGS, rayon="Хустський (Закарпатська область)")])
    response = _upload(client, content, "data.csv", region_id=region_id)
    body = response.json()
    assert body["imported"] == 1
    assert body["created_regions"] == []  # no auto-creation when targeted
    respondents = client.get(f"/api/regions/{region_id}/respondents").json()
    assert respondents["total"] == 1
    assert respondents["items"][0]["ratings"]["K11"] == 4

    assert _upload(client, content, "data.csv", region_id=9999).status_code == 404


def test_import_rejects_unknown_extension(client):
    assert _upload(client, b"whatever", "data.txt").status_code == 422


def test_import_rejects_corrupt_xlsx_with_422(client):
    response = _upload(client, b"not a zip archive", "fake.xlsx")
    assert response.status_code == 422
    assert "not a valid .xlsx" in response.json()["detail"]


def test_import_rejects_non_utf8_csv_with_422(client):
    content = make_csv([import_row("e1", GOOD_RATINGS)]).decode("utf-8").encode("cp1251")
    response = _upload(client, content, "data.csv")
    assert response.status_code == 422
    assert "UTF-8" in response.json()["detail"]


def test_import_rejects_too_many_rows(client, monkeypatch):
    monkeypatch.setattr("app.services.importer.MAX_IMPORT_ROWS", 2)
    content = make_csv([import_row(f"e{i}", GOOD_RATINGS) for i in range(3)])
    response = _upload(client, content, "data.csv")
    assert response.status_code == 422
    assert "more than 2 data rows" in response.json()["detail"]
    # Nothing was inserted.
    assert client.get("/api/regions").json()["total"] == 0


def test_import_rejects_oversized_upload(client, monkeypatch):
    monkeypatch.setattr("app.routers.imports.MAX_UPLOAD_BYTES", 64)
    content = make_csv([import_row("e1", GOOD_RATINGS)])
    assert len(content) > 64
    response = _upload(client, content, "data.csv")
    assert response.status_code == 413
    assert "exceeds" in response.json()["detail"]


def test_demo_import_seeds_three_regions_and_is_idempotent(client):
    response = client.post("/api/import/demo")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["imported"] == 327
    assert body["skipped"] == 0
    assert body["errors"] == []

    regions = {region["name_uk"]: region for region in body["created_regions"]}
    assert regions["Закарпатська область"]["xi"] == 0.85
    assert regions["Закарпатська область"]["delta_level"] == "D5"
    assert regions["Івано-Франківська область"]["xi"] == 0.78
    assert regions["Івано-Франківська область"]["delta_level"] == "D4"
    assert regions["Львівська область"]["xi"] == 0.88
    assert regions["Львівська область"]["delta_level"] == "D4"
    # Article counts: 209 Zakarpattia / 41 Ivano-Frankivsk / 77 Lviv.
    assert regions["Закарпатська область"]["respondent_count"] == 209
    assert regions["Івано-Франківська область"]["respondent_count"] == 41
    assert regions["Львівська область"]["respondent_count"] == 77

    second = client.post("/api/import/demo")
    assert second.status_code == 409
    assert "already imported" in second.json()["detail"]

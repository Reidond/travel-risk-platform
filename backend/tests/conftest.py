"""Shared fixtures: per-test SQLite database + TestClient with lifespan."""

import csv
import io
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.factory import create_app

#: Flat criterion codes in group order (K1..K17 of the demo file map here).
CRITERIA_CODES = [
    "K11", "K12", "K13", "K14", "K15",
    "K21", "K22", "K23", "K24", "K25", "K26", "K27",
    "K31", "K32", "K33", "K34", "K35",
]  # fmt: skip

#: Header row matching «Експертне оцінювання.xlsx».
IMPORT_HEADER = [
    "id",
    "Рік відпустки (перебування): ",
    "Місяць відпустки (перебування): ",
    "Відвідуваний район: ",
    "Тип розміщення: ",
    *[f"K{i}" for i in range(1, 18)],
    "U",
    "м",
]

# MATH_SPEC §2.2 control respondents (article Table 1), grouped G1 + G2 + G3.
E1 = [5, 5, 1, 1, 1] + [1] * 7 + [2, 2, 2, 1, 1]
E210 = [4, 2, 2, 2, 2] + [2, 2, 3, 2, 3, 2, 1] + [2, 3, 3, 4, 5]  # noqa: RUF005
E251 = [1, 1, 2, 1, 2] + [1, 1, 2, 1, 2, 3, 3] + [1, 2, 4, 2, 3]  # noqa: RUF005


def ratings_map(flat: list[int]) -> dict[str, int]:
    return dict(zip(CRITERIA_CODES, flat, strict=True))


def make_xlsx(rows: list[list[object]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(IMPORT_HEADER)
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def make_csv(rows: list[list[object]]) -> bytes:
    text = io.StringIO()
    writer = csv.writer(text)
    writer.writerow(IMPORT_HEADER)
    for row in rows:
        writer.writerow(["" if cell is None else cell for cell in row])
    return text.getvalue().encode("utf-8")


def import_row(
    ext_id: str,
    ratings: list[int | None | str],
    rayon: str = "Ужгородський (Закарпатська область)",
    year: str = "2023 рік",
    month: str = "Липень",
    accommodation: str = "Готель",
) -> list[object]:
    return [ext_id, year, month, rayon, accommodation, *ratings, 60, 0.5]


def create_control_region(client: TestClient) -> int:
    """Region with the article's DM inputs + the three control respondents."""
    region = client.post(
        "/api/regions",
        json={
            "name_uk": "Контрольний регіон",
            "name_en": "Control region",
            "xi": 0.85,
            "delta_level": "D5",
        },
    ).json()
    for ext_id, flat in [("e1", E1), ("e210", E210), ("e251", E251)]:
        response = client.post(
            f"/api/regions/{region['id']}/respondents",
            json={"ext_id": ext_id, "ratings": ratings_map(flat)},
        )
        assert response.status_code == 201, response.text
    return region["id"]


@pytest.fixture
def client(tmp_path) -> Iterator[TestClient]:
    app = create_app(f"sqlite:///{tmp_path / 'test.db'}")
    with TestClient(app) as test_client:
        yield test_client

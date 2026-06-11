"""Regression pins for the full 327-respondent dataset (plan stage 2).

Reuses the parser from ``core/scripts/verify_dataset.py`` so that the test
and the verification report can never diverge. Skipped automatically when
the survey file (``docs/Експертне оцінювання.xlsx``) is not present — e.g.
in the published sdist or on CI without the private dataset.

Pinned values come from the verification run documented in
``.specs/plan-implementation/dataset-verification.md``. They are regression
pins of *our* pipeline on the real dataset — NOT the article's published
illustrative values (see documented discrepancy #3 in MATH_SPEC §5).
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest

from tourism_risk import DEFAULT_CONFIG, RiskClass, evaluate_region

_REPO_ROOT = Path(__file__).resolve().parents[2]
DATASET_PATH = _REPO_ROOT / "docs" / "Експертне оцінювання.xlsx"
_SCRIPT_PATH = _REPO_ROOT / "core" / "scripts" / "verify_dataset.py"

requires_dataset = pytest.mark.skipif(
    not DATASET_PATH.exists() or not _SCRIPT_PATH.exists(),
    reason="full survey dataset (or verification script) not available",
)

#: (region code, oblast, n, Xi, Delta level, pinned delta, pinned mu_R).
EXPECTED_REGIONS: tuple[tuple[str, str, int, float, int, float, float], ...] = (
    ("R1", "Закарпатська", 209, 0.85, 5, 28.2057, 0.98875),
    ("R2", "Івано-Франківська", 41, 0.78, 4, 32.8049, 0.834112),
    ("R3", "Львівська", 77, 0.88, 4, 30.5195, 0.876992),
)


def _load_verify_module() -> ModuleType:
    spec = importlib.util.spec_from_file_location("verify_dataset", _SCRIPT_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("verify_dataset", module)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def parsed_dataset() -> tuple[list[object], list[str]]:
    module = _load_verify_module()
    return module.parse_rows(DATASET_PATH)


@requires_dataset
def test_all_rows_validate(parsed_dataset: tuple[list[object], list[str]]) -> None:
    rows, anomalies = parsed_dataset
    assert anomalies == []
    assert len(rows) == 327


@requires_dataset
def test_region_counts(parsed_dataset: tuple[list[object], list[str]]) -> None:
    rows, _ = parsed_dataset
    counts: dict[str, int] = {}
    for row in rows:
        counts[row.oblast] = counts.get(row.oblast, 0) + 1
    expected = {oblast: n for _, oblast, n, *_ in EXPECTED_REGIONS}
    assert counts == expected


@requires_dataset
@pytest.mark.parametrize(
    ("oblast", "n", "xi", "delta_level", "pinned_delta", "pinned_mu"),
    [spec[1:] for spec in EXPECTED_REGIONS],
    ids=[spec[0] for spec in EXPECTED_REGIONS],
)
def test_region_pipeline_pins(
    parsed_dataset: tuple[list[object], list[str]],
    oblast: str,
    n: int,
    xi: float,
    delta_level: int,
    pinned_delta: float,
    pinned_mu: float,
) -> None:
    rows, _ = parsed_dataset
    ratings = [row.ratings for row in rows if row.oblast == oblast]
    assert len(ratings) == n
    result = evaluate_region(ratings, xi=xi, delta_level=delta_level, config=DEFAULT_CONFIG)
    assert result.delta == pytest.approx(pinned_delta, abs=0.01)
    # Real-dataset behaviour predicted by MATH_SPEC §5: delta well below the
    # Z-spline shoulder a=60, hence phi = 1 and a very-low-risk classification.
    assert result.phi == pytest.approx(1.0, abs=1e-12)
    assert result.mu == pytest.approx(pinned_mu, abs=0.01)
    assert result.risk_class is RiskClass.R5

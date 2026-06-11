"""Shared fixtures: the three control respondents from the article (Table 1)."""

from __future__ import annotations

import pytest

# Control respondents from the mathematical specification section 2.2
# (article Table 1 — synthetic example data). Flat order: G1 (5), G2 (7), G3 (5).
E1_RATINGS = [5, 5, 1, 1, 1, *([1] * 7), 2, 2, 2, 1, 1]
E210_RATINGS = [4, 2, 2, 2, 2, 2, 2, 3, 2, 3, 2, 1, 2, 3, 3, 4, 5]
E251_RATINGS = [1, 1, 2, 1, 2, 1, 1, 2, 1, 2, 3, 3, 1, 2, 4, 2, 3]


@pytest.fixture
def control_ratings() -> dict[str, list[int]]:
    return {"e1": E1_RATINGS, "e210": E210_RATINGS, "e251": E251_RATINGS}

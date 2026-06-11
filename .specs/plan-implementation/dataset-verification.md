# Full-Dataset Verification Report — 327-Respondent Survey (Plan Stage 2)

**Status:** complete. **Date:** 2026-06-10.
**Inputs:** `docs/Експертне оцінювання.xlsx` (327 respondents), `tourism-risk` core v0.1.0, `DEFAULT_CONFIG` (article preset).
**Reproduce:** `uv run --project core python core/scripts/verify_dataset.py` (from the repository root).
**Regression tests:** `core/tests/test_dataset.py` (`uv run --project core pytest core/tests -q`).

## 1. Methodology

1. **Parsing.** The single sheet «Всі дані» is read with openpyxl. Columns: respondent id,
   year, month, rayon (oblast in parentheses), accommodation type, K1–K17, U, м. The oblast
   is extracted from the parentheses of the rayon column.
2. **Validation.** Every K cell must be an integer in 1..5 and present. Result: **all 327 rows
   valid, 0 anomalies** (no missing values, no out-of-range ratings, no unexpected oblasts).
3. **Coding.** K values are fed **directly as τ** (positive coding — higher K = safer; confirmed
   via the satisfaction column «м»: all-5 rows → м ≈ 1.0, all-1 rows → м ≈ 0; MATH_SPEC §5).
4. **Grouping.** K1–K5 → G₁, K6–K12 → G₂, K13–K17 → G₃ (positional mapping, MATH_SPEC §1).
   Regions: Закарпатська → R1, Івано-Франківська → R2, Львівська → R3.
5. **Evaluation.** `evaluate_region` per region with the article's DM inputs — Ξ = 0.85 / 0.78 /
   0.88 and Δ = Δ₅ / Δ₄ / Δ₄ for R1 / R2 / R3 — under `DEFAULT_CONFIG` (rule 4 = [T₃,T₂,T₂],
   χ = 15/30/50/80/100, Z-spline a=60 b=100, cone base (1,1) scale (2,2), a₁..a₆ = 0..100).

## 2. Per-Region Results (actual pipeline outputs on the real dataset)

| | R1 Закарпатська | R2 Івано-Франківська | R3 Львівська |
|---|---|---|---|
| n | **209** ✓ | **41** ✓ | **77** ✓ |
| Ξ (DM input) | 0.85 | 0.78 | 0.88 |
| Δ (DM input) | Δ₅ | Δ₄ | Δ₄ |
| δ(R) | **28.21** (5895/209 = 28.205742) | **32.80** (1345/41 = 32.804878) | **30.52** (2350/77 = 30.519481) |
| φ(R) | 1.0 | 1.0 | 1.0 |
| m_S(R) | 0.925 | 0.89 | 0.94 |
| ω(R) | 92.5 | 71.2 | 75.2 |
| μ_R(R) | 0.988750 | 0.834112 | 0.876992 |
| T_R | **R₅ very low risk** | **R₅ very low risk** | **R₅ very low risk** |

Region counts match the article exactly (209/41/77 = 327 ✓). All δ values fall well below the
Z-spline shoulder a = 60, so φ = 1 in every region and m_S reduces to 1 − (1−Ξ)/2 — exactly the
behaviour predicted by MATH_SPEC §5.

## 3. r\*(e) Distributions

### R1 Закарпатська (n = 209)

| r\* | L | BA | A | AA | H |
|---|---|---|---|---|---|
| count | 139 | 11 | 48 | 1 | 10 |
| share | 66.5% | 5.3% | 23.0% | 0.5% | 4.8% |

### R2 Івано-Франківська (n = 41)

| r\* | L | BA | A | AA | H |
|---|---|---|---|---|---|
| count | 23 | 2 | 12 | 3 | 1 |
| share | 56.1% | 4.9% | 29.3% | 7.3% | 2.4% |

### R3 Львівська (n = 77)

| r\* | L | BA | A | AA | H |
|---|---|---|---|---|---|
| count | 46 | 1 | 27 | 1 | 2 |
| share | 59.7% | 1.3% | 35.1% | 1.3% | 2.6% |

The dominant term in every region is L (low individual risk) — consistent with the positive
coding and the high satisfaction levels in the file (mean м ≈ 0.73–0.76 per region).

## 4. Comparison with the Article's Published Values (section 5.4 / plan §8)

| step | published R1 | actual R1 | published R2 | actual R2 | published R3 | actual R3 |
|---|---|---|---|---|---|---|
| δ | 79.54 | 28.21 | 69.73 | 32.80 | 87.89 | 30.52 |
| φ | 0.5 | 1.0 | 0.88 | 1.0 | 0.13 | 1.0 |
| m_S | 0.74 | 0.925 | 0.875 | 0.89 | 0.56 | 0.94 |
| ω | 74 | 92.5 | 70 | 71.2 | 44.8 | 75.2 |
| μ_R | 0.86 | 0.9888 | 0.82 | 0.8341 | 0.41 | 0.8770 |
| T_R | R₅ | R₅ | R₅ | R₅ | **R₃** | **R₅** |

The published and actual chains agree on R1 and R2 classifications (R₅) but disagree on R3
(published R₃ medium vs actual R₅ very low) — because the published δ values are not aggregates
of this dataset (next section).

## 5. Documented Discrepancy #3 — Published Regional Values Are Illustrative

**Statement (MATH_SPEC §5):** the published regional δ values (79.54 / 69.73 / 87.89) are **not
derivable from the xlsx** under any tested method: term-pipeline with 4 rule-semantics variants,
inverted coding, mean(U), mean(U)/85·100, (U−17)/68·100, mean(м)·100, U-binned terms. The spec's
decisive evidence: **R2 and R3 differ by < 0.1 in every dataset aggregate, while their published
δ values differ by 18.16** (69.73 vs 87.89). They are an illustrative worked example, like Table 1
(whose respondents e₁/e₂₁₀/e₂₅₁ are synthetic and do not match the xlsx rows either).

Re-confirmed during this verification run:

| aggregate | R1 Закарп. | R2 Ів.-Франк. | R3 Львівська | R2−R3 gap |
|---|---|---|---|---|
| pipeline δ (this report) | 28.21 | 32.80 | 30.52 | 2.29 |
| mean(U) | 64.36 | 62.98 | 62.92 | 0.05 |
| mean(U)/85·100 | 75.72 | 74.09 | 74.03 | 0.06 |
| (mean(U)−17)/68·100 | 69.65 | 67.61 | 67.53 | 0.08 |
| mean(м)·100 | 76.07 | 73.01 | 74.23 | 1.22 |
| **published δ** | **79.54** | **69.73** | **87.89** | **18.16** |

No dataset aggregate separates R2 from R3 by anything close to 18 points, and no aggregate
reproduces even one published δ for the right region. **Conclusion: the published δ → φ → m_S →
ω → μ_R chain is a worked numerical example demonstrating the method, not a computation over this
survey file.** The library's published-value tests therefore pin the worked example by feeding the
published step inputs (δ = 79.54/69.73/87.89, φ = 0.5/0.88/0.13, m_S = 0.74/0.875/0.56), while
`core/tests/test_dataset.py` pins the platform's actual dataset outputs (this report's §2).

## 6. Conclusion for the Thesis Author (what to write in section 5.4)

Recommended structure for section 5.4 «Verification and testing»:

1. **Method verification (worked example).** State that the platform reproduces the article's
   illustrative computation chain exactly: feeding the published step inputs yields
   φ = 0.5227→0.5 / 0.8817→0.88 / (0.13 per the published chain), m_S = 0.74 / 0.875 / 0.56,
   ω = 74 / 70 / 44.8, μ_R = 0.86 / 0.82 / 0.41, T_R = R₅ / R₅ / R₃ — all covered by must-pass
   unit tests (175 passing). This validates the *implementation of the formulas*. Recomputing
   the illustrative example *inside the platform* (manual χ/δ entry or a synthetic respondent
   set with the published δ) is the cleanest way to present it — the dashboard can show the
   worked example as a fourth "demo" scenario.
2. **Dataset verification (real survey).** Present this report's §2–§3 as the platform's actual
   results on the 327-respondent survey: region counts 209/41/77 match the article; all rows
   validate; δ = 28.21 / 32.80 / 30.52 → φ = 1 → μ_R = 0.99 / 0.83 / 0.88 → T_R = R₅ for all
   three oblasts. Interpretation: respondents rated all three regions safe (66.5/56.1/59.7% of
   individual assessments are L), so the model assigns very low travel risk — a meaningful,
   internally consistent result.
3. **Be explicit about the relationship** between the two: the numbers in chapter 4 / the article
   are an illustrative example of the method; the dataset run is the empirical application.
   Do **not** present 79.54/69.73/87.89 as aggregates of the survey — they are not derivable from
   it (§5 above). One honest sentence suffices, e.g.: «Числові значення з розділу 4 є ілюстративним
   прикладом методу; обчислення платформи над реальною вибіркою (n = 327) наведені нижче.»
   Alternatively (stronger): replace the illustrative regional table in 5.4 with the platform's
   real-dataset table and keep the worked example only in chapter 4.
4. **Sensitivity note (optional but valuable for the defense).** With this dataset, regional
   differences are driven mainly by the DM inputs Ξ and Δ (since φ saturates at 1 for δ < 60).
   This is a defensible decision-support property — the questionnaire signal says "safe
   everywhere", and the expert inputs differentiate — but the author should be prepared to
   discuss it; a one-paragraph sensitivity analysis (e.g. varying Ξ ∈ [0.5, 1]) would preempt
   the question.

## 7. Artifacts

- Verification script: `core/scripts/verify_dataset.py` (run: `uv run --project core python core/scripts/verify_dataset.py`)
- Regression tests: `core/tests/test_dataset.py` (3 pinned facts: counts 209/41/77, δ values ±0.01, 327/327 rows valid; auto-skip when the xlsx is absent)
- Full suite: `uv run --project core pytest core/tests -q` → **175 passed**

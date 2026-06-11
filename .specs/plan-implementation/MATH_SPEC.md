# Mathematical Specification — Tourism Travel Safety Risk Assessment Core

**Source of truth** for implementing the computational core (`tourism-risk` library).
Derived from chapter 4 of the thesis (Шафар_PhD.docx) = article (Шафар_фін.docx), eq. (1)–(9),
cross-validated against the published control values and the 327-respondent dataset
(«Експертне оцінювання.xlsx»). All constants below are **configurable defaults**, never hard-coded.

## 0. Pipeline overview

```
T₅(R, E, Ξ, Δ, M_I, M_R1, M_R2, M_R3) → Y(f₅) = {μ_R, T_R}
```

Per respondent e: linguistic ratings l₁–l₅ on 17 criteria (3 groups) → [M_I] group sums θ_g →
[M_R1] group terms T_g → aggregated individual risk term r*(e) ∈ {L, BA, A, AA, H} →
[M_R2] χ(e) percentage → regional mean δ(R) → Z-spline φ(R) → cone MF with Ξ(R) → m_S(R) →
[M_R3] fuzzification with expert Δ(R) → ω(R) → S-shaped MF → μ_R(R) → thresholds → T_R ∈ {R₁…R₅}.

## 1. M_I — information module (eq. 2)

- Linguistic scale: l₁ "Зовсім не погоджуюсь" … l₅ "Цілком погоджуюсь"; numeric mapping τ(l_k) = k (1–5).
- Default criteria groups (open/extensible):
  - G₁ infrastructure safety: K₁₁–K₁₅ (m₁ = 5 criteria)
  - G₂ social & ecological safety: K₂₁–K₂₇ (m₂ = 7)
  - G₃ medical safety: K₃₁–K₃₅ (m₃ = 5)
- Group sum per respondent: **θ_g = Σᵢ τ_gi**, i = 1..m_g.

The flat columns K1–K17 of the demo dataset map positionally: K1–K5 → G₁, K6–K12 → G₂, K13–K17 → G₃.

## 2. M_R1 — individual level (eq. 3, 4)

### 2.1 Characteristic function → group term (eq. 3)

T_g (index k = 1..5) from θ_g, with boundaries as multiples of group size m_g:

| term | condition (default multipliers 1,2,3,4) |
|---|---|
| T₁ | θ_g < m_g |
| T₂ | m_g ≤ θ_g < 2·m_g |
| T₃ | 2·m_g ≤ θ_g < 3·m_g |
| T₄ | 3·m_g ≤ θ_g < 4·m_g |
| T₅ | θ_g ≥ 4·m_g |

NOTE (quirk, by design of the source): θ_g ≥ m_g always (each τ ≥ 1), so **T₁ is unreachable**
with default multipliers. Verified against the article's own example: e₁ G₂ all-l₁ → θ=7=m₂ → T₂. Keep as-is.
Boundary θ = 4·m_g (e.g. all-l₄ answers) → T₅ per the strict inequalities above.

### 2.2 Aggregation rules → r*(e) (eq. 4)

Output term-set R = {L, BA, A, AA, H} (low → high risk).

**Rule semantics (DECISION, validated against control values):** each rule has a *pattern* — a
multiset of minimum term levels (slots). A rule fires iff the respondent's group terms can be
assigned **injectively** to slots, each group's term **≥** its slot level ("не нижче" = at least).
Rules are evaluated **top-down, first match wins**; final rule is the default (H).

Default preset (3 groups):

| # | pattern (slots) | output |
|---|---|---|
| 1 | [T₅, T₄, T₄] | L |
| 2 | [T₅, T₄, T₃] | BA |
| 3 | [T₄, T₃, T₂] | A |
| 4 | [T₃, T₂, T₂] | AA |
| 5 | default (else) | H |

⚠ **Documented discrepancy #1:** the article's prose for rule 4 says "2 із термом T₃ та 1 із T₂"
(= [T₃,T₃,T₂]), but the article's own worked example requires [T₃,T₂,T₂]:
e₁ terms (T₃,T₂,T₂) → published r*(e₁) = AA. The control values (plan §8) are authoritative →
default preset uses **[T₃,T₂,T₂]**. The rule editor lets the DM restore the prose variant.

**Control values (must-pass unit tests, from article Table 1 — synthetic example data, NOT xlsx rows):**

| resp. | G₁ ratings | G₂ ratings | G₃ ratings | θ | terms | r* |
|---|---|---|---|---|---|---|
| e₁ | l₅,l₅,l₁,l₁,l₁ | l₁×7 | l₂,l₂,l₂,l₁,l₁ | (13, 7, 8) | (T₃,T₂,T₂) | **AA** |
| e₂₁₀ | l₄,l₂,l₂,l₂,l₂ | l₂,l₂,l₃,l₂,l₃,l₂,l₁ | l₂,l₃,l₃,l₄,l₅ | (12, 15, 17) | (T₃,T₃,T₄) | **A** |
| e₂₅₁ | l₁,l₁,l₂,l₁,l₂ | l₁,l₁,l₂,l₁,l₂,l₃,l₃ | l₁,l₂,l₄,l₂,l₃ | (7, 13, 12) | (T₂,T₂,T₃) | **AA** |

## 3. M_R2 — regional level (eq. 5, 6, 7)

### 3.1 Percentage scale χ and regional mean δ (eq. 5)

Default χ mapping (configurable, plan §2 item 4): L→15, BA→30, A→50, AA→80, H→100.
**δ(R) = (1/n) Σⱼ χ(eⱼ)** — equal weights by default; optional per-respondent weights (weighted mean).

### 3.2 Quadratic Z-spline (eq. 6), parameters a=60, b=100 (configurable)

```
φ(δ) = 1                          if δ ≤ a
     = 1 − (δ−a)²/(2·((b−a)/2)²)  if a < δ ≤ (a+b)/2     [denominator = 800 for a=60,b=100]
     = (b−δ)²/(2·((b−a)/2)²)      if (a+b)/2 < δ < b
     = 0                          if δ ≥ b
```

Oracle: φ(69.73) = 0.8816589; φ(79.54) = 0.5227355; φ(87.89) = 0.1833151; φ(89.78) = 0.1305605.

⚠ **Documented discrepancy #2:** article publishes φ(R₁)=0.5 for δ=79.54 (exact: 0.5227 — author
rounded to 1 d.p. and carried 0.5 forward), and φ(R₃)=0.13 for δ=87.89 (exact: 0.1833; 0.13 matches
δ=89.78 — digit transposition in the published δ). Downstream published values use φ = 0.5 / 0.88 / 0.13.
Tests must verify the formula against the *exact* oracle above AND reproduce the published chain by
feeding the published step inputs.

### 3.3 Cone-shaped membership function (eq. 7), base (1,1), scaling (2,2) — configurable

**m_S(R) = 1 − ½·√((φ(R)−1)² + (Ξ(R)−1)²)**, Ξ ∈ [0,1] entered manually by the DM.

Oracle (published φ, Ξ): m_S(0.5, 0.85) = 0.7389923 ≈ **0.74**; m_S(0.88, 0.78) = 0.8747004 ≈ **0.875**;
m_S(0.13, 0.88) = 0.5608815 ≈ **0.56**.

## 4. M_R3 — national level (eq. 8, 9)

Expert level Δ(R) ∈ {Δ₁..Δ₅} (manual DM entry). Interval boundaries a₁..a₆ default **[0, 20, 40, 60, 80, 100]**.

### 4.1 Fuzzification (eq. 8): **ω(R) = a_{k+1} · m_S(R)** when Δ(R) = Δ_k

(Δ₁→a₂=20, Δ₂→a₃=40, Δ₃→a₄=60, Δ₄→a₅=80, Δ₅→a₆=100.)

Oracle: ω(m_S=0.74, Δ₅) = 74; ω(0.875, Δ₄) = 70; ω(0.56, Δ₄) = 44.8.

### 4.2 S-shaped membership function (eq. 9) on [a₁, a₆]:

```
μ_R(ω) = 0                          if ω ≤ a₁
       = 2·((ω−a₁)/(a₆−a₁))²       if a₁ < ω ≤ (a₁+a₆)/2
       = 1 − 2·((a₆−ω)/(a₆−a₁))²   if (a₁+a₆)/2 < ω < a₆
       = 1                          if ω ≥ a₆
```

Oracle: μ_R(74) = 0.8648; μ_R(70) = 0.82; μ_R(44.8) = 0.401408.

### 4.3 Linguistic interpretation T_R (thresholds configurable)

[0, 0.2) → R₁ very high risk; [0.2, 0.4) → R₂ high; [0.4, 0.6) → R₃ medium;
[0.6, 0.8) → R₄ low; [0.8, 1] → R₅ very low.

Oracle: 0.8648 → R₅; 0.82 → R₅; 0.401408 → R₃ (published: 0.86→R₅, 0.82→R₅, 0.41→R₃ ✓).

## 5. Full-dataset verification (stage 2) — findings

The xlsx (327 rows: 209 Zakarpattia / 41 Ivano-Frankivsk / 77 Lviv ✓ matches article) is coded
**positively** (higher K = safer/more satisfied — confirmed by the satisfaction column "м":
all-5s → 1.0, all-1s → ~0). Feed K values directly as τ (no inversion); T₅-rich profiles → L (low risk) —
semantically consistent.

⚠ **Documented discrepancy #3:** the published regional δ values (79.54 / 69.73 / 87.89) are **not
derivable from this xlsx** under any tested method (term-pipeline with 4 rule-semantics variants,
inverted coding, mean(U), mean(U)/85·100, (U−17)/68·100, mean(м)·100, U-binned terms; R2 vs R3 differ
by <0.1 in every aggregate while published values differ by 18). They are illustrative, like Table 1.
The dataset verification report must state our pipeline's actual outputs and this finding; the
published-value tests cover the worked example, not the dataset aggregates.

Expected real-dataset behaviour (default preset): per-region δ ≈ 28–33 → φ = 1 → m_S = 1 − (1−Ξ)/2 →
high μ_R → R₅ for all three oblasts.

## 6. Numeric conventions

- All arithmetic in float64; no intermediate rounding inside the pipeline.
- Rounding only at presentation (default 2 d.p. for δ/ω, 2–4 d.p. for φ/m_S/μ_R) — configurable in reports.
- Published-value tests use abs tolerance 0.005 against the exact oracles above; the published rounded
  chain is reproduced by feeding published step inputs (φ=0.5/0.88/0.13, m_S=0.74/0.875/0.56).
- Validation: ratings ∈ {1..5} integers; group sizes ≥ 1; Ξ ∈ [0,1]; boundaries strictly increasing;
  rule patterns non-empty, pattern length ≤ number of groups; χ scale positive.

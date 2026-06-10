# Software Development Plan: Web Application "Intelligent Analytical Platform for Tourism Travel Safety Risk Assessment"

**Basis:** Chapter 4 of the PhD thesis (Шафар_PhD.docx) = the article Шафар_фін.docx
**Role in the thesis:** the developed software fills section 5.3 "Development of the software module" and feeds section 5.4 "Verification and testing"
**Format:** web application + public open-source library of the computational core
**Version:** 2.0 — updated based on agreements with the scientific supervisor on 10.06.2026 (sec. 9)

---

## 1. Purpose of the Software

Software implementation of the operator **T₅(R, E, Ξ, Δ, M_I, M_R1, M_R2, M_R3) → Y(f₅) = {μ_R, T_R}** — computing the quantitative (μ_R) and linguistic (T_R) assessment of tourism travel safety risk based on:

- questionnaire assessments by tourism participants (linguistic variables l₁–l₅ across 17 criteria in 3 groups G₁–G₃);
- the predicted level of repeat visits to the region Ξ ∈ [0;1];
- the expert level of safety of regional tourism systems Δ (terms Δ₁–Δ₅).

## 2. Functional Requirements

The system user is the **decision-maker (DM)/analyst only** (tourists do not fill in the questionnaire online; respondent data is imported in bulk).

1. **Data input:** import of respondent datasets from Excel/CSV (format of the file «Експертне оцінювання.xlsx»: e_i, region, accommodation type, K1–K17) + manual entry/editing of individual questionnaires by the analyst. Ξ and Δ for each region are **entered manually** by the DM.
2. **Arbitrary number of regions:** regions are created/deleted via the interface; the data of the 3 oblasts serves as the initial demonstration dataset.
3. **Computation** through the four modules (sec. 4 below) with intermediate results at every step.
4. **Parameter configuration** (chapter 4 requirement — adaptivity): composition of groups and criteria, the χ scale (15/30/50/80/100), Z-spline parameters, interval boundaries a₁–a₆, thresholds of the linguistic interpretation T_R.
5. **Editing of M_R1 aggregation rules via the interface** ("If–Then" rule builder with application priority). Phased implementation: first the fixed 5 rules from the article as the default preset, then the UI editor (agreed: "ideally editable, but fixed is acceptable").
6. **Decision support:** if the result does not satisfy the DM — return to parameter configuration and re-evaluation (the loop from fig. 4.1).
7. **Visualization:** region comparison dashboard, membership function plots, distribution of term assessments r*(e), color-coded risk scale R₁–R₅.
8. **Bilingual interface:** Ukrainian + English (i18n, language switcher; all terms and reports localized).
9. **Export of results** (PDF/Excel) — for the thesis appendices.
10. **Autonomy:** the platform does not depend on other modules of the chapter 5 system (T₁–T₄ are not implemented).

## 3. Architecture and Stack

```
┌────────────── Frontend: React + TypeScript ──────────────┐
│ Questionnaire │ Data import │ DM panel │ Dashboard │ Config │
└──────────────────────────┬────────────────────────────────┘
                      REST API (JSON)
┌──────────────────────────┴────────────────────────────────┐
│            Backend: Python 3.12 + FastAPI                 │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Computational core (separate package risk_core):    │ │
│  │  M_I → M_R1 → M_R2 → M_R3 → decision support module  │ │
│  └──────────────────────────────────────────────────────┘ │
│  Excel import (pandas/openpyxl) │ Report export           │
└──────────────────────────┬────────────────────────────────┘
                  DB: SQLite → PostgreSQL
     (regions, respondents, assessments, parameters, results)
```

- **Backend:** Python + FastAPI — the natural choice for fuzzy mathematics (NumPy), reading the real Excel data, auto-generated API docs (Swagger).
- **Frontend:** React + TypeScript, charts — Chart.js or Recharts; i18n — react-i18next (uk/en).
- **DB:** SQLite during development (zero configuration), PostgreSQL if needed.
- **Core as a public library** (supervisor's requirement): a standalone Python package, e.g. `tourism-risk` / `travel-risk-assess`, with no dependency on the web layer. Publication on **PyPI** + code on **GitHub** (MIT license, English README with formulas and examples, docstrings, citation link to the article — CITATION.cff file). The web application uses the library as a dependency — other researchers and managers can apply the module in their own computations without our UI.

### Demo Deployment

Docker (compose: api + frontend + DB) → free/cheap hosting for the online demo (Render / Railway / Fly.io / university VPS). A dedicated public URL for the defense and approbation.

## 4. Computational Core (Mapping to Chapter 4)

| Module | Section | Input | Computation | Output |
|---|---|---|---|---|
| **M_I** — information module | 4.2 | Questionnaires: l₁–l₅ for K₁₁–K₃₅ (G₁: 5, G₂: 7, G₃: 5 criteria) | Mapping l→τ (1–5); sum θ_g = Στ_gi (eq. 4.2) | θ_g per group |
| **M_R1** — individual level | 4.3 | θ_g | Characteristic function → term assessment T_g (eq. 4.3); "If–Then" rules → aggregated assessment r*(e) ∈ {L, BA, A, AA, H} (eq. 4.4) | r*(e) for each tourist |
| **M_R2** — regional level | 4.3 | r*(e₁)…r*(eₙ), Ξ(R) | χ(e): L→15, BA→30, A→50, AA→80, H→100; δ(R) = mean (eq. 4.5); Z-spline → φ(R) (eq. 4.6); cone-shaped MF → m_S(R) (eq. 4.7) | m_S(R) — regional feeling-of-safety level |
| **M_R3** — national level | 4.4 | m_S(R), Δ(R) | Fuzzification: ω(R) = a_k·m_S(R) (eq. 4.8); S-shaped MF → μ_R(R) (eq. 4.9); interpretation → T_R ∈ {R₁…R₅} | μ_R(R) + linguistic assessment T_R |
| **Decision support module** | 4.4 / fig. 4.1 | Y(f₅) | Region comparison; if unsatisfactory for the DM — parameter adjustment and recomputation | Report for the DM |

All constants (term boundaries, scales, spline coefficients) are configurable parameters, not hard-coded.

## 5. Data Model (Main Entities)

- **Region** — assessed region (name uk/en, Ξ, Δ); arbitrary count.
- **Respondent** — tourism participant (region, year/month, accommodation type).
- **Assessment** — respondent's ratings for K₁–K₁₇.
- **CriteriaGroup / Criterion** — directory of groups and criteria (open — extensible).
- **PlatformConfig** — versioned platform parameters (scales, intervals, thresholds).
- **RuleSet / Rule** — M_R1 aggregation rules (preset from the article + DM-editable, with priority and a default rule).
- **EvaluationRun** — computation result: δ, φ, Ξ, m_S, ω, μ_R, T_R + stored intermediate data.

## 6. Interface (Pages)

All pages are bilingual (uk/en); the user is the DM/analyst.

1. **Regions and data** — region creation, Excel import, viewing/filtering respondents, manual adding/editing of questionnaires.
2. **DM panel** — entering Ξ and Δ per region, launching the evaluation, viewing intermediate results per module.
3. **Dashboard** — region comparison, μ_R and T_R, MF plots, r*(e) distribution.
4. **Parameters** — editing the platform configuration (versioned) and the M_R1 aggregation rules ("If–Then" builder).

## 7. Development Stages

| Stage | Scope | Deliverable | Estimate |
|---|---|---|---|
| 1 | Core library: M_I, M_R1, M_R2, M_R3 + unit tests on the control example from the article; PyPI-ready package structure, English API | Tested package | 1–2 weeks |
| 2 | Core verification on the full dataset of 327 respondents (Excel) | Match with section 5.4 results | 0.5 week |
| 3 | Library publication: README (en) with formulas and examples, documentation, MIT license, CITATION.cff, GitHub + PyPI | Public library | 0.5–1 week |
| 4 | Backend: FastAPI (using the library), DB, Excel import, REST API | Working API (Swagger) | 1–2 weeks |
| 5 | Frontend: regions/data + DM panel + results, i18n uk/en | Working end-to-end scenario | 2 weeks |
| 6 | Dashboard, MF plots, parameter configuration, M_R1 rule editor, export | Full functionality | 1–2 weeks |
| 7 | Docker, online demo deployment, testing | Public demo URL | 0.5–1 week |
| 8 | Screenshots and write-up for sections 5.3–5.4, user manual (uk/en) | Thesis materials | 1 week |

Total ≈ 8–11 weeks. Stages 1–3 are the priority: a library with verified computations is a standalone scientific result that can be shown to the supervisor and cited before the web application is ready. The M_R1 rule editor (stage 6) is a candidate for simplification to fixed rules if time runs short (agreed with the supervisor).

## 8. Verification (Control Values from the Article / Section 5.4)

Core tests must reproduce the published example (R₁ — Zakarpattia, R₂ — Ivano-Frankivsk, R₃ — Lviv oblast):

- r*(e₁)=AA, r*(e₂₁₀)=A, r*(e₂₅₁)=AA;
- δ(R₁)=79.54; δ(R₂)=69.73; δ(R₃)=87.89;
- φ(R₁)=0.5; φ(R₂)=0.88; φ(R₃)=0.13;
- m_S(R₁)=0.74; m_S(R₂)=0.875; m_S(R₃)=0.56;
- ω(R₁)=74; ω(R₂)=70; ω(R₃)=44.8;
- μ_R(R₁)=0.86 (R₅ — very low risk); μ_R(R₂)=0.82 (R₅); μ_R(R₃)=0.41 (R₃ — medium risk).

## 9. Decisions Agreed with the Supervisor (10.06.2026)

1. User — **DM/analyst only** (no online tourist surveys).
2. **Arbitrary number of regions.**
3. M_R1 rules — ideally **editable via the interface**; fixed rules are an acceptable fallback.
4. Ξ — **entered manually**.
5. The platform is **autonomous** (no integration with T₁–T₄).
6. Interface — **Ukrainian + English**.
7. The computational core — a **public library** for other researchers/managers; the web demo — **deployed online**.

## 10. Project Risks

- **Ambiguities in the formulas** (chapter 4 contains duplicated notation T/Δ, O_i/ω) — resolved by the control example in sec. 8.
- **Completeness of M_R1 rules:** the 5 rules may not cover all combinations of term assessments — a rule application order is needed (top-down, first match wins) + a default rule (H).
- **Excel data quality** — import validation required (missing values, 1–5 range checks).

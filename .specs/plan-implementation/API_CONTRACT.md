# API Contract + UI Specification — Travel Risk Platform Web Application

Contract between `backend/` (FastAPI) and `frontend/` (React). Both sides implement THIS document.
The computational semantics come from `.specs/plan-implementation/MATH_SPEC.md`; the product scope from
`docs/Software_Development_Plan.md` (user = DM/analyst only; arbitrary regions; bilingual uk/en).

## Conventions

- Base path **`/api`** (in dev, frontend proxies `/api` → `http://localhost:8000`; in Docker, nginx does).
- JSON everywhere except file upload (multipart) and export downloads.
- Errors: FastAPI standard `{"detail": ...}`; validation 422; not-found 404; conflict 409.
- Lists return `{"items": [...], "total": <int>}`; paging via `?offset=0&limit=50`.
- Bilingual entity fields: `name_uk`, `name_en`. Enum/term labels are translated client-side.
- Respondent ratings are a **map keyed by criterion code**: `{"K11": 4, ..., "K35": 2}` — codes come from
  the criteria configuration (survives group/criteria editing).
- Linguistic values: rating ints 1–5 (= l₁..l₅); `r_star` ∈ `"L"|"BA"|"A"|"AA"|"H"`;
  `delta_level` ∈ `"D1".."D5"` (= Δ₁..Δ₅); `risk_class` ∈ `"R1".."R5"`.

## Endpoints

### Health & meta
- `GET /api/health` → `{"status": "ok"}`
- `GET /api/meta` → `{"app_version", "core_version"}` (core_version = tourism-risk package version)

### Regions
- `GET /api/regions` → items: `{id, name_uk, name_en, xi, delta_level, respondent_count, latest_result: {mu, risk_class, evaluated_at} | null}`
- `POST /api/regions` `{name_uk, name_en, xi?, delta_level?}` → 201 region (xi/delta may be null until DM sets them)
- `GET /api/regions/{id}` / `PATCH /api/regions/{id}` (any of name_uk, name_en, xi ∈ [0,1], delta_level) / `DELETE /api/regions/{id}` (cascades respondents; 204)

### Respondents (questionnaires)
- `GET /api/regions/{id}/respondents?offset&limit&year&month&accommodation` → items: `{id, ext_id, year, month, accommodation, ratings}`
- `POST /api/regions/{id}/respondents` `{ext_id?, year?, month?, accommodation?, ratings}` → 201. Ratings must cover exactly the active criteria codes, ints 1–5.
- `year`/`month`/`accommodation` are **free-text strings** (imported questionnaires hold values like «2021 рік», «Липень»); the year/month/accommodation filters are exact string matches on those values.
- `PATCH /api/respondents/{id}` / `DELETE /api/respondents/{id}`

### Import (Excel/CSV, format of «Експертне оцінювання.xlsx»)
- `POST /api/import` — multipart: `file` (.xlsx or .csv); optional form field `region_id`.
  Expected columns: respondent id, «Рік …», «Місяць …», «Відвідуваний район:» (oblast in parentheses), «Тип розміщення:», K1..K17 (positionally mapped to active criteria codes). Extra columns ignored.
  If `region_id` given → all rows go there. Else rows are grouped by the oblast extracted from the rayon column; missing regions are auto-created (name_uk = oblast, name_en = transliteration, xi/delta null).
  → `{"imported": n, "skipped": n, "created_regions": [region...], "errors": [{"row": i, "message": str}]}` (row-level validation: ratings present and 1–5; bad rows skipped, never abort the whole file).
  File-level validation: corrupt/non-xlsx workbook or non-UTF-8 CSV → 422 with a clear detail; uploads over 10 MiB → 413; more than 10 000 data rows → 422 (DoS guards).
- `POST /api/import/demo` → seeds the bundled 327-respondent demo dataset; creates the 3 oblast regions with the article's values (Закарпатська: xi 0.85, D5; Івано-Франківська: xi 0.78, D4; Львівська: xi 0.88, D4). Idempotent: 409 if any of those regions already has respondents.

### Criteria configuration
- `GET /api/criteria` → `{groups: [{id, code: "G1", name_uk, name_en, criteria: [{code: "K11", text_uk, text_en}]}]}`
- `PUT /api/criteria` (full replacement) — allowed only when it keeps codes of existing respondents' ratings valid OR no respondents exist; otherwise 409 with explanation. Label-only edits always allowed.

### Platform configuration (versioned — plan §2 item 4)
- `GET /api/config` → active version:
  ```json
  {"version": 3, "created_at": "...", "active": true, "comment": "...",
   "params": {
     "term_multipliers": [1,2,3,4],
     "chi_scale": {"L":15,"BA":30,"A":50,"AA":80,"H":100},
     "z_spline": {"a": 60, "b": 100},
     "cone": {"base": [1,1], "scale": [2,2]},
     "fuzzification_boundaries": [0,20,40,60,80,100],
     "risk_thresholds": [0.2,0.4,0.6,0.8]
  }}
  ```
- `GET /api/config/versions` → list (all versions, newest first)
- `POST /api/config` `{params, comment?}` → creates new active version (validation per MATH_SPEC §6)
- `POST /api/config/versions/{v}/activate` → switch active
- `GET /api/config/curves?version=` → plot data sampled from the **core library** (single source of math truth):
  `{"z_spline": [[delta, phi], ... 201 pts over [0,110]], "s_shape": [[omega, mu], ... 201 pts over [a1,a6]], "cone": {"xi_fixed": [[phi, m_s] ... for xi=1], "phi_fixed": [[xi, m_s] ... for phi=1]}}`

### Rule sets (M_R1 — versioned, DM-editable If–Then builder)
- `GET /api/rulesets` → `{items: [{version, active, created_at, comment, rules: [{pattern: [5,4,4], output: "L"}...], default_output: "H"}]}`
- `GET /api/rulesets/active`
- `POST /api/rulesets` `{rules, default_output, comment?}` → new active version. Validation: 1–10 rules, pattern lengths 1..(number of groups), levels 1–5, outputs valid terms.
- `POST /api/rulesets/reset-default` → new version = article preset (MATH_SPEC §2.2).

### Evaluation (the T₅ operator run)
- `POST /api/evaluations` `{region_ids: [..] | null (= all), comment?}` — uses ACTIVE config + ruleset; all listed regions must have xi and delta_level set and ≥1 respondent, else 409 listing the offenders. Regions over 10 000 respondents → 422 (memory guard: individuals persist as one JSON blob). Synchronous. → 201:
  ```json
  {"id": 7, "created_at": "...", "comment": null,
   "config_snapshot": {<params>, "version": <config version>}, "ruleset_snapshot": {"version": n, <rules>},
   "results": [{
      "region": {"id":1,"name_uk":"...","name_en":"..."},
      "n": 209, "xi": 0.85, "delta_level": "D5",
      "delta": 28.21, "phi": 1.0, "m_s": 0.925, "omega": 92.5,
      "mu": 0.98875, "risk_class": "R5",
      "r_star_distribution": {"L": 120, "BA": 30, "A": 40, "AA": 10, "H": 9}
   }]}
  ```
- `GET /api/evaluations?offset&limit` → history (without individuals)
- `GET /api/evaluations/{id}` → full run as above
- `GET /api/evaluations/{id}/regions/{region_id}/individuals?offset&limit` → per-respondent intermediates: `{respondent_id, ext_id, theta: {"G1": 13,...}, terms: {"G1": 3,...}, r_star, chi}`
- `DELETE /api/evaluations/{id}` → 204
- `GET /api/evaluations/{id}/export?format=xlsx|pdf&lang=uk|en` → file download (Content-Disposition). xlsx: summary sheet + one sheet per region with individual intermediates. pdf: localized summary report (region comparison table, parameters used, T_R interpretations) using bundled DejaVu fonts (`backend/assets/fonts/`) for Cyrillic.

## Backend implementation notes

- FastAPI + SQLAlchemy 2.0 typed ORM, **SQLite** (`DATABASE_URL` env, default `sqlite:///./data/app.db`), tables auto-created on startup; pydantic v2 schemas; depends on the core library via uv workspace (`tourism-risk`).
- EvaluationRun persists config+ruleset snapshots and ALL results incl. per-individual intermediates (JSON columns are fine).
- Default criteria/config/ruleset seeded on first startup from the core library's `DEFAULT_CONFIG` (article preset, criteria texts uk from the article, en translations).
- Demo dataset bundled at `backend/assets/demo.xlsx` (copy of docs/Експертне оцінювання.xlsx).
- CORS: allow `http://localhost:5173` (dev).
- Tests: pytest + httpx TestClient on a tmp SQLite: CRUD, import (incl. bad rows), full evaluate flow against MATH_SPEC control values (create region + 3 control respondents → published r*), config/ruleset versioning, export smoke (files non-empty, xlsx parses).

## Frontend implementation notes

- Vite + React 19 + TypeScript (strict), react-router, @tanstack/react-query, react-i18next (uk default + en, language switcher in header, ALL strings via i18n incl. term/risk labels), Recharts for charts. No heavy UI kit — clean hand-rolled CSS (CSS variables, light theme), accessible (labels, keyboard nav, WCAG AA contrast).
- Risk color scale (used consistently): R1 `#c62828`, R2 `#ef6c00`, R3 `#f9a825`, R4 `#9ccc65`, R5 `#2e7d32`; r* terms L→H use green→red (L `#2e7d32`, BA `#9ccc65`, A `#f9a825`, AA `#ef6c00`, H `#c62828`).
- Pages (per plan §6):
  1. **/regions — Regions & data**: region cards/table (name, xi, Δ, respondent count, latest risk badge); create/edit/delete region (modal); Excel/CSV import (file input + optional target region + result report incl. row errors); "Load demo dataset" button; respondent table per selected region (filter by year/accommodation, paging) with add/edit/delete questionnaire modal (17 criterion sliders/selects 1–5 grouped by G1–G3 with localized criterion texts).
  2. **/panel — DM panel**: per-region Ξ input (0–1) and Δ select (Δ₁–Δ₅ with labels); validation badges (what's missing to evaluate); "Run evaluation" (all/selected regions); after run: per-module intermediate results (M_I→M_R1: r* distribution; M_R2: δ, φ, m_S; M_R3: ω, μ_R, T_R) shown step by step; link to dashboard. Decision-support loop: a "Not satisfied? Adjust parameters" callout linking to /parameters, then re-evaluate (fig. 4.1 loop).
  3. **/dashboard — Dashboard**: latest (or selected) evaluation run; region comparison table + horizontal μ_R bar chart with risk colors; color-coded risk scale legend R1–R5; r*(e) distribution per region (stacked/grouped bar); MF plots from `/api/config/curves` (Z-spline with each region's δ marked; S-shape with each region's ω marked); per-region drill-down (individual intermediates table, paged); export buttons (xlsx/pdf, current language).
  4. **/parameters — Parameters**: platform config editor (χ scale per term, Z-spline a/b, boundaries a₁–a₆ , risk thresholds, term multipliers) with validation + "save as new version" + version history with activate; **If–Then rule builder**: ordered rule rows ("IF at least ⟨count auto-grouped from pattern⟩ groups with term ≥ Tₖ … THEN r* = ⟨term⟩") with add/remove/reorder (priority = order), pattern slot editors, default-output select, reset-to-article-preset button; criteria editor (group/criterion labels uk/en; structural edit warning).
- Header: app title (localized), nav, language switcher (uk/en, persisted in localStorage).
- API client: typed fetch wrappers in `src/api/` mirroring this contract exactly.
- Quality gate: `npm run build` (tsc + vite) passes; `npm run lint` (eslint) clean.

## Docker (stage 7)

- `backend/Dockerfile`: uv-based (ghcr.io/astral-sh/uv image pattern), runs uvicorn on :8000; volume for SQLite at /app/data.
- `frontend/Dockerfile`: node build → nginx serving SPA on :80, proxying `/api` → `api:8000`.
- root `docker-compose.yml`: services `api`, `web` (ports 8080:80), named volume for DB.

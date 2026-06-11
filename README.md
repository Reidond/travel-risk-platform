# Travel Risk Platform

**Intelligent analytical platform for tourism travel safety risk assessment.**

A web application + open-source computational library implementing the fuzzy
multi-level risk model **T₅(R, E, Ξ, Δ, M_I, M_R1, M_R2, M_R3) → {μ_R, T_R}**:
respondents rate 17 safety criteria (groups G₁–G₃) on a five-point linguistic
scale; the platform aggregates them through four computation modules
(M_I → M_R1 → M_R2 → M_R3) together with the decision-maker's inputs — the
predicted level of repeat visits Ξ ∈ [0,1] and the expert safety level of the
regional tourism system Δ₁–Δ₅ — into a quantitative (μ_R) and linguistic
(T_R, classes R₁ "very high risk" … R₅ "very low risk") assessment per region.

The user is a decision-maker/analyst: import questionnaire datasets
(Excel/CSV), set Ξ/Δ per region, run evaluations, inspect every intermediate
step, tune the model parameters (χ scale, Z-spline, fuzzification boundaries,
If–Then rules), and export results (xlsx/pdf, uk/en).

**Українською:** інтелектуальна аналітична платформа оцінювання ризику безпеки
туристичної подорожі. Реалізує нечітку багаторівневу модель ризику: анкетні
оцінки учасників туристичної діяльності (17 критеріїв у 3 групах, шкала
l₁–l₅) агрегуються через модулі M_I → M_R1 → M_R2 → M_R3 разом із вхідними
даними ОПР (Ξ — прогнозований рівень повторних відвідувань, Δ — експертний
рівень безпеки регіональних туристичних систем) у кількісну (μ_R) та
лінгвістичну (T_R) оцінку ризику для кожного регіону. Інтерфейс двомовний
(українська/англійська).

## Monorepo layout

| Path | What it is |
|---|---|
| [`core/`](core/README.md) | **tourism-risk** — pure-Python (zero-dependency) computational core; uv workspace member, 175 tests |
| `backend/` | **travel-risk-api** — FastAPI + SQLAlchemy/SQLite REST API; uv workspace member, depends on `core/` |
| `frontend/` | Vite + React 19 + TypeScript SPA (react-query, react-i18next uk/en, Recharts) |
| `docs/` | Software development plan, thesis/article sources, the 327-respondent demo dataset |
| `.specs/plan-implementation/` | Authoritative specs: [API contract](.specs/plan-implementation/API_CONTRACT.md), [math spec](.specs/plan-implementation/MATH_SPEC.md), [dataset verification report](.specs/plan-implementation/dataset-verification.md) |

## Quickstart

### Docker (production-like, one command)

Requires Docker with Compose:

```sh
docker compose up -d --build
```

Open **http://localhost:8080** — nginx serves the SPA and proxies `/api` to
the backend. The SQLite database persists in the named volume `api-data`.
On the **Regions & data** page click "Load demo dataset" to import the bundled
327-respondent survey (3 oblasts with the article's Ξ/Δ values), then run an
evaluation from the **DM panel**.

Tear down (and delete data): `docker compose down -v`.

### Dev mode (uv + npm)

Requires [uv](https://docs.astral.sh/uv/) (manages Python itself; no pip/venv
needed) and Node.js ≥ 20.

```sh
# Terminal 1 — API on :8000 (SQLite at ./data/app.db by default)
uv run --project backend uvicorn app.main:app --reload --port 8000

# Terminal 2 — SPA on :5173 (dev server proxies /api → :8000)
cd frontend && npm install && npm run dev
```

## Deployment

The compose stack runs unchanged on any Docker host — e.g. Render, Railway,
Fly.io, or a plain VPS: build the two images from `docker-compose.yml`, expose
the `web` service, and mount a persistent volume at `/app/data` on the API
container so the SQLite database survives restarts (compose already declares
the `api-data` volume for this).

Public demo: _URL to be added once deployed._

## Tests & quality gates

```sh
uv run --project core pytest core/tests -q        # core: 175 tests
uv run --project backend pytest backend/tests -q  # backend: API + control-value tests
uvx ruff check core backend                       # lint (Python)
cd frontend && npm run build && npm run lint      # tsc + vite build, eslint
```

Verification anchors (see `.specs/plan-implementation/dataset-verification.md`):

- **Worked example (article Table 1):** the three control respondents yield
  r\* = AA / A / AA and the full δ → φ → m_S → ω → μ_R chain matches the
  published values — pinned by must-pass unit tests in both core and backend.
- **Real dataset (327 respondents):** region counts 209/41/77,
  δ = 28.21 / 32.80 / 30.52, μ_R = 0.989 / 0.834 / 0.877, T_R = R₅ for all
  three oblasts.

## Thesis context

This software accompanies a PhD thesis: the risk model is **chapter 4** (= the
2025 article, eq. 4.2–4.9); the platform itself fills **section 5.3**
("Development of the software module") and its verification feeds
**section 5.4** ("Verification and testing"). The computational core is
built as a standalone open-source library (PyPI publication pending) so researchers and tourism
managers can apply the model without the web layer — see
[`core/README.md`](core/README.md) and
[`docs/Software_Development_Plan.md`](docs/Software_Development_Plan.md).

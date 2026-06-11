# AGENTS.md

Project conventions and AI development workflows for travel-risk-platform.

## Conventions

- **Layout**: uv workspace monorepo — `core/` (public PyPI library `tourism-risk`, pure Python, ZERO runtime deps), `backend/` (FastAPI, depends on core via `{ workspace = true }`), `frontend/` (Vite + React 19 + TS strict). Root `pyproject.toml` is a virtual workspace root.
- **Source of truth**: computational semantics live in `.specs/plan-implementation/MATH_SPEC.md` (formulas, oracle values, documented discrepancies — control values beat article prose); the backend/frontend boundary lives in `.specs/plan-implementation/API_CONTRACT.md`. Update the spec/contract before changing behavior on either side.
- **Math stays in the core**: backend and frontend never reimplement formulas; plots sample `/api/config/curves`, which calls the core library.
- **Testing**: `uv run --project core pytest core/tests -q` (175), `uv run --project backend pytest backend/tests -q` (48); frontend gate is `npm run build && npm run lint`. Control-value tests (plan §8) are must-pass — never re-tune them toward the article prose.
- **i18n**: `frontend/src/i18n/uk.json` and `en.json` must keep identical key sets; every user-visible string goes through `t()`.
- **Deployment**: `docker compose up` (web :8080, api internal :8000, named volume for SQLite). Backend Docker build context is the repo root (workspace deps). SQLite is single-worker (WAL + busy_timeout configured).
- **Thesis figures**: regenerate with `uv run scripts/make_screenshots.py` after UI changes.

## Do not

- Start implementing bug fixes without presenting a brief plan first
- Modify AI prompt templates without running `/review-prompts`
- Add runtime dependencies to `core/` (it ships to PyPI as a zero-dependency library)
- Invert the survey ratings on import — the dataset is positively coded (higher K = safer; see `.ai/learnings.md`)
- Remove the import/export/evaluation resource caps or the xlsx-cell sanitization in `backend/` (demo-deployment hardening)
- Change PanelPage's evaluation flow, its `step-card` markup, or the run-button labels without updating `scripts/make_screenshots.py` in the same change (it clicks "Run all", confirms the AlertDialog, and waits for `.step-card`)
- Edit `frontend/src/i18n/*.json` from parallel subagents — pre-provision keys in the orchestrator and keep agent file ownership disjoint

## AI Development Workflows

Specs live under `.specs/<task-name>/`. Use `/spec-driven-dev` for new features and `/post-task-review` after implementation.

Project learnings accumulate in `.ai/learnings.md` via the `task-learnings` skill. Periodically consolidate with `/learning-consolidator`.

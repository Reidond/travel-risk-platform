# Project Learnings

Accumulated project-level knowledge discovered during task implementation, bug fixes, and development sessions. This file is the single source of truth for lessons learned.

**How entries are added:** The `task-learnings` skill automatically appends entries after each task completion. Entries are periodically consolidated (~weekly) by promoting knowledge into rules, skills, and conventions, then removing the source entries.

**How to use:** Consult this file before starting any task to avoid repeating past mistakes and to leverage known patterns.

---

## Architecture Decisions

### [2026-06-11] MATH_SPEC.md is the single source of truth for all computational semantics
- **Context**: Implementing the full Software Development Plan; chapter-4 formulas had ambiguities (rule semantics, boundary directions, rounding) that the plan itself flagged.
- **Finding**: Pinning every formula, default, oracle value, and discrepancy in `.specs/plan-implementation/MATH_SPEC.md` *before* implementation let an independent agent re-implement the pipeline from the spec alone and match the library bit-identically on 146 checks. The spec, not the article prose, is what tests assert against.
- **Impact**: Any change to computational behavior must update MATH_SPEC.md first; treat code/spec conflicts as spec-wins. New math features need oracle values in the spec before code.
- **Category**: architecture

### [2026-06-11] uv workspace monorepo: virtual root, zero-dep core, workspace-dep backend
- **Context**: Plan requires the core as a public PyPI library independent of the web layer.
- **Finding**: Root `pyproject.toml` holds only `[tool.uv.workspace]` (no `[project]`); `core/` is a pure-Python zero-runtime-dependency package; `backend/` depends on it via `{ workspace = true }`. Docker builds for the backend need the **repo root** as build context (workspace member resolution). `uv.lock` lives at the root only.
- **Impact**: Never add runtime deps to `core/` (numpy included — all formulas are scalar). Run everything as `uv run --project <member> …` from the root. Backend Dockerfile copies core/ + root pyproject + uv.lock.
- **Category**: architecture

## Common Pitfalls

### [2026-06-11] Thesis/article published numbers are partly illustrative — control values beat prose
- **Context**: Verifying the core against the article's section 5.4 numbers and the 327-respondent xlsx.
- **Finding**: Three documented discrepancies (MATH_SPEC §2.2, §3.2, §5): (1) rule-4 prose says [T₃,T₃,T₂] but the worked example requires [T₃,T₂,T₂]; (2) published φ(R₁)=0.5 is a 1-d.p. rounding of 0.5227 and φ(R₃)=0.13 implies δ=89.78 (digit transposition of 87.89); (3) the published regional δ values are NOT derivable from the xlsx under any tested method — they are a worked example, like Table 1.
- **Impact**: When the article text and its worked example conflict, the worked example (= plan §8 control values) is authoritative. Never "fix" tests toward the prose. Don't expect dataset aggregates to reproduce published regional values.
- **Category**: pitfall

### [2026-06-11] The survey xlsx is positively coded (higher K = safer)
- **Context**: The article words all 17 criteria as worry-statements, suggesting agreement = unsafe; feeding the xlsx that way inverts everything.
- **Finding**: The dataset's «м» column proves positive coding (all-5 rows → м≈1.0, all-1 rows → м≈0). K values feed directly as τ with no inversion; T₅-rich profiles → r\*=L (low risk).
- **Impact**: Any new import path or dataset must keep direct (non-inverted) coding; if a future survey uses negative wording, recode before import.
- **Category**: pitfall

### [2026-06-11] Word .docx equations are OMML and invisible to python-docx
- **Context**: Extracting eq. 4.2–4.9 from Шафар_PhD.docx / Шафар_фін.docx.
- **Finding**: `python-docx` paragraph text silently drops `m:oMath` elements — exactly the formulas, interval boundaries, and rule terms needed. Parsing `word/document.xml` with lxml and linearizing OMML (fractions, eqArr piecewise, subscripts, nary) recovers them.
- **Impact**: Never trust plain-text docx extraction for this project's source documents; reuse the OMML-aware extraction approach (outputs preserved at `.specs/plan-implementation/article_with_math.md`, `thesis_with_math.md`).
- **Category**: pitfall

### [2026-06-11] Demo-deployment hardening that reviews actually caught
- **Context**: Security review of the FastAPI backend before public demo deployment.
- **Finding**: Four reproduced issues invisible to happy-path tests: malformed .xlsx → 500 (BadZipFile), cp1251 CSV → 500 (UnicodeDecodeError), xlsx-export formula injection via user-controlled `ext_id` (=HYPERLINK written as live `<f>` cell), and unbounded import/evaluation memory. Fixes: 422 wrappers, OWASP quote-prefix cell sanitization, 10 MiB/10 000-row/10 000-respondent caps, SQLite WAL + busy_timeout.
- **Impact**: Keep the caps and sanitization when touching import/export/evaluation paths; SQLite stays single-worker unless the locking strategy changes.
- **Category**: pitfall

### [2026-06-11] PATCH endpoints with exclude_unset let explicit JSON nulls corrupt required columns
- **Context**: Post-task review adversarial scenario: `PATCH /api/respondents/{id}` with `{"ratings": null}` committed a JSON `null` (SQLAlchemy JSON defaults to `none_as_null=False`, so Python None is stored as JSON 'null' TEXT, sailing past NOT NULL) and permanently 500'd the region's respondent list and evaluation.
- **Finding**: `model_dump(exclude_unset=True)` keeps explicitly-sent nulls; a `field is not None` guard skips validation but still writes. Required fields need a pydantic `field_validator` that rejects explicit null with 422 (validators don't fire on the omitted-field default).
- **Impact**: Every new PATCH schema must decide per nullable field: null-means-clear (allow, column nullable) vs null-never-valid (validator → 422). Regression tests in `backend/tests` cover ratings and region names.
- **Category**: pitfall

### [2026-06-11] SQLite reuses rowids — snapshot-id joins resurrect deleted entities' data
- **Context**: EvaluationResult.region_id is intentionally a plain snapshot int (runs survive region deletion). After delete-then-create, SQLite reused the rowid and the new region inherited the deleted region's latest risk badge.
- **Finding**: Without `AUTOINCREMENT`, SQLite recycles the max rowid. Any table whose id is referenced by snapshot (non-FK) columns needs `__table_args__ = {"sqlite_autoincrement": True}`.
- **Impact**: Applied to `Region`; apply to any future entity whose id lands in JSON snapshots. Existing dev DBs must be recreated after such a change.
- **Category**: pitfall

### [2026-06-11] Naive UTC datetimes serialize offset-less and JS parses them as local time
- **Context**: All UI timestamps rendered shifted by the viewer's UTC offset (sometimes wrong calendar date) — SQLite DateTime columns return naive values, FastAPI serialized them without offset, `new Date(iso)` treats offset-less strings as local.
- **Finding**: Fix belongs at the API boundary: a shared annotated type (`UTCDateTime` with a PlainSerializer doing `replace(tzinfo=UTC)` + isoformat) guarantees `+00:00` on every datetime field.
- **Impact**: Use `UTCDateTime` in every new response schema with datetimes; never emit naive ISO strings. `backend/tests/test_timestamps.py` pins this.
- **Category**: pitfall

### [2026-06-11] tsconfig must stay compatible with the user's editor TS service, not just the CLI compiler
- **Context**: Generated Vite tsconfigs used TS 6-era options (`erasableSyntaxOnly`, `target: es2023`, `tsBuildInfoFile` without `incremental`); CLI builds were green, but the user's editor runs an older TS service (~5.0/5.1) and flagged all three in both tsconfigs, plus phantom lint errors from ESLint resolving from the repo root.
- **Finding**: The editor's TS/ESLint run independently of the project toolchain. Fixes that cost nothing: `"incremental": true` next to `tsBuildInfoFile`, `ES2022` target/lib (code used no ES2023 features), drop options older services treat as hard errors, and `.vscode/settings.json` with `typescript.tsdk` → workspace TS + `eslint.workingDirectories: ["frontend"]`.
- **Impact**: When adding compiler options newer than ~2 years, either verify the user's editor supports them or prefer the compatible equivalent; keep `.vscode/settings.json` pointing at the workspace toolchain.
- **Category**: convention

## Pattern Discoveries

### [2026-06-11] Implement → adversarial-verify → fix workflow catches what builders miss
- **Context**: Both build workflows (core, app) used a parallel review panel: line-by-line formula audit with empirical probes, independent re-implementation from spec only, quality/packaging gate, contract-conformance diff, security probe, black-box e2e math audit.
- **Finding**: The builders' own gates were green, yet the panels found 1 major config-validation gap (core) and 8 blocking findings (app), incl. a frontend crash on /parameters from an envelope-type mismatch that tsc could not see (generic cast) and a year/month string-vs-number contract drift verified live.
- **Impact**: For multi-component changes, always run an independent verification pass with at least one agent that does NOT read the implementation (spec-only re-implementation or black-box probing); type-level conformance is not enough across HTTP boundaries.
- **Category**: pattern

### [2026-06-11] Re-runnable thesis figures via scripts/make_screenshots.py
- **Context**: Plan stage 8 requires screenshots for sections 5.3–5.4; one-off screenshots rot as the UI evolves.
- **Finding**: A PEP-723 Playwright script boots the real stack (throwaway SQLite), seeds the demo dataset, runs an evaluation (so the DM-panel step-cards are populated), and captures all 4 pages × 2 languages into `docs/screenshots/`.
- **Impact**: After any UI change, regenerate figures with `uv run scripts/make_screenshots.py` (one-time: `uv run --with playwright playwright install chromium`) instead of manual screenshots.
- **Category**: pattern

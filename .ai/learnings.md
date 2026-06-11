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

### [2026-06-11] shadcn CLI 4.x init is interactive-only — hand-write components.json instead
- **Context**: shadcn/ui + Tailwind v4 migration; `npx shadcn@latest init --base-color slate` failed (flag removed in CLI 4.x; base color is an interactive prompt and gray/slate are no longer offered).
- **Finding**: Writing `components.json` manually (style new-york, baseColor neutral, cssVariables, tailwind.config "") plus installing cva/clsx/tailwind-merge/lucide-react/tw-animate-css makes `npx shadcn add <components>` work deterministically with no prompts. Two post-add sweeps were needed: generated `sonner.tsx` imports `next-themes` (strip + hardcode theme="light"), and `src/components/ui/**` needs a scoped eslint override for `react-refresh/only-export-components`. Hardcoded sr-only strings in generated files (Dialog "Close") must be routed through t().
- **Impact**: For future `shadcn add` runs the setup is already in place; audit any newly generated ui/ file for next-themes imports, /50-opacity focus rings, and untranslated sr-only text before use.
- **Category**: external-api

### [2026-06-11] TS 6 deprecates baseUrl (TS5101); paths must be duplicated across both tsconfigs
- **Context**: Adding the @/* alias for shadcn; `tsc -b` failed with TS5101 "Option 'baseUrl' is deprecated".
- **Finding**: Relative `paths` entries (`"@/*": ["./src/*"]`) work without `baseUrl` in TS 6. They must exist in BOTH `tsconfig.json` (read by the shadcn CLI; harmless since files:[]) and `tsconfig.app.json` (used by tsc -b — project references do not inherit compilerOptions).
- **Impact**: Never add `baseUrl`; when adding aliases, update both tsconfig files and `vite.config.ts` resolve.alias together.
- **Category**: pitfall

### [2026-06-11] Radix Select crashes at runtime on empty-string item values
- **Context**: Converting native `<select>` "not set"/"all"/"auto-detect" options (value="") to Radix Select.
- **Finding**: `SelectItem value=""` throws at render time — a runtime error invisible to tsc. Sentinel values ('none'/'all'/'auto') mapped back to null/'' at the state/API boundary are required. Dense in-table selects stayed native to avoid sentinel churn (PanelPage Δ cells, RulesSection pills).
- **Impact**: Any new Radix Select with an optional/empty choice needs a sentinel; grep for `value=""` near SelectItem in reviews.
- **Category**: pitfall

### [2026-06-11] make_screenshots.py is coupled to UI flow semantics, not just selectors
- **Context**: UX-2 put "Run all regions" behind a ConfirmDialog; the screenshot script clicks that button by text and waits for `.step-card`.
- **Finding**: The script needed a second click (`get_by_role("alertdialog").get_by_role("button").last`) to confirm; it also depends on the literal `step-card` class kept on PanelPage step sections. Both are invisible couplings that only fail at thesis-figure regeneration time.
- **Impact**: Changing PanelPage's evaluation flow, step-card markup, or run-button labels requires updating `scripts/make_screenshots.py` in the same change (rule added to AGENTS.md).
- **Category**: pitfall

### [2026-06-11] Workflow subagents can report completion before their writes land — verify with git, recover from transcripts
- **Context**: 4-track page-conversion workflow "completed" with detailed per-track summaries, but `git status` showed zero page files modified; writes then flushed progressively over the next minutes, one track never wrote at all, and reviewer agents raced the flush (their findings mixed real issues with fabrications — the "blocker" was already fixed in the code, while two real issues were correct).
- **Finding**: Subagent structured output is a claim, not evidence. `git status --short` after a write-fanout is the ground truth; agent transcripts (`agent-*.jsonl`) contain full Write payloads, so un-flushed files can be recovered without re-running. A re-run agent should be told to verify its own writes via git before returning.
- **Impact**: After any multi-agent write workflow: (1) diff-verify the working tree against each agent's filesChanged claim, (2) treat reviewer findings as hypotheses to re-verify in the current code, (3) bake "confirm via git status before returning" into writer-agent prompts.
- **Category**: pattern

### [2026-06-11] Pre-provision all i18n keys before fanning out parallel page agents
- **Context**: 4 parallel agents converting disjoint page files, all needing new uk/en strings (toasts, confirms, empty states).
- **Finding**: Adding every anticipated key to both locale files up front and forbidding agents from touching `src/i18n/*` eliminated the only shared-file conflict; agents report missing keys in structured output instead. A flatten-and-diff node one-liner verifies parity (CI-able). Unused provisioned keys (one of ~30) are cheap to delete afterwards.
- **Impact**: For any parallel frontend fan-out: centralize shared-file edits (i18n, index.css, ui/) in the orchestrator before launching; give agents disjoint file ownership lists.
- **Category**: pattern

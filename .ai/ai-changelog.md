# AI Infrastructure Changelog

> Reverse-chronological log of all changes to the project's AI infrastructure:
> skills, conventions, rules, and workflow modifications.
>
> **How entries are added:** Automatically by AI workflows (skill-creator, learning-consolidator,
> post-task-review) or manually via the `ai-changelog` skill.
>
> **Format:** Each entry follows the structured format defined in `.claude/skills/ai-changelog/SKILL.md`.

---

## 2026-06-11

### CONV-MODIFIED: CI/CD convention added; Deployment and i18n conventions updated for GitHub Actions + Cloudflare
- **What:** Added a **CI/CD** bullet to AGENTS.md Conventions (ci.yml runs every gate as its own parallel job — ruff, pytest×2, eslint, tsc+vite build, i18n parity, wrangler validate — on PRs; deploy.yml re-runs CI then deploys to Cloudflare on pushes to main; SHA-pinned actions with weekly Dependabot). Updated **Deployment** to document the Cloudflare path (Worker = SPA static assets + `/api/*` → backend container, ephemeral SQLite, see cloudflare/README.md) alongside docker compose, and **i18n** to note key parity is now CI-enforced by `scripts/check_i18n_keys.mjs`
- **Why:** The platform gained a CI/CD pipeline and a second (primary, public-demo) deployment target this session; conventions must point future tasks at the CI gates they will be checked against and at the ephemeral-storage caveat before anyone relies on demo data persisting
- **Files:** `AGENTS.md`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/dependabot.yml`, `cloudflare/` (wrangler.jsonc, src/worker.ts, package.json, tsconfig.json, README.md), `scripts/check_i18n_keys.mjs`, `.dockerignore`, `frontend/public/_headers`, `README.md`, `docs/thesis-5.3-5.4-draft.md`, `.ai/learnings.md`
- **Affected workflows:** post-task-review (CI gates now exist to check against); any task touching i18n files (parity is CI-enforced); deployment-related tasks

### RULE-ADDED: Two "Do not" rules from the shadcn/ui migration
- **What:** Added to AGENTS.md "Do not": (1) never change PanelPage's evaluation flow, `step-card` markup, or run-button labels without updating `scripts/make_screenshots.py` in the same change (the script clicks "Run all", confirms the AlertDialog, and waits for `.step-card`); (2) never edit `frontend/src/i18n/*.json` from parallel subagents — pre-provision keys in the orchestrator and keep agent file ownership disjoint
- **Why:** The migration empirically hit both: putting Run-all behind a ConfirmDialog silently broke thesis-figure regeneration until the script was patched, and the parallel 4-track page conversion only avoided locale-file conflicts because keys were provisioned up front
- **Files:** `AGENTS.md`, `.ai/learnings.md`, `scripts/make_screenshots.py`
- **Affected workflows:** Any multi-agent frontend workflow; thesis-figure regeneration

### CONV-ADDED: Project conventions established after full platform implementation
- **What:** Replaced the AGENTS.md "Conventions" placeholder with the real project conventions: uv-workspace monorepo layout (zero-dep `core/` library, workspace-dep `backend/`, `frontend/`), source-of-truth pointers (`MATH_SPEC.md` for computational semantics, `API_CONTRACT.md` for the HTTP boundary), math-stays-in-core principle, test commands and must-pass control-value tests, i18n key-parity requirement, Docker deployment notes, and the screenshot-regeneration command
- **Why:** The Software Development Plan was fully implemented this session; conventions discovered/decided during the build (spec-wins conflicts, single math source, root build context for Docker) must bind future tasks before they drift
- **Files:** `AGENTS.md`, `.ai/learnings.md`
- **Affected workflows:** spec-driven-dev, post-task-review (both now inherit concrete conventions to check against)

### RULE-ADDED: Three "Do not" rules from implementation findings
- **What:** Added to AGENTS.md "Do not": (1) no runtime dependencies in `core/` (PyPI zero-dep library), (2) never invert survey ratings on import (dataset is positively coded), (3) never remove the backend's import/export/evaluation resource caps or xlsx-cell sanitization (security hardening from the review panel)
- **Why:** Each guards against a mistake that was either actually made or empirically demonstrated during the build (formula-injection PoC, coding-direction analysis, library-independence requirement from the supervisor agreements)
- **Files:** `AGENTS.md`
- **Affected workflows:** None

## 2026-06-10

### SKILL-ADDED: python-best-practices reference skill
- **What:** Created `.claude/skills/python-best-practices/` — expert Python conventions for the 3.12+ era (PEP 695 typing, data-modeling decision table, async TaskGroup patterns, pytest norms, ruff, 3.12→3.14 currency notes); web-researched via the skill-creation pipeline (research brief in `.specs/skill-python-best-practices/`) and content-reviewed (EXPERT rating, 1 CRITICAL TypeIs example fixed)
- **Why:** Give the AI agent current, source-backed Python guidance so generated code follows modern idioms instead of stale training-data patterns
- **Files:** `.claude/skills/python-best-practices/SKILL.md`, `.specs/skill-python-best-practices/research-brief.md`, `CLAUDE.md`
- **Affected workflows:** None (auto-loaded reference; defers package management to uv-python-tooling)

### SKILL-ADDED: uv-python-tooling reference skill
- **What:** Created `.claude/skills/uv-python-tooling/` — mandates uv for all Python tooling (no pip/poetry/pyenv/pipx), covering uv run/add/sync/lock semantics, PEP 723 scripts, workspaces, Docker/CI patterns, and a pip/poetry→uv migration table; web-researched against docs.astral.sh/uv (research brief in `.specs/skill-uv-python-tooling/`) and content-reviewed (THOROUGH rating, 1 CRITICAL gitignore contradiction fixed)
- **Why:** Establish uv as the single project standard for Python tooling so the agent never mixes pip/poetry workflows into uv-managed environments
- **Files:** `.claude/skills/uv-python-tooling/SKILL.md`, `.claude/skills/uv-python-tooling/references/docker-and-ci.md`, `.specs/skill-uv-python-tooling/research-brief.md`, `CLAUDE.md`
- **Affected workflows:** None (auto-loaded reference; complements python-best-practices)

### SKILL-ADDED: react-best-practices reference skill
- **What:** Created `.claude/skills/react-best-practices/` — React 19+ practices (Compiler memoization discipline, Actions/useActionState, Server Components boundary model, effects discipline, state/data-fetching decision ladders, RTL testing norms); web-researched against react.dev (research brief in `.specs/skill-react-best-practices/`) and content-reviewed (EXPERT rating, 1 MAJOR Compiler/context contradiction fixed)
- **Why:** Prevent the agent from emitting pre-React-19 patterns (forwardRef, reflexive useMemo/useCallback, useEffect data fetching) that are now obsolete or harmful
- **Files:** `.claude/skills/react-best-practices/SKILL.md`, `.claude/skills/react-best-practices/references/data-fetching-and-state.md`, `.claude/skills/react-best-practices/references/testing-react.md`, `.specs/skill-react-best-practices/research-brief.md`, `CLAUDE.md`
- **Affected workflows:** None (auto-loaded reference; defers TS language and web-platform concerns to sibling skills)

### SKILL-ADDED: typescript-best-practices reference skill
- **What:** Created `.claude/skills/typescript-best-practices/` — TypeScript conventions for the TS 6.0/7.0 (tsgo) era: strictness flags beyond `strict`, type design (discriminated unions, branded types, satisfies), boundary validation with Zod/Valibot, typed linting, and a 12-row anti-pattern table; web-researched against the TS devblog (research brief in `.specs/skill-typescript-best-practices/`) and content-reviewed (EXPERT rating, 0 CRITICAL/MAJOR findings)
- **Why:** TS 6.0/7.0 changed compiler defaults and deprecated long-standing options after training cutoffs; codified current guidance prevents stale tsconfig and type-design output
- **Files:** `.claude/skills/typescript-best-practices/SKILL.md`, `.claude/skills/typescript-best-practices/references/tsconfig-and-monorepo.md`, `.specs/skill-typescript-best-practices/research-brief.md`, `CLAUDE.md`
- **Affected workflows:** None (auto-loaded reference; defers React patterns and web-platform concerns to sibling skills)

### SKILL-ADDED: web-dev-best-practices reference skill
- **What:** Created `.claude/skills/web-dev-best-practices/` — framework-agnostic web practices: WCAG 2.2 accessibility, Baseline-calibrated modern CSS, Core Web Vitals (incl. INP), OWASP-grounded security (CSP, Fetch-Metadata CSRF, cookie discipline), RFC 9457 API errors, and native platform features replacing library habits; web-researched against MDN/web.dev/OWASP (research brief in `.specs/skill-web-dev-best-practices/`) and content-reviewed (EXPERT rating, 2 CRITICAL fixes incl. a research-brief error on scroll-driven animation support)
- **Why:** Anchor web output to verified current platform/security baselines — research explicitly debunked circulating misinformation (fabricated "CWV 2.0" thresholds) that could otherwise leak into generated guidance
- **Files:** `.claude/skills/web-dev-best-practices/SKILL.md`, `.claude/skills/web-dev-best-practices/references/security.md`, `.claude/skills/web-dev-best-practices/references/api-design.md`, `.claude/skills/web-dev-best-practices/references/platform-features.md`, `.specs/skill-web-dev-best-practices/research-brief.md`, `CLAUDE.md`
- **Affected workflows:** None (auto-loaded reference; defers React and TS specifics to sibling skills)

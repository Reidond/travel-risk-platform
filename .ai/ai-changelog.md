# AI Infrastructure Changelog

> Reverse-chronological log of all changes to the project's AI infrastructure:
> skills, conventions, rules, and workflow modifications.
>
> **How entries are added:** Automatically by AI workflows (skill-creator, learning-consolidator,
> post-task-review) or manually via the `ai-changelog` skill.
>
> **Format:** Each entry follows the structured format defined in `.claude/skills/ai-changelog/SKILL.md`.

---

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

# AI Infrastructure Improvement Hypotheses

> Testable predictions about expected value from AI infrastructure changes.
> Each hypothesis is linked to a changelog entry and will be validated by a future
> periodic review skill.
>
> **How entries are added:** Automatically by AI workflows after writing a changelog entry,
> via the `ai-improvement-tracker` skill.
>
> **Format:** Each entry follows the structured format defined in
> `.claude/skills/ai-improvement-tracker/SKILL.md`.
>
> **Status lifecycle:** PENDING → CONFIRMED | REFUTED | INCONCLUSIVE | SUPERSEDED
> (status changes are made by the future validation skill, not this file's authors)

---

## 2026-06-10

### [SKILL-ADDED] python-best-practices reference skill
- **Category:** Quality
- **Hypothesis:** By codifying 3.12+ idioms and ~30 anti-patterns (mutable defaults, TaskGroup over gather, pydantic-at-edges-only), we expect fewer modernization corrections during code review because the agent will emit current idioms on the first pass instead of training-data-era patterns.
- **Signal:** Python code review rounds in the next 4 weeks surface no findings about stale typing syntax (`Optional[X]`, `TypeVar` boilerplate) or known anti-patterns covered by the skill.
- **Risk:** Skill staleness as 3.15+ lands; the 3.12→3.14 cheat sheet may be over-applied to environments pinned to older interpreters.
- **Status:** PENDING
- **Changelog ref:** 2026-06-10 — SKILL-ADDED: python-best-practices reference skill

### [SKILL-ADDED] uv-python-tooling reference skill
- **Category:** Consistency
- **Hypothesis:** By mandating uv with explicit command mappings and GOOD/BAD pairs, we expect zero pip/poetry/manual-venv commands in agent sessions because the skill replaces ambiguous tool choice with a single prescribed path for every Python operation.
- **Signal:** No `pip install`, `poetry`, or `source .venv/bin/activate` invocations appear in session transcripts once Python work begins; environments stay reproducible via committed `uv.lock`.
- **Risk:** uv's fast release cadence may invalidate specific flags; over-strict application could fight third-party tooling that hard-requires pip.
- **Status:** PENDING
- **Changelog ref:** 2026-06-10 — SKILL-ADDED: uv-python-tooling reference skill

### [SKILL-ADDED] react-best-practices reference skill
- **Category:** Quality
- **Hypothesis:** By encoding React 19 obsolescence rules (no forwardRef, no reflexive memoization under the Compiler, no useEffect data fetching) and effects discipline, we expect fewer React anti-pattern findings in review because the agent's default output will match the 19-era mental model rather than 17/18-era habits dominant in training data.
- **Signal:** React code produced in the next 4 weeks contains no forwardRef, no hand-rolled form state for action-shaped flows, and no derive-in-effect patterns flagged by the skill's §16 checklist.
- **Risk:** Compiler-trust guidance may be wrong for codebases where the Compiler is not enabled — agent must check the build setup before omitting memoization.
- **Status:** PENDING
- **Changelog ref:** 2026-06-10 — SKILL-ADDED: react-best-practices reference skill

### [SKILL-ADDED] typescript-best-practices reference skill
- **Category:** Quality
- **Hypothesis:** By documenting TS 6.0 changed defaults/deprecations and boundary-validation patterns, we expect generated tsconfigs and type designs to compile cleanly under current TypeScript because the skill overrides stale training-data defaults (e.g., removed options, pre-6.0 module settings) with verified 2026 guidance.
- **Signal:** No tsconfig corrections or `any`-leakage/`as`-cast findings in TypeScript reviews over the next 4 weeks; new code uses discriminated unions and schema-first boundary types without prompting.
- **Risk:** TS 7.0 stable (expected weeks away) may shift tsgo guidance; skill needs a refresh when 7.0 ships.
- **Status:** PENDING
- **Changelog ref:** 2026-06-10 — SKILL-ADDED: typescript-best-practices reference skill

### [SKILL-ADDED] web-dev-best-practices reference skill
- **Category:** Coverage
- **Hypothesis:** By providing verified security, accessibility, and performance baselines (CSP/Fetch-Metadata CSRF, WCAG 2.2, real CWV thresholds), we expect web output to handle cross-cutting concerns unprompted because the skill injects checklists for dimensions users rarely specify explicitly.
- **Signal:** Web features built in the next 4 weeks include security headers, accessible form markup, and correct cookie attributes without the user requesting them; no fabricated "CWV 2.0" claims appear in agent guidance.
- **Risk:** Baseline browser-support calibrations (e.g., scroll-driven animations) drift as engines ship; periodic re-verification needed.
- **Status:** PENDING
- **Changelog ref:** 2026-06-10 — SKILL-ADDED: web-dev-best-practices reference skill

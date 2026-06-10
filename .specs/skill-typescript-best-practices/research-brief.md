# Research Brief: TypeScript Best Practices (mid-2026)

Prepared for the `typescript-best-practices` skill (reference type, expert depth,
audience: AI coding agent writing/reviewing TypeScript). Researched 2026-06-10 via
web search against official TypeScript release notes, typescript-eslint docs,
Node.js docs, and Total TypeScript (Matt Pocock).

## Research Question

**Core question**: What should an AI coding agent know to write, review, and configure
TypeScript correctly as of mid-2026 — without React or general web-platform concerns
(owned by sibling skills)?

Sub-questions:
1. What is the current compiler landscape (TS 6.0, TS 7.0 native/Go port)?
2. What tsconfig settings are recommended in 2026, and how did TS 6.0 change defaults?
3. What type-design patterns are consensus best practice (unions, branding, satisfies)?
4. Where do runtime and type-level guarantees diverge (validation at boundaries)?
5. What anti-patterns cause concrete harm and must be flagged in review?

Depth target: **Expert (judgment)** — the agent must make nuanced trade-off decisions,
not just apply rules.

## Codebase State

- This repository is nearly empty: no `.ts` files exist yet (only docs, CLAUDE.md/AGENTS.md,
  and AI-infrastructure skills). There is no existing TypeScript convention to preserve.
- Sibling skills `react-best-practices` and `web-dev-best-practices` are planned/specced;
  this skill must NOT cover React patterns or general web-platform concerns.
- Implication: the skill can prescribe greenfield-correct defaults (strictest config,
  ESM-first) without migration caveats dominating.

## Recent Developments (critical — invalidates pre-2025 training data)

1. **TypeScript 6.0 (stable, March 2026)** — last release on the JS codebase. Transition
   release aligning with TS 7. Key changes (source: MS devblog "Announcing TypeScript 6.0 RC"):
   - **Defaults changed**: `strict` now defaults to **true**; `module` defaults to `esnext`;
     `target` defaults to current-year ES (es2025); `types` defaults to `[]` (no auto
     @types enumeration); `rootDir` defaults to tsconfig directory;
     `noUncheckedSideEffectImports` defaults to true.
   - **Deprecated** (removed in TS 7): `target: es5`, `moduleResolution: node`(node10)/`classic`,
     `module: amd|umd|system|none`, `baseUrl`, `outFile`, `downlevelIteration`,
     `esModuleInterop: false`, import assertions (`assert` → `with`).
   - New: `--stableTypeOrdering` (matches TS 7 ordering), `#/` subpath imports,
     `moduleResolution: bundler` now combinable with `module: commonjs`.
2. **TypeScript 7.0 Beta (April 2026)** — the native Go port ("Project Corsa", repo
   `microsoft/typescript-go`). ~10x faster (VS Code: 78s → 7.5s). Type checking is
   "structurally identical to 6.0"; 99.6% of compiler tests pass. CLI parity includes
   `--incremental`, project references, and `--build` mode. Stable expected ~mid-2026.
   - Beta ships as `@typescript/native-preview` with `tsgo` CLI; stable will reclaim
     the `typescript` package and `tsc` name.
   - Gaps: stable programmatic API deferred to ≥7.1; legacy TS Server plugins do not
     work (new LSP architecture); `outFile` removed.
   - Practical implication for agents: write code/config that is 6.0-clean and free of
     deprecated options — that is exactly the TS 7 compatibility bar.
3. **Node.js native type stripping** — default for `.ts` files in Node 24 LTS (amaro,
   types replaced with whitespace). Only *erasable* syntax allowed: no enums, no
   namespaces (with values), no parameter properties, no legacy decorators.
   TS 5.8+ `--erasableSyntaxOnly` flag errors on non-erasable syntax. Node docs
   recommend: `noEmit`, `module: nodenext`, `erasableSyntaxOnly`,
   `rewriteRelativeImportExtensions`, `verbatimModuleSyntax`.
4. **Zod 4 (2025)** — ~4x faster than Zod 3, plus Zod Mini. Valibot remains ~90% smaller
   bundled; ArkType fastest at runtime. Consensus 2026: choice is "where does the
   validator ship?" — server/tRPC → Zod; edge/client bundles → Valibot.
5. **typescript-eslint v8+** — `projectService: true` is the recommended way to enable
   typed linting (replaces manual `project` arrays); flat config standard.

## Approach Landscape

### Approach: Maximal strictness tsconfig (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes)
- **What**: `strict: true` plus the strict-adjacent flags TS leaves out of `strict`.
- **When to use**: all new projects; an AI agent has no excuse to start loose.
- **When NOT**: `exactOptionalPropertyTypes` on codebases/dependencies that assign
  `undefined` to optional props pervasively — adopt with awareness; `noUncheckedIndexedAccess`
  adds friction in hot loops (use length-checked patterns or `.at()`).
- **Trade-offs**: more narrowing ceremony vs. whole bug classes eliminated at compile time.
- **Maturity**: established (Total TypeScript cheat sheet, typescriptlang.org tsconfig docs).

### Approach: "transpile with tsc" vs "bundler-owned" vs "Node type-stripping" module config
- Three valid emit strategies, each with a distinct module config:
  - tsc emits (libraries, plain Node services): `module: nodenext` + real `.js` extensions
    in relative imports.
  - Bundler emits (apps via Vite/esbuild/etc.): `module: preserve` + `noEmit: true`.
  - Node runs `.ts` directly (Node ≥24): `nodenext` + `erasableSyntaxOnly` +
    `rewriteRelativeImportExtensions` + `noEmit`.
- **Maturity**: established; this three-way split is the 2026 consensus (Total TypeScript,
  Node.js docs).

### Approach: Discriminated unions for state modeling ("make invalid states unrepresentable")
- Established, uncontroversial. Tag with a literal `kind`/`status` field; exhaustive
  `switch` with `never` check.

### Approach: Branded/nominal types for domain primitives
- `type UserId = string & { readonly __brand: 'UserId' }` (or a `Brand<T, B>` helper).
- **When**: IDs, currency, sanitized strings, units — anywhere two same-shaped primitives
  must not cross. **When NOT**: every string in the codebase (ceremony tax).
- Source: Total TypeScript (one of Pocock's "four most important patterns").

### Approach: Runtime validation at boundaries (zod/valibot)
- Types are erased; anything crossing a trust boundary (HTTP, env, DB rows, file/JSON,
  LLM output) must be parsed, not asserted. Schema-first: derive the static type with
  `z.infer` so runtime and compile time cannot drift.
- **When NOT**: internal function-to-function calls already covered by the type system —
  validating everywhere is overhead and noise.

### Approach: Error handling — typed throws don't exist; choose explicit strategy
- `catch` variables are `unknown` under `useUnknownInCatchVariables` (in `strict`);
  must narrow with `instanceof`.
- Two consensus camps: custom `Error` subclasses (with `cause`) for exceptional paths,
  and Result/Either objects (discriminated unions) for *expected* failures in core domain
  logic. Function signatures can't declare `throws`, which is the argument for Result
  in domain code. Neither is universally right — present as a calibrated choice.

### Approach: type vs interface
- TS team: personal preference, default `interface`. Pocock (and much of the community):
  default `type` because interface declaration merging is silent and surprising; use
  `interface` when you need `extends` hierarchies (also marginally cheaper for the checker)
  or declaration merging on purpose (module augmentation). Recommend: default `type`,
  `interface` for object hierarchies/augmentation — and above all be consistent.

### Approach: Generics discipline
- Rule of thumb (TS handbook + community): a type parameter must appear in at least two
  positions (or link input to output); otherwise use a concrete type or `unknown`.
  "Would a concrete type work here? If yes, skip the generic."

### Approach: Monorepo project references
- Threshold: ≥2 packages sharing code. Per-package `composite: true` + `declaration` +
  `declarationMap` + `incremental`; root solution tsconfig with `references`; build with
  `tsc -b` (fully supported by tsgo). Pair with pnpm workspaces. Single-app repos don't
  need them.

## Common Oversimplifications

| Simplified Version | What's Actually True | Why It Matters |
|---|---|---|
| "`strict: true` is all you need" | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` are NOT in `strict` | Index access and optional-prop bugs survive "strict" codebases |
| "Never use `any`" | `unknown` is the correct unsafe-input type; `any` is occasionally legitimate inside well-typed function signatures' implementation guts, but must never appear in exported signatures | Blanket bans push people to `as unknown as T`, which is worse |
| "Enums are banned in modern TS" | String enums are fine-ish; the real 2026 forcing function is that enums are non-erasable syntax (break Node type stripping / `erasableSyntaxOnly`); `as const` objects + derived union are the default replacement, but `const enum` still exists for special cases | Blind find-replace of enums breaks public APIs |
| "type vs interface doesn't matter" | Declaration merging makes `interface` silently merge duplicates; `extends` is better-cached than intersections | Subtle bugs and perf differences |
| "Zod everywhere" | Validation belongs at trust boundaries only; validator choice depends on ship target (bundle size vs ecosystem) | Perf/bundle waste; false sense of safety internally |
| "satisfies and `as` both 'set the type'" | `satisfies` checks without widening or asserting; `as` overrides the checker and can hide real errors | `as` is the #1 soundness hole agents introduce |
| "TS 7 is a different language" | Type checking is structurally identical to 6.0; the bar is simply "no deprecated options, clean on 6.0" | No need to write 'tsgo-specific' code |

## Anti-Patterns (for the skill's anti-pattern coverage)

1. **`any` leakage** — `any` in an exported signature infects every call site; each
   operation on `any` returns `any`. Instead: `unknown` + narrowing; if `any` is truly
   needed internally, contain it and never export it. (typescript-eslint
   `no-unsafe-*` rules exist precisely for this.)
2. **`as` casting to silence errors** — incl. the double assertion `as unknown as T`.
   Seems right because "I know the shape". Actually: hides real mismatches, breaks on
   refactor silently. Instead: fix the type, use a type guard, `satisfies`, or runtime
   parse. Legitimate `as`: `as const`, narrowing literal unions after validation,
   test fixtures.
3. **Numeric enums / non-erasable syntax** — numeric enums allow arbitrary number
   assignment in some versions, emit IIFEs, and all enums break Node type stripping.
   Instead: `as const` object + `(typeof X)[keyof typeof X]` union, or plain literal unions.
4. **Return-type-only generics** (`function get<T>(): T`) — a disguised `as` cast;
   caller picks any T with zero evidence. Instead: return `unknown` and parse/validate.
5. **Overengineered conditional/mapped types** — deep conditional types where a
   discriminated union or function overload would do; unreadable, slow to check,
   hostile to maintainers. "Simplest type that preserves the information you need."
6. **Type/runtime drift** — writing an `interface` for an API response and a separate
   validator (or none). Instead: schema-first, infer the type from the schema.
7. **Throwing non-Errors / assuming `catch (e: Error)`** — catch is `unknown`; throwing
   strings loses stack traces. Always throw `Error` subclasses; narrow in catch.
8. **`@ts-ignore` instead of `@ts-expect-error`** — ignore rots silently when the error
   disappears; expect-error self-cleans (errors when unused). Always with a description
   (lint rule `ban-ts-comment` enforces).
9. **Deprecated config in new projects** — `baseUrl`, `moduleResolution: node`,
   `target: es5`, `outFile`: all deprecated in 6.0, removed in 7.0.
10. **Untyped linting** — running typescript-eslint without type-aware rules misses the
    `no-floating-promises` / `no-misused-promises` / `no-unsafe-*` class of bugs (the
    highest-value rules for async-heavy code).
11. **Boolean/primitive obsession across domain boundaries** — passing bare `string` IDs
    between domains where branded types would catch transposition at compile time.
12. **Default function params typed optional in `exactOptionalPropertyTypes` confusion** —
    more generally: misunderstanding that with the flag on, `{x?: number}` no longer
    accepts explicit `undefined` assignment.

## Depth Recommendation

**Deep reference skill (numbered conventions)** — the topic has settled consensus on most
points but with judgment calls (error handling strategy, validator choice, strictness
flags with adoption costs). The rapidly evolving part (TS 6/7 transition) needs a
"pointer"-style section stating the current state with dates so staleness is detectable.
Keep SKILL.md < 400 lines; overflow (full tsconfig variants per emit strategy, monorepo
wiring detail) → `references/`.

## Required Examples (GOOD/BAD pairs where calibration matters)

1. `unknown` vs `any` at an input boundary (narrowing required).
2. `satisfies` vs `: Type` annotation vs `as` (config object losing literal inference).
3. Discriminated union + exhaustive switch with `never`.
4. Branded ID preventing argument transposition.
5. `as const` object replacing an enum, with derived union type.
6. Return-type-only generic (bad) vs schema parse (good).
7. Schema-first zod: `z.infer` vs hand-written duplicate interface.
8. `catch (e)` narrowing with `instanceof`; custom error with `cause`.
9. Result-type discriminated union for expected failures.
10. `noUncheckedIndexedAccess` handling (`arr[0]` is `T | undefined`).
11. `@ts-expect-error` with description vs `@ts-ignore`.
12. tsconfig snippets for the three emit strategies.

## Key Sources

1. **TypeScript official devblog — "Announcing TypeScript 6.0 RC" & "Announcing TypeScript 7.0 Beta"** (devblogs.microsoft.com/typescript, 2026) — authoritative for default changes, deprecations, native-port status, tsgo packaging.
2. **TypeScript TSConfig reference** (typescriptlang.org/tsconfig) — flag semantics: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly`.
3. **Total TypeScript (Matt Pocock) — TSConfig Cheat Sheet & articles** — community-consensus tsconfig (base/strictness/emit-strategy variants), type-vs-interface, branded types, satisfies.
4. **typescript-eslint docs** (typescript-eslint.io) — shared configs (`strictTypeChecked`, `stylisticTypeChecked`), `projectService` for typed linting, stability guarantees of configs.
5. **Node.js docs — Modules: TypeScript** (nodejs.org/api/typescript.html) — type-stripping defaults in Node 24 LTS, recommended tsconfig, non-erasable syntax list.
6. **microsoft/typescript-go repo + InfoQ/VS Magazine coverage** — TS 7 parity status (test pass rate, --build support), timeline.
7. **Zod 4 / Valibot comparisons (valibot.dev comparison guide; 2026 benchmarks)** — validator trade-offs by ship target.
8. **Community enum analyses** ("Breaking the Enum Habit", "Stop blindly replacing enum with as const") — calibrated enum guidance, not blanket bans.

## Recommendations for Skill Content

1. Open with the 2026 compiler-landscape section (TS 6 defaults, TS 7/tsgo status,
   Node type stripping) — it's the part agents' training data gets wrong.
2. Give one canonical strict tsconfig plus the three emit-strategy variants; push full
   variants to `references/tsconfig-emit-strategies.md` if SKILL.md grows.
3. Numbered convention sections mirroring `prompt-engineering-conventions` style:
   rule → rationale → GOOD/BAD example.
4. Dedicate explicit sections to the four highest-harm anti-patterns: `any` leakage,
   `as` casting, type/runtime drift at boundaries, return-type-only generics.
5. Present error handling as a calibrated two-strategy choice, not dogma.
6. Keep enum guidance nuanced: the forcing function is erasability, not fashion.
7. Stay out of React and web-platform territory; state the boundary in the description.

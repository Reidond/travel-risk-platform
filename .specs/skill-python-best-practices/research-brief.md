# Research Brief: Expert Python Best Practices (Python 3.12+ era, mid-2026)

## Research Question

**Core question**: What conventions, judgment calls, and anti-patterns should an AI coding
agent apply when writing or reviewing Python in this project, calibrated to the modern
Python 3.12–3.14 era (as of June 2026)?

**Sub-questions**:
1. What is the current consensus on typing syntax and data-modeling choices
   (PEP 695 generics, TypedDict/Protocol/dataclasses/pydantic)?
2. What async patterns and pitfalls matter most in production (TaskGroup era)?
3. What are pytest's high-value patterns and well-documented anti-patterns?
4. What are the current tooling norms (ruff, formatters, type checkers)?
5. What changed in 3.12/3.13/3.14 that invalidates older advice?

**Depth target**: Expert (judgment) — the skill must help an agent make nuanced
trade-off decisions, not just apply rules.

## Codebase State

- The repository contains no Python code yet (only docs, AGENTS.md, CLAUDE.md,
  `.claude/skills/`). The skill defines greenfield standards rather than codifying
  existing practice.
- Package management is owned by the sibling skill `uv-python-tooling` — this skill
  must reference it in one line and not duplicate uv workflows.
- Existing conventions: `prompt-engineering-conventions` is the formatting model for
  reference-type skills (numbered sections, GOOD/BAD examples, short rationale).

## Approach Landscape

### Typing syntax (PEP 695 vs legacy TypeVar)
- **What it is**: `class Stack[T]: ...`, `def first[T](items: list[T]) -> T: ...`,
  `type Vector = list[float]` (3.12+). Variance is inferred; bounds via `T: Bound`,
  defaults via `T = Default` (3.13+, PEP 696).
- **When to use**: All new code targeting 3.12+. Official typing best practices also
  say: builtin generics (`list[str]`, `dict[str, int]`), `X | None` not `Optional[X]`,
  `None` last in unions.
- **When NOT**: Library code that must support <3.12; stub files following older norms.
- **Maturity**: Established. Legacy `TypeVar`/`Generic`/`TypeAlias` syntax is
  understood-but-not-written for new code.
- **Source**: typing.python.org best practices; Jelle Zijlstra (PEP 695 implementer).

### Data modeling: dataclass vs TypedDict vs Protocol vs pydantic
- **dataclass**: internal domain objects; zero deps; no runtime validation; use
  `slots=True`, `frozen=True` where applicable; `kw_only=True` for many-field classes.
- **TypedDict**: typing JSON-shaped dicts you don't control (third-party API payloads);
  static-only — NO runtime checks; `Required`/`NotRequired` (3.11+), `ReadOnly` (3.13+);
  combine with `Literal` discriminators for tagged unions.
- **Protocol**: structural interfaces — depend on behavior, not inheritance; preferred
  over ABCs for consumer-defined interfaces.
- **pydantic**: trust boundaries only — parsing/validating untrusted external input
  (API requests, config files, LLM output). Validation pipeline costs ~5-50x dataclass
  instantiation; do not use for hot-path internal objects.
- **Consensus**: layered usage — pydantic at the edges, dataclasses in the core,
  TypedDict for dict-shaped interop, Protocol for interfaces.
- **Source**: Speakeasy pydantic-vs-dataclasses analysis; community benchmarks
  (Hrekov); pydantic docs.

### Async: TaskGroup-first structured concurrency
- `asyncio.TaskGroup` (3.11+) supersedes bare `gather`/`create_task` for new code:
  on failure it cancels siblings and raises `ExceptionGroup`; `gather` does not cancel.
- Fire-and-forget `create_task` without holding a reference → tasks garbage-collected
  mid-flight (documented in asyncio docs).
- Blocking calls (requests, time.sleep, heavy CPU) inside coroutines stall the entire
  event loop → `asyncio.to_thread` / executors.
- `asyncio.timeout()` context manager (3.11+) preferred over `wait_for` wrapping.
- 3.14 adds asyncio introspection CLI (`python -m asyncio ps/pstree <PID>`).
- **Source**: docs.python.org asyncio-dev; Shane Chang production pitfalls writeup.

### Testing: pytest norms
- Plain functions + fixtures; `parametrize` with `ids`/`pytest.param` for readable CI
  failures; `conftest.py` for shared fixtures; `tmp_path`, `monkeypatch`,
  `capsys` builtins over hand-rolled equivalents.
- Anti-patterns: fixture proliferation (`user_with_stuff_1`, `_2` → factory fixtures);
  expensive work at collection time inside parametrize lists; auto-use fixtures with
  side effects; testing implementation details via excessive mocking; asserting on
  log strings instead of behavior.
- `tests/` outside the package, with src layout so tests run against the installed
  package.
- **Source**: pytest official docs (goodpractices, parametrize); NerdWallet's
  5 pytest best practices.

### Tooling norms (mid-2026)
- **ruff** is the consensus linter+formatter (replaces flake8+isort+black stack).
  Norm: explicit `lint.select` in pyproject.toml with a curated set (E, W, F, I, UP,
  B, C4, SIM, RET, TC, PTH, RUF...); avoid `ALL` (new rules auto-enable on upgrade);
  per-file-ignores for tests.
- **Type checkers**: mypy (58% spec conformance, slow) is losing default status.
  Pyright: 98% conformance, VS Code native. New Rust checkers: Astral's `ty` (beta,
  Dec 2025) and Meta's Pyrefly (1.0 May 2026, adopted by PyTorch/JAX). Practical
  guidance: pick one strict checker and run it in CI; pyright is the safe 2026
  default; ty/pyrefly are credible and fast but newer.
- **Source**: docs.astral.sh/ruff; pydevtools handbook type-checker comparison;
  Pyrefly conformance blog.

### Project layout
- src layout (`src/<package>/`) recommended by PyPA for anything packaged or tested:
  forces imports to resolve against the installed copy, catching packaging mistakes
  (missing modules in wheel) that flat layout silently hides.
- Flat layout acceptable only for throwaway scripts.
- **Source**: packaging.python.org src-layout-vs-flat-layout discussion.

### Error handling
- Catch specific exceptions; "raise low, catch high" — handle at edges (CLI entry,
  request handler), let lower layers propagate.
- `raise X from err` to chain; `raise X from None` only when deliberately hiding.
- Custom exception hierarchy rooted at one project base class.
- `except*` / `ExceptionGroup` (3.11+) required knowledge now that TaskGroup raises
  groups.
- PEP 765 (3.14): `return`/`break`/`continue` in `finally` is now a SyntaxWarning —
  it silently swallows exceptions.
- **Source**: docs.python.org exceptions tutorial; PEP 654; PEP 765.

### Logging
- Emit structured data, not interpolated prose; module loggers
  (`logging.getLogger(__name__)`); lazy `%`-style args (`log.info("x=%s", x)`) not
  f-strings (defers formatting, keeps aggregation keys stable).
- `logger.exception(...)` inside except blocks for tracebacks.
- structlog for serious services: bind context once (request id, user id), use
  `structlog.contextvars` for async-safe context (thread-locals bleed across tasks).
- Libraries never configure handlers; configuration happens once at the application
  entry point (`dictConfig` or structlog.configure).
- **Source**: structlog logging-best-practices docs; Better Stack structlog guide.

## Common Oversimplifications

| Simplified Version | What's Actually True | Why It Matters |
|---|---|---|
| "Always use pydantic for data classes" | Pydantic validates on every instantiation (~5-50x dataclass cost); right only at trust boundaries | Hot-path internal objects become accidentally slow |
| "Add `from __future__ import annotations` everywhere" | 3.14 (PEP 649) defers annotations natively; the future import is now legacy and changes runtime annotation semantics | Cargo-culting it into 3.14 code adds noise and diverges from new default behavior |
| "Use `gather` for concurrency" | `gather` does not cancel siblings on failure; TaskGroup does and surfaces ExceptionGroup | Orphan tasks keep running after partial failure; errors get lost |
| "TypedDict gives you type safety" | Static only — zero runtime checks; mistyped API payloads pass silently | False confidence at trust boundaries; use pydantic there |
| "Catch Exception and log it" | Broad catches at low levels hide bugs; catch specific types low, broad only at process edges with re-raise or crash policy | Silent corruption, undebuggable failures |
| "mypy is the standard type checker" | mypy is at 58% spec conformance and slow; pyright (98%) is the 2026 default, ty/pyrefly emerging | Recommending mypy by reflex is stale advice |
| "f-strings everywhere, including logs" | Lazy `%` args defer formatting and keep message templates stable for aggregation | f-string logs always pay formatting cost and break log grouping |
| "Async makes code faster" | Only for I/O-bound concurrency; CPU work blocks the loop; single awaited call in sequence gains nothing | Async-washing adds complexity without benefit |

## Recent Developments (3.12 → 3.14)

- **3.12 (Oct 2023)**: PEP 695 generics syntax + `type` aliases; PEP 701 (f-string
  formalization, nesting quotes); `itertools.batched`; per-interpreter GIL groundwork;
  `pathlib.Path.walk`.
- **3.13 (Oct 2024)**: new REPL (multiline, colors); experimental free-threading +
  JIT; `typing.TypeIs` (proper narrowing), `ReadOnly` TypedDict items, TypeVar
  defaults (PEP 696), `warnings.deprecated`; `copy.replace()`.
- **3.14 (Oct 2025)**: PEP 649/749 deferred annotations (no future import needed;
  `annotationlib` for introspection); PEP 750 t-strings (safe templating — SQL/HTML);
  free-threading officially supported (PEP 779, ~5-10% single-thread penalty);
  PEP 734 `concurrent.interpreters` + `InterpreterPoolExecutor`; PEP 758
  (`except A, B:` without parens, no `as`); PEP 765 SyntaxWarning for control flow in
  `finally`; `compression.zstd`; `pathlib.copy/move`; `map(..., strict=True)`;
  asyncio CLI introspection.
- Type checker landscape shift (2025-26): Astral `ty` beta, Meta Pyrefly 1.0.
- Ruff consolidated as the lint+format standard; black/isort/flake8 stacks legacy.

## Anti-Patterns

1. **Mutable default arguments** — default evaluated once at def time; shared across
   calls. Use `None` sentinel or `field(default_factory=...)`. (quantifiedcode,
   ruff B006)
2. **Bare/broad except low in the stack** — hides bugs incl. KeyboardInterrupt
   (bare) — catch specific, or broad only at the process edge with `logger.exception`.
3. **Swallowing exceptions without chaining** — `raise NewError(...)` inside except
   loses the cause; use `from err`.
4. **Fire-and-forget `asyncio.create_task`** — unreferenced tasks can be GC'd
   mid-flight and exceptions vanish; hold references or use TaskGroup. (asyncio docs)
5. **Blocking the event loop** — sync I/O / CPU work in coroutines stalls everything;
   `asyncio.to_thread` or process pool.
6. **`gather` where failure handling matters** — no sibling cancellation; prefer
   TaskGroup (or `gather(return_exceptions=True)` consciously).
7. **Pydantic for internal hot-path objects** — validation tax with no trust boundary
   benefit; use dataclass(slots=True).
8. **TypedDict trusted at runtime** — no validation happens; pydantic/msgspec at
   boundaries.
9. **`Any` as escape hatch** — disables checking transitively; `object` for "any
   value, no operations", precise types or `cast` with comment otherwise.
10. **Fixture proliferation / mystery fixtures** — dozens of near-identical fixtures,
    or autouse fixtures mutating global state; use factory fixtures + explicit deps.
11. **Over-mocking** — patching internals couples tests to implementation; fake at
    boundaries (transport, clock, filesystem via tmp_path).
12. **Expensive collection-time parametrize** — building DB connections in the
    parametrize list runs at collection; defer to fixtures.
13. **f-string logging + logging in libraries with handlers** — eager formatting,
    duplicated handlers; lazy args, configure only at entry point.
14. **`return` in `finally`** — silently swallows in-flight exceptions; now a
    SyntaxWarning (PEP 765).
15. **String-building paths / `os.path` in new code** — pathlib is the norm
    (ruff PTH); 3.14 adds copy/move.
16. **Legacy typing in new code** — `Optional[X]`, `Union`, `List[...]`, manual
    TypeVar where PEP 695 applies; `from __future__ import annotations` on 3.14.
17. **Catching exceptions to control flow where EAFP fits, and vice versa** — EAFP
    is idiomatic but exception-driven loops in hot paths are slow (try is free,
    raise is not).
18. **`ALL` in ruff select** — upgrades silently enable new rules and break CI;
    explicit curated select.

## Depth Recommendation

**Decision-tree + deep hybrid.** The data-modeling and async areas have 3+ valid
approaches with real trade-offs (decision guidance needed); typing/tooling/layout
have clear 2026 consensus (state rules concisely); the 3.12-3.14 delta is a
currency table. Numbered convention sections matching
`prompt-engineering-conventions` format, GOOD/BAD pairs where calibration matters,
overflow (full version-by-version changes, extended tooling config) to
`references/` if SKILL.md approaches 400 lines.

## Required Examples

1. PEP 695 generic function/class + `type` alias vs legacy TypeVar (GOOD/BAD).
2. Data-model decision: pydantic at API boundary, dataclass internal (GOOD/BAD pair).
3. TypedDict + Literal discriminator for an external payload.
4. TaskGroup vs gather failure semantics (GOOD/BAD).
5. Fire-and-forget task bug.
6. Exception chaining `from err`; edge-vs-core catching.
7. Lazy logging args vs f-string logging.
8. Mutable default argument.
9. Factory fixture vs fixture proliferation; parametrize with ids.
10. Ruff pyproject curated select snippet.

## Key Sources

1. docs.python.org — What's New in 3.12/3.13/3.14 (official, verified via fetch)
2. typing.python.org/en/latest/reference/best_practices.html (official typing council)
3. packaging.python.org — src layout vs flat layout (PyPA official)
4. docs.python.org asyncio-dev + asyncio-task (official; TaskGroup, task references)
5. docs.astral.sh/ruff — configuration, linter defaults philosophy
6. structlog.org logging-best-practices (canonical structured logging)
7. PEPs 695, 696, 649/749, 750, 654, 758, 765, 779, 734
8. pydevtools handbook — type checker comparison (mypy/pyright/ty/pyrefly, 2026)
9. Speakeasy — pydantic vs dataclasses trade-off analysis
10. pytest docs (goodpractices, parametrize) + NerdWallet pytest best practices
11. quantifiedcode Little Book of Python Anti-Patterns
12. Shane Chang — asyncio best practices and pitfalls (production lessons)

## Recommendations for Skill Content

1. Lead with typing conventions (highest-frequency decisions for a code-writing
   agent), then data modeling decision table, then error handling, async, testing,
   logging, layout/tooling, performance idioms, and a "what changed recently" section.
2. Anti-patterns should be woven into each numbered section as BAD examples rather
   than ghettoized in one list — the agent encounters them in context.
3. Include an explicit version-targeting note: rules assume 3.12+ baseline; flag
   3.13/3.14-only features inline so the agent doesn't use them on older targets.
4. One-line pointer to `uv-python-tooling` for package management; do not duplicate.
5. Keep prescriptive tone ("Use X. Rationale. GOOD/BAD.") per
   prompt-engineering-conventions formatting.

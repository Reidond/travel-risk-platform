# Research Brief: uv for Everything Python

Date: 2026-06-10. Researched against uv 0.11.x (latest release 0.11.19, 2026-06-03;
official Docker docs reference 0.11.20). All claims verified against docs.astral.sh/uv
and recent production reports — not training data.

## Research Question

**Core question**: How should an AI coding agent perform ALL Python tooling operations
through uv — project setup, dependencies, execution, Python versions, tools, scripts,
monorepos, builds, Docker, CI — without ever falling back to pip/poetry/pyenv/pipx habits?

**Sub-questions**:
1. What is the canonical uv command for each operation an agent commonly performs?
2. Where do agents/devs with pip/poetry muscle memory go wrong (anti-patterns)?
3. What is lockfile discipline in uv and how does it differ between dev/CI/Docker?
4. What changed recently (2025–2026) that invalidates older advice?
5. What are the documented Docker and CI integration patterns?

**Depth target**: Working → Expert. The agent must apply commands correctly AND make
judgment calls (sync vs run semantics, --locked vs --frozen, uvx vs uv run, workspace
vs path dependency).

## Codebase State

This repo (travel-risk-platform) is nearly empty — no Python code, no pyproject.toml,
no existing Python conventions. The skill establishes greenfield convention: uv is
mandatory for all Python tooling. No conflicting existing patterns to migrate.
A sibling skill `python-best-practices` owns general Python coding practice — this
skill must stay strictly on tooling.

## Approach Landscape

### Approach: uv-native project workflow (uv init/add/lock/sync/run)
- **What it is**: Declarative pyproject.toml + universal uv.lock; uv owns the .venv;
  every execution goes through `uv run`.
- **When to use**: Always, for any project work in this org. Project standard.
- **When NOT to use**: n/a here (mandated).
- **Trade-offs**: Gain reproducibility, speed (10–100x vs pip), single tool; give up
  pip's lenient resolution (can break legacy dependency trees) and Dependabot lockfile
  support (still missing for uv.lock as of early 2026).
- **Maturity**: Established. Adopted by pandas, FastAPI, Hugging Face, Airflow.
- **Source**: docs.astral.sh/uv (concepts/projects), bitecode.dev year-of-uv report.

### Approach: uv pip interface (drop-in pip replacement)
- **What it is**: `uv pip install/compile/sync` mimicking pip/pip-tools.
- **When to use**: ONLY as an escape hatch for legacy interop (e.g. third-party docs
  demanding `pip install` into an existing env, ephemeral experiments) — never for
  project dependency management.
- **When NOT to use**: Inside a uv-managed project — it bypasses pyproject.toml and
  uv.lock; the env drifts and the next exact `uv sync` removes the packages.
- **Trade-offs**: Familiar interface, but no lockfile integration; differs from pip
  (requires a venv by default, no `--user`, ignores pip config files, stricter
  pre-release handling, order-sensitive resolution).
- **Maturity**: Established but explicitly a compatibility layer.
- **Source**: docs.astral.sh/uv/pip/compatibility/.

### Approach: PEP 723 inline-metadata scripts (uv run script.py)
- **What it is**: Single-file scripts declaring deps in a `# /// script` block;
  uv builds an ephemeral env per run; lockable via `uv lock --script`.
- **When to use**: One-off automation, utilities not belonging to the project env.
- **When NOT to use**: Anything needing the project's own dependencies — inline
  metadata makes uv IGNORE project dependencies even when run inside a project.
- **Maturity**: Established (PEP 723 final; first-class uv support).
- **Source**: docs.astral.sh/uv/guides/scripts/.

### Approach: uv tool / uvx (pipx replacement)
- **What it is**: Isolated, persistent or ephemeral environments for CLI tools.
- **When to use**: Standalone CLIs (ruff, httpie, cowsay-grade utilities).
- **When NOT to use**: Tools that must import project code/deps (pytest, mypy) —
  their isolated env cannot see the project; use `uv run` for those.
- **Source**: docs.astral.sh/uv/guides/tools/ (explicit note on pytest/mypy).

### Approach: uv workspaces (Cargo-style monorepo)
- **What it is**: Multiple packages, one root `[tool.uv.workspace]`, ONE shared
  lockfile and (by default) one env; members reference each other via
  `{ workspace = true }` sources (installed editable).
- **When to use**: Interconnected packages released/managed together.
- **When NOT to use**: Members with conflicting dependency or Python requirements
  (workspace enforces a single requires-python intersection) — use plain path
  dependencies instead for isolation.
- **Source**: docs.astral.sh/uv/concepts/projects/workspaces/.

## Common Oversimplifications

| Simplified Version | What's Actually True | Why It Matters |
|---|---|---|
| "uv sync installs dependencies" | `uv sync` is EXACT by default — it also REMOVES anything not in the lockfile (`uv run` syncs inexactly) | Explains why pip-installed packages "disappear"; agents must not be surprised |
| "uv run auto-updates the lockfile, so locking is automatic" | True locally, but in CI/Docker you must pass `--locked` (error if stale) or `--frozen` (don't even check) or builds silently re-resolve | Silent dependency drift in CI |
| "uvx is just a faster way to run any tool" | uvx envs are isolated from the project; pytest/mypy via uvx can't see project deps and may pick a conflicting Python | Classic failure mode documented in docs + bitecode report |
| "uv add and uv pip install are interchangeable" | `uv add` updates pyproject.toml + uv.lock + env; `uv pip install` only mutates the env | Only `uv add` keeps the project reproducible |
| "Activate the venv, then work normally" | Supported but discouraged; an activated env goes stale — `uv run` locks+syncs before every execution | Stale-env bugs; also `python`/`pip` on PATH may resolve to system interpreter |
| "uv.lock is like requirements.txt" | uv.lock is universal (all platforms/Python versions in one file), machine-generated, never hand-edited; export with `uv export` when a requirements.txt is needed | Prevents hand-editing and per-platform lock proliferation |
| "`pip install -r requirements.txt` → `uv pip install -r requirements.txt`" | For projects the right move is `uv add -r requirements.in -c requirements.txt` (constraints preserve pins), then delete requirements files | Mechanical translation misses the declarative model |

## Recent Developments (2025–2026)

- uv at 0.11.x (June 2026); still pre-1.0 — pin uv versions in CI/Docker
  (`astral-sh/setup-uv` with `version:`, `ghcr.io/astral-sh/uv:0.11.20` images).
- uv 0.8 (2025): managed Pythons get installed onto PATH automatically; managed
  Python is the default preference (`python-preference: managed`).
- `uv version` command for semantic version bumps (`--bump minor`, `--dry-run`).
- `uv_build` is the default build backend for `uv init --package`/`--lib`.
- `uv python upgrade` transparently upgrades patch releases.
- PEP 735 dependency groups (`[dependency-groups]`) are the standard for dev deps —
  poetry-style `[tool.poetry.group.*]` is legacy.
- `uv lock --script` for reproducible PEP 723 scripts.
- pythonspeed.com (Feb 2026): uv-managed Python is production-ready IF you keep the
  uv binary current (security patches for bundled OpenSSL etc. land in new builds).
- Gap that still stands: Dependabot does not process uv.lock (audit via other means).

## Anti-Patterns

### Anti-Pattern 1: Mixing pip into a uv-managed environment
- **What people do**: `pip install X` or `uv pip install X` inside a uv project.
- **Why it seems right**: Decades of muscle memory; README files say "pip install".
- **What actually happens**: Env diverges from pyproject.toml/uv.lock; the next exact
  `uv sync` silently removes the package; reproducibility is broken.
- **What to do instead**: `uv add X` (or `uv run --with X ...` for a throwaway).
- **Source**: docs (sync exact semantics), pydevtools lockfile guide.

### Anti-Pattern 2: Activating the venv and running bare `python`/`pip`
- **What people do**: `source .venv/bin/activate && python script.py`.
- **What actually happens**: Env can be stale (no auto lock+sync); in a fresh shell,
  bare `python` may resolve to the system interpreter; agents forget activation state
  between shell calls.
- **What to do instead**: `uv run python script.py`, `uv run pytest`, etc. —
  stateless, always fresh.
- **Source**: docs.astral.sh/uv/concepts/projects/run/, pip-to-project migration guide.

### Anti-Pattern 3: Ignoring or hand-editing uv.lock
- **What people do**: .gitignore uv.lock, resolve conflicts by hand-editing it, or
  let CI regenerate it.
- **What actually happens**: Loss of reproducibility; corrupt lock; CI tests different
  versions than dev.
- **What to do instead**: Commit uv.lock always; regenerate via `uv lock`; resolve
  conflicts by checking out one side and re-running `uv lock`.
- **Source**: docs concepts/projects/sync, jakubk.cz uv lock article.

### Anti-Pattern 4: No `--locked`/`--frozen` in CI and Docker
- **What people do**: plain `uv sync` in pipelines.
- **What actually happens**: A stale lockfile is silently re-resolved at build time —
  untested versions ship.
- **What to do instead**: `uv sync --locked` (fail if stale) in CI; `--frozen` only
  when re-resolution is impossible/undesired and freshness was checked earlier.
- **Source**: official Docker & GitHub guides use `--locked` throughout.

### Anti-Pattern 5: uvx for project-coupled tools (pytest, mypy)
- **What people do**: `uvx pytest`, `uvx mypy src/`.
- **What actually happens**: Tool runs in an isolated env without the project or its
  deps installed; imports fail or wrong-Python conflicts appear.
- **What to do instead**: add to dev group and `uv run pytest` / `uv run mypy`.
- **Source**: explicit warning in docs.astral.sh/uv/guides/tools/.

### Anti-Pattern 6: pyenv/manual interpreter management alongside uv
- **What people do**: pyenv install + pyenv local, or brew-installed Pythons, then
  point uv at them ad hoc.
- **What actually happens**: Interpreter drift between machines; uv already downloads
  and pins interpreters.
- **What to do instead**: `uv python install`, `uv python pin 3.13` (.python-version
  committed), requires-python in pyproject.toml.
- **Source**: docs concepts/python-versions.

### Anti-Pattern 7: sys.executable / bare `python` confusion in subprocesses
- **What people do**: scripts spawn `subprocess.run(["python", ...])` or
  `subprocess.run(["pip", ...])`.
- **What actually happens**: PATH lookup may find a different interpreter than the
  one running; pip may not exist in the uv env at all (uv envs omit pip by default).
- **What to do instead**: spawn `sys.executable`; never shell out to pip — shell out
  to `uv` itself if env mutation is needed.
- **Source**: uv envs created without pip (docs venv behavior); standard Python guidance.

### Anti-Pattern 8: Copying the local .venv into Docker images
- **What people do**: `COPY . .` without .dockerignore, shipping the host .venv.
- **What actually happens**: Platform-specific binaries break in the container.
- **What to do instead**: add `.venv` to .dockerignore; build env inside the image
  with `uv sync --locked`; use intermediate dependency layers + cache mounts.
- **Source**: docs.astral.sh/uv/guides/integration/docker/ (explicit warning).

### Anti-Pattern 9: Keeping requirements.txt as the source of truth
- **What people do**: maintain requirements.txt and pyproject.toml in parallel.
- **What actually happens**: Two sources of truth drift apart.
- **What to do instead**: pyproject.toml + uv.lock are canonical; generate
  requirements.txt on demand via `uv export --format requirements.txt` for tools
  that need it.
- **Source**: pip-to-project migration guide.

### Anti-Pattern 10: Expecting project deps inside a PEP 723 script
- **What people do**: run an inline-metadata script inside a project and import
  project dependencies not declared in the script block.
- **What actually happens**: "When using inline script metadata, even if uv run is
  used in a project, the project's dependencies will be ignored" — ImportError.
- **What to do instead**: declare every dep in the script block (`uv add --script`),
  or drop the inline block and make it a project script.
- **Source**: docs.astral.sh/uv/guides/scripts/ (quoted).

### Anti-Pattern 11: Unpinned uv version in CI/Docker
- **What people do**: `ghcr.io/astral-sh/uv:latest`, setup-uv without `version:`.
- **What actually happens**: Pre-1.0 tool — behavior changes across minor versions;
  builds break without code changes.
- **What to do instead**: pin (`uv:0.11.20`, `version: "0.11.20"`); upgrade
  deliberately (also gets security fixes for managed Pythons).
- **Source**: Docker guide best-practice note; pythonspeed production article.

## Depth Recommendation

**Concise convention skill with decision points** — the approach landscape has one
mandated path (uv-native), so most content is "state the command, show GOOD/BAD".
Decision-tree elements needed only at: sync vs run semantics, --locked vs --frozen,
uvx vs uv run, workspace vs path dep. Rapidly-evolving specifics (exact flags of
setup-uv, image tags) should note pinning + pointer to official docs. Keep SKILL.md
lean; push full Dockerfile/CI YAML to references/.

## Required Examples

1. GOOD/BAD: `uv add requests` vs `pip install requests` (the headline pair).
2. GOOD/BAD: `uv run pytest` vs `source .venv/bin/activate && pytest`.
3. GOOD/BAD: `uv run pytest` vs `uvx pytest` (boundary case — tool vs project tool).
4. GOOD/BAD: CI `uv sync --locked` vs bare `uv sync`.
5. PEP 723 script block with `uv add --script`.
6. Dependency groups: `uv add --dev pytest`, `uv add --group lint ruff`.
7. Migration table pip/poetry → uv (full mapping).
8. Multi-stage Dockerfile with cache mounts (reference file).
9. Edge case: temporary dep without polluting project — `uv run --with`.

## Key Sources

1. docs.astral.sh/uv — official Astral docs (concepts: projects/dependencies, sync,
   run, init, workspaces, python-versions; guides: scripts, tools, package, Docker,
   GitHub Actions, pip-to-project migration; pip/compatibility). Primary authority;
   fetched June 2026.
2. github.com/astral-sh/uv/releases — release cadence/version check (0.11.19,
   2026-06-03).
3. pythonspeed.com/articles/uv-python-production/ — Itamar Turner-Trauring (Feb 2026):
   uv-managed Python production-readiness; keep uv binary current for security.
4. bitecode.dev "A year of uv: pros, cons, and should you migrate" — long-term
   production experience: uvx/tool Python conflicts, legacy resolver breakage,
   cache growth, Dependabot gap.
5. pydevtools.com handbook (lockfile how-to; uv 0.8 release note — PATH-managed
   Pythons).
6. Bixoto / loopwerk / pydevtools poetry→uv migration guides + `uvx migrate-to-uv`
   tool — command mapping confirmation.

## Recommendations for Skill Content

1. Open with the absolute rule: every Python operation goes through uv; bare
   `python`, `pip`, `poetry`, `pyenv`, `pipx`, manual `venv` are prohibited.
2. Organize as numbered convention sections (match prompt-engineering-conventions
   style) with GOOD/BAD command pairs in fenced blocks.
3. Include the full migration mapping table (pip + poetry + pyenv + pipx → uv).
4. Dedicate a section to lockfile discipline (--locked/--frozen, exact vs inexact
   sync, commit uv.lock, uv export) — highest-harm area.
5. Include all 11 anti-patterns, condensed; each with the corrective command.
6. Move full Dockerfile, GitHub Actions YAML, and workspace details to
   references/docker-and-ci.md (linked explicitly); keep condensed rules in SKILL.md.
7. Note version currency: written against uv 0.11.x (June 2026); verify fast-moving
   flags against docs.astral.sh/uv.

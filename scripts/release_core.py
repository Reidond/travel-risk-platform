# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Cut a stable release of the core library (tourism-risk).

The actual PyPI upload happens in CI: pushing a ``core-v<version>`` tag triggers
``.github/workflows/publish-pypi.yml``, which re-runs the full gate, builds, and
publishes via Trusted Publishing (no local token needed). This script is the
safe front door to that path — it validates preconditions, optionally bumps the
version, runs the same gates CI will, then creates and pushes the tag.

Run from the repository root:

    uv run scripts/release_core.py                 # release the current pyproject version
    uv run scripts/release_core.py --bump patch    # 0.1.0 -> 0.1.1, commit, then release
    uv run scripts/release_core.py --bump minor    # 0.1.0 -> 0.2.0
    uv run scripts/release_core.py 1.2.0           # set an explicit version, commit, then release
    uv run scripts/release_core.py --dry-run       # print the plan, change nothing

Preview releases are separate and automatic: every push to main publishes a
``.devN`` prerelease (see publish-pypi.yml). This script is for stable only.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TAG_PREFIX = "core-v"
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


def run(*args: str, capture: bool = False, check: bool = True) -> str:
    """Run a command at the repo root, echoing it; return stdout when captured."""
    print(f"  $ {' '.join(args)}")
    result = subprocess.run(
        args,
        cwd=REPO_ROOT,
        check=check,
        text=True,
        stdout=subprocess.PIPE if capture else None,
    )
    return (result.stdout or "").strip()


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def current_version() -> str:
    return run("uv", "version", "--project", "core", "--short", capture=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    target = parser.add_mutually_exclusive_group()
    target.add_argument(
        "--bump",
        choices=["patch", "minor", "major"],
        help="bump core/pyproject.toml by this part, commit, then release",
    )
    target.add_argument(
        "version",
        nargs="?",
        help="explicit X.Y.Z to set, commit, then release (default: release the current version)",
    )
    parser.add_argument("--dry-run", action="store_true", help="print the plan and exit without changing anything")
    parser.add_argument(
        "--remote", default="origin", help="git remote to push the branch and tag to (default: origin)"
    )
    args = parser.parse_args()

    # --- preconditions -------------------------------------------------------
    branch = run("git", "rev-parse", "--abbrev-ref", "HEAD", capture=True)
    if branch != "main":
        fail(f"stable releases are cut from main, but HEAD is on '{branch}'")

    if run("git", "status", "--porcelain", capture=True):
        fail("working tree is dirty — commit or stash first (the tag must point at a clean tree)")

    run("git", "fetch", "--quiet", args.remote, "main", check=False)
    local = run("git", "rev-parse", "@", capture=True)
    remote = run("git", "rev-parse", "@{u}", capture=True, check=False)
    if remote and local != remote:
        fail(f"local main ({local[:7]}) differs from {args.remote}/main ({remote[:7]}) — pull/push first")

    # --- resolve the version we will tag -------------------------------------
    if args.bump:
        new_version = run("uv", "version", "--project", "core", "--bump", args.bump, "--dry-run", capture=True)
        new_version = new_version.split("=>")[-1].strip()
    elif args.version:
        if not SEMVER.match(args.version):
            fail(f"'{args.version}' is not a plain X.Y.Z version")
        new_version = args.version
    else:
        new_version = current_version()

    if not SEMVER.match(new_version):
        fail(f"resolved version '{new_version}' is not a plain X.Y.Z stable version")

    tag = f"{TAG_PREFIX}{new_version}"
    will_commit = bool(args.bump or args.version)

    existing_tags = run("git", "tag", "--list", tag, capture=True)
    if existing_tags:
        fail(f"tag {tag} already exists — bump to a new version")

    print(f"\nReleasing tourism-risk {new_version}  (current pyproject: {current_version()})")
    print(f"  tag:    {tag}")
    print(f"  commit: {'yes — bump core/pyproject.toml then tag' if will_commit else 'no — tag the current tree'}")
    print(f"  push:   {args.remote} main + {tag}  (CI then publishes to PyPI)\n")

    if args.dry_run:
        print("dry-run: nothing changed.")
        return

    # --- apply version bump (if any) -----------------------------------------
    if will_commit:
        run("uv", "version", "--project", "core", new_version)
        run("git", "add", "core/pyproject.toml", "uv.lock")
        run("git", "commit", "-m", f"release(core): tourism-risk {new_version}")

    # --- run the same gates CI will, so a broken tree never gets tagged ------
    print("\nRunning gates (build + clean-env import smoke)...")
    run("rm", "-rf", "dist")
    run("uv", "build", "--package", "tourism-risk", "-o", "dist")
    # Install only the freshly built wheel into a throwaway env (core ships
    # zero runtime deps) and prove it imports — the same check CI runs.
    wheel = next((REPO_ROOT / "dist").glob("*.whl"))
    run("uv", "run", "--isolated", "--no-project", "--with", str(wheel), "python", "-c", "import tourism_risk")

    # --- tag + push: this is the trigger CI watches for ----------------------
    run("git", "tag", "-a", tag, "-m", f"tourism-risk {new_version}")
    if will_commit:
        run("git", "push", args.remote, "main")
    run("git", "push", args.remote, tag)

    print(
        f"\nPushed {tag}. Watch the publish run:\n"
        f"  https://github.com/Reidond/travel-risk-platform/actions/workflows/publish-pypi.yml\n"
        f"It will publish tourism-risk {new_version} to PyPI and create the GitHub Release."
    )


if __name__ == "__main__":
    main()

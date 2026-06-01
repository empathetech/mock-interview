#!/usr/bin/env python3
"""Fail if any shell file changed without bumping `assets/shell/VERSION`.

"Shell files" are exactly the deployed fileset defined by `shell_sync.mappings()` (the shared UI, `serve.py`,
and the dashboard template) — change one without bumping VERSION and every deployed portfolio inherits drift
that the version-string check can't see. This guard makes that mistake impossible to commit (and impossible to
merge, via the CI workflow that calls the same script).

Usage:
  python3 scripts/check_version_bump.py                 # check STAGED changes (pre-commit hook)
  python3 scripts/check_version_bump.py <git-range>     # check a range, e.g. origin/main...HEAD (CI)

Exit 0 = ok (no shell change, or shell change WITH a VERSION bump); exit 1 = shell changed but VERSION didn't.
"""
import subprocess
import sys
from pathlib import Path

import shell_sync  # sibling module — single source of truth for "what is the shell"

SKILL_ROOT = Path(__file__).resolve().parent.parent
VERSION_REL = "assets/shell/VERSION"


def shell_files():
    """Deployed shell sources, repo-relative, excluding VERSION itself."""
    rels = {str(src.relative_to(SKILL_ROOT)) for src, _dest in shell_sync.mappings()}
    rels.discard(VERSION_REL)
    return rels


def changed(range_arg):
    cmd = ["git", "diff", "--name-only", range_arg] if range_arg else ["git", "diff", "--cached", "--name-only"]
    out = subprocess.run(cmd, cwd=SKILL_ROOT, capture_output=True, text=True).stdout
    return {ln.strip() for ln in out.splitlines() if ln.strip()}


def main(argv):
    range_arg = argv[1] if len(argv) > 1 else None
    ch = changed(range_arg)
    touched = sorted(ch & shell_files())
    if not touched:
        return 0
    if VERSION_REL in ch:
        print(f"✓ shell changed and {VERSION_REL} bumped — ok")
        return 0
    print("✗ Shell files changed but assets/shell/VERSION was NOT bumped:")
    for f in touched:
        print(f"    {f}")
    print(f"\n  Fix: bump {VERSION_REL} (semver) and add a CHANGELOG.md entry, then re-commit.")
    print("  Why: deployed portfolios detect upgrades by this version + a content hash. An unbumped shell")
    print("  change ships drift that won't be flagged. See references/component-inventory.md → Versioning.")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))

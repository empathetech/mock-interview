#!/usr/bin/env python3
"""Shell sync — keep a deployed portfolio's shared shell in step with this skill, painlessly.

The problem this solves: a portfolio is a *deployment* — at setup we copy the skill's shell
(`assets/shell/` + `serve.py` + the dashboard template) into `<portfolio>/shell/` and `<portfolio>/index.html`,
and stamp `shell_version` in `portfolio.json`. The skill keeps evolving afterward, but the copy doesn't
auto-update. A version *string* alone can't catch this (someone forgets to bump), so we compare BOTH the
stamped semver AND a content hash of the actual files.

Crucially, an upgrade is **graceful**: it only ever replaces the shared shell fileset. Interview instance
folders (their `interview.json`, `artifacts/`, `transcript.json`, `prompt.md`, tests, feedback) are *data*
and are never touched. That's the whole point of the shell-vs-instance split — the shell is replaceable,
the candidate's work is not.

Usage:
  python3 scripts/shell_sync.py version                 # print this skill's shell version
  python3 scripts/shell_sync.py check <portfolio>       # report version/content drift (exit 0 = in sync)
  python3 scripts/shell_sync.py upgrade <portfolio>     # re-copy shell + stamp version (instances untouched)

`check` exits 3 when drift is found (so hooks/CI can branch on it), 0 when in sync.
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent


def skill_version() -> str:
    return (SKILL_ROOT / "assets" / "shell" / "VERSION").read_text(encoding="utf-8").strip()


def mappings():
    """Yield (source file in the skill, destination path relative to the portfolio root).

    This is the canonical definition of "the shell": everything a portfolio needs that is shared and
    versioned. Per-instance templates (interview.html) are NOT here — those are stamped per interview.
    """
    sh = SKILL_ROOT / "assets" / "shell"
    pairs = []
    # Flat shell files + the VERSION stamp.
    for name in ("shell.css", "shell.js", "theme.js", "VERSION"):
        pairs.append((sh / name, f"shell/{name}"))
    # lib/ and modules/ trees (every file, so new modules sync automatically).
    for sub in ("lib", "modules"):
        for f in sorted((sh / sub).glob("*")):
            if f.is_file():
                pairs.append((f, f"shell/{sub}/{f.name}"))
    # The server and the dashboard template land at their deployed locations.
    pairs.append((SKILL_ROOT / "scripts" / "serve.py", "shell/serve.py"))
    pairs.append((SKILL_ROOT / "assets" / "templates" / "portfolio-index.html", "index.html"))
    return pairs


def _hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else ""


def diff(portfolio: Path):
    """Return (changed, missing) lists of dest-relative paths where the portfolio differs from the skill."""
    changed, missing = [], []
    for src, dest in mappings():
        dst = portfolio / dest
        if not dst.exists():
            missing.append(dest)
        elif _hash(src) != _hash(dst):
            changed.append(dest)
    return changed, missing


def stamped_version(portfolio: Path) -> str:
    try:
        return json.loads((portfolio / "portfolio.json").read_text()).get("shell_version", "?")
    except Exception:
        return "?"


def check(portfolio: Path) -> int:
    cur, want = stamped_version(portfolio), skill_version()
    changed, missing = diff(portfolio)
    print(f"\nShell sync — {portfolio}")
    print(f"  portfolio shell_version : {cur}")
    print(f"  skill shell_version     : {want}")
    if not changed and not missing and cur == want:
        print("  ✓ in sync — nothing to do.\n")
        return 0
    if cur != want:
        print(f"  ✗ version drift: portfolio is at {cur}, skill ships {want}")
    for d in missing:
        print(f"  ✗ missing file (skill has it, portfolio doesn't): {d}")
    for d in changed:
        print(f"  ✗ content drift: {d}")
    print(f"\n  → harmonize with:  python3 {Path(__file__).relative_to(SKILL_ROOT)} upgrade {portfolio}")
    print("    (re-copies the shell only; your interviews and their artifacts are left untouched)\n")
    return 3


def upgrade(portfolio: Path) -> int:
    if not (portfolio / "portfolio.json").exists():
        print(f"✗ {portfolio} is not a portfolio (no portfolio.json).")
        return 1
    want = skill_version()
    n = 0
    for src, dest in mappings():
        dst = portfolio / dest
        dst.parent.mkdir(parents=True, exist_ok=True)
        if not dst.exists() or _hash(src) != _hash(dst):
            shutil.copy2(src, dst)
            n += 1
            print(f"  ↻ {dest}")
    # Stamp the new version in portfolio.json (preserving everything else).
    pj_path = portfolio / "portfolio.json"
    pj = json.loads(pj_path.read_text())
    prev = pj.get("shell_version")
    pj["shell_version"] = want
    pj_path.write_text(json.dumps(pj, indent=2) + "\n", encoding="utf-8")
    print(f"\n  ✓ upgraded {n} file(s); shell_version {prev} → {want}")
    print("    Interview instances and artifacts were NOT modified. Restart the server to load the new serve.py:")
    print("      pkill -f 'serve.py'; python3 shell/serve.py\n")
    return 0


def main(argv):
    if len(argv) < 2 or argv[1] not in ("version", "check", "upgrade"):
        print(__doc__)
        return 2
    cmd = argv[1]
    if cmd == "version":
        print(skill_version())
        return 0
    if len(argv) < 3:
        print(f"✗ `{cmd}` needs a portfolio path:  python3 scripts/shell_sync.py {cmd} <portfolio>")
        return 2
    portfolio = Path(argv[2]).expanduser().resolve()
    return check(portfolio) if cmd == "check" else upgrade(portfolio)


if __name__ == "__main__":
    sys.exit(main(sys.argv))

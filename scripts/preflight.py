#!/usr/bin/env python3
"""Mock Interview preflight — run once on first setup (and any time something seems off).

Design choice: this skill is deliberately near-zero-install. `serve.py` is Python-stdlib-only (no pip
packages), and every UI library (CodeMirror, Mermaid, Excalidraw, React, DuckDB-WASM) loads from a CDN at
runtime with graceful offline fallbacks. So there is nothing to `pip install` or `npm install` for the core.

That means "ensure dependencies" = VERIFY the few host tools are present and tell the user exactly what each
one enables, rather than silently installing system packages (which would be invasive). This script does that
and prints a readiness report. Exit code is 0 if the required pieces are present, 1 otherwise.
"""
import json
import shutil
import subprocess
import sys
import urllib.request

CHECKS = []


def have(cmd):
    return shutil.which(cmd) is not None


def ver(cmd, args=("--version",)):
    try:
        return subprocess.run([cmd, *args], capture_output=True, text=True, timeout=5).stdout.strip().splitlines()[0]
    except Exception:
        return None


def line(ok, name, detail):
    CHECKS.append(ok)
    mark = "✓" if ok else ("·" if ok is None else "✗")
    print(f"  {mark}  {name:<22} {detail}")


def main():
    print("\nMock Interview — preflight check\n" + "-" * 40)

    # REQUIRED: python3 to run the local server
    line(True, "python3", f"{sys.version.split()[0]} — runs the interview server (required) ✓")

    # OPTIONAL: node, only to EXECUTE JavaScript interview code (Python works without it)
    if have("node"):
        line(True, "node", f"{ver('node')} — enables JavaScript code execution")
    else:
        line(None, "node", "not found — fine unless you run JavaScript coding interviews")

    # OPTIONAL: gh, only to open community-contribution issues
    if have("gh"):
        try:
            authed = subprocess.run(["gh", "auth", "status"], capture_output=True, timeout=5).returncode == 0
        except Exception:
            authed = False
        line(True, "gh (GitHub CLI)", "authenticated ✓" if authed else "installed, not authenticated (run: gh auth login)")
    else:
        line(None, "gh (GitHub CLI)", "not found — only needed to contribute interviews back to the community")

    # OPTIONAL: internet, for the rich editor/diagram libraries (CDN). Offline → plain-textarea fallbacks.
    try:
        urllib.request.urlopen("https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js", timeout=4)
        line(True, "internet (CDN libs)", "reachable — rich editor, Mermaid, Excalidraw available")
    except Exception:
        line(None, "internet (CDN libs)", "unreachable — UI still works with plain-textarea fallbacks (offline mode)")

    print("-" * 40)
    required_ok = CHECKS[0]  # python3
    if required_ok:
        print("Ready to run interviews. Start the server from your portfolio:  python3 shell/serve.py\n")
    else:
        print("Missing python3 — install Python 3 to run the interview server.\n")
    return 0 if required_ok else 1


if __name__ == "__main__":
    sys.exit(main())

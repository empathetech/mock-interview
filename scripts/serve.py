#!/usr/bin/env python3
"""Mock Interview local server.

A dependency-free (stdlib-only) server that powers the interview UI. It does three jobs:

  1. Serves the portfolio's static files (the shared `shell/` and each interview instance).
  2. Lets the browser SAVE the candidate's work to real files on disk, so the interviewer
     (Claude, in the terminal) can read their code / notes / diagrams / SQL in flight.
  3. Lets the browser RUN the candidate's code in the real toolchain (python3, node, ...),
     so tests behave like a real coding environment and results land in a file Claude can read.

Run it from the PORTFOLIO ROOT (the folder that contains `shell/` and the interview folders):

    python3 shell/serve.py            # serves cwd, picks a free port, prints the URL

Then open the printed URL and navigate to your interview, e.g. http://localhost:8000/<slug>/interview.html

Security: this binds to 127.0.0.1 only and refuses to read/write/execute anything outside the
portfolio root. It is meant for a single local user practicing interviews, not for exposure to a network.
"""

import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(os.environ.get("MOCK_INTERVIEW_ROOT", os.getcwd())).resolve()

# language -> how to run a single source file. Extend as needed.
RUNNERS = {
    "python": [sys.executable or "python3"],
    "javascript": ["node"],
    "node": ["node"],
}
RUN_TIMEOUT_SECONDS = 15
MAX_BODY_BYTES = 16 * 1024 * 1024     # reject oversized requests (memory DoS guard)
MAX_OUTPUT_CHARS = 256 * 1024         # truncate giant program output before sending it back
SOCKET_TIMEOUT_SECONDS = 30           # a stalled client can't wedge its worker thread forever

# Note: /api/run executes arbitrary code as the current user by design (real test execution is the point).
# The sandbox protects file *paths*, not the *code*. That's acceptable only because we bind to 127.0.0.1.


def _safe(path_str: str) -> Path:
    """Resolve a client-supplied path and refuse anything outside ROOT."""
    p = (ROOT / path_str.lstrip("/")).resolve()
    if ROOT not in p.parents and p != ROOT:
        raise ValueError(f"path escapes portfolio root: {path_str}")
    return p


def _clip(s: str) -> str:
    """Bound program output so one runaway print() can't blow up memory / the response."""
    if s and len(s) > MAX_OUTPUT_CHARS:
        return s[:MAX_OUTPUT_CHARS] + f"\n…[truncated {len(s) - MAX_OUTPUT_CHARS} chars]"
    return s


# ---- interview-management helpers ------------------------------------------------
# These power the portfolio dashboard's per-interview actions (reset / clone / delete / edit)
# and the candidate-profile editor. Every path is resolved through _safe(), so nothing can
# touch or remove anything outside the portfolio root.
PORTFOLIO_JSON = "portfolio.json"
VALID_STATUSES = {"not_started", "in_progress", "ended", "completed"}
# Interview metadata the dashboard is allowed to edit. `slug` is intentionally NOT here — it's the
# folder name; "renaming" an interview is a clone + delete, not an in-place edit.
EDITABLE_META = ("title", "type", "company", "role_category", "role", "level", "date", "status", "overall")
EDITABLE_PROFILE = ("name", "github", "linkedin")
SLUG_RE = re.compile(r"^[A-Za-z0-9._-]+$")   # one safe path segment, no slashes / traversal


def _read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _write_json(path: Path, obj):
    path.write_text(json.dumps(obj, indent=2) + "\n", encoding="utf-8")


def _portfolio_path() -> Path:
    return ROOT / PORTFOLIO_JSON


def _instance_dir(slug: str) -> Path:
    """Resolve an interview instance folder by slug, refusing anything that isn't a real instance."""
    if not slug or not SLUG_RE.match(slug) or slug in (".", "..", "shell"):
        raise ValueError(f"invalid interview slug: {slug!r}")
    d = _safe(slug)
    if not d.is_dir():
        raise ValueError(f"no such interview: {slug}")
    if not (d / "interview.json").is_file():
        raise ValueError(f"{slug} is not an interview instance (no interview.json)")
    return d


def _portfolio_upsert(slug: str, fields: dict):
    """Insert or update a single interview's snapshot in portfolio.json, keeping it in sync with
    the instance's interview.json. Best-effort: if there's no portfolio.json, quietly do nothing."""
    pf = _read_json(_portfolio_path(), None)
    if not isinstance(pf, dict):
        return
    items = pf.setdefault("interviews", [])
    for it in items:
        if it.get("slug") == slug:
            it.update(fields)
            break
    else:
        items.insert(0, {"slug": slug, **fields})
    _write_json(_portfolio_path(), pf)


def _portfolio_remove(slug: str):
    pf = _read_json(_portfolio_path(), None)
    if not isinstance(pf, dict):
        return
    pf["interviews"] = [it for it in pf.get("interviews", []) if it.get("slug") != slug]
    _write_json(_portfolio_path(), pf)


def _reset_instance(d: Path) -> dict:
    """Return an instance to a fresh, unstarted state, preserving the problem definition (prompt,
    tests, background, config, starter code). Wipes the candidate's work and the conversation:
    the artifacts/ dir, transcript.json, feedback.md, and the status/overall fields."""
    art = d / "artifacts"
    if art.exists():
        shutil.rmtree(art)
    art.mkdir(parents=True, exist_ok=True)
    (d / "transcript.json").write_text("[]\n", encoding="utf-8")
    fb = d / "feedback.md"
    if fb.exists():
        fb.unlink()
    iv_path = d / "interview.json"
    iv = _read_json(iv_path, None)
    if isinstance(iv, dict):
        iv["status"] = "not_started"
        iv["overall"] = None
        _write_json(iv_path, iv)
        return iv
    return {}


def _next_attempt_slug(slug: str) -> str:
    """Pick the next free `<base>-attempt-N` slug (the original counts as attempt 1)."""
    base = re.sub(r"-attempt-\d+$", "", slug)
    n = 2
    while (ROOT / f"{base}-attempt-{n}").exists():
        n += 1
    return f"{base}-attempt-{n}"


class Handler(http.server.SimpleHTTPRequestHandler):
    timeout = SOCKET_TIMEOUT_SECONDS   # StreamRequestHandler applies this as the socket read timeout

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):  # keep the terminal quiet-ish
        if "/api/" in (self.path or ""):
            sys.stderr.write("[mock-interview] %s\n" % (fmt % args))

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        n = int(self.headers.get("Content-Length", 0))
        if n > MAX_BODY_BYTES:
            raise ValueError(f"request too large ({n} bytes > {MAX_BODY_BYTES})")
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        if self.path == "/api/ping":           # read-only health check (no disk writes)
            return self._json(200, {"ok": True})
        return super().do_GET()

    def do_POST(self):
        try:
            routes = {
                "/api/save": self._save,
                "/api/run": self._run,
                "/api/reset": self._reset,
                "/api/clone": self._clone,
                "/api/delete": self._delete,
                "/api/meta": self._meta,
                "/api/profile": self._profile,
            }
            handler = routes.get(self.path)
            if handler:
                handler()
            else:
                self._json(404, {"error": "unknown endpoint"})
        except Exception as e:  # surface the error to the UI instead of 500-ing silently
            self._json(400, {"error": str(e)})

    def _save(self):
        data = self._read_body()
        target = _safe(data["path"])
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(data.get("content", ""), encoding="utf-8")
        self._json(200, {"ok": True, "path": str(target.relative_to(ROOT)), "bytes": target.stat().st_size})

    # ---- interview management (dashboard actions) -------------------------------
    def _reset(self):
        """Body: {slug}. Wipe one interview's work + conversation; keep the problem itself."""
        slug = (self._read_body() or {}).get("slug", "")
        d = _instance_dir(slug)
        _reset_instance(d)
        _portfolio_upsert(slug, {"status": "not_started", "overall": None})
        self._json(200, {"ok": True, "slug": slug, "status": "not_started"})

    def _clone(self):
        """Body: {slug, new_slug?, new_title?}. Duplicate an interview as a FRESH attempt: same
        problem/tests/settings, empty work/transcript/feedback. The original is untouched."""
        data = self._read_body() or {}
        slug = data.get("slug", "")
        src = _instance_dir(slug)
        new_slug = (data.get("new_slug") or _next_attempt_slug(slug)).strip()
        if not SLUG_RE.match(new_slug) or new_slug in (".", "..", "shell"):
            raise ValueError(f"invalid target slug: {new_slug!r}")
        dst = _safe(new_slug)
        if dst.exists():
            raise ValueError(f"an interview named {new_slug!r} already exists")
        shutil.copytree(src, dst)
        _reset_instance(dst)
        iv = _read_json(dst / "interview.json", {}) or {}
        iv["slug"] = new_slug
        if data.get("new_title"):
            iv["title"] = data["new_title"]
        _write_json(dst / "interview.json", iv)
        # Base the new portfolio snapshot on the source's so type/company/role/level carry over.
        pf = _read_json(_portfolio_path(), {}) or {}
        entry = next((dict(it) for it in pf.get("interviews", []) if it.get("slug") == slug), {})
        entry.update({"slug": new_slug, "status": "not_started", "overall": None})
        if iv.get("title"):
            entry["title"] = iv["title"]
        _portfolio_upsert(new_slug, entry)
        self._json(200, {"ok": True, "slug": new_slug, "title": iv.get("title")})

    def _delete(self):
        """Body: {slug}. Permanently remove an interview folder and its portfolio entry."""
        slug = (self._read_body() or {}).get("slug", "")
        d = _instance_dir(slug)
        shutil.rmtree(d)
        _portfolio_remove(slug)
        self._json(200, {"ok": True, "slug": slug})

    def _meta(self):
        """Body: {slug, patch}. Edit interview metadata in interview.json and mirror it to
        portfolio.json. Only EDITABLE_META keys are honored; slug is not editable here."""
        data = self._read_body() or {}
        slug = data.get("slug", "")
        patch = data.get("patch") or {}
        if not isinstance(patch, dict):
            raise ValueError("patch must be an object")
        d = _instance_dir(slug)
        iv_path = d / "interview.json"
        iv = _read_json(iv_path, None)
        if not isinstance(iv, dict):
            raise ValueError("interview.json is missing or invalid")
        clean = {}
        for k in EDITABLE_META:
            if k in patch:
                v = patch[k]
                if k == "status" and v not in VALID_STATUSES:
                    raise ValueError(f"invalid status: {v!r}")
                if k == "type" and (not isinstance(v, str) or not v.strip()):
                    raise ValueError("type cannot be empty")
                clean[k] = v
        iv.update(clean)
        _write_json(iv_path, iv)
        _portfolio_upsert(slug, clean)
        self._json(200, {"ok": True, "slug": slug, "patch": clean})

    def _profile(self):
        """Body: {patch}. Edit the candidate profile (name + GitHub/LinkedIn) in portfolio.json."""
        patch = (self._read_body() or {}).get("patch") or {}
        if not isinstance(patch, dict):
            raise ValueError("patch must be an object")
        pf = _read_json(_portfolio_path(), None)
        if not isinstance(pf, dict):
            raise ValueError("portfolio.json is missing or invalid")
        cand = pf.setdefault("candidate", {})
        clean = {k: patch[k] for k in EDITABLE_PROFILE if k in patch}
        cand.update(clean)
        _write_json(_portfolio_path(), pf)
        self._json(200, {"ok": True, "candidate": cand})

    def _run(self):
        """Run code. Body: {language, code | file, stdin?, args?}.

        If `code` is given, it's written to a temp file and executed. If `file` is given
        (a path under ROOT, e.g. the saved solution), that file is executed in place so
        relative imports of sibling files (tests, helpers) work like a real project.
        """
        data = self._read_body()
        lang = (data.get("language") or "python").lower()
        if lang not in RUNNERS:
            return self._json(400, {"error": f"unsupported language: {lang}"})
        cmd = list(RUNNERS[lang])

        cwd = ROOT
        cleanup = None
        if data.get("file"):
            f = _safe(data["file"])
            cwd = f.parent
            cmd.append(str(f))
        else:
            suffix = ".py" if lang == "python" else ".js"
            tmp = tempfile.NamedTemporaryFile("w", suffix=suffix, delete=False, dir=str(ROOT))
            tmp.write(data.get("code", ""))
            tmp.close()
            cmd.append(tmp.name)
            cleanup = tmp.name
        cmd += [str(a) for a in data.get("args", [])]

        env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")  # keep artifacts/ free of __pycache__
        try:
            proc = subprocess.run(
                cmd, cwd=str(cwd), input=data.get("stdin", ""),
                capture_output=True, text=True, timeout=RUN_TIMEOUT_SECONDS, env=env,
            )
            result = {"stdout": _clip(proc.stdout), "stderr": _clip(proc.stderr), "exit_code": proc.returncode}
        except subprocess.TimeoutExpired:
            result = {"stdout": "", "stderr": f"Timed out after {RUN_TIMEOUT_SECONDS}s.", "exit_code": 124}
        except FileNotFoundError:
            result = {"stdout": "", "stderr": f"Interpreter for '{lang}' not found on PATH.", "exit_code": 127}
        finally:
            if cleanup:
                try:
                    os.unlink(cleanup)
                except OSError:
                    pass

        # Persist the latest run so the interviewer can read it without the UI relaying it.
        if data.get("results_path"):
            try:
                rp = _safe(data["results_path"])
                rp.parent.mkdir(parents=True, exist_ok=True)
                rp.write_text(json.dumps(result, indent=2), encoding="utf-8")
                result["results_path"] = str(rp.relative_to(ROOT))
            except Exception as e:
                result["results_path_error"] = str(e)   # don't swallow — the interviewer needs to know
        self._json(200, result)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    # Threaded so one slow/stalled request (or a long code run) can't freeze the whole UI.
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler) as httpd:
        httpd.daemon_threads = True
        actual = httpd.server_address[1]
        print(f"\n  Mock Interview server running.")
        print(f"  Portfolio root: {ROOT}")
        print(f"  Open:           http://localhost:{actual}/")
        print(f"  (navigate to <interview-slug>/interview.html)\n")
        print("  Ctrl-C to stop.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Stopped.")


if __name__ == "__main__":
    main()

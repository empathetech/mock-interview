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
            if self.path == "/api/save":
                self._save()
            elif self.path == "/api/run":
                self._run()
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

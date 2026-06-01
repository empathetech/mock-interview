# UI Architecture

How the interactive interview UI is built, why it's structured this way, and how to extend it. The
guiding principle: **build the UI once, reuse it forever.** A candidate doing their tenth interview should
not wait for you to regenerate an editor — they should get a fresh prompt in an interface they already know.

## Table of contents
1. [The big picture](#the-big-picture)
2. [Portfolio layout](#portfolio-layout)
3. [The shared shell](#the-shared-shell)
4. [The local server (serve.py)](#the-local-server-servepy)
5. [How an interview instance is wired](#how-an-interview-instance-is-wired)
6. [Module system — adding a new interview type](#module-system)
7. [JSON schemas](#json-schemas)
8. [Setup checklist](#setup-checklist)

## The big picture

Three layers, loaded progressively, exactly mirroring how this skill itself is organized:

- **The shell** (`<portfolio>/shell/`) — the reusable chrome: header, budgeted Scope/Roadmap/Code/Retro phase
  timer, overall timer, the right-rail tabs (Prompt/Transcript/Feedback/Splits/Notes/Improve), the help/FAQ
  overlay (the `?` button explains the terminal-interviewer + fourth-wall protocol), and the save/run plumbing.
  Copied once from this skill's `assets/shell/` into the candidate's portfolio.
- **The modules** (`shell/modules/<type>.js`) — one per interview type (coding, system-design, case-study,
  data-sql, …). The shell loads the one the current interview needs. Also copied once.
- **The instance** (`<portfolio>/<slug>/`) — the only thing you generate per interview: a prompt, an
  `interview.json`, starter files, tests, background packs. Tiny. This is where "change only the artifacts
  that matter" lives.

The candidate works in the browser; **the conversation stays in Claude Code**. The browser never calls an
LLM — it only saves files and runs code locally. You (the interviewer) read those files from disk.

## Portfolio layout

```
<portfolio>/                       # default ~/mock-interviews/
├── portfolio.json                 # candidate profile + index of all interviews + shell version
├── index.html                     # searchable dashboard of every interview (Portfolio Mode)
├── shell/                         # the reusable UI (copied once from this skill's assets/shell/)
│   ├── shell.css                  # design tokens + light/dark themes + a11y base (see references/design-system.md)
│   ├── shell.js
│   ├── theme.js                   # light/dark controller, loaded in every page <head>
│   ├── serve.py                   # copied from this skill's scripts/serve.py
│   ├── lib/editor.js              # the ONE shared code-editor component every pad uses (makeEditor)
│   └── modules/
│       ├── coding.js
│       ├── system-design.js       # added when first needed
│       └── ...
└── <slug>/                        # one folder per interview (e.g. two-sum-meta-e5)
    ├── interview.json
    ├── INTERVIEWER_CONTEXT.md
    ├── interview.html
    ├── prompt.md
    ├── background/                # optional
    ├── artifacts/                 # candidate's work (server writes here; never overwrite across instances)
    ├── tests/                     # optional generated tests
    ├── transcript.json            # structured chat log the UI renders as bubbles (interviewer appends as you talk)
    ├── iteration_notes.md         # the candidate's own notes on improving THIS interview — read on iteration
    └── feedback.md                # written at the Retro
```

## The shared shell

`shell.js` exposes `MockInterview.boot()`, called by every `interview.html`. On boot it:

1. Reads the instance's `interview.json` (fetched relative to the page).
2. Renders chrome and the **budgeted phase timer**; starts the timer using `timebox_minutes`. If `phases`
   carry `minutes`, each pill fills as that slice of the clock elapses (a pacing signal — full pill = "you
   should be moving on"); the candidate can add/remove phases and edit budgets via the ⚙ popover, persisted
   per-instance in `localStorage`. Crossing into the next budgeted phase and the overall-time expiry each fire
   a **timer cue** — a soft sound (mutable via the header 🔔) plus a visual pulse/flash for muted or
   reduced-motion users. A first-run **help/FAQ overlay** (re-openable via `?`) explains the UI, and a `⌂`
   home button returns to the portfolio. The right rail has six tabs: **Prompt**; **Transcript** (chat bubbles
   polled from `transcript.json`, fourth-wall toggle, each bubble timestamped by relative time + phase);
   **Feedback** (the Retro, polled from `feedback.md`, persists); **Splits** (speedrun-style estimated-vs-actual
   time per phase, from the live `phase_splits` in `_session.json`); **Notes** (`artifacts/notes.md`); and
   **Improve** (notes to improve this interview → `iteration_notes.md`). All editors (coding, Spec, Mermaid)
   are the one shared component in `shell/lib/editor.js` — line numbers, soft tabs, theme-aware styling — so every pad
   looks and behaves identically; build new pads on it rather than hand-rolling a textarea.
3. Probes the server (`GET /api/ping`, a read-only health check). If absent, shows a banner and falls back
   to `localStorage` so the candidate can still work — but warns them the interviewer can't see their
   progress. All work is mirrored to `localStorage` even when the server write succeeds, so a page reload
   restores it.
4. Renders `prompt.md` (a light markdown renderer) into the prompt pane.
5. Dynamically imports `/shell/modules/<type>.js` and calls its `mount(workEl, ctx)`.

It continuously mirrors the candidate's scratch notes to `artifacts/notes.md` and writes
`artifacts/_session.json` (current phase, elapsed time, hint level) so resume and the interviewer always
know the live state. **Reading `artifacts/_session.json` and the artifact files is how you watch the
interview in flight.**

`ctx` passed to every module:
```js
{ cfg,                 // parsed interview.json (cfg._phase is the live phase)
  base,                // instance path prefix, e.g. "/two-sum-meta/"
  save(relPath, str),  // -> POST /api/save, writes <instance>/relPath; falls back to localStorage
  run(payload),        // -> POST /api/run; throws if server offline
  serverUp(),          // bool
  setPhase(name) }     // advance the Scope/Roadmap/Code/Retro tracker
```

## The local server (serve.py)

Stdlib-only. Three responsibilities and a hard security boundary (binds `127.0.0.1`, refuses any path that
escapes the portfolio root). Run from the **portfolio root**:

```
python3 shell/serve.py            # auto-picks a free port, prints the URL
```

Endpoints:
- `GET /api/ping` → `{ok:true}`. Read-only health check the UI polls (never writes to the workspace).
- `POST /api/save {path, content}` → writes a file under the portfolio root. This is how browser work
  becomes real files you can read.
- `POST /api/run {language, code|file, stdin?, args?, results_path?}` → executes in the real toolchain
  (`python3`, `node`) with a 15s timeout, returns `{stdout, stderr, exit_code}`, and optionally persists
  the result to `results_path` so you can read test outcomes directly (a write failure surfaces as
  `results_path_error` rather than being swallowed).

Interview-management endpoints (power the dashboard's per-row actions and the profile editor; every path
goes through the same `_safe()` sandbox, and the slug is validated as a single safe path segment — never
`shell`, `.`, `..`, or anything with a slash):
- `POST /api/reset {slug}` → return one interview to a fresh, unstarted state: wipe `artifacts/`,
  `transcript.json` → `[]`, delete `feedback.md`, set `status:"not_started"`/`overall:null` in both
  `interview.json` and `portfolio.json`. The **problem itself is preserved** (prompt, tests, background,
  config, starter). The dashboard also clears the browser's `localStorage` mirror for that slug.
- `POST /api/clone {slug, new_slug?, new_title?}` → copy the instance to a new folder (default
  `<base>-attempt-N`, the original being attempt 1), reset the copy's state so it's a clean attempt, set
  its `slug`/`title`, and add a `portfolio.json` entry inheriting type/company/role/level. Original untouched.
- `POST /api/delete {slug}` → `rmtree` the instance folder and drop its `portfolio.json` entry.
- `POST /api/meta {slug, patch}` → edit interview metadata (`title, type, company, role, level, date,
  status, overall`) in `interview.json` and mirror it to `portfolio.json`. `slug` is **not** editable here
  (renaming = clone + delete); `status` is validated against the four known values; `type` can't be empty.
- `POST /api/profile {patch}` → edit the candidate profile (`name, github, linkedin`) in `portfolio.json`.

On status: the persisted statuses are `not_started` / `in_progress` / `completed`. **`ended` is derived,
not stored** — the shell sets `_session.json.ended:true` when the candidate clicks End & Retro, and the
dashboard surfaces that as "ended (awaiting retro)" until you write `feedback.md` and flip `interview.json`
to `completed`. So *ended* = stopped, no feedback yet; *completed* = retro written. The edit dropdown offers
it for manual recovery but labels it as normally-automatic.

It is a `ThreadingHTTPServer` with a 30s socket read timeout, a 16 MB request cap, and 256 KB output
truncation — so one stalled client or runaway `print()` can't wedge or OOM the session. `/api/run` runs
real code as the current user (that's the point); the sandbox guards file *paths*, not the code, which is
why it binds to localhost only.

Why a server at all (vs. pure browser): you, the interviewer, need to *read the candidate's actual code and
test results*. Browsers can't write to disk unprompted. The server is the bridge — and it doubles as a real
execution environment, which is what makes a coding round feel like CoderPad instead of a toy. If a
candidate's machine can't run a server, the shell still works in localStorage mode; you then ask them to
paste their solution into the terminal when they want a read.

## How an interview instance is wired

`interview.html` is nearly identical across instances — it's just a loader:

```html
<!doctype html><html><head>
  <meta charset="utf-8"><title>Mock Interview</title>
  <script src="/shell/theme.js"></script>   <!-- in <head>, before the stylesheet, so the theme applies with no flash -->
  <link rel="stylesheet" href="/shell/shell.css">
</head><body>
  <div id="mi-root"></div>
  <script src="/shell/shell.js"></script>
  <script>MockInterview.boot()</script>
</body></html>
```
(In practice, copy `assets/templates/interview.html` verbatim rather than hand-writing this.)

Everything specific to the interview is data: `interview.json` (config) + `prompt.md` (the problem) +
`tests/` + `background/` + starter code embedded in `interview.json`. To make a new interview in the same
format, you copy this loader verbatim and write new data. **You do not touch the shell.**

## Module system

A module is an ES module at `shell/modules/<type>.js` exporting `mount(el, ctx)`. It owns the work pane;
the shell owns everything else. Keep modules self-contained (inject their own styles, load their own libs
from CDN with a graceful offline fallback). Current + planned modules:

- **coding.js** (built) — editor (CodeMirror, textarea fallback), Run, Run Tests, console. Autosaves to
  `artifacts/<solution_filename>`; runs `tests/<test_runner>` and writes `artifacts/test_results.json`.
- **system-design.js** (built, phase 3 = "Design") — a blank freeform **Spec** editor (saved to
  `artifacts/design.md`) and a **Diagram** tab with three modes: live-rendering **Mermaid** (saved to
  `artifacts/diagram.mmd`), an **Excalidraw** draw canvas (saved as JSON to `artifacts/diagram.excalidraw`),
  and a Mermaid **cheatsheet**. No on-screen scaling boxes — scale lives in the prompt narrative. Both
  diagram formats are text/JSON you can read and interpret.
- **case-study.js** (built) — prompt chooser (pick 1 of N), a deliverable editor (shared editor, markdown;
  optional slide-deck link) saved to `artifacts/deliverable.md`, and a stakeholder-rounds strip; rounds run
  conversationally in the terminal.
- **data-sql.js** (built) — a SQL console backed by DuckDB-WASM in the browser over data seeded from
  `cfg.data_sql.setup_sql`; saves queries to `artifacts/queries.sql` and last result to
  `artifacts/last_result.json`, with a schema sidebar. Uses the shared SQL editor.
- **screener.js** (built, orchestrator) — a multi-problem, two-section timed screen that *composes* the
  coding and data-sql pads (one per problem, namespaced `artifact_dir: artifacts/<problem-id>`) with a problem
  navigator and `min_before_switch` / `pass_threshold` rules; progress in `artifacts/_screener.json`.

Pads accept an optional `artifact_dir` (default `artifacts`) so an orchestrator like the screener can give
each sub-problem its own save namespace — the mechanism that lets one instance hold many problems.

When you need a type that doesn't exist yet, build the module *once* into the portfolio's `shell/modules/`
(and, if it's broadly useful, back into this skill's `assets/shell/modules/` so everyone gets it). After
that, every future interview of that type is just an instance. **Style new modules with the design tokens
(`var(--accent)`, `var(--ink)`, …) so they inherit light/dark theming and stay on-brand and accessible — see
`references/design-system.md`. Never hard-code hex colors.**

**Design modules to be data-driven**, so the same module serves countless problems via `interview.json`
config — never hard-code a specific problem into a module.

## JSON schemas

`interview.json` (instance config + live state):
```json
{
  "slug": "two-sum-meta-e5",
  "title": "Two Sum — warm-up",
  "type": "coding",
  "pathway": "company-specific",        // company-specific | catalog | hybrid
  "company": "Meta", "role": "Software Engineer", "level": "E5",
  "hint_level": "realistic",            // realistic | generous | silent
  "evaluation_focus": null,             // optional, e.g. "tradeoff reasoning & code quality over raw optimality"
  "timebox_minutes": 35,
  "methodology": "scope-roadmap-code-retro",
  "phases": [                           // optional; names + per-phase time budgets (minutes). Design swaps Code→Design.
    { "name": "Scope", "minutes": 5 }, { "name": "Roadmap", "minutes": 4 },
    { "name": "Code", "minutes": 23 }, { "name": "Retro", "minutes": 3 }
  ],
  "status": "in_progress",              // not_started | in_progress | completed
  "created": "2026-05-31",
  "coding": { "language": "python", "solution_filename": "solution.py",
              "test_runner": "tests/run_tests.py", "starter_code": "def two_sum(nums, target):\n    pass\n",
              "allow_language_switch": false },
  "artifacts": { "shared": ["../shell"], "local": ["artifacts/solution.py", "artifacts/notes.md"] },
  "design": {                           // optional, for system-design interviews: seed the Mermaid diagram
    "starter_diagram": "graph TD\n  Client --> API"
  },
  "overall": null                        // short qualitative result filled at the Retro, e.g. "pass (E5)" — never a number
}
```

`portfolio.json` (hub):
```json
{
  "candidate": { "name": "Ada Lovelace", "target_roles": ["Backend SWE"], "target_levels": ["E5"],
                 "github": "alovelace", "linkedin": "ada-lovelace" },   // github/linkedin editable from the dashboard
  "shell_version": "1.0.0",
  "interviews": [
    { "slug": "two-sum-meta-e5", "type": "coding", "company": "Meta", "level": "E5",
      "date": "2026-05-31", "status": "completed", "overall": "borderline" }
  ],
  "attribution": { "org": "Empathetech",
                   "links": { "website": "https://www.empathetech.org", "github": "https://github.com/empathetech" } }
}
```

## Setup checklist

First interview for a candidate (one-time):
0. Run `scripts/preflight.py` to verify dependencies (python3 required; node/gh/internet optional — nothing
   to pip/npm-install). Report what's missing and what it gates.
1. Create the portfolio dir (default `~/mock-interviews/`, or honor cwd if already a portfolio).
2. Copy this skill's `assets/shell/` (includes `lib/editor.js` and `theme.js`) → `<portfolio>/shell/` and
   `scripts/serve.py` → `<portfolio>/shell/serve.py`. Stamp `shell_version` in `portfolio.json` from
   `assets/shell/VERSION`. (On later runs, `scripts/preflight.py` / `scripts/shell_sync.py check` detect when a
   portfolio is behind — by version *and* content hash — and `shell_sync.py upgrade <portfolio>` re-syncs the
   shell gracefully without touching instances. See `references/component-inventory.md` → "Versioning & upgrades".)
3. Copy `assets/templates/portfolio-index.html` → `<portfolio>/index.html` (it reads `portfolio.json`, no
   edits needed) and write `portfolio.json` (attribution renders inline in the dashboard footer — no separate
   credits page needed).

Every interview:
1. Make `<portfolio>/<slug>/` and copy `assets/templates/interview.html` into it verbatim (it's a pure
   loader — never edit it). Add `interview.json`, `prompt.md`, and any `tests/`, `background/`, starter code.
2. Add the interview to `portfolio.json` and refresh `index.html`.
3. Start the server (if not running) and give the candidate the exact URL:
   `http://localhost:<port>/<slug>/interview.html`.
4. Write `INTERVIEWER_CONTEXT.md` so you can resume as the right persona later.

## Managing interviews from the dashboard

`index.html` isn't read-only. Each row carries actions — **✎ edit** (title, role/position, type, company,
level, date, status, result), **↺ reset** (back to a fresh attempt, keeping the problem), **⧉ clone** (a new
tracked attempt), **🗑 delete** — and the header has **✎ Profile** to edit the candidate's name and
GitHub/LinkedIn links. Filters include both **Type** and **Role**. All of these call the management endpoints
above, so they need the server running; they keep `interview.json` and `portfolio.json` in sync and clear the
browser mirror on reset/delete. This means a candidate can run several attempts at the same problem (clone),
wipe a botched run (reset), fix mislabeled metadata, or prune old interviews — without you hand-editing JSON.

# Component Inventory & Reuse Governance

This is the registry of reusable UI/runtime components and the rules for reusing them. **Before building any
UI for a new interview type or catalog entry, consult this file** — the default is always "reuse a component,"
not "hand-roll a textarea/div." If you find yourself writing a second copy of something here, stop and reuse
(or generalize) the shared one.

## The three layers (what's global vs. local)

1. **Global / canonical** — lives in this skill repo under `assets/shell/` + `scripts/`, version-controlled
   at `github.com/empathetech/mock-interview`. This is the single source of truth, maintained centrally.
2. **Portfolio copy** — when a candidate's portfolio is first created, the skill copies the canonical shell
   into `<portfolio>/shell/`, stamped with `shell_version` in `portfolio.json`. A pinned snapshot, local to
   that machine, shared across all of that candidate's interviews.
3. **Per-interview instance** — `<portfolio>/<slug>/` is **data only** (`interview.json`, `prompt.md`,
   `tests/`, `background/`, `artifacts/`). It never forks shell code; it points at the shared shell.

So: **globally maintained, locally pinned.** New work that's broadly useful is built into layer 1 (and
contributed back), not stranded in one portfolio. An instance must never contain its own copy of a component.

## Component registry

| Component | Where | Reused by | Reuse rule |
|-----------|-------|-----------|------------|
| **Design tokens + light/dark themes** | `shell.css` (`:root`, `[data-theme]`) | every surface | Style with `var(--…)` tokens; never hard-code hex. New colors must pass AA in both themes. |
| **Theme controller** | `theme.js` | shell + portfolio | Load in every page `<head>`; add `[data-theme-toggle]` to any toggle button — it auto-wires. |
| **Shell chrome** | `shell.js` `renderChrome()` | every interview | Header (title/phases/timer/buttons), responsive right rail (tabs↔dropdown, collapse), help overlay. Don't rebuild per type. |
| **Reusable code editor** | `lib/editor.js` (`makeEditor`) | coding pad, design Spec pad, Mermaid pad, any future pad | All "coderpads" MUST use this — line numbers, soft tabs, theme-aware editor + syntax colors. Never hand-roll a `<textarea>` editor. |
| **Budgeted phase timer + splits + cues** | `shell.js` | every interview | Phases/budgets from `interview.json`; pills, ⚙ config, sound/visual cues, Splits tab all come free. |
| **Transcript chat bubbles** | `shell.js` (`renderTranscript`) | every interview | Reads `transcript.json`; interviewer/candidate/meta styling + fourth-wall toggle + timestamps. |
| **Feedback renderer** | `shell.js` (`mdLite` + Feedback tab) | every interview | Renders `feedback.md`; persists. |
| **Local server** | `scripts/serve.py` | every interview | `/api/save`, `/api/run`, `/api/ping`. Stdlib-only. Extend `RUNNERS` for new languages, don't fork. |
| **Portfolio dashboard** | `assets/templates/portfolio-index.html` | the portfolio | Reads `portfolio.json`; search + full-text + filters. Copy verbatim. |
| **Interview loader** | `assets/templates/interview.html` | every instance | Pure loader; copy verbatim, never edit. |
| **Markdown-lite** | `shell.js` (`mdLite`), module cheatsheets | prompt/feedback/transcript | Use for light markdown; it escapes (XSS-safe). |

## Module-level components (inside `modules/`)

- **coding.js** (built) — editor (shared) + language select + Run/Run Tests + a console with
  clear/expand/collapse. Honors `cfg.coding.artifact_dir` so a screener can namespace it per problem.
- **system-design.js** (built) — Spec pad (shared editor) + Diagram tab (Mermaid via shared editor with live
  render, Excalidraw canvas from CDN, Mermaid cheatsheet).
- **data-sql.js** (built) — SQL console over seeded DuckDB-WASM (browser), shared SQL editor + result grid +
  schema sidebar. Honors `artifact_dir`.
- **case-study.js** (built) — prompt chooser (1 of N) + deliverable editor (shared, markdown; optional slide
  link) + a stakeholder-rounds strip. Rounds run conversationally in the terminal.
- **screener.js** (built, **orchestrator**) — composes `coding.js` + `data-sql.js` pads per problem (namespaced
  `artifact_dir`, one pad attached at a time so element IDs never collide) with a problem navigator, objective
  completion (the pad's `onComplete` fires when its check/tests pass), and the section-switch / pass-threshold
  rules shown for realism but **not enforced** (free navigation in a mock). The reference example of reuse: it
  mounts the existing pads rather than reimplementing them.
- **Planned, reuse-first:** `deploy.js` (shared editor + diagram). When building it, reuse the console/run
  wiring rather than copy-pasting — and if you find the coding console worth sharing, lift it into `lib/`.

## Governing reuse when building the catalog

- **Reuse-first is a rule, not a preference.** New interview type → assemble from the registry above. The only
  new code should be what's genuinely type-specific (e.g., a SQL result grid), and even that gets built into
  `modules/` as a shared module, not into an instance.
- **Promote, don't duplicate.** If two modules need the same thing (e.g., the run-console), extract it to a
  shared helper in `lib/` and have both import it — exactly as `lib/editor.js` was extracted from the editors.
- **Contribute back.** A broadly useful new module/component built for one candidate belongs in this skill's
  `assets/shell/` so the whole community gets it (see `contributing.md`). Don't leave it in one local portfolio.

## Versioning & upgrades

The skill's shell version is declared in **`assets/shell/VERSION`** (semver — the single source of truth), and
`portfolio.json` records the `shell_version` a portfolio was deployed from. **Never change a shell file
(`assets/shell/`, `scripts/serve.py`, `assets/templates/portfolio-index.html`) without bumping `VERSION` and
adding a `CHANGELOG.md` entry** — an unbumped change is exactly the drift this mechanism exists to prevent.

This rule is **enforced, not just documented**: `scripts/check_version_bump.py` fails any commit/PR that
changes a shell file without bumping `VERSION`. It runs as a pre-commit hook (activate once per clone with
`git config core.hooksPath hooks`) and, airtight, as the `shell-version-check` CI workflow on every PR/push to
`main` (CI can't be `--no-verify`'d).

Don't eyeball whether a portfolio is current — run the tool, which compares the stamped version **and** a
content hash of every shell file (so it catches drift even when someone forgot to bump):

- `python3 scripts/shell_sync.py check <portfolio>` — report drift (exit 3 if behind, 0 if in sync).
- `python3 scripts/shell_sync.py upgrade <portfolio>` — re-copy the shell and re-stamp the version.
- `scripts/preflight.py` runs the check automatically for `~/mock-interviews` (or any portfolio path passed).

Upgrading is **graceful and safe**: it only ever replaces the shared shell. Instances are *data* and depend
only on the shell's stable contract — the design tokens, the module `mount(el, ctx)` API, and the file
conventions (`interview.json`, `artifacts/`, `transcript.json`, `feedback.md`) — so they are never touched.
Keep that contract stable within a major version; PATCH/MINOR upgrade in place, and when the contract must
break, bump the **major** version and document the instance migration in `CHANGELOG.md`.

## Dependencies (what must be installed)

Near-zero-install by design — run `scripts/preflight.py` on first setup to verify:
- **python3** — required (runs `serve.py`, which is stdlib-only — no pip packages).
- **node** — optional, only to execute JavaScript interview code.
- **gh** — optional, only to contribute interviews back.
- **internet** — for the CDN UI libs (CodeMirror, Mermaid, Excalidraw, DuckDB-WASM); offline degrades to
  plain-textarea fallbacks. Nothing to `npm`/`pip` install for the core.

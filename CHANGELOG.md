# Changelog

All notable changes to the mock-interview skill are documented here. This project follows
[Semantic Versioning](https://semver.org/): the version in `assets/shell/VERSION` is the single source of
truth for the shared shell, and portfolios stamp the version they were deployed from in their
`portfolio.json` (`shell_version`).

**Upgrade policy:** PATCH and MINOR releases are shell-only and upgrade gracefully —
`python3 scripts/shell_sync.py upgrade <portfolio>` re-copies the shared shell and never touches interview
instances or their artifacts. MAJOR releases may require instance migration and will say so here.

## [1.2.3] — 2026-05-31

### Changed
- **Dashboard collapses to five columns: Interview · Company · Role · Status · Actions.** Level, Date, and the
  specific job title are no longer their own columns — every column is now wide enough that nothing truncates
  awkwardly. The dropped data moves to hover: a row's **Role** reveals the specific title + level, and its
  **Status** reveals date, attempt #, and time taken. This rebalances the table so Status no longer hogs space
  while Role gets squeezed.
- **Role becomes a canonical enum (`role_category`).** Instead of a free-form role string, the Role column
  shows a hard-enum **family** (`swe`, `data-eng`, `data-sci`, `ml`, `analytics`, `infra`, `security`, `pm`,
  `em`, `design`, `qa`, `research`, `finance`, `other`), with the specific title (e.g. "Staff Backend
  Engineer") and level (e.g. "E7") kept in `role` / `level` and surfaced on hover. The Role filter and the Edit
  modal use the enum; legacy interviews are classified by inference until edited. New field is editable through
  `/api/meta` and documented in `references/ui-architecture.md`. (Requires a server restart to pick up the new
  `serve.py` whitelist.)

## [1.2.2] — 2026-05-31

### Changed
- **Result is folded into Status; row actions collapse to a `⋯` menu.** The dashboard dropped the separate
  **Result** column — a *completed* interview now shows its outcome directly in the **Status** cell as a
  **pass / borderline / fail** pill (or plain "completed" when no result was recorded), with the full
  qualitative sentence on hover. The four inline action icons (edit / clone / reset / delete) are replaced by
  a single **`⋯` more-menu** that opens a dropdown, so the Actions column is slim and the row reads cleanly.
- **Outcome pills are now high-contrast.** pass / borderline / fail (and completed) render as **solid filled**
  pills instead of faint tinted text, meeting contrast in both light and dark themes via new paired
  `--success-ink` / `--warn-ink` / `--danger-ink` tokens. Status no longer relies on color alone — the label
  is always spelled out.

### Fixed
- **Pills and titles never overflow their cell.** Every pill is width-capped with ellipsis and carries a
  `title` tooltip with the full text; the interview title link is likewise tooltipped. Combined with the
  fixed table layout, nothing peeks past the table edge at any column width.

## [1.2.1] — 2026-05-31

### Fixed
- **Portfolio dashboard table no longer overflows its container.** Adding the per-row **Actions** column
  pushed the 8-column table wider than the page wrap, so it drifted off-center and the rightmost buttons
  peeked past the edge. The table now uses a fixed layout with explicit per-column widths (summing to 100%),
  sits in a scroll wrapper, and is exactly as wide as the controls above it — centered, uniform width, with
  nothing peeking out. Long titles and tags ellipsize within their column instead of forcing the table wider.
  (Shell-only, graceful upgrade — `python3 scripts/shell_sync.py upgrade <portfolio>`.)

## [1.2.0] — 2026-05-31

### Changed
- **Portfolio dashboard table is now scannable, not free-form.** Dropped the **Type** column; reordered to
  Interview · Company · Role · Level · Date · Status · Result. Company/Role/Level/Date render as neutral
  **tags** (long values ellipsize with the full text on hover), and **Result** is now a color-coded
  **pass / borderline / fail** pill derived from the qualitative `overall`, with the full sentence on hover —
  instead of a wrapping paragraph that made rows mushy. (Type is still a filter and remains on each interview.)
- **Removed the candidate's level from the dashboard header.** Levels belong on interviews, not on the person;
  the header now reads "Name · N interviews".

## [Unreleased]

### Added
- **Enforcement that a shell change must bump `VERSION`.** `scripts/check_version_bump.py` fails when any
  deployed shell file changes without a `VERSION` bump; wired as a version-controlled pre-commit hook
  (`hooks/pre-commit`, activate with `git config core.hooksPath hooks`) and as the `shell-version-check` GitHub
  Actions workflow (the un-bypassable layer) on every PR and push to `main`. This closes the loop that let
  shell features ship un-versioned before 1.1.0. (Tooling/CI only — does not change the deployed shell.)

## [1.1.0] — 2026-05-31

### Added
- **Semantic versioning for the shell.** `assets/shell/VERSION` is now the authoritative version. Previously
  the docs referred to a "current version" the skill shipped, but no such constant existed — so drift between
  a deployed portfolio and the skill was undetectable.
- **`scripts/shell_sync.py`** — `version` / `check` / `upgrade` for portfolios. `check` compares both the
  stamped semver **and** a content hash of every shell file (so drift is caught even when no one bumped the
  version); `upgrade` re-syncs the shell and re-stamps the version while leaving all interview instances and
  artifacts untouched.
- **Preflight drift detection.** `scripts/preflight.py` now reports whether an existing portfolio's shell is
  behind this skill and prints the one-line harmonize command.

### Fixed
- **Fourth-wall asides weren't being recorded.** The interviewer persona now explicitly records both the
  candidate's meta question and the coaching reply to `transcript.json` with `meta: true`, so the UI's
  "show fourth-wall asides" toggle has content. The instruction was moved next to the fourth-wall protocol
  (in both `SKILL.md` and `references/interviewer-persona.md`) where it's actually needed.

### Notes
- The management dashboard (per-row edit modal incl. Role/position, clone, delete, profile editing) and its
  `/api/meta`, `/api/clone`, `/api/delete`, `/api/profile`, `/api/reset` endpoints — added earlier but never
  released — are now part of a tagged release. Portfolios at `1.0.0` should run the harmonize command above to
  receive them.

## [1.0.0] — baseline
- Initial shell: interview instances, the Scope→Roadmap→Code/Design→Retro engine, coding / system-design /
  data-sql / react / case-study / screener modules, the portfolio dashboard, and the near-zero-install
  `serve.py`. (Pre-versioning; portfolios deployed in this era stamp `shell_version: "1.0.0"`.)

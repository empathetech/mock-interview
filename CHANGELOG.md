# Changelog

All notable changes to the mock-interview skill are documented here. This project follows
[Semantic Versioning](https://semver.org/): the version in `assets/shell/VERSION` is the single source of
truth for the shared shell, and portfolios stamp the version they were deployed from in their
`portfolio.json` (`shell_version`).

**Upgrade policy:** PATCH and MINOR releases are shell-only and upgrade gracefully —
`python3 scripts/shell_sync.py upgrade <portfolio>` re-copies the shared shell and never touches interview
instances or their artifacts. MAJOR releases may require instance migration and will say so here.

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

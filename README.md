# mock-interview

A [Claude Code](https://claude.com/claude-code) skill that builds and runs **realistic, interactive mock
technical interviews for software engineers** — grounded in Empathetech's "Tech Interview Office Hours"
methodology (**Scope → Roadmap → Code/Design → Retro**).

You do the work in a local interactive UI (a real code editor that runs real tests, a system-design diagram
canvas, a SQL console over a seeded database, a deliverable editor); Claude plays the **interviewer in the
terminal** — reading your work in flight and conversing there, so the interview runs on your existing Claude
subscription with **no extra API cost**. At the end you get a critical, honest **Plus / Minus / Delta** retro,
and every session is saved to a local portfolio you can grow over time.

## Three pathways

1. **Company-specific** — give Claude your real loop details (recruiter email, prep doc, take-home brief) and
   it reconstructs that interview as faithfully as possible, supplementing from public sources where your docs
   are silent (your docs always win on conflicts).
2. **Catalog** — pick a type for your role + level: DS&A coding, product/system design, cloud/deploy,
   data/SQL, or a case study. Built on the Empathetech method.
3. **Hybrid / custom** — "drill me on window functions," "design a rate limiter," etc. — assembled from the
   same building blocks, scoped to what you ask.

## What makes it realistic

- **Fidelity** — a coding round is a CoderPad-style editor that executes real tests against a timer; system
  design gives you a spec + live Mermaid/Excalidraw diagram; a data screen is a real DuckDB SQL console; a
  case study is a deliverable workspace with timed stakeholder rounds.
- **Honest evaluation** — hints like a real interviewer (calibrated, never the answer), then a no-glazing
  retro that tells you where you actually stand.
- **In character** — Claude stays in the interviewer persona; step out for a meta question any time ("can we
  pause for a sec?") and step back in.

## Interview types (modules)

Coding/DSA, product/system design (Mermaid + Excalidraw), data/SQL (DuckDB-WASM), case study + multi-round
stakeholder loops, and multi-section timed screeners (e.g. SQL + executable Python) — all composed from one
reusable shell + a shared code-editor component. Light/dark themed, WCAG-AA, keyboard-accessible.

## Dependencies

Near-zero-install by design: the local server (`scripts/serve.py`) is **Python-stdlib only**, and all UI
libraries load from CDN with offline fallbacks. Run `scripts/preflight.py` to check your setup — only
**python3** is required; `node` (for executing JavaScript answers), `gh` (for contributing), and internet
(for the rich editor/diagram libs) are optional.

## Contributing interviews back

Built a great interview? You can contribute a **generalized, scrubbed** version back to the community catalog
by opening an issue here (label `interview-contribution`), credited to your GitHub handle. Contributions must
be company-agnostic and free of any confidential/NDA material from a real loop — a generalized interview, not
a leak. See `references/contributing.md`.

## Attribution

Built on the **Empathetech** Tech Interview methodology — [empathetech.org](https://www.empathetech.org) ·
[github.com/empathetech](https://github.com/empathetech) — with Claude Code. Office Hours core contributors:
Molly Jean Bennett, John Hyland, Chris Ling, and Julie Nisbet.

## Layout

```
SKILL.md                  # the skill (loaded by Claude Code)
references/                # methodology, interview types, UI architecture, persona, design system, components, contributing
assets/shell/              # the reusable interview UI (copied once into a user's portfolio)
assets/templates/          # interview loader + portfolio dashboard
scripts/                   # serve.py (local server), preflight.py (dependency check)
```

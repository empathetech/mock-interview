# Contributing an Interview Back to the Community

A candidate who builds a strong interview — a well-researched company loop, or a sharp ad hoc drill that
deserves to be in the catalog — can contribute it back so it graduates from a personal artifact into shared
Empathetech material. This is **opt-in**, the contributor gets **attribution**, and it must never leak
anything confidential. Read this before opening any issue.

## What gets contributed (and what must not)

A contribution is a **generalized, reusable interview template** — not a dump of someone's real loop.

**Include:**
- The interview type and the role/level it targets.
- A roomy prompt (with deliberate ambiguity intact).
- The methodology mapping (Scope → Roadmap → Code/Design → Retro for this problem).
- Expected artifacts, the kinds of clarifying questions a strong candidate asks, and grading cues
  (Plus/Minus/Delta signals, red/green flags) — i.e. what goes in `INTERVIEWER_CONTEXT.md`.
- Any generated background pack or test harness, cleaned up.

**Never include:**
- The candidate's own solution, notes, transcript, or feedback — those are personal.
- **Anything proprietary or NDA-covered from a real interview.** If the source was a company-specific loop
  (Pathway A), the contribution must be *abstracted away from that company's actual questions*. Generalize:
  "a graph problem on a social network's friend recommendations" is fine; transcribing the exact question
  an employer asked under NDA is not. When in doubt, leave it out and tell the candidate why.

Always **confirm with the candidate and show them the synthesized file before anything leaves their
machine.** They own the decision and are responsible for not sharing what they shouldn't.

## The synthesized file

Produce a single self-contained markdown file the maintainers can drop into the catalog. Suggested shape:

```markdown
# <Interview title>
- Type: coding | system-design | case-study | data-sql | deploy
- Target: <role> / <level>
- Tier candidate: catalog (Pathway B) | company-template (Pathway A)
- Contributed by: @<github-handle>

## Prompt
<the roomy, company-agnostic prompt>

## Methodology mapping
Scope / Roadmap / Code-or-Design / Retro — what each phase should look like for this problem.

## Expected artifacts
<solution shape / diagram / deliverable expectations — NOT a filled-in answer>

## Interviewer guide
Clarifying questions a strong candidate asks · expected approach(es) · Plus/Minus/Delta cues ·
red/green flags · difficulty notes by level.

## Tests / background (if any)
<the generalized test harness or background pack>
```

## Attribution

Credit the contributor by their **GitHub handle** (from `portfolio.json` `candidate.github`, confirmed with
them). Mirror the house attribution style used elsewhere: the contribution names the human as the author and
Claude Code as the tool. Put `Contributed by @handle` in the file and the issue, and — if the candidate
opted into portfolio attribution — keep their footer/credits consistent with the rest of their portfolio.

## Opening the issue

The contribution goes to the skill's repo: **`github.com/empathetech/mock-interview`** (this is the
configurable contribution target — if Empathetech moves the repo, update this and the reference in SKILL.md).

Prefer the `gh` CLI if it's available and authenticated:

```bash
gh issue create \
  --repo empathetech/mock-interview \
  --title "Interview contribution: <type> — <short name> (<role>/<level>)" \
  --label "interview-contribution" \
  --body-file <path-to-synthesized.md>
```

The issue body is the synthesized file above. The `interview-contribution` label lets maintainers triage
proposals for promotion into Pathway B (catalog) or as a Pathway A company-template.

If `gh` isn't installed or authenticated, don't block: save the synthesized file into the candidate's
portfolio (e.g. `<portfolio>/contributions/<slug>.md`), give them a prefilled issue URL or the exact `gh`
command to run themselves, and tell them where the file is. Suggest they type `! gh auth login` in the
session if they want to authenticate now. Never push anything to a remote without explicit confirmation in
that same exchange — a contribution is outward-facing and public.

## After contributing

Note the contribution in `portfolio.json` (e.g. a `contributed: true` flag on the interview) so the
candidate has a record, and so you don't offer to contribute the same one twice.

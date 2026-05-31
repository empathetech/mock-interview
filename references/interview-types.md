# Building Each Interview Type

How to actually assemble each kind of interview: the module it uses, what a good prompt looks like, what
artifacts the candidate produces, and how to calibrate difficulty by level. Read
`references/empathetech-methodology.md` for the authoritative framing of each type; this file is the
build guide. Remember the phase spine is **Scope → Roadmap → Code → Retro**, except design interviews swap
the third phase to **Design**.

## A good prompt is roomy, not a one-liner

Across all types, the prompt must leave the candidate room to *scope*. Real interviewers give an ambiguous
problem and watch the candidate resolve it. So:

- State the scenario and the goal, but **leave deliberate ambiguity** a strong candidate would surface
  (input ranges, constraints, what "done" means). Don't pre-answer the clarifying questions.
- **Write it like a real prompt, not a coach.** A CoderPad question or a take-home brief is terse and
  neutral: problem, examples, constraints. No "your job is to scope this," no "don't jump to code," no
  encouragement, no hints. The instant a prompt coaches, the simulation breaks. Leave ambiguity — just
  don't narrate that you left it. (See `interviewer-persona.md` → "Stay in character.")
- For design/scale interviews, fold the scale expectations **into the narrative** ("~100M new URLs/month,
  reads outnumber writes ~100:1, redirects must be low-latency globally") rather than into on-screen boxes
  or a checklist. That's how a real brief states it, and it lets the candidate decide what matters.
- Make it answerable in the timebox at the target level.
- Keep the "answer" out of the candidate-facing `prompt.md`. Put your private expected-solution notes,
  expected clarifying questions, and grading cues in `INTERVIEWER_CONTEXT.md` instead.
- **Starters must never contain the solution.** `starter_code` is a *signature stub* (`def f(args): pass`);
  `starter_query` is empty or an *exploratory* hint (`-- write your query here`, or a harmless
  `SELECT * FROM t LIMIT 5;`) — never the working query. Seeding the answer in the starter defeats the
  interview, exactly like handing over the solution live. Same rule for every pad.

Difficulty by level (rough): intern/new-grad → one core idea, generous scoping; mid (E4) → a twist or a
follow-up; senior (E5) → ambiguity + tradeoffs + a scaling follow-up; staff+ → open-ended, multiple viable
directions, expect them to drive and justify.

---

## Coding / DSA — `coding.js`

The CoderPad-style round. Module gives an editor, Run, Run Tests, and a console; it autosaves the solution
and writes `artifacts/test_results.json`. Hyland's decks emphasize: solve the *problem* on paper before the
*computers* part, name the data structure and complexity, then code.

**Instance files:**
- `prompt.md` — the problem, with a couple of examples and the ambiguity intact.
- `interview.json` `coding` block — `language`, `starter_code` (a signature stub, not a solution),
  `solution_filename`, `test_runner`.
- `tests/run_tests.py` — the generated test harness.

**Test-runner convention** (this is what `coding.js` runs). The candidate's solution is saved to
`artifacts/<solution_filename>`; the runner imports it and checks cases. Keep it dependency-free and make
output human-readable so it reads like a real test panel.

**Validate correctness, not a single exact output.** This matters a lot: many problems have more than one
correct answer (Two Sum accepts the index pair in *either order*; "return any valid path"; floating-point
within a tolerance; an unordered set). If you hard-code `got == expected` against one canonical answer, you
will unfairly fail a correct solution — a real interviewer wouldn't. Write a `check()` that verifies the
answer *satisfies the problem*, and only fall back to exact equality when the output genuinely is unique.

```python
# tests/run_tests.py
import sys, importlib.util
from pathlib import Path

sol_path = Path(__file__).resolve().parent.parent / "artifacts" / "solution.py"
spec = importlib.util.spec_from_file_location("solution", sol_path)
solution = importlib.util.module_from_spec(spec)
spec.loader.exec_module(solution)

CASES = [
    # (args, marker)  — marker says what a valid answer looks like, not one canonical value
    (([2, 7, 11, 15], 9), True),
    (([3, 3], 6), True),             # duplicate values — order of returned indices must not matter
    (([], 0), None),                 # edge case the candidate should have scoped
]

def check(got, nums, target, expected):
    if expected is None:                       # "no answer" cases
        return got is None or got == [] or got is False
    if not got or len(got) != 2:               # accept ANY valid pair, in any order
        return False
    i, j = got
    return i != j and 0 <= i < len(nums) and 0 <= j < len(nums) and nums[i] + nums[j] == target

passed = 0
for n, (args, expected) in enumerate(CASES, 1):
    nums, target = args
    try:
        got = solution.two_sum(*args)
        ok = check(got, nums, target, expected)
        print(f"case {n}: {'PASS' if ok else 'FAIL'}  input={args}  got={got}")
        passed += int(ok)
    except Exception as e:
        print(f"case {n}: ERROR  input={args}  -> {type(e).__name__}: {e}")

print(f"\n{passed}/{len(CASES)} passed")
sys.exit(0 if passed == len(CASES) else 1)
```

Hide one or two edge cases (empty input, duplicates, overflow) that only surface if the candidate scoped
well — failing them is a teachable Minus for the Retro. For JavaScript, use the analogous Node runner that
`require`s `../artifacts/solution.js`.

---

## Product / System Design — `system-design.js` (phase = Design)

Chris Ling's framing: **"The Story / The Schematic / The Service"**, and the parsing trick **"sentences are
features, nouns are the data model, verbs are the API."** Probe the user-experience promise ("the McDonalds
promise"), and remember **"product !== front-end."** Question archetypes: (Re)Inventing the Wheel /
Extending a Feature / Exploring a Sandbox.

**What the module provides** (deliberately a blank canvas, the way a real interviewer hands you a whiteboard
rather than a worksheet):
- **Spec tab** — a single freeform editor (no Features/Data-model/API boxes; structuring the spec is part of
  what's being assessed). Saved to `artifacts/design.md`.
- **Diagram tab** — three modes: **Mermaid** (a source editor on the shared editor component that renders
  *live* as they type, saved to `artifacts/diagram.mmd`; the Cheatsheet links the full mermaid.js docs),
  **Draw (Excalidraw)** — a freehand canvas loaded from the **Excalidraw CDN** (not a local copy; needs
  internet, falls back to a "use Mermaid" message offline), saved as JSON to `artifacts/diagram.excalidraw`,
  and a **Cheatsheet** of Mermaid syntax. The Spec and Mermaid editors are the same shared
  `lib/editor.js` component as the coding pad, so they look and behave identically.

Both diagram formats are text/JSON you can read and interpret. Scaling is **not** an on-screen checklist —
it lives in the prompt narrative, and the candidate addresses it in their spec and diagram.

**Instance:** `prompt.md` poses the system ("design a URL shortener / a notification service / Twitter
timeline") and folds the scale expectations into the narrative (volumes, read:write ratio, latency,
availability) the way a real brief does — neutrally, no coaching. Put expected components, the bottlenecks
you'll push on, and the "this/not-this" diagram cues in `INTERVIEWER_CONTEXT.md`. In flight, read `design.md`
and the diagram (`.mmd` or `.excalidraw`), then interrogate: where does this fall over at the stated scale?
what's the data model? consistency vs. availability? The diagram is graded "This / Not This" — is it
communicating, or decoration?

---

## Cloud / Deploy-an-App / infra — `coding.js` or a deploy module

The method's deploy round (deck 006) uses Scope → Roadmap → Code → Retro and has a house rule: **"Don't do
AWS"** for the teaching version (avoid getting lost in one vendor's console; reason about the architecture).
Frame it as: provision and wire up an app, then reason about scale and ops. The candidate produces an
architecture sketch + a deployment plan (commands/IaC pseudocode) saved as a deliverable; you probe
failure modes, scaling, and the "Goldilocks engineer" sizing of resources. A `coding.js` editor (for IaC /
shell / config) plus a diagram works well; a dedicated module is optional.

---

## Data / SQL / data-engineering — `data-sql.js` (built)

A SQL console over a **real, seeded DuckDB-WASM database in the browser** (self-contained; falls back to
save-only offline). Seed it via `cfg.data_sql.setup_sql` (CREATE + INSERT statements) so it feels like a real
warehouse, and give a `schema_hint` for the table sidebar and a `starter_query`. The candidate writes queries
(saved to `artifacts/queries.sql`, last result to `artifacts/last_result.json`) and runs them against actual
DuckDB. Calibrate: joins/aggregation for mid; window functions/optimization/modeling for senior. Read the
queries + results in flight. Uses the shared SQL editor.

**Objective checking, one button.** Set `cfg.data_sql.expected` — a private reference `query` (preferred) or
literal `rows`, plus optional `order_matters` — and the **Run query** button both shows the result *and* checks
its *output* against the expected result in the same click (compared by row value-tuples, multiset unless
ordered), reporting `✓ correct` / `✗ doesn't match`. No separate Check button. Passing is what marks the
problem solved (mirrors Run Tests for code). Omit `expected` for open exploration drills — then Run query just
shows results. A shared DuckDB instance is reused across a screener's SQL problems (each isolated by schema),
so don't spin up one per problem.

---

## Case study / take-home — `case-study.js` (built)

Lightest UI, heaviest on judgment. `cfg.case_study` carries `options` (the candidate picks ONE of N prompts),
an optional `prep_note`, the `rounds` (sequential stakeholder rounds — name/minutes/persona), and
`deliverable_format` (`markdown` or `slides`). The module shows the chosen prompt + a deliverable editor
(shared editor, markdown; a slide-deck link field for `slides`), saving to `artifacts/deliverable.md`. **The
stakeholder rounds are conversational — you run them in sequence in the terminal**, each as its own persona,
honoring stakes like "a bad round cancels the rest." Evaluate the deliverable + the discussion against the
method, Staff-calibrated (strategy, tradeoffs, communication) for senior loops.

---

## Multi-section screener — `screener.js` (built, an orchestrator)

For timed screens with multiple problems across two sections (e.g. SQL + executable Python) and switch/pass
rules — the big-tech DE/SWE screener shape. **It does not reimplement pads — it orchestrates them**: each
problem is rendered by the existing `coding.js` or `data-sql.js` module, mounted into a per-problem container
with a namespaced `artifact_dir` (`artifacts/<problem-id>/`) so every problem's work saves separately; the
shell's single timer covers the whole screen. `cfg.screener` carries `sections` (key/name/type), `rules`
(`min_before_switch`, `pass_threshold`), and `problems` (each with `section`, `prompt`, and its own `coding`
or `data_sql` config + `test_runner`). **Completion is objective** — a problem is solved when its Check (SQL,
via `expected`) or Run Tests (coding) passes; the pad calls back, no self-attested checkbox. **In a mock all
problems are open in any order** — the `min_before_switch` / `pass_threshold` rules are shown for realism but
*not enforced* (interview-day gating shouldn't gatekeep practice). Progress is in `artifacts/_screener.json`.
Judge against the pass threshold and per-section completion. This is the reuse-first pattern in action —
compose pads, don't fork them.

**Generate the full problem set the real format specifies — don't undersize it.** If the loop is a 50-minute,
10-problem screen of 5 SQL + 5 Python, build all ten (each with its own `expected`/`test_runner`), and set
`timebox_minutes` to the realistic total (≈ the average time per problem × the count — e.g. ~50 minutes for
ten ~5-minute problems). The screener is one timed block, so a single `phases` entry covering the whole
screen (e.g. `[{ "name": "Screen", "minutes": 50 }]`) is the right timer structure.

---

## Non-technical & conversational interviews (any field)

The skill has the deepest *tooling* for technical rounds, but it works for **any** interview — and many
interviews need no specialized pad at all. Match the surface to the format:

- **Behavioral / leadership / panel** — runs as a pure conversation in the terminal. Create an instance with
  no module beyond the shell: `prompt.md` holds the themes/competencies (or "tell me about a time…" leads),
  `artifacts/notes.md` is the candidate's scratch space for STAR stories, and you interview them in character.
  Structure with the field's framework (STAR: Situation/Task/Action/Result) rather than Scope-Roadmap-Code;
  the method explicitly likens its four-part spine to STAR, so the *discipline* carries over. The phase pills
  can be the round's natural beats or just a single timed block.
- **Case / consulting / product-management / product-sense** — use the **case-study module**: a prompt + a
  background pack + a deliverable/working space, structured with the field's framework (e.g. scope → structure
  → analyze → recommend; or a PM product-sense framework), often across multiple stakeholder rounds.
- **Design / portfolio review, data-science take-homes, finance & quant, academic & grad-school, medical,
  and other domain loops** — assemble from the same building blocks: a deliverable editor for take-homes, a
  diagram canvas where a visual matters, a SQL/data console for analytics, or just the conversation. When a
  field has a standard rubric (e.g. a consulting case rubric, a PM framework, a research-fit interview), use
  it; otherwise fall back to scope → plan → execute → reflect, which generalizes.

Whatever the field, the engine is identical: realistic in-character conversation, in-flight reading of any
artifacts, the fourth-wall protocol, and the honest no-glazing **Plus / Minus / Delta** Retro calibrated to
the role and level. Don't force technical tooling onto a conversational interview — the conversation *is* the
interview.

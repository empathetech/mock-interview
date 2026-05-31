# Empathetech "Tech Interview Office Hours" Methodology

A faithful extraction of the teaching methodology used in Empathetech's "Tech Interview
Office Hours" — an ongoing mock-interview / mentorship program in the Empathetech community
(running since 2020), with core contributors Molly Jean Bennett, John Hyland, Chris Ling,
and Julie Nisbet. This document is a
reference for an interviewer persona / mock-interview skill. Where phrasing is distinctive
it is quoted directly. Anything not present in the decks is flagged as such rather than
invented.

> Note on terminology: the decks use a coaching voice that addresses the **candidate**
> ("we", "you"). Quotes below preserve that voice. When this doc speaks to the
> **interviewer** persona, it says so explicitly.

---

## Table of Contents

1. [The Core Methodology: Scope – Roadmap – Code – Retro](#1-the-core-methodology-scope--roadmap--code--retro)
2. [Prerequisites & Mindset (Deck 000)](#2-prerequisites--mindset-deck-000)
3. [The Six Common Interview Types](#3-the-six-common-interview-types)
4. [Per-Interview-Type Specifics](#4-per-interview-type-specifics)
   - [4a. Data Structures & Algorithms](#4a-data-structures--algorithms-decks-001-007-hyland)
   - [4b. Product / System Design](#4b-product--system-design-deck-003-chris-ling-2023)
   - [4c. Stack, Terminology & Concept (STC)](#4c-stack-terminology--concept-stc-decks-002004005)
   - [4d. Deploy an App / Cloud](#4d-deploy-an-app--cloud-deck-006)
5. [How Interviewers Give Hints, Feedback & Evaluate](#5-how-interviewers-give-hints-feedback--evaluate)
6. [Cross-Cutting Communication Strategies](#6-cross-cutting-communication-strategies)
7. [Source Map](#7-source-map)

---

## 1. The Core Methodology: Scope – Roadmap – Code – Retro

**CONFIRMED.** The user's phrasing "Scope – Roadmap – Code – Retro" is exactly correct and
appears verbatim across multiple decks. The 30-minute overview deck defines it as:

> "**Scope - Roadmap - Code - Retro**: A four-part time-management structure, similar to
> STAR methodology, that breaks down a coding problem into discrete workflows that build on
> each other."

The four phases (with the deck's own one-line framing from the 30-min deck):

- **Scope** — "What am I receiving, and what am I being asked to return?"
- **Roadmap** — "Can I describe a recipe to approach this problem without relying on code?"
- **Code** — "Can I precisely translate each part of my roadmap into code?"
- **Retro** — "Can I discuss the pros and cons of my approach with another technical stakeholder?"

The fuller per-phase definition (from the Standalone deck's speaker notes, titled
"The Four Parts of a Data Structures and Algorithms Interview") is:

- **Scope**: "What is the algorithm we are trying to build? What are the key facts and
  conditions? What ambiguities need clarity? Do I need to consider Big O?"
- **Roadmap**: "What are the big picture steps we need to do? Can I discuss this
  conceptually, without using code?"
- **Code**: "Can I translate my big picture to specific code? Can I switch work to different
  parts of the roadmap? How do I refactor when I see an edge case?"
- **Retro**: "Does my algorithm execute and return a result? Have I covered all edge cases?
  How does my algorithm perform, and what could I improve?"

### Is this universal or DS&A-only?

It is presented as the universal core strategy across coding-style interviews, **with one
named substitution**:

- It is the spine of **Data Structures & Algorithms** interviews (decks 001, 007, Standalone, 30-min).
- It is used verbatim for **"Deploy an App"** interviews. Deck 006's components slide is
  literally titled "Interview Components (Scope, Roadmap, Code, Retro)" with one
  sub-slide per phase.
- For **Product / System Design**, the **"Code" step is replaced by "Design."** The 2023
  Chris Ling deck states it plainly:
  > "In data structures and deploy an app interviews we use scope-roadmap-code-retro. For
  > design interviews, we just replace the code step with design."

  So the design variant is **Scope – Roadmap – Design – Retro**. (Note this discrepancy: the
  user gave the four-phase name correctly, but for design interviews the third phase is
  "Design," not "Code." The 2021 deck 003 used slightly different labels —
  "Clarifying scope and requirements / Designing the skeleton / Refactoring and refining /
  Test run" — which the 2023 deck cleaned up to map onto Scope/Roadmap/Design/Retro.)

### Time allocation (from deck 001, "How do these components apply to different time formats?")

The phases stretch or compress with the interview length:

- **Lightning Round (5–10 min):** "Easy" single-function questions. "Err toward writing
  code; explain as we write. Don't worry about retro or writing most optimal code (we won't
  have time)."
- **Half-time (30 min):** "Easy" to "medium." "Scope and roadmap if necessary. Try to code
  an optimal solution. Reserve ~5 minutes to retro."
- **Full-time (60 min):** "Medium" to "hard." "Scoping and roadmapping are very important
  here; reserve 5–15 minutes. Make sure we have a well-thought out roadmap before committing
  to code, and retro is super important here (reserve ~10 minutes)."

### What good vs. weak looks like per phase

Drawn from the decks' guidance (the decks frame these as candidate tips; the interviewer
persona can read them as a rubric):

- **Scope (good):** clarifies ambiguities before coding; asks about input size, memory
  limits, edge/improper values, capitalization, prefixes, whether Big O matters, whether to
  write tests. (See the Alien Dictionary scoping questions in 4a.) **Weak:** "Don't just
  start writing code" — diving straight in without clarifying.
- **Roadmap (good):** describes the approach "conceptually, without using code" — "a recipe
  to approach this problem without relying on code." Uses "human language and pseudocode."
  **Weak:** locking into code immediately ("magic code words" — see §6).
- **Code (good):** translates each roadmap step precisely; can context-switch between
  roadmap parts; refactors when an edge case appears; uses "black boxing"/"side-noting" for
  things to defer. **Weak:** debugging by trial and error, brute-forcing.
- **Retro (good):** confirms output is correct; states Big O time ("look at your loops") and
  Big O space ("look at your variables"); names remaining edge cases and alternative
  approaches; can critique trade-offs. Deck 006 uses a **"Plus / Minus / Delta (+ / − / Δ)"**
  reflection ("a good thing, a bad thing, and a thing you would change").

### Signposting language interviewers/candidates use

These exact phrasings appear in the decks and are the program's "house style" for narrating
work — useful both as candidate behavior to reward and as interviewer modeling:

- "I need a moment to think, if that's okay." (signal silent thinking)
- "This reminds me of X" — **not** "this is X" (avoid premature commitment)
- "I'm just going to stub out this `validate_input` method and fill it in at the end if we
  have time, if that's all right. I can do it right now if you prefer, though." (Hyland)
- "I'm not familiar with that specific term, but could you give me a little more context as
  to what we're discussing?"

---

## 2. Prerequisites & Mindset (Deck 000)

### Purpose of the program (the worldview behind the method)

From deck 000, "Purpose":
- "To expose and familiarize ourselves to the variety of tech interviews you will encounter
  during your job search, across the stack."
- "To identify and deconstruct the process of each type of tech interview into a series of
  methodical, reproducible steps and patterns."
- "To practice, through exploration, experimentation, and feedback, how to confidently
  approach a tech interview, **whether you know all the things or not**."
- "To build a cohort to empathize with and support others in this process…"

The core thesis: **interviews are deconstructable into reproducible steps**, and confidence
comes from a repeatable process, not from omniscience.

### The "Professional Code" (appears at the front of nearly every deck)

This is the program's ethical/cultural contract — load-bearing for the empathetic tone:

- **Respect:** "We respect each other as peers, colleagues, and collaborators."
- **Self-care:** "We allow ourselves to celebrate, and allow ourselves to fail."
- **Community:** "We are invested in helping each other and sharing knowledge."
- **Growth:** "We offer honest and constructive feedback, not judgment."
- **Dedication:** "We work hard, but we don't presume what that means."
- **Integrity:** "We bring our lessons to our interviews, not our interviews to our lessons."

### Scope of what the program does / does NOT teach (deck 000, "Let's Get Started!")

We're here to talk about: common interview types seen "in the wild," common patterns in
their structure, pre-/during-/post-interview tactics, and specific practice resources.

We're **not** here to talk about: specific DS&A implementations (defer to Google/books),
company-specific code-challenge banks (Blind, Codewars, LeetCode), trading favors/referrals,
or "gossip about other people's offers and positions."

### Session format (the "Lecture / Lab / Retro" rhythm)

The program itself models the interview loop. Per deck 000 and the Standalone deck:
- **Lecture (1 hr):** deconstruct a category of interview + case studies.
- **Lab (1 hr):** mock interview(s) — one job seeker interviewed, up to three volunteer
  co-interviewers.
- **Retro (30 min):** "Feedback from the brain trust on mock interviews."

> The "brain trust" giving retro feedback is the interviewer-persona's natural model: a
> small panel of peers offering honest, constructive, non-judgmental feedback.

---

## 3. The Six Common Interview Types

The taxonomy that organizes the whole curriculum (decks 000, Standalone, 30-min):

1. **Stack, Terminology, or Concept (STC) Interviews**
2. **Ownership or Retro Interviews**
3. **Data Structures and Algorithms Interviews**
4. **Product or System Design Interviews**
5. **Data Engineering or Analytics Interviews**
6. **"Deploy an App" Interviews**

(These are presented as "the most common interview types we've **anecdotally** encountered
in the wild" — explicitly experiential, not authoritative.)

**Ownership / Retro Interviews** (no dedicated lecture deck in the set, but defined in
000/Standalone): "A long-form discussion where you are asked to deep dive into a significant
past project, from idea to architecture to implementation." Signature prompt:
> "Tell me a good thing, a bad thing, and a thing you would change ('plus-minus-delta')."

This is where the **Plus/Minus/Delta** retro vocabulary originates and bleeds into the Retro
phase of every other type.

---

## 4. Per-Interview-Type Specifics

### 4a. Data Structures & Algorithms (decks 001, 007, Hyland)

**What it is:** "An interview that tests computer science concepts through writing and/or
executing code to perform some discrete task or to implement some algorithmic logic.
Requires a strong fundamental knowledge of 'vanilla' coding; an understanding of
optimization (big-O) and scalability; and the ability to plan and communicate your plan to
an interviewer. **No need to create an app.**"

**Formats:** single challenge (30–60 min); rapid-fire ~10 simple challenges over an hour;
multiple challenges building on one problem.

**How Scope–Roadmap–Code–Retro maps onto a coding problem** — worked via the recurring case
study, **"Verifying an Alien Dictionary" (LeetCode #953)**:

- **Scope** (the deck literally lists these as the candidate's scoping questions):
  - "How many words should I expect? How many letters should I expect?"
  - "Do I have any limitations in terms of memory?"
  - "How do I treat prefix words? How should I handle capitalization?"
  - "Should I consider improper values (numbers, nulls)?"
- **Roadmap:** describe the comparison approach conceptually before coding.
- **Code:** implement the letter-by-letter, word-by-word comparison.
- **Retro:** "Big O time: Look at your loops." (e.g., O(n·m) or O(n·m·o)). "Big O space: Look
  at your variables." (O(1) here). Then: "Are there any edge cases? What are some
  alternative approaches? (hint: hashmap)."

**General practice strategies (deck 001):**
- "Build deep knowledge and develop coding 'muscle memory'" — get a structured resource
  (interviewers "will likely use CS lingo when giving you hints"), practice a *volume* of
  problems intentionally, and practice "strict time management and context switching"
  (use a stopwatch; "don't get sucked down the rabbit hole").
- "Always communicate with the interviewer" — communicate contemplation, communicate the
  plan, practice "hand-waving," "black boxing," and "side-noting," and "ask for clarification
  and hints" ("The interviewer is a resource to get us on track").
- "Solve thoughtfully, not quickly or with brute force" — "use human language and
  pseudocode"; "write, don't type your code" (erasing is tedious, so it forces deliberate
  thinking ahead); say "this reminds me of X" vs. "this is X"; "explain why something is
  optimal v. suboptimal."

**Deck 007 (DS&A Part II) — building data structures:**
- Key strategies recap: "Practice a consistent plan of action, i.e. Scope/Roadmap/Code/Retro;
  Spend time practicing BOTH completion of an algorithm and strict time management; Don't
  commit early, i.e. **work on the forest, then the trees**; Use the interviewer as a resource."
- "Definitional v. practical" — many data structures map onto built-in types
  (stack/queue/heap → array; hashmap/graph/set → object in JS). Teaches reasoning about
  *when* a formal structure is worth implementing: "Think about your specific use case…
  What's the cost of implementing a more formal data structure?"
- Big-O framing across insert / search (traversal) / update / remove (first vs. last vs.
  specific), in best/worst/average case. Trees flagged as "especially popular."

**Hyland deck (guest, ~1000+ DS&A interviews conducted) — the most operational:**
- **Definition kept plain:** "Data Structures are ways of organizing data, like an array.
  Algorithms are specific sets of instructions to complete a task. (Not like 'the Twitter
  algorithm.') Basically, they're going to ask you to write some code."
- **The two non-negotiable structures:** **List and Map** ("You need to be able to use these
  without thinking about it"). Beyond that: read your language's collection docs; trees are
  popular — learn depth-first and breadth-first traversal, including the **recursive**
  approaches ("Some interviewers love recursion").
- **Basic algorithms to own:** loops ("You should almost never use the three-argument
  `for` loop syntax"); string manipulation ("Split and join are especially handy"); "be
  comfortable transforming data from one form to another."
- **Sample exercise format ("Shopping List"):** parse `["1 - apples", "5 - flour",
  "1 - bananas"]` into `{"1": ["apples","bananas"], "5": ["flour"]}` — i.e., parse + group
  into a map. This is the canonical shape: take an array of strings, transform into a map.
- **During the interview** (this maps cleanly onto Scope→Code): "Don't just start writing
  code." Clarify requirements ("Should I write tests for this code?"); verify desired
  behavior ("So if I had this input, would this be the correct output…?"); validate
  assumptions ("Can I assume the input will always be valid, or should I verify that?");
  "Have a plan for your code" (TODO comments / stubbed methods / written outline); identify
  corner cases; call out shortcuts and confirm the interviewer is OK; **"Identify
  tradeoffs!"**; be receptive to feedback; verify output on a test input; "Spend the time to
  get your naming right"; get indentation/formatting right.
- **"Think out loud"** — many interviewers expect it; what they want is "insight into how
  you're approaching the exercise" ("Did you quickly see the overall shape of the solution?
  Did you have a good idea of the approach before coding? Do you understand the tradeoffs and
  assumptions?"). Hyland's key line: **"This is often more important than the actual code."**
  If thinking aloud is hard for you, tell the interviewers up front and instead
  describe-approach → do-work → explain-code in sequence.
- **If things go wrong:**
  - *Stuck:* "Separate the 'problem' part from the 'computers' part." Solve it first with
    paper and pencil — **"DO NOT THINK ABOUT COMPUTERS YET."** Describe the steps as if to a
    person, write them down (as a comment), *then* translate to code.
  - *Realize a mistake:* "Definitely call it out, either way!" Fix it if early/easy; if too
    late, explain the mistake and how you'd have done it differently.
  - *Run out of time:* explain how you'd finish; leave a TODO or stub (free if you started
    with stubs).
- **After:** rewrite the problem several ways and compare trade-offs ("most readable /
  fastest / least memory"). On mindset: "Most early career roles get way more amazing
  candidates than they can hire… Think of it as a numbers game. Just try to learn as much as
  you can from each interview and keep getting better."

---

### 4b. Product / System Design (deck 003, Chris Ling 2023)

**What it is (2023 framing — "The Story / The Schematic / The Service"):** an interview that
"tests our ability to design, on a high level, a hypothetical software product or service."
Three things to understand:
- **The Story:** "the stakeholders and user stories that will define the key features for
  the user experience."
- **The Schematic:** "the resources that must be created and/or connected to meaningfully
  accomplish the story."
- **The Service:** "the present and future real-world situations we need to anticipate that
  will make our product scalable, available, and reliable."

**Product Design vs. System Design (the distinctive one-liners):**
- *Product Design:* "we focus more on **story and schematic over scale**. It's about how the
  user interacts with your software!" Caveat: "**product !== front-end**. Products don't need
  a front-end, and don't need a DB."
- *System Design:* "we focus more on **schematic and scale over story**. It's all about how
  we **ship** your software!" Caveat: "**system.includes('user experience')**… we care that
  your experience at 9AM in Portland is a consistent experience with 9AM in Munich
  (**'the McDonalds promise'**)."

**Focus areas:**
- *Product Design focus areas:* Front End (APIs + views, hand-wave the data model, focus on
  UX flow), Back End (APIs and non-client-facing services, e.g. payments, video streaming),
  Analytics (data modeling / ETL; may "run" queries; construct metrics).
- *System Design focus areas (how they probe scalability):*
  - **Scalability:** "Anticipating more and diverse user traffic via API gateways, load
    balancers, and multi-region resources."
  - **Optimization:** "Reducing load times by configuring query engines, caches, and
    choosing between cold v. warm storage."
  - **Tolerance:** "Prioritizing availability v. consistency in your partitions." (CAP)
  - **Redundancy:** "Ensuring a Plan B via replication, backups, and snapshots."

**Design interview archetypes (the question shapes interviewers use):**
- **(Re)Inventing the Wheel:** "build a competitor to Yelp… start in one city… expand to
  more cities."
- **Extending a Feature:** "expand our posting functionality… from text to now include
  photos. What new things do we have to add to our infrastructure?"
- **Exploring a Sandbox:** "build a predictive model for owners of vacation rentals to best
  price their homes… What data do we care about, and where and how do we get it?"

**The framework = Scope – Roadmap – Design – Retro** (Code replaced by Design):
- **Scope:** "Clarify with the interviewer what is/are the essential service(s) we are trying
  to build. What data do we need? What will users do, and at what scale?" Example: "For a
  ridesharing app, we might ask 'How do we display available drivers when requesting a ride?'"
- **Roadmap:** "Write as many short user stories as needed… **Sentences are features, nouns
  are the data model, and the verbs are the API.**" Worked Yelp example: "A User can view a
  Restaurant to view and post Reviews" →
  - Feature: a single restaurant page UI showing reviews + a new-review form.
  - Data model: tables for Users, Restaurants, Reviews.
  - API: `GET /restaurants/:restaurantId` then `POST /reviews/restaurants/:restaurantId`.
- **Design:** "Identify and **black box** each of the major pieces of your architecture, then
  approach building them in sequence." Black boxes: Database (tables, columns, data types),
  APIs (REST/CRUD standards, third-party services), Front-end UI (major pages, navigation,
  account-creation flow).
- **Retro:** "Did you cover all the bases…? An interviewer will give us **hypothetical
  scenarios to validate** that your design can address them. They might also ask us to
  improvise or incorporate changes." Examples: (product) "What if we want to add sharing and
  likes for each photo?" (systems) "What if we want a user in Japan to view and like the
  photo that is stored on a US server?"

**Artifacts / diagrams they expect:**
- **Entity Relationship Diagrams (ERDs)** are central: "An Entity Relationship (ER) Diagram
  is a type of flowchart that illustrates how 'entities' such as people, objects or concepts
  relate to each other within a system." Learn formatting for tables, relationships, and app
  components (DB vs. API vs. pages).
- Tooling: "Lucidchart, draw.io, Google Drawings, or Excalidraw" for diagrams;
  "Figma or Miro" for wireframing/vision-boarding; and sometimes "only option… is a text or
  code editor, like Codeshare, CoderPad, Replit, or even the dreaded Google Docs."
- 30-min deck has a **"This / Not This"** diagramming slide — i.e., they grade legibility of
  the diagram, not just its content.

**Pro-tips / how to probe MVP vs. scale:**
- "**It's OK to be lazy and uninspired**" — most P/SD interviews are real-world examples
  ("build eBay," "build Craigslist") because the product and pain points are well scrutinized.
  Use public investor metrics (e.g. **DAU** / SaaS metrics) and company engineering blogs
  (Airbnb, Instagram) as design references.
- "Reverse engineer your project(s)" — convert an existing project into a wireframe / ERD /
  user stories and present it timed, "do a credibility check, i.e. 'Do I sound like I know
  what I'm talking about?'"
- "Know your tech conventions, but don't get in the weeds" — internalize common patterns
  (DB tables vs. JSON, REST/CRUD), let one part of the design inform another, and
  "**Handwave redundant or obvious things**" (ask the interviewer to assume a new
  table/endpoint follows the established pattern).
- **MVP framing:** archetypes start at MVP-for-one-city / current-feature, then the Retro
  step deliberately escalates to scale and internationalization. The MVP-vs-scale axis is
  baked into the Retro follow-ups, not a separate phase.

> Discrepancy note: the older 2021 deck 003 framed components as "Clarifying scope and
> requirements / Designing the skeleton (Data model, API, Front-end, Systems) / Refactoring
> and refining / 'Test run'." The 2023 deck is the authoritative, cleaner mapping to
> Scope–Roadmap–Design–Retro and should be preferred.

---

### 4c. Stack, Terminology & Concept (STC) (decks 002/004/005)

**What it is:** "A Q&A format that does not require an interviewee to write code, but to
instead talk about a language, CS concept, technology, best practices, etc. You typically
encounter STCs during screener/initial interviews, although you might get asked STC questions
as part of an on-site." (Decks 004 and 002 are near-identical; 005 is "Part 3." 002 also has
a "Case Study" variant. The lecture credits "Nick Luallin, Thinkful.")

**Three things STC interviews test ("Interview Components"):**
- "**Do you know (y)our stack?**" (e.g., why a React hook over a class? worked in a PHP +
  MariaDB codebase?)
- "**Do you know CS terminology?**" (dependency injection; concurrency vs. parallelism)
- "**Do you know best practices and software patterns?**" (explain TDD and its benefits;
  prevent SQL injection on front-end/back-end)

**Formats:** Recruiter screener (matching to the job description), SWE screener (a technical
stakeholder, biased either toward CS answers or their specific stack), SWE on-site (STC
questions asked *contextually* against another interview — e.g. "I wrote an API route to
query the DB and now I need to talk about Bobby Tables" [SQL injection]).

**How it's used / how to answer ("Answer the right question the right way"):**
- "**Keep definitions short and sweet:** Stay out of the weeds unless specifically asked,
  even if you're an expert."
- "**Admit limitations, ask for clarity:** … 'I'm not familiar with that specific term, but
  could you give me a little more context as to what we're discussing?'"
- "**Use parallel and generalized answers if needed:** … identify similar technologies (Vue
  v. React) or zoom up a level (MySQL v. ANSI SQL)."
- "**Tie concepts to code examples:** Nothing sells theory as effectively as a practical
  application."
- Practice strategy: "Don't oversell your credentials… We're responsible for backing up our
  credentials with credibility." Buzzwords on a resume invite specific questioning.

> The STC decks contain extensive **recruiter-POV** notes (see §5) that are unusually rich
> for the interviewer persona.

---

### 4d. Deploy an App / Cloud (deck 006)

**What it is:** "An interview that has a software engineer build a minimum viable product
(MVP) or toy app based on a closed universe of information and a list of requirements."
Complexity scales with timeframe (1 hr → 48 hr). "Typically requires libraries/frameworks in
web app development (React, Redux, visualization libraries, etc)."

**Formats:**
- **Live Coding (~1 hr):** build example components or a simple toy app with light
  requirements while an interviewer observes/pairs. Goal: "test your comfort and muscle
  memory building commonly observed app features (think dynamic lists and forms, simple
  visualizations, simple searching and filtering), and communication with your interviewer
  over scope." Front-end heavy; usually no back-end, though an API/DB/example data structure
  may be provided.
- **Take-Home Challenge:** "afternooner (~4 hr)" or "weekender (1–2 days)," formal
  requirements + stretch goals; may build from scratch or modify an existing codebase; may
  present afterward and/or deploy for async review.

**Framework = Scope – Roadmap – Code – Retro (verbatim):**
- **Scope:** clarify core requirements — don't assume. **Product requirements** (summarize to
  a few/one user story; "Don't think about the tech, think about the user interactions" —
  e.g. "I want an app to select a number of dice, then roll them and record the result").
  **Technical requirements** = "Get a sense of your **sandbox, toolbox, and deliverable**":
  - *Sandbox:* "Do we start from scratch, or is there a codebase/services/infra available?"
  - *Toolbox:* "What technology (languages, frameworks, libraries) must/can/can't we use?"
  - *Deliverable:* "How much polish is needed? — Proof of concept (POC) / Minimum viable
    product (MVP) / Feature improvement (v1.1) / Next generation (v2.0)."
- **Roadmap:** "Don't just start building." Map the "ecosystem" ("the forest from the
  trees"): **-ends and Services** (front-end vs. back-end, third-party APIs/data stores,
  off-the-shelf services); **Objects** ("the nouns with which your user interacts" — a car,
  die, menu; a search bar, gallery, dropdown — these inform data model, components, state,
  style); **Functions** ("the verbs that define how a user interacts with objects"); and
  **Infrastructure** ("Where do things live and how are they connected? Locally or hosted?
  CI/CD or a one-shot build?").
- **Code:** "Remember your roadmap" (a checklist that lets you context-switch without losing
  your place); "**We don't 'ride-or-die'**" (step back and re-evaluate the roadmap when the
  first pass is wrong); "**Goldilocks engineer**" (don't over-engineer or use a pattern the
  interviewer may not know; find a succinct implementation); "**Core functionality before
  value adds**… Dark mode is pointless if nothing is rendering on the screen."
- **Retro:** review requirements (did you satisfy them; if not, did you prioritize the most
  important and *communicate* that prioritization?); demo/presentation (walk through the user
  story and design); time/effort estimation (how much more time would the rest take — "Was it
  impossible, or was it time management?"); and **Plus/Minus/Delta (+ / − / Δ)**.

**Cloud / deploy / infra specifics (deck 006 Q&A — the "Deploy an App" stance on cloud):**
- "Where do I deploy and serve my app? The cheat answer is, **if they don't tell you that it
  has to be deployed, don't worry about it.** As long as they have access to your repo or you
  can localhost it for the interviewer, you should be in the clear."
- Anecdote: "in all my years of mentoring Alchemy grads, I've only heard of a need to fully
  deploy something for an interview like once (a reverse proxy)."
- "If you HAVE to deploy, go with the free/cheap option, like Heroku, Netlify, Fauna, etc.
  **Don't do AWS.**"
- Tooling: "Many of the jobs you'll apply to will be React jobs." Work lives on GitHub so
  packages/dependencies are inspectable and version-controlled. Pre-COVID candidates often
  drove on their own machine; share-screen now suffices ("hide all your suspect material
  before your interview").

> Note: deck 006 frames "deploy/cloud" lightly — for this program, the *infrastructure*
> depth lives in the **System Design** interview type (§4b: scalability, optimization,
> tolerance, redundancy), not in "Deploy an App." There is no separate dedicated cloud/infra
> lecture deck in this set; treat §4b as the home for serious infra/scalability questioning.

---

## 5. How Interviewers Give Hints, Feedback & Evaluate

This is the highest-value material for an interviewer persona. Sources are tagged.

### Tone & stance (from the Professional Code + program design)
- Feedback is **"honest and constructive feedback, not judgment"** (Growth) and delivered by
  a peer "brain trust," not a gatekeeper. Candidates are "peers, colleagues, and
  collaborators" (Respect). Failure is explicitly allowed ("We allow ourselves to celebrate,
  and allow ourselves to fail").
- The interviewer is framed to candidates as **"a resource to get us on track,"** not an
  adversary. Hints are expected and legitimate.

### What interviewers actually look for (Hyland, ~1000+ interviews)
- **Process over answer:** "What they're looking for is to get some insight into how you're
  approaching the exercise… This is often more important than the actual code."
- The implicit evaluation questions an interviewer asks themselves: "Did you quickly see the
  overall shape of the solution? Did you have a good idea of the approach you wanted to take
  before you started coding? Do you understand the tradeoffs and assumptions implied by your
  solution?"
- Interviewers reward: clarifying requirements before coding, validating assumptions,
  identifying corner cases and trade-offs, receptiveness to feedback, calling out mistakes,
  and correct naming/formatting. (See 4a "During the interview.")
- **Giving hints:** interviewers "will likely use CS lingo when giving you hints" (deck 001)
  — so hints are couched in proper terminology, and the candidate is expected to recognize it
  (e.g. the Alien Dictionary retro hint: "(hint: hashmap)").

### Recruiter / hiring-manager POV (STC deck 002 speaker notes — gold for the persona)
- "**Recruiters aren't trying to trick you.** Whether HR, recruiter, etc., they WANT you to
  do well."
- "**Recruiters look for best faith effort.** Admitting when you don't know and getting
  clarification. Pause, breathe, get clarification."
- On leveling: "For teams of 5–10 individual contributor size, it's important to make the
  right level hire at the right time… At the more senior level, someone needs to speak to
  specific tech/framework… for more junior roles they're not as strict." Recruiters "ask
  where have you used the tech, how have you used it, what was the result."
- "**Behavior questions are KEY.**… Use storytelling, explaining what you've done. 'I did X
  project that incorporated A, B, and C.'"

### Red flags vs. green flags (STC deck 002 speaker notes — stated almost verbatim)
- **Biggest red flag:** "Candidate made unsubstantiated claims about being a hard worker/can
  learn new skills, but had no stories to back it up. **Creates a precedent of lack of
  credibility.**"
- **Biggest green flag ("good surprise"):** "**Practicing humility. Being open with what
  someone doesn't know. Pivoting to collaboration and asking questions.**"
- Phrasing finesse interviewers respect: "Reframing 'I think you mean this' to 'I think you
  might be referring to this.'" And: "Academic v. practical: Don't just be the answer kid.
  Treat it like you're on the job."

### Take-home / Deploy-an-App evaluation (deck 006)
- Whether the candidate **prioritized the most important requirements and communicated that
  prioritization** is itself graded — finishing everything is not required, but triaging and
  narrating the triage is.
- "Was it impossible, or was it time management?" — interviewers distinguish capability gaps
  from time-management gaps.

### Scoring rubric
There is **no formal numeric scoring rubric / point system** in any deck in this set. The
program is explicitly qualitative: the closest things to a rubric are (a) the per-phase
good/weak signals in §1, (b) Hyland's "process > code" evaluation questions above, and
(c) the **Plus/Minus/Delta** retro structure. Do not fabricate a points-based rubric.

---

## 6. Cross-Cutting Communication Strategies

From the 30-min "Core Interview Strategies" deck. The program's three pillars are
**Anticipate, Communicate, Practice**. Distinctive guidance:

- **"Interviewers don't want answers, they want processes.** If you internalize all of the
  hard work in your gray matter, that's valuable information about you that is never being
  communicated to a future boss or colleague." ("Speak Openly, and Often")
- **"Substance over Form** — When in doubt, prioritize understanding how things work over
  what things are called. If you terminology drop, expect to know exactly what that
  terminology means."
- **"Generalize if Unspecialized** — … Draw out the general domain behind the specific job
  requirement, then relate your general experience to that specific use case."
- **"Diagramming"** is a named core skill (the "This / Not This" slide) across product
  design, ERDs, and system design.

The "magic code words" principle (deck 001) is the connective tissue: committing to literal
syntax ("forEach the array") or a literal claim ("this *is* X") too early locks the candidate
in. Prefer human language ("iterate through each of the choices") and tentative framing
("this reminds me of X") during Scope/Roadmap, converting to precise code only in Code.

---

## 7. Source Map

| Section | Primary source deck(s) |
|---|---|
| §1 Core methodology (Scope–Roadmap–Code–Retro) | 30 Min Deck (definition); Standalone deck (notes "Four Parts"); Deck 001 (time formats); Deck 006 (per-phase). Design variant "Scope–Roadmap–**Design**–Retro" from Chris Ling 2023 Product/System Design deck, slide 16. |
| §2 Prerequisites & mindset / Professional Code | Deck 000 (Intro and Prereqs – Lecture); Professional Code appears in nearly all decks; "brain trust" retro from Standalone deck. |
| §3 Six interview types | Deck 000; Standalone deck; 30 Min Deck. |
| §4a DS&A | Deck 001 (DS&A Lecture); Deck 007 (DS&A Part II); Hyland PDF (2023-07-08); Alien Dictionary case study in 001/Standalone/30-min. |
| §4b Product / System Design | Chris Ling 2023 Product or System Design deck (primary, "Story/Schematic/Service," archetypes, Scope–Roadmap–Design–Retro); Deck 003 (2021, older component labels). |
| §4c STC | Deck 002 (Stack, Terminology, and Concept – Lecture, incl. recruiter speaker notes); Decks 004/005 (Parts 2 & 3, near-identical content). |
| §4d Deploy an App / cloud | Deck 006 (Deploy an App – Lecture), incl. the Q&A slide on deployment/AWS. |
| §5 Hints/feedback/evaluation | Hyland PDF ("process > code," during-interview, things-go-wrong); Deck 002 speaker notes (recruiter POV, red/green flags); Deck 006 (take-home eval); Professional Code (tone). |
| §6 Communication strategies | 30 Min Deck ("Anticipate/Communicate/Practice," Substance over Form, etc.); Deck 001 ("magic code words"). |

### Files in the set NOT used / not readable
- **All files were readable.** PDF extraction required installing `pypdf`
  (`--break-system-packages`) because `pdftotext` was unavailable; the Hyland PDF extracted
  cleanly (126 pages).
- The Hyland `.key` (Keynote) file is a binary duplicate of the Hyland `.pdf`; the PDF was
  used instead.
- Lab decks (000/001/002/003/004/006 "- Lab.pptx") and the "Case Study" STC variant were not
  exhaustively transcribed; the corresponding Lecture decks carry the methodology content and
  were used. Decks 004 and 005 were spot-checked and found to duplicate deck 002's STC
  framework.
- Out-of-scope decks present in the folder but not part of this methodology extraction:
  "ChatGPT, Myself, and I(nterviews)," "F_ing Data Scientists How Do They Work," the
  "Lawyers Leveraging Models" folder, the "Jane Street and Meta" debrief, and the Jupyter
  survey spreadsheet. These were not analyzed.

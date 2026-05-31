/* Mock Interview shared shell — core runtime.
 *
 * interview.html loads this and calls MockInterview.boot(). The shell reads the instance's
 * ./interview.json, renders the chrome (header, budgeted Scope/Roadmap/Code/Retro phase timer, overall
 * timer, the right-rail tabs Prompt/Transcript/Feedback/Splits/Notes/Improve, help overlay), then hands the
 * work pane to the right module from /shell/modules/<type>.js.
 *
 * Everything the candidate produces is mirrored to real files via the local server's /api/save, so the
 * interviewer (Claude, in the terminal) reads their work in flight. If the server isn't running, the shell
 * degrades to localStorage and shows a banner. */

const MockInterview = (() => {
  // Phases are the method's spine (Scope → Roadmap → Code/Design → Retro). Each phase may carry a `minutes`
  // budget; when set, the pill fills as that slice of the clock elapses, signalling when you should move on.
  const DEFAULT_PHASES = [{ name: "Scope" }, { name: "Roadmap" }, { name: "Code" }, { name: "Retro" }];
  let PHASES = DEFAULT_PHASES.slice();
  let activePhase = null;  // where the candidate actually is (auto-advanced or clicked)
  let cfg = null, base = "", serverUp = false;
  let timer = { start: null, limitSec: 0, raf: null, paused: true, elapsed: 0 };
  let txData = [], txRaw = "", txShowMeta = false;   // conversation log (transcript.json) state
  let fbRaw = "";                                     // last-seen feedback.md (so the Retro shows + persists)
  let ended = false;                                  // set when the candidate ends the interview
  let splits = {}, phaseStartUsed = 0, lastSplitRender = 0;   // actual time spent per phase (speedrun splits)
  let audioCtx = null, soundOn = true, prevExpected = -1, lastExpected = -1, expiredFired = false;  // timer cues

  // ---- persistence ----------------------------------------------------------
  async function save(relPath, content) {
    const full = base + relPath;
    if (content == null) localStorage.removeItem("mi:" + full);
    else localStorage.setItem("mi:" + full, content);   // always mirror so reloads restore work
    if (serverUp && content != null) {
      try {
        const r = await fetch("/api/save", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: full, content }),
        });
        if (r.ok) return true;
      } catch (e) { /* localStorage already holds it */ }
    }
    return false;
  }
  async function run(payload) {
    if (!serverUp) throw new Error("server-offline");
    const r = await fetch("/api/run", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    return r.json();
  }
  async function checkServer() {
    try { serverUp = (await fetch("/api/ping")).ok; } catch (e) { serverUp = false; }
    document.getElementById("mi-offline").classList.toggle("hide", serverUp);
    return serverUp;
  }

  // ---- phase model ----------------------------------------------------------
  function normalizePhases(raw) {
    if (!Array.isArray(raw) || !raw.length) return DEFAULT_PHASES.slice();
    return raw.map(p => typeof p === "string"
      ? { name: p }
      : { name: String(p.name || "Phase"), minutes: Number(p.minutes) > 0 ? Number(p.minutes) : undefined });
  }
  function windows() {  // cumulative [start,end) seconds for budgeted phases
    let t = 0;
    return PHASES.map(p => { const start = t, dur = (p.minutes || 0) * 60; t += dur; return { start, end: t, dur }; });
  }
  function usedSeconds() {
    return timer.elapsed + (timer.paused ? 0 : (performance.now() - timer.start) / 1000);
  }

  // ---- overall timer --------------------------------------------------------
  function fmt(sec) { const s = Math.max(0, Math.floor(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
  function tickTimer() {
    const used = usedSeconds();
    const el = document.getElementById("mi-timer");
    if (el) {
      const remaining = timer.limitSec - used;
      el.textContent = timer.limitSec ? fmt(remaining) : fmt(used);
      el.classList.toggle("over", timer.limitSec && remaining < 0);
    }
    updatePhaseFills(used);

    // cue when the clock crosses into the next budgeted phase, and once when the overall time expires
    if (timer.limitSec && !timer.paused) {
      if (lastExpected > prevExpected && prevExpected >= 0) phaseCue(lastExpected);
      if (used >= timer.limitSec && !expiredFired) { expiredFired = true; expiryCue(); }
    }
    prevExpected = lastExpected;

    const sp = document.getElementById("mi-splits");   // keep the splits view live while it's open
    if (sp && !sp.hidden && performance.now() - lastSplitRender > 500) { lastSplitRender = performance.now(); renderSplits(); }

    timer.raf = requestAnimationFrame(tickTimer);
  }
  function toggleTimer() {
    const btn = document.getElementById("mi-timerbtn");
    if (timer.paused) { initAudio(); timer.start = performance.now(); timer.paused = false; btn.textContent = "Pause"; }
    else { timer.elapsed += (performance.now() - timer.start) / 1000; timer.paused = true; btn.textContent = "Resume"; }
    persistState();
  }

  // ---- phase pills: render, fill by budget, set active ----------------------
  function renderPhases() {
    const host = document.getElementById("mi-phases");
    if (!host) return;
    host.innerHTML = PHASES.map((p, i) =>
      `<button class="mi-phase" data-i="${i}" role="button" tabindex="0"
         aria-label="${esc(p.name)}${p.minutes ? ` — ${p.minutes} minute budget` : ""}">
         <span class="mi-phase-fill"></span>
         <span class="mi-phase-label">${esc(p.name)}${p.minutes ? `<em>${p.minutes}m</em>` : ""}</span>
       </button>`).join("") +
      `<button class="mi-phase-cfg" id="mi-phasecfg" aria-label="Configure phases and time budgets"
         title="Configure phases & time budgets">⚙</button>`;
    host.querySelectorAll(".mi-phase").forEach(btn => {
      const go = () => setPhase(PHASES[+btn.dataset.i].name);
      btn.onclick = go;
      btn.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    });
    host.querySelector("#mi-phasecfg").onclick = openPhaseConfig;
    if (activePhase) markActive();
    updatePhaseFills(usedSeconds());
  }
  function markActive() {
    const cur = PHASES.findIndex(p => p.name === activePhase);
    document.querySelectorAll(".mi-phase").forEach((el, i) => el.classList.toggle("active", i === cur));
  }
  function updatePhaseFills(used) {
    const w = windows(), pills = document.querySelectorAll(".mi-phase");
    // "expected" phase = the budgeted window the clock currently sits in
    let expected = -1;
    for (let i = 0; i < w.length; i++) { if (w[i].dur > 0 && used < w[i].end) { expected = i; break; } }
    pills.forEach((el, i) => {
      const fill = el.querySelector(".mi-phase-fill");
      if (!w[i] || w[i].dur === 0) { if (fill) fill.style.width = "0%"; el.classList.remove("expected", "over"); return; }
      const frac = Math.max(0, Math.min(1, (used - w[i].start) / w[i].dur));
      if (fill) fill.style.width = (frac * 100) + "%";
      el.classList.toggle("expected", i === expected);
      el.classList.toggle("over", frac >= 1 && i === expectedLag(expected));  // only flag the one you're overrunning
    });
    lastExpected = expected;
  }
  // if the candidate's active phase is fully elapsed but they haven't moved on, flag it
  function expectedLag(expected) {
    const activeIdx = PHASES.findIndex(p => p.name === activePhase);
    return (expected > activeIdx && activeIdx >= 0) ? activeIdx : -2;
  }

  function setPhase(name) {
    if (activePhase && name !== activePhase) {            // bank the time spent in the phase we're leaving
      const u = usedSeconds();
      splits[activePhase] = (splits[activePhase] || 0) + Math.max(0, u - phaseStartUsed);
      phaseStartUsed = u;
    }
    activePhase = name; cfg._phase = name;
    markActive(); renderSplits(); persistState();
  }

  function splitsSnapshot() {   // live actual seconds per phase (current phase includes the running segment)
    const o = {}, u = usedSeconds();
    PHASES.forEach(p => {
      o[p.name] = Math.round((splits[p.name] || 0) + (p.name === activePhase ? Math.max(0, u - phaseStartUsed) : 0));
    });
    return o;
  }
  function renderSplits() {
    const host = document.getElementById("mi-splits"); if (!host) return;
    const actual = splitsSnapshot();
    let tb = 0, ta = 0;
    const rows = PHASES.map(p => {
      const budget = (p.minutes || 0) * 60, act = actual[p.name] || 0;
      tb += budget; ta += act;
      const d = budget ? act - budget : null;
      const cls = d == null ? "" : (d <= 0 ? "mi-sp-under" : "mi-sp-over");
      const dtxt = d == null ? "—" : (d <= 0 ? "−" : "+") + fmt(Math.abs(d));
      return `<tr class="${p.name === activePhase ? "mi-sp-cur" : ""}">
        <td class="mi-sp-name">${esc(p.name)}${p.name === activePhase ? ' <span class="mi-sp-live" title="current">●</span>' : ""}</td>
        <td>${budget ? fmt(budget) : "—"}</td><td>${fmt(act)}</td>
        <td class="${cls}">${budget ? dtxt : "—"}</td></tr>`;
    }).join("");
    const td = tb ? ta - tb : null;
    host.innerHTML = `
      <table class="mi-sp-table">
        <thead><tr><th>Phase</th><th>Budget</th><th>Actual</th><th>±</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td class="mi-sp-name">Total</td><td>${tb ? fmt(tb) : "—"}</td><td>${fmt(ta)}</td>
          <td class="${td == null ? "" : (td <= 0 ? "mi-sp-under" : "mi-sp-over")}">${tb ? ((td <= 0 ? "−" : "+") + fmt(Math.abs(td))) : "—"}</td></tr></tfoot>
      </table>
      <p class="mi-sp-hint">Estimated (budget) vs. actual time per phase — like speedrun splits. Green = under, amber = over.
        Set budgets with ⚙ and start the timer to track.</p>`;
  }

  // ---- timer cues (sound + visual) ------------------------------------------
  function initAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) { audioCtx = null; }
  }
  function beep(freq, dur, when = 0, type = "sine", gain = 0.06) {
    if (!soundOn || !audioCtx) return;
    try {
      const t = audioCtx.currentTime + when;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  }
  function phaseCue(idx) {                       // gentle two-note rise + pulse the newly-expected pill
    beep(660, 0.12); beep(880, 0.14, 0.12);
    const pill = document.querySelectorAll(".mi-phase")[idx];
    if (pill) { pill.classList.add("pulse"); setTimeout(() => pill.classList.remove("pulse"), 900); }
  }
  function expiryCue() {                          // distinct lower double-tone + flash the timer
    beep(440, 0.25, 0, "square", 0.05); beep(330, 0.4, 0.22, "square", 0.05);
    const el = document.getElementById("mi-timer"); if (el) { el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); }
  }

  function txTimeLabel(m) {
    const parts = [];
    if (typeof m.at === "number") parts.push("+" + fmt(m.at) + (m.phase ? " · " + esc(m.phase) : ""));
    else if (m.phase) parts.push(esc(m.phase));
    if (m.ts) { const d = new Date(m.ts); if (!isNaN(d.getTime())) parts.push(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })); }
    return parts.length ? `<span class="mi-bubble-time">${parts.join(" · ")}</span>` : "";
  }

  function persistState() {
    save("artifacts/_session.json", JSON.stringify({
      phase: activePhase, elapsed_seconds: Math.round(usedSeconds()), paused: timer.paused,
      hint_level: cfg.hint_level, timebox_minutes: cfg.timebox_minutes,
      phases: PHASES, phase_splits: splitsSnapshot(), ended, updated: new Date().toISOString(),
    }, null, 2));
  }

  // ---- phase config popover (add/remove phases, set budgets) -----------------
  function openPhaseConfig() {
    closePopover();
    const anchor = document.getElementById("mi-phasecfg");
    const pop = document.createElement("div");
    pop.className = "mi-pop"; pop.id = "mi-pop"; pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Configure phases and time budgets");
    pop.innerHTML = `
      <div class="mi-pop-title">Phases &amp; time budgets</div>
      <div class="mi-pop-rows" id="mi-pop-rows"></div>
      <button class="mi-btn" id="mi-pop-add">+ Add phase</button>
      <div class="mi-pop-foot">
        <span class="mi-pop-note">Budgets pace the pills as the clock runs.</span>
        <button class="mi-btn primary" id="mi-pop-done">Done</button>
      </div>`;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.top = (r.bottom + 6) + "px"; pop.style.left = Math.max(8, r.left - 120) + "px";

    const rows = pop.querySelector("#mi-pop-rows");
    const draw = () => {
      rows.innerHTML = PHASES.map((p, i) => `
        <div class="mi-pop-row">
          <input class="mi-pop-name" data-i="${i}" value="${esc(p.name)}" aria-label="Phase name">
          <input class="mi-pop-min" data-i="${i}" type="number" min="0" step="1"
            value="${p.minutes ?? ""}" placeholder="min" aria-label="Minutes for ${esc(p.name)}">
          <button class="mi-pop-del" data-i="${i}" aria-label="Remove ${esc(p.name)}">×</button>
        </div>`).join("");
      rows.querySelectorAll(".mi-pop-name").forEach(inp => inp.oninput = () => { PHASES[+inp.dataset.i].name = inp.value || "Phase"; });
      rows.querySelectorAll(".mi-pop-min").forEach(inp => inp.oninput = () => {
        const v = Number(inp.value); PHASES[+inp.dataset.i].minutes = v > 0 ? v : undefined;
      });
      rows.querySelectorAll(".mi-pop-del").forEach(b => b.onclick = () => {
        if (PHASES.length > 1) { PHASES.splice(+b.dataset.i, 1); draw(); }
      });
    };
    draw();
    pop.querySelector("#mi-pop-add").onclick = () => { PHASES.push({ name: "Phase " + (PHASES.length + 1) }); draw(); };
    pop.querySelector("#mi-pop-done").onclick = () => {
      PHASES = normalizePhases(PHASES);
      if (!PHASES.find(p => p.name === activePhase)) activePhase = PHASES[0].name;
      localStorage.setItem("mi:phases:" + base, JSON.stringify(PHASES));
      renderPhases(); persistState(); closePopover();
    };
    pop.querySelector("#mi-pop-done").focus();
  }
  function closePopover() { const p = document.getElementById("mi-pop"); if (p) p.remove(); }
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closePopover(); closeHelp(); } });

  // ---- help / FAQ overlay ---------------------------------------------------
  function helpHTML() {
    return `
      <div class="mi-help-card" role="dialog" aria-modal="true" aria-labelledby="mi-help-h">
        <button class="mi-help-x" id="mi-help-x" aria-label="Close help">×</button>
        <h2 id="mi-help-h">How this mock interview works</h2>
        <p class="mi-help-lead">A real interview, run two places at once: you <b>do the work here</b> in this UI,
          and you <b>talk to your interviewer in the Claude Code terminal</b>. The terminal conversation runs on
          your subscription — it doesn't cost extra API credits.</p>
        <div class="mi-help-grid">
          <div><h3>The work pane</h3><p>Write code, draw, query, or draft here. It autosaves to disk as you go,
            so your interviewer can read exactly what's on your screen. <b>Run</b> executes your code;
            <b>Run Tests</b> checks it against the cases.</p></div>
          <div><h3>The phase timer</h3><p>Scope → Roadmap → Code → Retro is the method's pacing spine. If a phase
            has a time budget, its pill fills as the clock runs — when it's full, you've used that phase's time
            and should move on. Hit <b>⚙</b> to add/remove phases or change budgets.</p></div>
          <div><h3>The side tabs</h3><p><b>Prompt</b> is the question. <b>Transcript</b> mirrors your conversation
            as read-only chat bubbles. <b>Feedback</b> is your Retro — it appears when you wrap up and stays here to
            revisit. <b>Notes</b> is your scratchpad. <b>Improve</b> is for notes to <i>yourself</i> about this
            interview (too easy? bug? confusing?) — saved and fed back in when you re-run the skill to iterate.</p></div>
          <div><h3>Talking to your interviewer</h3><p>Think out loud, ask clarifying questions, or say you're ready
            for the next phase <i>in the terminal</i>. It shows up in the <b>Transcript</b> tab as you go. Hints come
            at the level set for this interview, and you won't get the answer until the Retro.</p></div>
          <div><h3>Stepping out (the fourth wall)</h3><p>Need a meta question — "is this the approach you wanted?"
            Just say so in the terminal ("can we pause for a sec?"), ask it, then say when you're ready to jump back
            in. The interviewer stays in character until you ask to step out.</p></div>
          <div><h3>Theme &amp; layout</h3><p>Toggle light/dark with ☾/☀. Use ⇔ to widen the prompt panel. Everything
            is keyboard-accessible and respects your contrast / reduced-motion settings.</p></div>
        </div>
        <label class="mi-help-dismiss"><input type="checkbox" id="mi-help-never"> Don't show this automatically again</label>
      </div>`;
  }
  function openHelp() {
    closeHelp();
    const o = document.createElement("div");
    o.className = "mi-help-overlay"; o.id = "mi-help"; o.innerHTML = helpHTML();
    o.addEventListener("click", e => { if (e.target === o) closeHelp(); });
    document.body.appendChild(o);
    o.querySelector("#mi-help-x").onclick = closeHelp;
    o.querySelector("#mi-help-never").onchange = e => {
      try { localStorage.setItem("mi:help-dismissed", e.target.checked ? "1" : ""); } catch (er) {}
    };
    o.querySelector("#mi-help-x").focus();
  }
  function closeHelp() { const o = document.getElementById("mi-help"); if (o) o.remove(); }

  // ---- conversation log (read-only chat bubbles, polled from transcript.json) -----------------
  // The interviewer (Claude, in the terminal) appends {role, name?, text, meta, at, phase, ts?} entries to the
  // instance's transcript.json as the conversation unfolds; the UI renders them as chat bubbles and
  // refreshes every few seconds. `meta:true` marks fourth-wall asides, which the toggle can hide.
  async function pollTranscript() {
    try {
      const r = await fetch("transcript.json", { cache: "no-store" });
      if (!r.ok) return;
      const text = await r.text();
      if (text === txRaw) return;             // unchanged since last poll
      txRaw = text; txData = JSON.parse(text); renderTranscript();
    } catch (e) { /* no transcript yet, or invalid — leave the empty state */ }
  }
  function renderTranscript() {
    const list = document.getElementById("mi-tx-list"); if (!list) return;
    const all = Array.isArray(txData) ? txData : [];
    const items = all.filter(m => txShowMeta || !m.meta);
    const status = document.getElementById("mi-tx-status");
    if (status) {
      const hidden = all.filter(m => m.meta).length;
      status.textContent = (hidden && !txShowMeta) ? `${hidden} aside${hidden > 1 ? "s" : ""} hidden` : "";
    }
    if (!items.length) {
      list.innerHTML = `<div class="mi-tx-empty">Your conversation with the interviewer appears here as you talk in the terminal — read-only, in chat form.</div>`;
      return;
    }
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
    list.innerHTML = items.map(m => {
      const me = m.role === "candidate";
      return `<div class="mi-bubble-row ${me ? "right" : "left"}">
        <div class="mi-bubble ${me ? "me" : "them"}${m.meta ? " meta" : ""}">
          ${m.meta ? '<span class="mi-bubble-tag">fourth wall</span>' : ""}
          <span class="mi-bubble-who">${me ? "You" : esc(m.name || "Interviewer")}</span>${txTimeLabel(m)}
          <div class="mi-bubble-txt">${mdLite(m.text || "")}</div>
        </div></div>`;
    }).join("");
    if (atBottom) list.scrollTop = list.scrollHeight;   // keep pinned to newest unless scrolled up
  }

  // The Retro lives in feedback.md (written at the end). Poll for it so it appears when ready and persists.
  async function pollFeedback() {
    try {
      const r = await fetch("feedback.md", { cache: "no-store" });
      if (!r.ok) return;
      const text = await r.text();
      if (text === fbRaw) return;
      fbRaw = text;
      const el = document.getElementById("mi-feedback");
      if (el) el.innerHTML = mdLite(text);
      const tab = document.querySelector('.mi-railtab[data-rail="feedback"]');
      if (tab) tab.classList.add("mi-railtab-flag");   // subtle dot: feedback is ready
    } catch (e) { /* no feedback yet */ }
  }

  // ---- rendering ------------------------------------------------------------
  function renderChrome() {
    const root = document.getElementById("mi-root");
    root.innerHTML = `
      <div id="mi-offline" class="mi-banner hide" role="status" aria-live="polite">Local server not detected —
        your work is being kept in this browser only. Start it so your interviewer can see your progress:
        <code>python3 shell/serve.py</code> from your portfolio folder.</div>
      <header class="mi-bar">
        <a class="mi-iconbtn mi-home" href="../index.html" title="Back to your portfolio" aria-label="Back to your portfolio">⌂</a>
        <div class="mi-id">
          <span class="mi-title">${esc(cfg.title || "Mock Interview")}</span>
          <span class="mi-sub">${esc([cfg.company, cfg.role, cfg.level].filter(Boolean).join(" · ") || cfg.type)}</span>
        </div>
        <div class="mi-phases" id="mi-phases" role="group" aria-label="Interview phases and time budgets"></div>
        <div class="mi-spacer"></div>
        <div class="mi-timer" id="mi-timer" role="timer" aria-live="polite">0:00</div>
        <button class="mi-btn" id="mi-timerbtn">Start</button>
        <button class="mi-btn primary" id="mi-done">End &amp; Retro</button>
        <button class="mi-iconbtn" id="mi-sound" aria-label="Mute timer sounds" title="Timer sounds">🔔</button>
        <button class="mi-iconbtn" id="mi-help-btn" aria-label="How this works (help)" title="How this works">?</button>
        <button class="mi-iconbtn" data-theme-toggle id="mi-theme" aria-label="Toggle theme">☾</button>
      </header>
      <div class="mi-main">
        <div class="mi-work" id="mi-work"></div>
        <aside class="mi-side" id="mi-side">
          <div class="mi-railtabs">
            <div class="mi-railtabbtns">
              <button class="mi-railtab active" data-rail="prompt">Prompt</button>
              <button class="mi-railtab" data-rail="transcript">Transcript</button>
              <button class="mi-railtab" data-rail="feedback">Feedback</button>
              <button class="mi-railtab" data-rail="splits">Splits</button>
              <button class="mi-railtab" data-rail="notes">Notes</button>
              <button class="mi-railtab" data-rail="improve" title="Notes to improve this interview next time">Improve</button>
            </div>
            <select class="mi-railselect" id="mi-railselect" aria-label="Choose panel">
              <option value="prompt">Prompt</option>
              <option value="transcript">Transcript</option>
              <option value="feedback">Feedback</option>
              <option value="splits">Splits</option>
              <option value="notes">Notes</option>
              <option value="improve">Improve</option>
            </select>
            <span class="mi-spacer"></span>
            <button class="mi-railwide" id="mi-railwide" title="Widen / narrow this panel" aria-label="Widen or narrow panel">⇔</button>
            <button class="mi-railwide" id="mi-railcollapse" title="Collapse this panel" aria-label="Collapse panel">⟩</button>
          </div>
          <div class="mi-railpanel mi-prompt" data-rail="prompt" id="mi-prompt">Loading…</div>
          <div class="mi-railpanel mi-transcript" data-rail="transcript" hidden>
            <div class="mi-tx-bar">
              <label class="mi-tx-toggle"><input type="checkbox" id="mi-tx-meta"> Show fourth-wall asides</label>
              <span class="mi-tx-status" id="mi-tx-status"></span>
            </div>
            <div class="mi-tx-list" id="mi-tx-list">
              <div class="mi-tx-empty">Your conversation with the interviewer appears here as you talk in the terminal — read-only, in chat form.</div>
            </div>
          </div>
          <div class="mi-railpanel mi-prompt" data-rail="feedback" id="mi-feedback" hidden>
            <div class="mi-tx-empty">Your Retro feedback appears here once you wrap up the interview — and it
              stays here, so you can revisit it before your next rep.</div>
          </div>
          <div class="mi-railpanel mi-splits-panel" data-rail="splits" id="mi-splits" hidden></div>
          <div class="mi-railpanel mi-notes" data-rail="notes" hidden>
            <textarea id="mi-notes" placeholder="Scratch notes — assumptions, approach, complexity, edge cases…"></textarea>
            <div class="mi-savebar"><span class="mi-dot" id="mi-dot"></span><span id="mi-savetxt">autosaving to disk</span></div>
          </div>
          <div class="mi-railpanel mi-notes" data-rail="improve" hidden>
            <div class="mi-improve-hint">Notes to improve <b>this interview</b> next time — prompt wording,
              difficulty, missing test cases, UI. Saved to <code>iteration_notes.md</code> and read when you
              re-run the skill to iterate on this interview. (Not part of your interview answer.)</div>
            <textarea id="mi-improve" placeholder="e.g. 'prompt should state whether duplicates are allowed'; 'add a no-solution test case'; 'timebox felt tight'…"></textarea>
            <div class="mi-savebar"><span class="mi-dot" id="mi-dot2"></span><span>autosaves</span></div>
          </div>
          <button class="mi-railexpand" id="mi-railexpand" title="Expand panel" aria-label="Expand panel">‹ Panel</button>
        </aside>
      </div>`;

    document.getElementById("mi-timerbtn").onclick = toggleTimer;
    document.getElementById("mi-done").onclick = endInterview;
    document.getElementById("mi-help-btn").onclick = openHelp;
    if (window.MITheme) window.MITheme.update();   // theme button handled by theme.js delegation

    const soundBtn = document.getElementById("mi-sound");
    soundOn = localStorage.getItem("mi:sound") !== "off";
    const paintSound = () => {
      soundBtn.textContent = soundOn ? "🔔" : "🔕";
      const l = soundOn ? "Mute timer sounds" : "Unmute timer sounds";
      soundBtn.setAttribute("aria-label", l); soundBtn.title = l;
    };
    paintSound();
    soundBtn.onclick = () => { soundOn = !soundOn; localStorage.setItem("mi:sound", soundOn ? "on" : "off"); if (soundOn) initAudio(); paintSound(); };

    // tab bar and the (narrow-mode) dropdown both drive selectRail, kept in sync
    const selectRail = name => {
      document.querySelectorAll(".mi-railtab").forEach(x => {
        const on = x.dataset.rail === name;
        x.classList.toggle("active", on);
        if (on) x.classList.remove("mi-railtab-flag");
      });
      document.querySelectorAll(".mi-railpanel").forEach(p => p.hidden = p.dataset.rail !== name);
      const sel = document.getElementById("mi-railselect"); if (sel) sel.value = name;
    };
    document.querySelectorAll(".mi-railtab").forEach(b => b.onclick = () => selectRail(b.dataset.rail));
    document.getElementById("mi-railselect").onchange = e => selectRail(e.target.value);
    const side = document.getElementById("mi-side");
    document.getElementById("mi-railwide").onclick = () => { side.classList.remove("collapsed"); side.classList.toggle("wide"); };
    document.getElementById("mi-railcollapse").onclick = () => side.classList.add("collapsed");
    document.getElementById("mi-railexpand").onclick = () => side.classList.remove("collapsed");

    wireAutosave("mi-notes", "artifacts/notes.md", "mi-dot", true);
    wireAutosave("mi-improve", "iteration_notes.md", "mi-dot2", false);
    const txMeta = document.getElementById("mi-tx-meta");
    if (txMeta) txMeta.onchange = e => { txShowMeta = e.target.checked; renderTranscript(); };
    renderPhases();
    renderSplits();
  }

  function wireAutosave(textareaId, relPath, dotId, showStatus) {
    const ta = document.getElementById(textareaId);
    ta.value = localStorage.getItem("mi:" + base + relPath) || "";
    let t;
    ta.addEventListener("input", () => {
      const dot = document.getElementById(dotId); if (dot) dot.className = "mi-dot saving";
      clearTimeout(t);
      t = setTimeout(async () => {
        await save(relPath, ta.value);
        if (dot) dot.className = "mi-dot saved";
        if (showStatus) document.getElementById("mi-savetxt").textContent = serverUp ? "saved to disk" : "saved in browser";
      }, 600);
    });
  }

  function endInterview() {
    if (!confirm("End the interview? The timer stops and your interviewer will write up your feedback.")) return;
    if (!timer.paused) { timer.elapsed += (performance.now() - timer.start) / 1000; timer.paused = true; }
    document.getElementById("mi-timerbtn").textContent = "Resume";
    ended = true;
    setPhase(PHASES[PHASES.length - 1].name);   // persists _session.json with ended:true so the interviewer can detect it
    alert("That's a wrap. Your interviewer will write your feedback now — it'll appear in the Feedback tab. " +
          "(If you're chatting in the terminal, just say you're done — no need to ask for feedback.)");
  }

  function mdLite(s) {
    return esc(s)
      .replace(/^### (.*)$/gm, "<h2>$1</h2>").replace(/^## (.*)$/gm, "<h1>$1</h1>").replace(/^# (.*)$/gm, "<h1>$1</h1>")
      .replace(/```([\s\S]*?)```/g, (m, c) => `<pre>${c.trim()}</pre>`)
      .replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/^- (.*)$/gm, "• $1<br>").replace(/\n\n/g, "<br><br>");
  }
  function esc(s) {
    return (s ?? "").toString().replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---- boot -----------------------------------------------------------------
  async function boot() {
    base = location.pathname.replace(/[^/]*$/, "");
    try {
      cfg = await fetch("interview.json").then(r => { if (!r.ok) throw new Error("interview.json returned HTTP " + r.status); return r.json(); });
    } catch (e) {
      document.getElementById("mi-root").innerHTML =
        `<div style="padding:32px;max-width:640px;margin:0 auto;font-family:system-ui">
          <h2 style="color:var(--danger)">Couldn't load this interview</h2>
          <p><code>interview.json</code> is missing or invalid: ${esc(e.message)}.</p>
          <p>Make sure the local server is running — <code>python3 shell/serve.py</code> from your portfolio
          folder — and that <code>interview.json</code> is valid JSON, then reload.</p></div>`;
      return;
    }
    // phases: a saved per-instance config wins, else interview.json, else the default spine
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem("mi:phases:" + base) || "null"); } catch (e) {}
    PHASES = normalizePhases(stored || cfg.phases);
    activePhase = PHASES[0].name; cfg._phase = activePhase;
    const mins = Number(cfg.timebox_minutes);
    timer.limitSec = Math.min(24 * 60, Math.max(0, Number.isFinite(mins) ? mins : 0)) * 60;

    renderChrome();
    await checkServer();
    setInterval(checkServer, 20000);
    tickTimer();
    pollTranscript(); pollFeedback();
    setInterval(() => { pollTranscript(); pollFeedback(); }, 3000);   // pick up new turns + the Retro when written

    try { document.getElementById("mi-prompt").innerHTML = mdLite(await fetch("prompt.md").then(r => r.text())); }
    catch (e) { document.getElementById("mi-prompt").textContent = cfg.prompt || "(no prompt found)"; }

    // prefill the Improve tab from any existing iteration_notes.md on disk
    try { const t = await fetch("iteration_notes.md"); if (t.ok) { const v = await t.text(); const ta = document.getElementById("mi-improve"); if (v && !ta.value) ta.value = v; } } catch (e) {}

    const mod = (cfg.type || "coding").toLowerCase();
    try {
      const m = await import(`/shell/modules/${mod}.js`);
      m.mount(document.getElementById("mi-work"), { cfg, base, save, run, serverUp: () => serverUp, setPhase });
    } catch (e) {
      document.getElementById("mi-work").innerHTML =
        `<div style="padding:24px">No module for type <code>${esc(mod)}</code> yet. ` +
        `See <code>references/ui-architecture.md</code> to add one.</div>`;
    }

    // first-run tutorial unless dismissed
    try { if (localStorage.getItem("mi:help-dismissed") !== "1") openHelp(); } catch (e) {}
  }

  return { boot, save, run, openHelp };
})();

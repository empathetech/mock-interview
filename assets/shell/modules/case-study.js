/* Case Study module — a take-home prompt + a deliverable workspace + a multi-stakeholder round structure.
 *
 * Lightest UI, heaviest on judgment: the real work is the candidate's thinking and the discussion (which
 * happens in the terminal across the stakeholder rounds). The module gives them the prompt(s), a place to
 * build a deliverable (markdown on the shared editor; a slide-deck link if they present slides), and a clear
 * view of the round structure. Saves artifacts/deliverable.md (+ deliverable_link.txt) so the interviewer
 * evaluates exactly what the candidate prepared.
 *
 * cfg.case_study shape:
 *   { options: [{ id, title, prompt }],        // candidate picks ONE (omit for a single fixed prompt)
 *     selected: null,                          // chosen option id (set once picked)
 *     prep_note: "24 hours to prepare",        // shown as context
 *     rounds: [{ name, minutes, persona }],    // sequential stakeholder rounds (conversational, in terminal)
 *     deliverable_format: "markdown" }         // "markdown" | "slides"
 */
export async function mount(el, ctx) {
  const c = ctx.cfg.case_study || {};
  const key = "mi:" + ctx.base + "artifacts/";
  let selected = c.selected || localStorage.getItem(key + "_case_choice") || null;
  const options = c.options || [];

  // ---- choose a prompt (if multiple and none chosen yet) ----
  if (options.length > 1 && !selected) {
    el.innerHTML = `<div class="cs-choose">
      <h2>Choose your case study</h2>
      ${c.prep_note ? `<p class="cs-note">${esc(c.prep_note)}</p>` : ""}
      <div class="cs-options">${options.map(o => `
        <button class="cs-option" data-id="${esc(o.id)}">
          <span class="cs-option-title">${esc(o.title)}</span>
          <span class="cs-option-prev">${esc((o.prompt || "").slice(0, 220))}…</span>
        </button>`).join("")}</div></div>`;
    injectStyles();
    el.querySelectorAll(".cs-option").forEach(b => b.onclick = () => {
      selected = b.dataset.id; localStorage.setItem(key + "_case_choice", selected);
      ctx.save("artifacts/_case_choice.txt", selected);
      build();
    });
    return;
  }
  build();

  function build() {
    const opt = options.find(o => o.id === selected) || options[0] || null;
    const promptText = opt ? `## ${opt.title}\n\n${opt.prompt}` : (ctx.cfg.prompt || "(see the Prompt tab)");
    const rounds = c.rounds || [];
    el.innerHTML = `
      ${rounds.length ? `<div class="cs-rounds">${rounds.map((r, i) => `
        <div class="cs-round" data-i="${i}"><b>${esc(r.name || "Round " + (i + 1))}</b>
          <span>${r.minutes ? r.minutes + " min" : ""}${r.persona ? " · " + esc(r.persona) : ""}</span></div>`).join("")}
        <span class="cs-rounds-note">Rounds run as conversations with your interviewer in the terminal.</span>
      </div>` : ""}
      <div class="cs-body">
        <section class="cs-prompt" id="cs-prompt">${mdLite(promptText)}</section>
        <section class="cs-deliv">
          <div class="cs-deliv-head">Your deliverable${c.deliverable_format === "slides" ? " (outline here; link your slides below)" : ""}</div>
          <textarea id="cs-deliv" spellcheck="false" placeholder="Draft your write-up / outline here. Structure it the way you'd present it."></textarea>
          ${c.deliverable_format === "slides" ? `<div class="cs-link"><label>Slide deck link <input id="cs-link" type="url" placeholder="https://docs.google.com/presentation/…"></label></div>` : ""}
          <div class="mi-savebar"><span class="mi-dot" id="cs-dot"></span><span>autosaves to deliverable.md</span></div>
        </section>
      </div>`;
    injectStyles();

    // Case-study phases ARE the stakeholder rounds, advanced by the interviewer (not by editing the
    // deliverable, which happens during prep). So editing the deliverable doesn't change the phase.
    const enter = () => {};
    wire("cs-deliv", "artifacts/deliverable.md", "cs-dot", enter);
    const link = document.getElementById("cs-link");
    if (link) { link.value = localStorage.getItem(key + "deliverable_link.txt") || ""; link.addEventListener("input", () => ctx.save("deliverable_link.txt", link.value) /* instance-root link */); }
  }

  async function wire(id, rel, dotId, onEdit) {
    const ta = document.getElementById(id);
    ta.value = localStorage.getItem(key + rel.replace("artifacts/", "artifacts/")) || localStorage.getItem("mi:" + ctx.base + rel) || "";
    // load shared editor (markdown) for a consistent writing surface
    let makeEditor = null;
    try { ({ makeEditor } = await import("/shell/lib/editor.js")); } catch (e) {}
    const cm = makeEditor ? await makeEditor(ta, { mode: "markdown", lineWrapping: true, autofocus: true, onChange: v => { ctx.save(rel, v); flag(dotId); onEdit(); } }) : null;
    if (!cm) { let t; ta.addEventListener("input", () => { onEdit(); flag(dotId); clearTimeout(t); t = setTimeout(() => ctx.save(rel, ta.value), 500); }); }
  }
  function flag(dotId) { const d = document.getElementById(dotId); if (d) { d.className = "mi-dot saved"; } }
}

function mdLite(s) {
  return esc(s).replace(/^### (.*)$/gm, "<h2>$1</h2>").replace(/^## (.*)$/gm, "<h1>$1</h1>").replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n\n/g, "<br><br>");
}
function esc(s) { return (s ?? "").toString().replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }

function injectStyles() {
  if (document.getElementById("cs-styles")) return;
  const s = document.createElement("style"); s.id = "cs-styles";
  s.textContent = `
    .mi-work { background: var(--bg); }
    .cs-choose { padding: 28px 32px; max-width: 760px; overflow:auto; }
    .cs-choose h2 { margin:0 0 6px; font-size:20px; } .cs-note { color:var(--muted); margin:0 0 16px; }
    .cs-options { display:flex; flex-direction:column; gap:10px; }
    .cs-option { text-align:left; padding:14px 16px; border:1px solid var(--line); border-radius:var(--radius-lg);
      background:var(--panel); cursor:pointer; display:flex; flex-direction:column; gap:6px; }
    .cs-option:hover { border-color:var(--accent); background:var(--accent-soft); }
    .cs-option-title { font-weight:600; font-size:15px; } .cs-option-prev { color:var(--muted); font-size:12.5px; line-height:1.45; }
    .cs-rounds { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:8px 14px; background:var(--panel); border-bottom:1px solid var(--line); }
    .cs-round { font-size:12px; padding:5px 10px; border:1px solid var(--line); border-radius:var(--radius-pill); }
    .cs-round b { color:var(--accent); } .cs-round span { color:var(--muted); margin-left:6px; }
    .cs-rounds-note { font-size:11.5px; color:var(--muted); }
    .cs-body { flex:1; min-height:0; display:flex; }
    .cs-prompt { flex:0 0 42%; overflow:auto; padding:18px 20px; font-size:14px; line-height:1.6; border-right:1px solid var(--line); }
    .cs-prompt h1 { font-size:17px; } .cs-prompt code { font-family:var(--mono); background:var(--panel-2); padding:1px 4px; border-radius:4px; }
    .cs-deliv { flex:1; min-width:0; display:flex; flex-direction:column; }
    .cs-deliv-head { padding:8px 14px; font-size:12px; color:var(--muted); border-bottom:1px solid var(--line); background:var(--panel); }
    #cs-deliv { flex:1; border:0; outline:none; resize:none; padding:14px 16px; font:14px/1.6 var(--mono); background:var(--editor-bg); color:var(--editor-ink); }
    .cs-deliv .CodeMirror { flex:1; }
    .cs-link { padding:8px 14px; border-top:1px solid var(--line); font-size:12px; }
    .cs-link input { width:100%; margin-top:4px; font:inherit; font-size:13px; padding:5px 8px; border:1px solid var(--line); border-radius:6px; background:var(--panel); color:var(--ink); }`;
  document.head.appendChild(s);
}

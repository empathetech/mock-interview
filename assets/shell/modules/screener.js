/* Screener module — a timed, multi-problem screen with two sections (e.g. SQL + executable code), the kind
 * of big-tech data/SWE screener where you pick a section, must clear a minimum before you can switch, and
 * need a threshold of total problems to pass.
 *
 * It does NOT reimplement the pads — it ORCHESTRATES them. Each problem is rendered by the existing coding or
 * data-sql module, mounted into a per-problem container with a namespaced artifact dir (artifacts/<problem-id>/)
 * so every problem's work is saved separately. The shell's single timer covers the whole screen. Progress is
 * tracked in artifacts/_screener.json so the interviewer can see completion per section and judge against the
 * pass threshold.
 *
 * cfg.screener shape:
 *   { sections: [{ key:"sql", name:"SQL", type:"data-sql" }, { key:"py", name:"Python", type:"coding" }],
 *     rules: { min_before_switch: 3, pass_threshold: 6 },
 *     problems: [
 *       { id:"sql1", section:"sql", title:"…", prompt:"…", data_sql:{…} },
 *       { id:"py1",  section:"py",  title:"…", prompt:"…", coding:{…}, test_runner:"tests/py1/run_tests.py" },
 *       … ] }
 */
export async function mount(el, ctx) {
  const s = ctx.cfg.screener || {};
  const sections = s.sections || [];
  const problems = s.problems || [];
  const rules = s.rules || { min_before_switch: 3, pass_threshold: 6 };
  const key = "mi:" + ctx.base + "artifacts/_screener.json";

  let state = { completed: [] };
  try { state = { ...state, ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch (e) {}
  const completedSet = new Set(state.completed);
  const mounted = {};   // problem id -> { container }
  const sqlShared = {};   // holds ONE DuckDB promise shared by all SQL problems (each isolated by schema)
  let current = null;

  el.innerHTML = `
    <div class="scr-wrap">
      <aside class="scr-nav">
        <div class="scr-progress" id="scr-progress"></div>
        <div id="scr-list"></div>
      </aside>
      <div class="scr-pads" id="scr-pads"><div class="scr-hint">Pick any problem on the left — in a mock you can
        attempt them in any order. A problem is marked solved when your check/tests pass. (On interview day
        you'd need ≥${rules.min_before_switch} in a section before switching and ≥${rules.pass_threshold}
        total to pass — shown here for realism, not enforced.)</div></div>
    </div>`;
  injectStyles();

  const completedIn = sec => problems.filter(p => p.section === sec && completedSet.has(p.id)).length;

  function persist() {
    state.completed = [...completedSet];
    const blob = JSON.stringify({ ...state, updated: new Date().toISOString() }, null, 2);
    localStorage.setItem(key, blob);
    ctx.save("artifacts/_screener.json", blob);
  }

  function renderNav() {
    document.getElementById("scr-progress").innerHTML =
      `<b>${completedSet.size} / ${rules.pass_threshold}</b> solved` +
      (completedSet.size >= rules.pass_threshold ? ` <span class="scr-pass">✓ at the passing bar</span>` : ``) +
      sections.map(sec => `<div class="scr-secprog">${esc(sec.name)}: ${completedIn(sec.key)} solved</div>`).join("") +
      `<div class="scr-rulenote">Real format: ≥${rules.min_before_switch} in a section before switching, ≥${rules.pass_threshold} total to pass — not enforced in this mock.</div>`;
    document.getElementById("scr-list").innerHTML = sections.map(sec => `
      <div class="scr-sec"><h4>${esc(sec.name)}</h4>${problems.filter(p => p.section === sec.key).map(p => {
        const done = completedSet.has(p.id), cur = current === p.id;
        return `<button class="scr-prob ${cur ? "cur" : ""} ${done ? "done" : ""}" data-id="${esc(p.id)}">
          <span class="scr-check">${done ? "✓" : "○"}</span> ${esc(p.title || p.id)}</button>`;
      }).join("")}</div>`).join("");
    document.querySelectorAll(".scr-prob").forEach(b => b.onclick = () => open(b.dataset.id));
  }

  async function open(id) {
    const p = problems.find(x => x.id === id); if (!p) return;   // no gatekeeping — any problem, any order
    current = id;
    // Keep only the CURRENT pad in the DOM. Two pads at once would share element IDs (sql-area, sql-db-status,
    // cm-area…) and collide — that's what left switched-to SQL problems stuck on "loading". Detached pads keep
    // their JS/editor/DuckDB state in their closures and re-attach cleanly.
    const host = document.getElementById("scr-pads");
    Object.values(mounted).forEach(m => { if (m.container.parentNode) m.container.remove(); });
    document.querySelector(".scr-hint")?.remove();
    if (!mounted[id]) {
      const container = document.createElement("div"); container.className = "scr-pad";
      mounted[id] = { container };
      host.appendChild(container);   // attach before mounting so the pad sizes correctly and no sibling IDs exist
      const type = (sections.find(sec => sec.key === p.section) || {}).type || "coding";
      const padCtx = {
        cfg: { ...ctx.cfg, prompt: p.prompt,
          coding: p.coding ? { ...p.coding, artifact_dir: `artifacts/${id}`, test_runner: p.test_runner } : undefined,
          data_sql: p.data_sql ? { ...p.data_sql, artifact_dir: `artifacts/${id}` } : undefined },
        base: ctx.base, save: ctx.save, run: ctx.run, serverUp: ctx.serverUp,
        setPhase: () => {},
        duckdb: sqlShared, sqlSchema: id,   // SQL pads share one DuckDB, isolated by this problem's schema
        // objective completion: the pad calls this when its check/tests pass — no self-attested checkbox
        onComplete: () => {
          completedSet.add(id); persist(); renderNav();
          const b = document.getElementById(`scr-badge-${id}`); if (b) { b.textContent = "✓ solved"; b.className = "scr-done-badge done"; }
        },
      };
      const head = document.createElement("div"); head.className = "scr-pad-head";
      head.innerHTML = `<div class="scr-pad-prompt">${mdLite(`## ${p.title || id}\n\n${p.prompt || ""}`)}</div>
        <span class="scr-done-badge ${completedSet.has(id) ? "done" : ""}" id="scr-badge-${esc(id)}">${completedSet.has(id) ? "✓ solved" : "run the check / tests to solve it"}</span>`;
      container.appendChild(head);
      const padEl = document.createElement("div"); padEl.className = "scr-pad-body"; container.appendChild(padEl);
      try { const mod = await import(`/shell/modules/${type}.js`); await mod.mount(padEl, padCtx); }
      catch (e) { padEl.innerHTML = `<div class="scr-hint">Couldn't load the ${esc(type)} pad.</div>`; }
    } else {
      host.appendChild(mounted[id].container);   // reattach the cached pad (state preserved in its closure)
    }
    renderNav();
  }

  renderNav(); persist();
}

function mdLite(s) {
  return esc(s).replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n\n/g, "<br><br>");
}
function esc(s) { return (s ?? "").toString().replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }

function injectStyles() {
  if (document.getElementById("scr-styles")) return;
  const st = document.createElement("style"); st.id = "scr-styles";
  st.textContent = `
    .mi-work { background: var(--bg); }
    .scr-wrap { flex:1; min-height:0; display:flex; }
    .scr-nav { flex:0 0 230px; border-right:1px solid var(--line); background:var(--panel); overflow:auto; }
    .scr-progress { padding:12px 14px; border-bottom:1px solid var(--line); font-size:13px; }
    .scr-progress b { font-size:15px; } .scr-pass { color:var(--success); font-weight:600; }
    .scr-secprog { font-size:12px; color:var(--muted); margin-top:4px; } .scr-muted { color:var(--warn); }
    .scr-sec { padding:8px 10px; } .scr-sec h4 { margin:6px 4px; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
    .scr-prob { display:flex; align-items:center; gap:8px; width:100%; text-align:left; padding:7px 10px; margin-bottom:3px;
      border:1px solid transparent; border-radius:var(--radius); background:transparent; color:var(--ink); cursor:pointer; font:inherit; font-size:13px; }
    .scr-prob:hover:not([disabled]) { background:var(--bg); } .scr-prob.cur { background:var(--accent-soft); border-color:var(--accent); color:var(--accent); }
    .scr-prob.done .scr-check { color:var(--success); } .scr-prob[disabled] { opacity:.55; cursor:not-allowed; }
    .scr-check { width:16px; text-align:center; }
    .scr-pads { flex:1; min-width:0; display:flex; flex-direction:column; }
    .scr-pad { flex:1; min-height:0; display:flex; flex-direction:column; }
    .scr-pad[hidden] { display:none; }
    .scr-pad-head { padding:10px 14px; border-bottom:1px solid var(--line); background:var(--panel); display:flex; align-items:flex-start; gap:14px; }
    .scr-pad-prompt { flex:1; font-size:13.5px; line-height:1.55; } .scr-pad-prompt h2 { font-size:15px; margin:0 0 4px; }
    .scr-pad-prompt code { font-family:var(--mono); background:var(--panel-2); padding:1px 4px; border-radius:4px; }
    .scr-done-badge { flex:0 0 auto; font-size:12px; color:var(--muted); white-space:nowrap; padding:3px 9px; border:1px solid var(--line); border-radius:var(--radius-pill); }
    .scr-done-badge.done { color:var(--success); border-color:var(--success); }
    .scr-rulenote { margin-top:8px; font-size:11px; color:var(--muted); line-height:1.4; }
    .scr-pad-body { flex:1; min-height:0; display:flex; flex-direction:column; }
    .scr-hint { padding:24px; color:var(--muted); font-size:13.5px; line-height:1.55; max-width:520px; }`;
  document.head.appendChild(st);
}

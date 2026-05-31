/* Product / System Design module — phase 3 is "Design", not "Code".
 *
 * Two tabs, both blank canvases (a real interviewer hands you space, not a fill-in-the-blanks form):
 *   • Spec    — a freeform editor on the SHARED editor component (lib/editor.js), same as the coding pad.
 *               Saved to artifacts/design.md.
 *   • Diagram — three modes:
 *       - Mermaid : source editor (same shared editor) with LIVE render, saved to artifacts/diagram.mmd
 *       - Draw    : Excalidraw, loaded from the Excalidraw CDN (NOT a local instance — needs internet),
 *                   saved as JSON to artifacts/diagram.excalidraw
 *       - Cheatsheet : quick Mermaid syntax reference + a link to the full docs
 *
 * Scaling expectations live in the interview prompt (narrative), not as on-screen boxes. Everything is
 * mirrored to disk so the interviewer reads the candidate's thinking and diagram in flight. */
const MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
const EXCALIDRAW_VER = "0.17.6";
const REACT_CDN = "https://unpkg.com/react@18/umd/react.production.min.js";
const REACTDOM_CDN = "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js";
const EXCALIDRAW_CDN = `https://unpkg.com/@excalidraw/excalidraw@${EXCALIDRAW_VER}/dist/excalidraw.production.min.js`;

const STARTER_DIAGRAM = `graph TD
  Client --> LB[Load Balancer]
  LB --> API[API Server]
  API --> DB[(Database)]`;

const CHEATSHEET = `
<h3>Mermaid quick reference</h3>
<pre>graph TD            %% top-down (LR = left-right)
  A[Box] --> B[Box]            %% arrow
  A --&gt;|label| C              %% labelled arrow
  D[(Database)]               %% cylinder
  E((Cache))                  %% circle
  F{Decision}                 %% diamond
  subgraph Region
    G --> H
  end</pre>
<p>Sequence diagram:</p>
<pre>sequenceDiagram
  Client-&gt;&gt;API: POST /links
  API-&gt;&gt;DB: insert
  DB--&gt;&gt;API: id
  API--&gt;&gt;Client: short url</pre>
<p>It renders live as you type on the <b>Mermaid</b> tab. Full syntax reference:
  <a href="https://mermaid.js.org/intro/syntax-reference.html" target="_blank" rel="noopener noreferrer">mermaid.js.org</a>.</p>`;

export async function mount(el, ctx) {
  const c = ctx.cfg.design || {};
  el.innerHTML = `
    <div class="sd-tabs">
      <button class="sd-tab active" data-tab="spec">Spec</button>
      <button class="sd-tab" data-tab="diagram">Diagram</button>
    </div>
    <div class="sd-body">
      <section class="sd-panel" data-panel="spec"><textarea id="sd-spec" spellcheck="false"></textarea></section>
      <section class="sd-panel" data-panel="diagram" hidden>
        <div class="sd-dmodes">
          <button class="sd-dmode active" data-mode="mermaid">Mermaid</button>
          <button class="sd-dmode" data-mode="draw">Draw (Excalidraw)</button>
          <button class="sd-dmode" data-mode="cheat">Cheatsheet</button>
          <span class="sd-dstatus" id="sd-dstatus"></span>
        </div>
        <div class="sd-dpanel sd-mmd" data-mode="mermaid">
          <textarea id="sd-mmd" spellcheck="false"></textarea>
          <div class="sd-mmd-prev"><div id="sd-mmd-out">type to render…</div></div>
        </div>
        <div class="sd-dpanel" data-mode="draw" hidden>
          <div id="sd-draw"><div class="sd-draw-intro">Opening <b>Excalidraw</b> — a freehand drawing canvas,
            loaded from the Excalidraw CDN (this is not a local copy; it needs internet). Your drawing autosaves
            to <code>diagram.excalidraw</code> for your interviewer.</div></div>
        </div>
        <div class="sd-dpanel sd-cheat" data-mode="cheat" hidden>${CHEATSHEET}</div>
      </section>
    </div>`;
  injectStyles();

  const $ = id => document.getElementById(id);
  const cached = k => localStorage.getItem("mi:" + ctx.base + "artifacts/" + k);
  const enterDesign = () => { if (ctx.cfg._phase === ctx.cfg.phases?.[0]) ctx.setPhase("Design"); };

  // the one shared editor every pad uses; dynamic import so a load failure degrades to a plain textarea
  let makeEditor = null;
  try { ({ makeEditor } = await import("/shell/lib/editor.js")); } catch (e) {}

  // ---- Spec: shared editor (markdown) ----
  const specArea = $("sd-spec");
  specArea.value = cached("design.md") ?? "";
  const specCm = makeEditor ? await makeEditor(specArea, {
    mode: "markdown", lineWrapping: true, autofocus: true,
    onChange: v => { ctx.save("artifacts/design.md", v); enterDesign(); },
  }) : null;
  if (!specCm) {
    let st; specArea.addEventListener("input", () => { enterDesign(); clearTimeout(st); st = setTimeout(() => ctx.save("artifacts/design.md", specArea.value), 500); });
  }

  // ---- Mermaid: shared editor + live render ----
  const mmdArea = $("sd-mmd");
  mmdArea.value = cached("diagram.mmd") ?? c.starter_diagram ?? STARTER_DIAGRAM;
  let mermaid = null, lastGoodEmpty = true;
  const getMmd = () => mmdCm ? mmdCm.getValue() : mmdArea.value;
  async function render(src) {
    src = src ?? getMmd();
    const out = $("sd-mmd-out"), status = $("sd-dstatus");
    if (!mermaid) { out.textContent = "(Mermaid offline — your source is still saved for the interviewer.)"; return; }
    if (!src.trim()) { out.textContent = "type to render…"; return; }
    try { const { svg } = await mermaid.render("sd-graph", src); out.innerHTML = svg; status.textContent = ""; lastGoodEmpty = false; }
    catch (e) { status.textContent = "diagram syntax error"; if (lastGoodEmpty) out.textContent = "(fix the syntax to preview — source is saved either way.)"; }
  }
  const mmdCm = makeEditor ? await makeEditor(mmdArea, {
    mode: null, debounce: 350,
    onChange: v => { ctx.save("artifacts/diagram.mmd", v); render(v); enterDesign(); },
  }) : null;
  if (!mmdCm) mmdArea.addEventListener("input", () => { ctx.save("artifacts/diagram.mmd", mmdArea.value); render(mmdArea.value); enterDesign(); });

  // ---- tabs ----
  el.querySelectorAll(".sd-tab").forEach(btn => btn.onclick = () => {
    el.querySelectorAll(".sd-tab").forEach(b => b.classList.toggle("active", b === btn));
    el.querySelectorAll(".sd-panel").forEach(p => p.hidden = p.dataset.panel !== btn.dataset.tab);
    if (btn.dataset.tab === "spec" && specCm) setTimeout(() => specCm.refresh(), 0);
    if (btn.dataset.tab === "diagram" && mmdCm) setTimeout(() => mmdCm.refresh(), 0);
  });

  // ---- diagram modes ----
  let drawStarted = false;
  el.querySelectorAll(".sd-dmode").forEach(btn => btn.onclick = () => {
    el.querySelectorAll(".sd-dmode").forEach(b => b.classList.toggle("active", b === btn));
    el.querySelectorAll(".sd-dpanel").forEach(p => p.hidden = p.dataset.mode !== btn.dataset.mode);
    if (btn.dataset.mode === "draw" && !drawStarted) { drawStarted = true; startExcalidraw(ctx, $, cached); }
    if (btn.dataset.mode === "mermaid") { if (mmdCm) setTimeout(() => mmdCm.refresh(), 0); render(); }
  });

  try { await loadScript(MERMAID_CDN); mermaid = window.mermaid; mermaid.initialize({ startOnLoad: false, theme: "neutral" }); }
  catch (e) { /* offline: source still saved */ }
  ctx.save("artifacts/diagram.mmd", getMmd());
  if (mermaid) render();
}

// ---- Excalidraw (lazy: only loads React + the lib if the candidate opens the Draw tab) ----
async function startExcalidraw(ctx, $, cached) {
  const mountEl = $("sd-draw");
  try {
    window.process = window.process || { env: { NODE_ENV: "production" } };
    window.EXCALIDRAW_ASSET_PATH = `https://unpkg.com/@excalidraw/excalidraw@${EXCALIDRAW_VER}/dist/`;
    await loadScript(REACT_CDN); await loadScript(REACTDOM_CDN); await loadScript(EXCALIDRAW_CDN);
    const React = window.React, ReactDOM = window.ReactDOM, Lib = window.ExcalidrawLib;
    if (!React || !ReactDOM || !Lib) throw new Error("library globals missing");

    let initialData;
    const saved = cached("diagram.excalidraw");
    if (saved) { try { const s = JSON.parse(saved); initialData = { elements: s.elements || [], appState: { ...(s.appState || {}), collaborators: undefined } }; } catch (e) {} }

    mountEl.textContent = "";
    let dt;
    const onChange = (elements, appState, files) => {
      if (ctx.cfg._phase === ctx.cfg.phases?.[0]) ctx.setPhase("Design");
      clearTimeout(dt);
      dt = setTimeout(() => {
        try { ctx.save("artifacts/diagram.excalidraw", Lib.serializeAsJSON(elements, appState, files || {}, "local")); } catch (e) {}
      }, 600);
    };
    ReactDOM.createRoot(mountEl).render(
      React.createElement(Lib.Excalidraw, { onChange, initialData, UIOptions: { canvasActions: { loadScene: false } } })
    );
  } catch (e) {
    mountEl.innerHTML = `<div class="sd-draw-fail"><b>Excalidraw</b> couldn't load — it's served from the
      Excalidraw CDN and needs internet access. Use the <b>Mermaid</b> tab instead; it works offline and the
      interviewer reads it just as well.</div>`;
  }
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if ([...document.scripts].some(s => s.src === src)) return res();
    const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function injectStyles() {
  if (document.getElementById("sd-styles")) return;
  const s = document.createElement("style"); s.id = "sd-styles";
  s.textContent = `
    .mi-work { background: var(--bg); }
    .sd-tabs { display:flex; gap:4px; padding:8px 12px; background:var(--panel); border-bottom:1px solid var(--line); }
    .sd-tab { font:inherit; font-size:13px; padding:6px 14px; border:1px solid var(--line); border-radius:6px;
      background:var(--bg); color:var(--muted); cursor:pointer; }
    .sd-tab.active { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
    .sd-body { flex:1; min-height:0; display:flex; }
    .sd-panel { flex:1; min-height:0; display:flex; flex-direction:column; }
    .sd-panel[hidden] { display:none; }
    #sd-spec { flex:1; border:0; outline:none; resize:none; padding:14px 16px; font:14px/1.6 var(--mono);
      background:var(--editor-bg); color:var(--editor-ink); }
    [data-panel="spec"] .CodeMirror { flex:1; }
    .sd-dmodes { display:flex; align-items:center; gap:6px; padding:6px 12px; background:var(--panel);
      border-bottom:1px solid var(--line); }
    .sd-dmode { font:inherit; font-size:12.5px; padding:5px 12px; border:1px solid var(--line); border-radius:6px;
      background:var(--bg); color:var(--muted); cursor:pointer; }
    .sd-dmode.active { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
    .sd-dstatus { font-size:12px; color:var(--warn); margin-left:8px; }
    .sd-dpanel { flex:1; min-height:0; }
    .sd-dpanel[hidden] { display:none; }
    .sd-mmd { display:flex; }
    #sd-mmd { flex:0 0 42%; border:0; outline:none; resize:none; padding:12px 14px; font:13px/1.5 var(--mono);
      background:var(--editor-bg); color:var(--editor-ink); }
    .sd-mmd .CodeMirror { flex:0 0 42%; }
    .sd-mmd-prev { flex:1; overflow:auto; background:var(--panel); padding:14px; border-left:1px solid var(--line); }
    #sd-mmd-out { color:var(--muted); font-size:13px; } #sd-mmd-out svg { max-width:100%; height:auto; }
    #sd-draw { height:100%; min-height:420px; } #sd-draw .excalidraw { height:100%; }
    .sd-draw-intro, .sd-draw-fail { padding:24px; max-width:560px; color:var(--muted); font-size:13.5px; line-height:1.55; }
    .sd-draw-intro code, .sd-draw-fail code { font-family:var(--mono); font-size:12px; background:var(--panel-2); padding:1px 4px; border-radius:4px; }
    .sd-cheat { padding:16px 20px; overflow:auto; }
    .sd-cheat h3 { margin:0 0 10px; font-size:15px; }
    .sd-cheat pre { background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:10px;
      font:12.5px/1.5 var(--mono); overflow:auto; }
    .sd-cheat p { font-size:13px; color:var(--muted); } .sd-cheat a { color:var(--link); }`;
  document.head.appendChild(s);
}

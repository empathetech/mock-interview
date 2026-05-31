/* Coding / DSA module — the CoderPad-style experience.
 *
 * Renders a code editor (CodeMirror if reachable, styled textarea otherwise), a language
 * selector, Run and Run Tests buttons, and a results console. The candidate's code is
 * autosaved to artifacts/<solution_filename> so the interviewer reads exactly what's on
 * screen. Tests execute in the real toolchain via the server and write results to
 * artifacts/test_results.json so the interviewer can read pass/fail without the UI relaying it.
 *
 * Expected cfg.coding shape (all optional except language):
 *   { language: "python"|"javascript",
 *     starter_code: "def two_sum(nums, target):\n    pass\n",
 *     solution_filename: "solution.py",        // default by language
 *     test_runner: "tests/run_tests.py",       // path under the instance; if present, Run Tests is enabled
 *     allow_language_switch: false }
 *
 * The test runner is a normal script the skill generates per problem. Convention: it adds the
 * sibling artifacts/ dir to the import path, imports the candidate's solution, runs cases, prints
 * a human-readable summary, and exits non-zero if anything fails. See references/interview-types.md.
 */
const DEFAULT_FILENAME = { python: "solution.py", javascript: "solution.js" };

export async function mount(el, ctx) {
  // the one shared editor every pad uses; dynamic import so a load failure degrades to a plain textarea
  let makeEditor = null;
  try { ({ makeEditor } = await import("/shell/lib/editor.js")); } catch (e) {}
  const c = ctx.cfg.coding || {};
  let lang = (c.language || "python").toLowerCase();
  const filename = c.solution_filename || DEFAULT_FILENAME[lang] || "solution.txt";
  const adir = c.artifact_dir || "artifacts";   // screener namespaces this per problem, e.g. "artifacts/py1"

  el.innerHTML = `
    <div class="cm-toolbar">
      <label>Language
        <select id="cm-lang" ${c.allow_language_switch ? "" : "disabled"}>
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
        </select>
      </label>
      <span class="cm-spacer"></span>
      <button class="mi-btn" id="cm-run">▶ Run</button>
      <button class="mi-btn primary" id="cm-test" ${c.test_runner ? "" : "disabled title='No tests for this problem'"}>✓ Run Tests</button>
    </div>
    <div class="cm-editor-wrap"><textarea id="cm-area"></textarea></div>
    <div class="cm-console">
      <div class="cm-console-head">
        <span id="cm-status">ready</span><span class="cm-spacer"></span>
        <button class="mi-btn ghost" id="cm-grow" title="Expand / shrink the console" aria-label="Expand or shrink console">↕</button>
        <button class="mi-btn ghost" id="cm-fold" title="Hide / show output" aria-label="Hide or show output">▾</button>
        <button class="mi-btn ghost" id="cm-clear">clear</button>
      </div>
      <pre id="cm-out" class="cm-out"></pre>
    </div>`;
  injectStyles();
  el.querySelector("#cm-lang").value = lang;

  const area = el.querySelector("#cm-area");
  area.value = localStorage.getItem("mi:" + ctx.base + adir + "/" + filename) ?? c.starter_code ?? "";

  // Shared editor (CodeMirror with line numbers, soft tabs, theme-aware styling); autosaves on change.
  const cm = makeEditor ? await makeEditor(area, { mode: lang, autofocus: true, onChange: code => ctx.save(`${adir}/${filename}`, code) }) : null;
  const getCode = () => cm ? cm.getValue() : area.value;
  if (!cm) {   // textarea fallback still autosaves
    let t;
    area.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => ctx.save(`${adir}/${filename}`, area.value), 600); });
  }
  const setStatus = (t, cls = "") => { const s = el.querySelector("#cm-status"); s.textContent = t; s.className = cls; };
  const out = el.querySelector("#cm-out");
  const print = (t, cls = "") => { out.innerHTML += `<span class="${cls}">${esc(t)}</span>`; out.scrollTop = out.scrollHeight; };
  ctx.save(`${adir}/${filename}`, getCode()); // initial mirror

  el.querySelector("#cm-clear").onclick = () => { out.innerHTML = ""; };
  const consoleEl = el.querySelector(".cm-console");
  el.querySelector("#cm-grow").onclick = () => { consoleEl.classList.remove("folded"); consoleEl.classList.toggle("tall"); };
  el.querySelector("#cm-fold").onclick = () => {
    consoleEl.classList.remove("tall");
    el.querySelector("#cm-fold").textContent = consoleEl.classList.toggle("folded") ? "▴" : "▾";
  };

  el.querySelector("#cm-run").onclick = async () => {
    if (ctx.cfg._phase === "Scope") ctx.setPhase("Code");
    await ctx.save(`${adir}/${filename}`, getCode());
    setStatus("running…");
    try {
      const r = await ctx.run({ language: lang, file: `${ctx.base}${adir}/${filename}` });
      out.innerHTML = "";
      if (r.stdout) print(r.stdout);
      if (r.stderr) print(r.stderr, "cm-err");
      if (!r.stdout && !r.stderr && r.exit_code === 0) {
        print("Ran successfully (exit 0) — but no output. Run executes the file top-to-bottom, and a " +
              "print() inside a function won't fire unless you call it. Add a top-level call, e.g.\n" +
              `    print(${/javascript/.test(lang) ? "twoSum([2,7,11,15], 9)" : "two_sum([2,7,11,15], 9)"})\n` +
              "…or hit Run Tests to check it against the cases.", "cm-muted");
      }
      setStatus(r.exit_code === 0 ? "ran · exit 0" : `exit ${r.exit_code}`, r.exit_code === 0 ? "cm-ok" : "cm-err");
    } catch (e) { offlineNote(setStatus, print); }
  };

  el.querySelector("#cm-test").onclick = async () => {
    if (ctx.cfg._phase !== "Retro") ctx.setPhase("Code");
    await ctx.save(`${adir}/${filename}`, getCode());
    setStatus("running tests…");
    try {
      const r = await ctx.run({
        language: lang, file: `${ctx.base}${c.test_runner}`,
        results_path: `${ctx.base}${adir}/test_results.json`,
      });
      out.innerHTML = "";
      if (r.stdout) print(r.stdout);
      if (r.stderr) print(r.stderr, "cm-err");
      const passed = r.exit_code === 0;
      setStatus(passed ? "✓ all tests passed" : "✗ tests failing", passed ? "cm-ok" : "cm-err");
      if (passed) ctx.onComplete?.();   // lets a screener mark this problem objectively complete
    } catch (e) { offlineNote(setStatus, print); }
  };
}

function offlineNote(setStatus, print) {
  setStatus("server offline", "cm-err");
  print("\nThe local server isn't running, so code can't execute. Start it with:\n" +
        "    python3 shell/serve.py\nfrom your portfolio folder, then reload.\n", "cm-err");
}
function esc(s) { return (s ?? "").toString().replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }

function injectStyles() {
  if (document.getElementById("cm-styles")) return;
  const s = document.createElement("style"); s.id = "cm-styles";
  s.textContent = `
    .mi-work { background: var(--editor-bg); }
    .cm-toolbar { display:flex; align-items:center; gap:12px; padding:8px 12px;
      background:var(--toolbar-bg); color:var(--toolbar-ink); border-bottom:1px solid var(--line); font-size:13px; }
    .cm-toolbar label { display:flex; align-items:center; gap:6px; }
    .cm-toolbar select { font:inherit; background:var(--editor-bg); color:var(--editor-ink); border:1px solid var(--line); border-radius:6px; padding:3px 6px; }
    .cm-toolbar option { background:var(--editor-bg); color:var(--editor-ink); }
    .cm-spacer { flex:1; }
    .cm-editor-wrap { flex:1; min-height:0; position:relative; }
    #cm-area { width:100%; height:100%; border:0; resize:none; outline:none; padding:12px;
      font:14px/1.5 var(--mono); background:var(--editor-bg); color:var(--editor-ink); }
    /* .CodeMirror.cm-dark is styled centrally in shell.css so every pad matches */
    /* Console is compact by default (header + a short output strip) and grows with output, so the editor
       takes the rest of the height instead of leaving an empty third at the bottom. */
    .cm-console { flex:0 0 auto; display:flex; flex-direction:column; border-top:1px solid var(--line); }
    .cm-console-head { display:flex; align-items:center; justify-content:space-between; padding:4px 12px;
      background:var(--toolbar-bg); color:var(--toolbar-ink); font:12px var(--mono); }
    .cm-console-head .mi-btn { color:var(--toolbar-ink); background:color-mix(in srgb, var(--toolbar-ink) 12%, transparent); border:1px solid var(--line); font-size:14px; line-height:1; padding:3px 9px; }
    .cm-console-head .mi-btn:hover { background:color-mix(in srgb, var(--toolbar-ink) 24%, transparent); }
    #cm-status.cm-ok { color:var(--success); } #cm-status.cm-err { color:var(--danger); }
    .cm-out { margin:0; min-height:60px; max-height:38vh; overflow:auto; padding:10px 12px; background:var(--console-bg); color:var(--console-ink);
      font:13px/1.45 var(--mono); white-space:pre-wrap; }
    .cm-console.tall .cm-out { min-height:42vh; max-height:65vh; }   /* expand */
    .cm-console.folded .cm-out { display:none; }                    /* collapse to just the header */
    .cm-out .cm-err { color:var(--danger); } .cm-out .cm-ok { color:var(--success); } .cm-out .cm-muted { color:var(--muted); font-style:italic; }`;
  document.head.appendChild(s);
}

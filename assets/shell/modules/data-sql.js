/* Data / SQL module — a SQL console over a seeded toy database, in the browser via DuckDB-WASM.
 *
 * Reuses the shared editor (lib/editor.js, sql mode) and the console pattern. The interview seeds a small
 * realistic database from interview.json; the candidate writes queries, runs them against real DuckDB, and
 * sees a result grid. Queries save to artifacts/queries.sql and the last result to artifacts/last_result.json
 * so the interviewer reads exactly what the candidate ran and got.
 *
 * cfg.data_sql shape:
 *   { setup_sql: "CREATE TABLE orders(...); INSERT INTO orders VALUES (...); ...",   // seed the toy DB
 *     schema_hint: [{ table: "orders", columns: ["id","user_id","amount","created_at"] }, ...],  // sidebar
 *     starter_query: "SELECT * FROM orders LIMIT 10;" }
 *
 * DuckDB-WASM loads from CDN (needs internet); offline, the pad degrades to "save-only" with a clear notice. */
const DUCKDB_CDN = "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/+esm";

// Create ONE DuckDB-WASM instance. A screener shares a single instance across all its SQL problems
// (multiple instances each spin up a WASM worker and the second can hang) — see screener.js.
export async function createDuckDB() {
  const duckdb = await import(/* @vite-ignore */ DUCKDB_CDN);
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }));
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  return db;
}

export async function mount(el, ctx) {
  const c = ctx.cfg.data_sql || {};
  const adir = c.artifact_dir || "artifacts";   // screener namespaces per problem
  el.innerHTML = `
    <div class="sql-wrap">
      <aside class="sql-schema" id="sql-schema"><h4>Tables</h4><div id="sql-schema-list">loading…</div></aside>
      <div class="sql-main">
        <div class="sql-toolbar">
          <span id="sql-db-status" class="sql-db-status">starting database…</span>
          <span class="cm-spacer"></span>
          <button class="mi-btn primary" id="sql-run" disabled>▶ Run query</button>
        </div>
        <div class="sql-editor"><textarea id="sql-area"></textarea></div>
        <div class="sql-result">
          <div class="sql-result-head"><span id="sql-status">—</span><span class="cm-spacer"></span>
            <button class="mi-btn ghost" id="sql-grow" title="Expand / shrink results">↕</button>
            <button class="mi-btn ghost" id="sql-fold" title="Hide / show results">▾</button></div>
          <div class="sql-grid" id="sql-grid"><div class="sql-empty">Run a query to see results.</div></div>
        </div>
      </div>
    </div>`;
  injectStyles();

  const $ = id => el.querySelector("#" + id);   // scope to THIS pad — a screener mounts several (IDs collide)
  const cached = localStorage.getItem("mi:" + ctx.base + `${adir}/queries.sql`);
  $("sql-area").value = cached ?? c.starter_query ?? "SELECT 1;";

  // schema sidebar from the hint (so the candidate knows the tables/columns)
  $("sql-schema-list").innerHTML = (c.schema_hint || []).length
    ? c.schema_hint.map(t => `<div class="sql-tbl"><b>${esc(t.table)}</b><div>${(t.columns || []).map(esc).join(", ")}</div></div>`).join("")
    : "<div class='sql-empty'>(schema appears once the DB is ready)</div>";

  // shared editor (SQL mode); autosave queries
  let makeEditor = null;
  try { ({ makeEditor } = await import("/shell/lib/editor.js")); } catch (e) {}
  const area = $("sql-area");
  const cm = makeEditor ? await makeEditor(area, { mode: "sql", autofocus: true, onChange: v => ctx.save(`${adir}/queries.sql`, v) }) : null;
  const getSQL = () => cm ? cm.getValue() : area.value;
  if (!cm) { let t; area.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => ctx.save(`${adir}/queries.sql`, area.value), 600); }); }
  // (no initial auto-save — a starter stub shouldn't be persisted; we save on first edit/run)

  const setDb = (t, cls = "") => { const s = $("sql-db-status"); s.textContent = t; s.className = "sql-db-status " + cls; };
  const setStatus = (t, cls = "") => { const s = $("sql-status"); s.textContent = t; s.className = cls; };
  const result = el.querySelector(".sql-result");
  $("sql-grow").onclick = () => { result.classList.remove("folded"); result.classList.toggle("tall"); };
  $("sql-fold").onclick = () => { result.classList.remove("tall"); $("sql-fold").textContent = result.classList.toggle("folded") ? "▴" : "▾"; };
  const advance = () => { if (ctx.cfg._phase === ctx.cfg.phases?.[0]) ctx.setPhase(ctx.cfg.phases?.[2] || "Code"); };

  // ---- DuckDB-WASM (shared across a screener's SQL problems; isolated per problem by schema) ----
  let conn = null;
  try {
    // Reuse one DuckDB across a screener's SQL problems. Cache the PROMISE (not just the instance) so a fast
    // switch between problems can't kick off a second instantiate while the first is still loading.
    let db;
    if (ctx.duckdb) { if (!ctx.duckdb.p) ctx.duckdb.p = createDuckDB(); db = await ctx.duckdb.p; }
    else { db = await createDuckDB(); }
    conn = await db.connect();
    if (ctx.sqlSchema) {   // screener passes the problem id so each problem's tables don't collide
      const s = String(ctx.sqlSchema).replace(/[^A-Za-z0-9_]/g, "_");
      await conn.query(`CREATE SCHEMA IF NOT EXISTS "${s}"`); await conn.query(`USE "${s}"`);
    }
    for (const stmt of splitSql(c.setup_sql || "")) { try { await conn.query(stmt); } catch (e) { console.warn("seed stmt failed", e); } }
    if (!(c.schema_hint || []).length) await refreshSchema(conn, $);
    setDb("DuckDB ready", "ok");
    $("sql-run").disabled = false;
  } catch (e) {
    setDb("DuckDB offline — queries are saved but can't run (needs internet).", "err");
  }

  async function runSql(text) {
    const res = await conn.query(text);
    const cols = res.schema.fields.map(f => f.name);
    const rows = res.toArray().map(r => { const o = {}; for (const c of cols) o[c] = cell(r[c]); return o; });
    return { cols, rows };
  }
  const saveResult = (sql, got, check) => ctx.save(`${adir}/last_result.json`,
    JSON.stringify({ sql, columns: got.cols, rows: got.rows.slice(0, 200), ...(check ? { check } : {}) }, (k, v) => typeof v === "bigint" ? v.toString() : v, 2));

  // Run shows the result AND, when the problem has an expected answer, checks the output against it in the
  // same click — one button. Objective: passing the check (not a self-attested box) marks the problem solved.
  $("sql-run").onclick = async () => {
    advance(); await ctx.save(`${adir}/queries.sql`, getSQL());
    if (!conn) { setStatus("database offline", "cm-err"); return; }
    const sql = firstStatement(getSQL());
    setStatus("running…");
    try {
      const got = await runSql(sql);
      renderGrid($("sql-grid"), got.cols, got.rows);
      const n = `${got.rows.length} row${got.rows.length === 1 ? "" : "s"}`;
      if (c.expected) {
        const exp = c.expected.query ? await runSql(c.expected.query) : { cols: c.expected.columns || got.cols, rows: c.expected.rows || [] };
        const ok = compareResults(got, exp, !!c.expected.order_matters);
        if (ok) { setStatus(`✓ correct — ${n}`, "cm-ok"); ctx.onComplete?.(); }
        else setStatus(`✗ ${n} — doesn't match the expected result`, "cm-err");
        saveResult(sql, got, ok ? "pass" : "fail");
      } else {
        setStatus(n, "cm-ok"); saveResult(sql, got);
      }
    } catch (e) { $("sql-grid").innerHTML = `<div class="sql-error">${esc(String(e.message || e))}</div>`; setStatus("error", "cm-err"); }
  };
}

// Compare two result sets by their row VALUE tuples (ignoring column names/aliases). Multiset compare unless
// the problem requires a specific order. Numbers are rounded to absorb float noise.
function compareResults(got, exp, orderMatters) {
  const sig = res => res.rows.map(row => JSON.stringify(res.cols.map(c => normCmp(row[c]))));
  let a = sig(got), b = sig(exp);
  if (a.length !== b.length) return false;
  if (!orderMatters) { a = [...a].sort(); b = [...b].sort(); }
  return a.every((x, i) => x === b[i]);
}
function normCmp(v) { return typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v; }

function splitSql(s) { return s.split(";").map(x => x.trim()).filter(Boolean); }
function firstStatement(s) { return splitSql(s)[0] || s.trim(); }

async function refreshSchema(conn, $) {
  try {
    const res = await conn.query("SELECT table_name, column_name FROM information_schema.columns ORDER BY table_name, ordinal_position");
    const byTable = {};
    for (const r of res.toArray().map(x => x.toJSON())) (byTable[r.table_name] ||= []).push(r.column_name);
    $("sql-schema-list").innerHTML = Object.entries(byTable).map(([t, cols]) =>
      `<div class="sql-tbl"><b>${esc(t)}</b><div>${cols.map(esc).join(", ")}</div></div>`).join("") || "<div class='sql-empty'>no tables</div>";
  } catch (e) {}
}

function renderGrid(host, cols, rows) {
  if (!rows.length) { host.innerHTML = "<div class='sql-empty'>0 rows</div>"; return; }
  const head = cols.map(c => `<th>${esc(c)}</th>`).join("");
  const body = rows.slice(0, 200).map(r => "<tr>" + cols.map(c => `<td>${esc(r[c] === null || r[c] === undefined ? "∅" : String(r[c]))}</td>`).join("") + "</tr>").join("");
  host.innerHTML = `<table class="sql-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>` +
    (rows.length > 200 ? `<div class="sql-empty">showing first 200 of ${rows.length} rows</div>` : "");
}
// Normalize an Arrow/DuckDB cell to a clean JS primitive (so it renders + serializes cleanly, not as
// double-stringified "\"12000\""). bigints -> Number when safe; Decimals/Dates/objects -> readable string.
function cell(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return (v >= -9007199254740991n && v <= 9007199254740991n) ? Number(v) : v.toString();
  if (typeof v !== "object") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = typeof v.toString === "function" ? v.toString() : String(v);
  return s && s !== "[object Object]" ? s : JSON.stringify(v);
}
function esc(s) { return (s ?? "").toString().replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])); }

function injectStyles() {
  if (document.getElementById("sql-styles")) return;
  const s = document.createElement("style"); s.id = "sql-styles";
  s.textContent = `
    .mi-work { background: var(--bg); }
    .sql-wrap { flex:1; min-height:0; display:flex; }
    .sql-schema { flex:0 0 180px; border-right:1px solid var(--line); background:var(--panel); padding:12px 14px; overflow:auto; }
    .sql-schema h4 { margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
    .sql-tbl { margin-bottom:10px; font-size:12px; } .sql-tbl b { color:var(--accent); } .sql-tbl div { color:var(--muted); }
    .sql-main { flex:1; min-width:0; display:flex; flex-direction:column; }
    .sql-toolbar { display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--toolbar-bg); border-bottom:1px solid var(--line); }
    .sql-db-status { font-size:12px; color:var(--muted); } .sql-db-status.ok { color:var(--success); } .sql-db-status.err { color:var(--danger); }
    .sql-editor { flex:1 1 auto; min-height:0; }
    #sql-area { width:100%; height:100%; border:0; resize:none; outline:none; padding:12px; font:14px/1.5 var(--mono); background:var(--editor-bg); color:var(--editor-ink); }
    .sql-editor .CodeMirror { height:100%; }
    .sql-result { flex:0 0 auto; display:flex; flex-direction:column; border-top:1px solid var(--line); }
    .sql-result.tall .sql-grid { min-height:45vh; max-height:62vh; }
    .sql-result.folded .sql-grid { display:none; }
    .sql-result-head { display:flex; align-items:center; justify-content:space-between; padding:4px 12px; background:var(--toolbar-bg); color:var(--muted); font:12px var(--mono); }
    .sql-result-head .mi-btn { color:var(--toolbar-ink); background:color-mix(in srgb, var(--toolbar-ink) 12%, transparent); border:1px solid var(--line); font-size:14px; line-height:1; padding:3px 9px; }
    .sql-result-head .mi-btn:hover { background:color-mix(in srgb, var(--toolbar-ink) 24%, transparent); }
    #sql-status.cm-ok { color:var(--success); } #sql-status.cm-err { color:var(--danger); }
    .sql-grid { min-height:80px; max-height:32vh; overflow:auto; background:var(--panel); }
    .sql-table { border-collapse:collapse; width:100%; font-size:12.5px; }
    .sql-table th, .sql-table td { border:1px solid var(--line); padding:4px 8px; text-align:left; white-space:nowrap; }
    .sql-table th { position:sticky; top:0; background:var(--panel-2); color:var(--ink); }
    .sql-empty { padding:14px; color:var(--muted); font-size:13px; }
    .sql-error { padding:14px; color:var(--danger); font:12.5px/1.5 var(--mono); white-space:pre-wrap; }`;
  document.head.appendChild(s);
}

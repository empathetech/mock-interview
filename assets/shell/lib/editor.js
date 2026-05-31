/* Reusable code editor — ONE implementation used by every "coderpad" in the skill (the coding pad, the
 * system-design Spec pad, the Mermaid pad, and any future one). Wraps a <textarea> in CodeMirror with the
 * same quality-of-life everywhere: line numbers, soft tabs (Tab inserts spaces, Backspace removes a whole
 * indent level), the shared theme-aware editor styling (the `cm-dark` class is a legacy name — it's actually
 * light-in-light / dark-in-dark, styled via tokens in shell.css), and a debounced change hook.
 *
 *   import { makeEditor } from "/shell/lib/editor.js";
 *   const cm = await makeEditor(textareaEl, { mode: "python", onChange: v => save(v) });
 *   const value = cm ? cm.getValue() : textareaEl.value;   // cm is null if CodeMirror couldn't load
 *
 * Keeping this in one place is the point: fix or improve the editor once and every pad inherits it. */
const CM_BASE = "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16";
const CM_CSS = `${CM_BASE}/codemirror.min.css`;
const CM_JS = `${CM_BASE}/codemirror.min.js`;
const MODES = {
  python: `${CM_BASE}/mode/python/python.min.js`,
  javascript: `${CM_BASE}/mode/javascript/javascript.min.js`,
  markdown: `${CM_BASE}/mode/markdown/markdown.min.js`,
  sql: `${CM_BASE}/mode/sql/sql.min.js`,
  // Mermaid/plain: no mode file — still gets line numbers, soft tabs, and the themed editor for a consistent feel.
};

export async function makeEditor(textarea, opts = {}) {
  try {
    loadCss(CM_CSS);
    await loadScript(CM_JS);
    if (opts.mode && MODES[opts.mode]) await loadScript(MODES[opts.mode]);
    const CM = window.CodeMirror;
    const cm = CM.fromTextArea(textarea, {
      lineNumbers: true, mode: (opts.mode && MODES[opts.mode]) ? opts.mode : null,
      indentUnit: 4, tabSize: 4, indentWithTabs: false, smartIndent: true,
      lineWrapping: !!opts.lineWrapping, autofocus: !!opts.autofocus,
      extraKeys: {
        Tab: ed => ed.somethingSelected() ? ed.indentSelection("add") : ed.execCommand("insertSoftTab"),
        "Shift-Tab": ed => ed.indentSelection("subtract"),
        Backspace: ed => softBackspace(ed, CM),
      },
    });
    cm.setSize("100%", "100%");
    cm.getWrapperElement().classList.add("cm-dark");
    if (opts.onChange) {
      let t;
      cm.on("change", () => { clearTimeout(t); t = setTimeout(() => opts.onChange(cm.getValue()), opts.debounce ?? 500); });
    }
    // CodeMirror mis-measures when created in a hidden/zero-size container or before web fonts load
    // (symptoms: a big top gap and a cursor that sits between lines, "fixing" itself on the first keystroke).
    // Refresh proactively: next frame, after a beat, when web fonts finish, and whenever the box resizes
    // (which covers a hidden pad becoming visible — e.g. switching problems in the screener).
    const refresh = () => cm.refresh();
    requestAnimationFrame(refresh);
    setTimeout(refresh, 80);
    try { if (window.ResizeObserver) new ResizeObserver(refresh).observe(cm.getWrapperElement()); } catch (e) {}
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh); } catch (e) {}
    return cm;
  } catch (e) {
    return null;   // caller keeps using the raw <textarea>
  }
}

// Backspace in leading whitespace removes a whole indent level (back to the tab stop) so indentation
// never drifts a single space out of alignment — matters most for Python.
function softBackspace(ed, CM) {
  if (ed.somethingSelected()) return CM.Pass;
  const cur = ed.getCursor();
  const before = ed.getLine(cur.line).slice(0, cur.ch);
  if (cur.ch > 0 && /^ +$/.test(before)) {
    const unit = ed.getOption("indentUnit") || 4;
    const del = ((cur.ch - 1) % unit) + 1;
    ed.replaceRange("", { line: cur.line, ch: cur.ch - del }, cur);
    return;
  }
  return CM.Pass;
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if ([...document.scripts].some(s => s.src === src)) return res();
    const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
function loadCss(href) {
  if ([...document.styleSheets].some(s => s.href === href)) return;
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l);
}

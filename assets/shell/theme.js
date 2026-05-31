/* Shared light/dark theme controller for every Mock Interview surface (interview shell + portfolio).
 * Loaded in <head> BEFORE the page renders so a saved choice applies with no flash of the wrong theme.
 * Default follows the OS (prefers-color-scheme); an explicit choice is remembered in localStorage.
 * Any button with [data-theme-toggle] becomes a working, labelled toggle automatically. */
(function () {
  const KEY = "mi:theme";
  const root = document.documentElement;

  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function effective() {
    return root.getAttribute("data-theme") ||
      (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  function update() {
    const dark = effective() === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach(b => {
      b.textContent = dark ? "☀" : "☾";
      const label = dark ? "Switch to light theme" : "Switch to dark theme";
      b.setAttribute("aria-label", label); b.setAttribute("title", label);
    });
  }
  function apply(t) { if (t) root.setAttribute("data-theme", t); else root.removeAttribute("data-theme"); update(); }
  function toggle() {
    const next = effective() === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, next); } catch (e) {}
    apply(next); window.dispatchEvent(new Event("mi-theme"));
    return next;
  }

  const s = saved(); if (s) root.setAttribute("data-theme", s);   // apply before paint
  window.MITheme = { apply, toggle, effective, update };
  // Any [data-theme-toggle] button works automatically — one delegated handler, no per-page wiring.
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-theme-toggle]");
    if (b) { e.preventDefault(); toggle(); }
  });
  document.addEventListener("DOMContentLoaded", update);
  // keep in sync if the OS theme changes and the user hasn't pinned one
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (!saved()) update(); });
})();

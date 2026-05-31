# Design System, Theming, and Accessibility

Every surface this skill builds — the interview shell, each module, the portfolio — must look like Empathetech
and be usable by everyone. This is not decoration: accessibility is the org's whole ethos ("Empathetech,"
pronounced "empathetic"; a community that explicitly welcomes non-traditional and differently-abled people in
tech). Build to that standard by default, not on request.

## Where the look comes from

The tokens are adapted from Empathetech's own site (`empathetech.org`, `src/styles/variables.css`). Reuse
them rather than inventing new ones:

- **Palette:** deep-purple `#642d9b`, bright-purple `#9973d3`, dark-blue `#302653`, aqua `#2a9d8f`,
  sunset `#e76f51`, yellow `#ffac32`, barbie-pink `#ff3186`. Purple is primary; aqua reads as success;
  sunset/yellow are accents/warnings.
- **Type:** Poppins (with a system-font fallback for offline). Monospace: JetBrains Mono / system mono.
- **Shape & motion:** 3px spacing base (xs 9 / s 18 / m 30 …), 9px "semi-rounded" radius, 0.2s transitions.
- **Tone:** warm, friendly, a little playful — but a working tool stays calm and legible. A thin brand
  gradient hairline (deep-purple → bright-purple → sunset) is the signature touch; don't flood work surfaces
  with the full marketing gradient.

All of this lives as CSS custom properties in `assets/shell/shell.css`. **Use the tokens** (`var(--accent)`,
`var(--ink)`, `var(--panel)`, `var(--line)`, …) — never hard-code hex in a module, or it won't theme.

## Light / dark theming

`assets/shell/theme.js` is the controller, loaded in every page's `<head>` *before* the stylesheet so a saved
choice applies with no flash:

- Default follows the OS (`prefers-color-scheme`); an explicit choice is stored in `localStorage` (`mi:theme`)
  and sets `data-theme="light|dark"` on `<html>`.
- Any element with `data-theme-toggle` becomes a labelled, working toggle automatically (the shell header and
  the portfolio both include one). `window.MITheme.toggle()` flips it.
- Tokens are defined for light (default) and overridden under `:root[data-theme="dark"]` and a
  `prefers-color-scheme: dark` media query. The **code-editor surfaces are theme-aware too** — light editor in
  light mode, dark in dark mode — driven by `--editor-bg/-ink/-gutter/-lineno`, `--toolbar-bg/-ink`,
  `--console-bg/-ink`, and a `--syn-*` syntax palette, all defined per theme. **Never hardcode a color in a
  pad** (that's what caused invisible-text bugs); use the tokens and it flips correctly. New AA-checked.

When you add a new module or page, link `shell.css`, include `theme.js` in the head, and you inherit theming
for free as long as you style with the tokens.

## Accessibility checklist (apply to everything you build)

- **Contrast:** every text/background pair must clear **WCAG AA** (≥4.5 normal, ≥3 for large/UI). The shipped
  tokens are all verified AA in both themes; if you introduce a new color pairing, check it. A quick ratio
  check is cheap — do it rather than guessing.
- **Keyboard:** everything interactive is reachable and operable by keyboard. Use real `<button>`s; if you must
  use a div, add `role="button"`, `tabindex="0"`, and Enter/Space handlers (see the phase pills). Never trap focus.
- **Focus visible:** never remove focus outlines — the shell ships a strong `:focus-visible` ring in the brand
  purple. Keep it.
- **Screen readers:** label controls (`aria-label` on icon-only buttons), use `aria-live` for things that
  change without interaction (the timer, the offline banner), and group related controls (`role="group"`).
- **Motion:** respect `prefers-reduced-motion` (the shell already neutralizes transitions/animations under it).
- **Text scaling / zoom:** size with relative units and don't break layout when text is enlarged or the window
  is narrow; nothing should require horizontal scrolling at 200% zoom.
- **Color is never the only signal:** pair it with text or shape (the save dot has a label; phases show names;
  pass/fail prints "PASS"/"FAIL", not just green/red).

The goal: a candidate using a screen reader, keyboard-only, high zoom, or a light/dark preference gets the same
quality of mock interview as anyone else. That's the brief.

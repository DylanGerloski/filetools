'use strict';

/**
 * The site's one stylesheet, inlined into every page's <head> (src/shell.js)
 * for fast static delivery with no render-blocking request. Built from
 * DESIGN_TOKENS (src/tokens.js) -- every color/size/spacing value below is a
 * var(--token), never a literal hex or px, so the whole palette/scale can be
 * changed from one file.
 */

const { DESIGN_TOKENS, designTokensCss } = require('./tokens.js');
const { url: sitePath } = require('./site.js');

const FONT_WOFF2_PATH = 'vendor/fonts/space-grotesk/space-grotesk-latin-wght-normal.woff2';
const FONT_WOFF2_URL = sitePath(FONT_WOFF2_PATH);

const SITE_CSS = `
  /* Space Grotesk (display face) -- self-hosted from vendor/fonts/, Latin
     subset only. See tokens.js's --font-display comment for the license
     and CLS notes. Variable-weight file covers 300-700 in one request. */
  @font-face {
    font-family: 'Space Grotesk Variable';
    font-style: normal;
    font-display: swap;
    font-weight: 300 700;
    src: url('${FONT_WOFF2_URL}') format('woff2-variations');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }

  :root {
${designTokensCss(DESIGN_TOKENS)}
  }

  * { box-sizing: border-box; }

  /* prefers-reduced-motion: state changes (color/border/text) stay; only
     their timing collapses. The one exception is the working-state
     indeterminate progress loop below, which is an ongoing-work indicator
     rather than decoration and is separately suppressed by name. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 1ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 1ms !important;
      scroll-behavior: auto !important;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  html { background: var(--color-bg); }

  body {
    margin: 0;
    font-family: var(--font-sans);
    background: var(--color-bg);
    color: var(--color-text);
    line-height: var(--leading-normal);
    font-size: var(--text-base);
    -webkit-text-size-adjust: 100%;
  }

  img, svg { max-width: 100%; }

  main { display: block; }

  h1, h2, h3 {
    font-family: var(--font-display);
    font-weight: var(--weight-bold);
    color: var(--color-text);
    line-height: var(--leading-tight);
    margin: 0 0 var(--space-4);
  }
  h1 { font-size: var(--text-2xl); letter-spacing: var(--tracking-tight); }
  h2 { font-size: var(--text-xl); margin-top: var(--space-7); }
  h3 { font-size: var(--text-lg); }

  p, li { margin: 0 0 var(--space-4); }

  main p, main li, main .deck, main blockquote {
    max-width: var(--measure);
  }

  .deck {
    font-size: var(--text-md);
    color: var(--color-muted);
    max-width: var(--measure);
  }

  caption, .caption {
    font-size: var(--text-xs);
    color: var(--color-muted);
  }

  [data-tabular], .tabular-nums {
    font-variant-numeric: tabular-nums;
  }

  a { color: var(--color-accent); }
  a:hover { color: var(--color-accent-hover); }

  :focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    transition: outline-color var(--focus-ring-transition);
  }

  /* -------------------------------------------------------------------
     Skip link
     ------------------------------------------------------------------- */
  .skip-link {
    position: absolute;
    left: var(--space-3);
    top: -100px;
    background: var(--color-text);
    color: var(--color-surface);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    z-index: 100;
    transition: top var(--motion-duration-fast) var(--motion-ease-standard);
  }
  .skip-link:focus { top: var(--space-3); }

  /* -------------------------------------------------------------------
     Header / nav
     ------------------------------------------------------------------- */
  .site-header {
    max-width: var(--width-wide);
    margin: 0 auto;
    padding: var(--space-4) var(--space-4) 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .brand {
    font-family: var(--font-display);
    font-weight: var(--weight-bold);
    font-size: var(--text-lg);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
    text-decoration: none;
  }
  .brand:hover { color: var(--color-text); }
  .brand .brand-tail { color: var(--color-accent); }

  .site-nav {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .site-nav a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    color: var(--color-text);
    text-decoration: none;
    font-weight: var(--weight-medium);
    font-size: var(--text-sm);
    border-radius: var(--radius-sm);
  }
  .site-nav a:hover { color: var(--color-accent); background: var(--color-accent-tint); }
  .site-nav a[aria-current="page"] { color: var(--color-accent); }

  /* -------------------------------------------------------------------
     Page shell / breadcrumb
     ------------------------------------------------------------------- */
  .page-shell {
    max-width: var(--width-page);
    margin: 0 auto;
    padding: var(--space-6) var(--space-4) var(--space-8);
  }
  .page-shell.page-shell-app { max-width: var(--width-app); }

  .breadcrumb {
    font-size: var(--text-xs);
    color: var(--color-muted);
    margin-bottom: var(--space-4);
  }
  .breadcrumb a { color: var(--color-muted); }
  .breadcrumb a:hover { color: var(--color-accent); }
  .breadcrumb .sep { margin: 0 var(--space-1); }

  /* -------------------------------------------------------------------
     Buttons
     ------------------------------------------------------------------- */
  .btn-primary, .btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 48px;
    min-width: 180px;
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-md);
    font-weight: var(--weight-medium);
    font-size: var(--text-base);
    text-decoration: none;
    cursor: pointer;
    border: var(--border-control) solid transparent;
  }
  .btn-primary {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
  }
  .btn-primary:hover { background: var(--color-accent-hover); color: var(--color-accent-contrast); }
  .btn-secondary {
    background: transparent;
    color: var(--color-text);
    border-color: var(--color-border-strong);
  }
  .btn-secondary:hover { background: var(--color-accent-tint); }
  .btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    border: var(--border-hairline) solid var(--color-border);
    background: var(--color-surface);
    cursor: pointer;
  }
  .btn-icon:hover { background: var(--color-accent-tint); border-color: var(--color-accent); }
  .btn-icon:disabled { opacity: 0.4; cursor: not-allowed; }

  /* -------------------------------------------------------------------
     Drop zone (src/browser/dropzone.client.js)
     ------------------------------------------------------------------- */
  .dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    min-height: 200px;
    padding: var(--space-6);
    text-align: center;
    background: var(--color-surface);
    border: var(--border-drop) dashed var(--color-border-strong);
    border-radius: var(--radius-lg);
    transition: border-color var(--motion-duration-fast) var(--motion-ease-standard),
      background var(--motion-duration-fast) var(--motion-ease-standard),
      box-shadow var(--motion-duration-fast) var(--motion-ease-standard);
  }
  @media (max-width: 768px) {
    .dropzone { min-height: 160px; padding: var(--space-5); }
  }
  .dropzone[data-state="dragover"] {
    border-style: solid;
    border-color: var(--color-accent);
    background: var(--color-accent-tint);
    box-shadow: var(--shadow-drop);
  }
  .dropzone[data-state="working"] {
    border-style: solid;
    border-color: var(--color-accent);
  }
  .dropzone[data-state="error"] {
    border-color: var(--color-danger);
    animation: dz-shake 200ms var(--motion-ease-standard);
  }
  .dropzone[data-state="done"] {
    border-color: var(--color-success);
  }
  @keyframes dz-shake {
    0% { transform: translateX(0); }
    30% { transform: translateX(-4px); }
    70% { transform: translateX(4px); }
    100% { transform: translateX(0); }
  }

  .dz-icon-wrap { position: relative; width: 48px; height: 48px; }
  .dz-icon {
    color: var(--color-border-strong);
    width: 48px; height: 48px;
    transition: color var(--motion-duration-fast) var(--motion-ease-standard),
      transform var(--motion-duration-fast) var(--motion-ease-standard),
      opacity var(--motion-duration-fast) var(--motion-ease-standard);
  }
  .dropzone[data-state="dragover"] .dz-icon { color: var(--color-accent); transform: scale(1.06); }
  .dropzone[data-state="working"] .dz-icon {
    color: var(--color-accent);
    opacity: 0.35;
    animation: dz-spin var(--motion-duration-loop) linear infinite;
  }
  .dropzone[data-state="done"] .dz-icon { opacity: 0; }
  @keyframes dz-spin {
    to { transform: rotate(360deg); }
  }
  /* Check glyph draws in via stroke-dasharray/-offset on entering "done";
     invisible (dasharray fully offset) in every other state. */
  .dz-check {
    position: absolute;
    inset: 0;
    width: 48px; height: 48px;
    color: var(--color-success);
    opacity: 0;
    transition: opacity var(--motion-duration-fast) var(--motion-ease-standard);
  }
  .dz-check path {
    stroke-dasharray: 40;
    stroke-dashoffset: 40;
    transition: stroke-dashoffset var(--motion-duration-standard) var(--motion-ease-decelerate);
  }
  .dropzone[data-state="done"] .dz-check { opacity: 1; }
  .dropzone[data-state="done"] .dz-check path { stroke-dashoffset: 0; }

  .dz-title {
    font-weight: var(--weight-medium);
    font-size: var(--text-md);
    margin: 0;
  }
  .dz-caption {
    font-size: var(--text-sm);
    color: var(--color-muted);
    margin: 0;
  }
  .dz-proof {
    text-align: center;
    font-size: var(--text-sm);
    color: var(--color-muted);
    margin: var(--space-3) 0 0;
  }
  .dz-status {
    text-align: center;
    font-size: var(--text-sm);
    margin: var(--space-3) 0 0;
    min-height: 1.5em;
  }
  .dz-status[data-tone="error"] { color: var(--color-danger); }
  .dz-status[data-tone="success"] { color: var(--color-success); }

  .progress-track {
    display: none;
    width: 100%;
    max-width: 320px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--color-surface-alt);
    overflow: hidden;
  }
  .dropzone[data-state="working"] .progress-track { display: block; }
  .progress-fill {
    height: 100%;
    width: 40%;
    background: var(--color-accent);
    border-radius: var(--radius-pill);
    transition: width var(--motion-duration-fast) var(--motion-ease-standard);
  }
  /* Indeterminate loop: no per-processor progress plumbing exists today, so
     this is a "work is happening" signal, not a real percentage -- the
     accompanying .dz-status text (already aria-live) carries the real
     detail a processor knows (e.g. "Reading 4 pages on this device..."). */
  .dropzone[data-state="working"] .progress-fill {
    animation: dz-progress-loop var(--motion-duration-loop) linear infinite;
  }
  @keyframes dz-progress-loop {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(250%); }
  }

  .dz-cancel {
    display: none;
    margin-top: var(--space-1);
  }
  .dropzone[data-state="working"][data-slow="true"] .dz-cancel { display: inline-flex; }

  .alert {
    padding: var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    margin: var(--space-4) 0;
  }
  .alert-danger { background: var(--color-danger-bg); color: var(--color-danger); }
  .alert-warn { background: var(--color-warn-bg); color: var(--color-warn); }
  .alert-success { background: var(--color-success-bg); color: var(--color-success); }

  /* -------------------------------------------------------------------
     File list (merge) / page grid (split, rotate)
     ------------------------------------------------------------------- */
  .file-list {
    list-style: none;
    margin: var(--space-4) 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .file-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    background: var(--color-surface);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .file-row .file-name {
    flex: 1;
    font-weight: var(--weight-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file-row .file-meta {
    color: var(--color-muted);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }
  .file-row .file-actions { display: flex; gap: var(--space-1); }

  .page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: var(--space-3);
    margin: var(--space-4) 0;
  }
  .page-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--color-surface);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .page-card canvas, .page-card .page-thumb-fallback {
    width: 100%;
    aspect-ratio: 3 / 4;
    background: var(--color-surface-alt);
    border-radius: var(--radius-sm);
    display: block;
  }
  .page-card .page-num {
    font-size: var(--text-xs);
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }
  .page-card[data-selected="false"] { opacity: 0.5; }
  .page-card .page-rotate-row { display: flex; gap: var(--space-1); }
  .page-card canvas[data-rotation="90"] { transform: rotate(90deg); }
  .page-card canvas[data-rotation="180"] { transform: rotate(180deg); }
  .page-card canvas[data-rotation="270"] { transform: rotate(270deg); }

  /* -------------------------------------------------------------------
     Extracted-table preview (PDF tables to CSV --
     src/browser/pdfTables.client.js)
     ------------------------------------------------------------------- */
  .table-block {
    margin: var(--space-5) 0;
    padding: var(--space-4);
    background: var(--color-surface);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .table-block-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .page-badge {
    display: inline-flex;
    align-items: center;
    padding: var(--space-1) var(--space-3);
    background: var(--color-accent-tint);
    color: var(--color-accent);
    border-radius: var(--radius-pill);
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
  }
  .table-block-head label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text);
  }
  /* Sort-by-column controls (src/browser/sortLines.client.js) reuse this
     same options-row pattern, adding <select> dropdowns alongside the
     checkboxes every other table-block-head already uses. */
  .table-block-head select {
    min-height: 36px;
    padding: var(--space-1) var(--space-2);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--text-sm);
  }
  .table-block-head select:focus-visible {
    outline: var(--border-control) solid var(--color-accent);
    outline-offset: 1px;
  }
  /* Split-CSV's rows-per-file control (src/browser/splitCsv.client.js)
     reuses this same options-row pattern with a number input. */
  .table-block-head input[type="number"] {
    width: 88px;
    min-height: 36px;
    padding: var(--space-1) var(--space-2);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
    font-size: var(--text-sm);
  }
  .table-block-head input[type="number"]:focus-visible {
    outline: var(--border-control) solid var(--color-accent);
    outline-offset: 1px;
  }
  /* Horizontally scrollable inside its OWN container so the page itself
     never scrolls horizontally at 360px, even for a wide extracted table. */
  .table-scroll {
    overflow-x: auto;
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
  }
  .extracted-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .extracted-table th, .extracted-table td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-bottom: var(--border-hairline) solid var(--color-border);
    white-space: nowrap;
  }
  .extracted-table thead th {
    position: sticky;
    top: 0;
    background: var(--color-surface-alt);
    font-weight: var(--weight-medium);
    z-index: 1;
  }
  .extracted-table tbody tr:last-child td { border-bottom: none; }
  /* Read-only JSON preview (YAML to JSON --
     src/browser/yamlToJson.client.js). Reuses .table-scroll's border
     treatment for a consistent contained-scroll box, but scrolls both axes
     since JSON text (unlike a table) can have both long lines and many of
     them. */
  .json-preview {
    max-height: 480px;
    overflow: auto;
    margin: 0;
    padding: var(--space-3);
    background: var(--color-surface-alt);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    color: var(--color-text);
    white-space: pre;
  }
  .row-action-cell { width: 44px; text-align: center; }
  .boundary-editor { margin-top: var(--space-4); }
  .boundary-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  .boundary-item {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .boundary-item input[type="number"] {
    width: 72px;
    min-height: 36px;
    padding: var(--space-1) var(--space-2);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
    font-variant-numeric: tabular-nums;
    font-size: var(--text-sm);
  }
  .table-block > .btn-secondary { margin-top: var(--space-4); }
  .download-btn-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }

  /* -------------------------------------------------------------------
     Cell-level CSV diff table (compare-csv --
     src/browser/csvDiff.client.js). Row-level tint from a shared
     background token PLUS the .diff-status-cell text label in every row
     (never color alone -- see design-standards.md's "color never the sole
     carrier of meaning").
     ------------------------------------------------------------------- */
  .extracted-table tr[data-diff-status="added"] > td { background: var(--color-success-bg); }
  .extracted-table tr[data-diff-status="removed"] > td { background: var(--color-danger-bg); }
  .extracted-table tr[data-diff-status="changed"] > td { background: var(--color-warn-bg); }
  .extracted-table td[data-diff-cell="changed"] { font-weight: var(--weight-bold); }
  .diff-cell-old {
    color: var(--color-danger);
    text-decoration: line-through;
    margin-right: var(--space-1);
  }
  .diff-cell-new { color: var(--color-success); }
  .diff-status-cell {
    font-size: var(--text-xs);
    font-weight: var(--weight-medium);
    white-space: nowrap;
  }
  .diff-status-cell[data-diff-status="added"] { color: var(--color-success); }
  .diff-status-cell[data-diff-status="removed"] { color: var(--color-danger); }
  .diff-status-cell[data-diff-status="changed"] { color: var(--color-warn); }
  .diff-status-cell[data-diff-status="unchanged"] { color: var(--color-muted); }

  /* -------------------------------------------------------------------
     Second input path: "paste markup" (html-table-to-csv today; toolPage.js
     only renders this block when a tool config sets pasteInput)
     ------------------------------------------------------------------- */
  .or-divider {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: var(--space-4) 0;
    color: var(--color-muted);
    font-size: var(--text-sm);
  }
  .or-divider::before, .or-divider::after {
    content: '';
    flex: 1;
    height: var(--border-hairline);
    background: var(--color-border);
  }
  .paste-input {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .paste-input label {
    font-weight: var(--weight-medium);
    font-size: var(--text-sm);
  }
  .paste-textarea {
    width: 100%;
    min-height: 140px;
    padding: var(--space-3);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: var(--text-sm);
    color: var(--color-text);
    background: var(--color-surface);
    resize: vertical;
  }
  .paste-textarea:focus-visible {
    outline: var(--border-control) solid var(--color-accent);
    outline-offset: 1px;
  }
  .paste-input > .btn-secondary { align-self: flex-start; }

  /* -------------------------------------------------------------------
     Result block
     ------------------------------------------------------------------- */
  .result {
    margin-top: var(--space-5);
    padding: var(--space-5);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }
  .support-note {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: var(--border-hairline) solid var(--color-border);
    font-size: var(--text-sm);
    color: var(--color-muted);
  }

  /* -------------------------------------------------------------------
     Before -> after transformation diagram (Deliverable 6 -- see
     src/diagrams.js). Sits between the deck and the dropzone; empty string
     for tools with no diagram yet, so this block simply doesn't render.
     ------------------------------------------------------------------- */
  .transform-diagram {
    margin: var(--space-4) 0 var(--space-6);
    padding: var(--space-4);
    background: var(--color-surface);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-lg);
  }
  .transform-diagram-svg {
    display: block;
    width: 100%;
    max-width: 480px;
    height: auto;
    color: var(--color-border-strong);
  }
  .transform-diagram-svg .td-label {
    font-family: var(--font-sans);
    font-size: 13px;
    fill: var(--color-muted);
    stroke: none;
  }
  .transform-diagram-svg .td-accent { color: var(--color-accent); }

  /* -------------------------------------------------------------------
     Tool surface card
     ------------------------------------------------------------------- */
  #tool {
    background: var(--color-surface);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }
  @media (max-width: 768px) {
    #tool { padding: var(--space-4); }
  }

  /* -------------------------------------------------------------------
     How-it-works process rail -- CSS-only counter-generated step markers
     on the genuinely-ordered <ol> (design-standards.md permits numbering an
     element's own semantics; it rejects decorative numbering of sections,
     a different thing).
     ------------------------------------------------------------------- */
  .how-steps {
    list-style: none;
    padding-left: 0;
    counter-reset: how-step;
    margin: var(--space-5) 0;
  }
  .how-steps li {
    position: relative;
    max-width: var(--measure);
    padding-left: calc(28px + var(--space-4));
    padding-bottom: var(--space-5);
    border-left: var(--border-hairline) solid var(--color-border);
    margin-left: 13px;
  }
  .how-steps li:last-child { border-left-color: transparent; padding-bottom: 0; }
  .how-steps li::before {
    counter-increment: how-step;
    content: counter(how-step);
    position: absolute;
    left: -14px;
    top: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-accent-tint);
    color: var(--color-accent);
    border-radius: var(--radius-pill);
    font-family: var(--font-display);
    font-weight: var(--weight-bold);
    font-size: var(--text-sm);
  }

  /* -------------------------------------------------------------------
     FAQ -- native <details>/<summary> disclosure (Deliverable 4). The
     first two items ship the open attribute; see src/pages/toolPage.js.
     ------------------------------------------------------------------- */
  .faq-item {
    max-width: var(--measure);
    border-bottom: var(--border-hairline) solid var(--color-border);
    padding: var(--space-4) 0;
  }
  .faq-item:first-of-type { border-top: var(--border-hairline) solid var(--color-border); }
  .faq-item summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    padding-left: var(--space-5);
    position: relative;
  }
  .faq-item summary::-webkit-details-marker { display: none; }
  .faq-item summary::before {
    content: '';
    position: absolute;
    left: 0;
    width: 10px;
    height: 10px;
    border-right: var(--border-control) solid var(--color-muted);
    border-bottom: var(--border-control) solid var(--color-muted);
    transform: rotate(-45deg);
    transition: transform var(--motion-duration-fast) var(--motion-ease-standard);
  }
  .faq-item[open] summary::before { transform: rotate(45deg); }
  .faq-item[open] { border-left: var(--border-control) solid var(--color-accent); padding-left: var(--space-3); }
  .faq-item summary h3 { display: inline; font-size: var(--text-md); margin: 0; }
  .faq-item p { margin: var(--space-2) 0 0 var(--space-5); color: var(--color-text); }

  /* -------------------------------------------------------------------
     Related tools -- one inline glyph+text row under a hairline, not a
     card grid (design-standards.md; see toolPage.js's comment).
     ------------------------------------------------------------------- */
  .related-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-6);
    margin: var(--space-4) 0 0;
    padding-top: var(--space-4);
    border-top: var(--border-hairline) solid var(--color-border);
    max-width: none;
  }
  .related-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 44px;
    color: var(--color-text);
    text-decoration: none;
    font-weight: var(--weight-medium);
  }
  .related-link svg { width: 20px; height: 20px; color: var(--color-muted); flex-shrink: 0; }
  .related-link:hover { color: var(--color-accent); }
  .related-link:hover svg { color: var(--color-accent); }

  /* -------------------------------------------------------------------
     Ad slot -- reserved height, never above/beside the tool.
     ------------------------------------------------------------------- */
  .ad-slot {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--ad-min-h-mobile);
    margin: var(--space-6) 0;
    contain: layout;
    background: var(--color-surface-alt);
    border: var(--border-hairline) dashed var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-muted);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  @media (min-width: 768px) {
    .ad-slot { min-height: var(--ad-min-h-desktop); }
  }

  /* -------------------------------------------------------------------
     Footer
     ------------------------------------------------------------------- */
  .site-footer {
    max-width: var(--width-wide);
    margin: 0 auto;
    padding: var(--space-6) var(--space-4) var(--space-8);
    border-top: var(--border-hairline) solid var(--color-border);
    color: var(--color-muted);
    font-size: var(--text-sm);
  }
  .footer-groups {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
    margin-bottom: var(--space-5);
  }
  @media (min-width: 768px) {
    .footer-groups { grid-template-columns: repeat(3, 1fr); }
  }
  .footer-group h3 {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--color-text);
    margin-bottom: var(--space-2);
  }
  .footer-group ul { list-style: none; margin: 0; padding: 0; }
  .footer-group li { margin: 0 0 var(--space-1); }
  .footer-group a { color: var(--color-muted); }
  .footer-group a:hover { color: var(--color-accent); }
  .footer-legal { max-width: none; }
  .footer-legal a { color: var(--color-muted); margin-right: var(--space-4); }
  .footer-credit {
    margin: var(--space-3) 0 0;
    color: var(--color-muted);
    font-size: var(--text-xs);
  }
  .footer-credit a { color: var(--color-muted); }
  .footer-credit a:hover { color: var(--color-accent); }
  .footer-social {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .footer-social svg { display: block; }

  .newsletter-signup {
    margin: var(--space-5) 0;
    padding: var(--space-4);
    background: var(--color-surface);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-md);
    max-width: 60ch;
  }
  .newsletter-heading {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 var(--space-2);
  }
  .newsletter-description {
    color: var(--color-muted);
    font-size: var(--text-xs);
    margin: 0 0 var(--space-3);
  }
  .newsletter-signup--pending .newsletter-description { margin-bottom: 0; }
  /* D1 fix: the styled box (border/background/fixed height) now belongs
     ONLY to the loaded iframe -- the default slot (.newsletter-slot,
     src/shell.js) renders as a plain link with no box at all, so a load
     that never happens degrades to a real link, not an empty rectangle. */
  .newsletter-slot a { font-weight: var(--weight-medium); }
  .newsletter-embed {
    display: block;
    width: 100%;
    max-width: 480px;
    height: 320px;
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
  }

  /* -------------------------------------------------------------------
     404
     ------------------------------------------------------------------- */
  .not-found ul { padding-left: var(--space-5); }

  /* -------------------------------------------------------------------
     Home page -- left-aligned hero directly above the first category
     group (design-standards.md's Distinctiveness Gate names a centered
     hero over a card grid an automatic NO-GO; this also makes the
     homepage's silhouette differ from every tool page by construction).
     ------------------------------------------------------------------- */
  .hero { padding: var(--space-6) 0 var(--space-4); text-align: left; }
  .hero h1 { margin-bottom: var(--space-3); max-width: var(--measure); }
  .hero .deck { margin: 0; }

  .tool-group { margin: var(--space-7) 0; padding: var(--space-4); border-radius: var(--radius-lg); }
  .tool-group h2 { margin-top: 0; margin-bottom: var(--space-4); }
  .tool-group--pdf { background: var(--color-surface-alt); }
  .tool-group--data { background: var(--color-accent-tint); }

  .tool-list { display: flex; flex-direction: column; }
  @media (min-width: 768px) {
    .tool-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 var(--space-6); }
  }
  .tool-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: var(--border-hairline) solid var(--color-border);
    text-decoration: none;
    color: var(--color-text);
    min-height: 44px;
  }
  .tool-list > .tool-row:last-child,
  .tool-list > .tool-row:nth-last-child(2):nth-child(odd) { border-bottom: none; }
  .tool-row:hover .tool-row-name { color: var(--color-accent); }
  .tool-row-icon { width: 24px; height: 24px; flex-shrink: 0; margin-top: 2px; color: var(--color-muted); }
  .tool-row:hover .tool-row-icon { color: var(--color-accent); }
  .tool-row-text { display: flex; flex-direction: column; gap: 2px; }
  .tool-row-name {
    font-family: var(--font-display);
    font-weight: var(--weight-bold);
    font-size: var(--text-md);
    color: var(--color-text);
  }
  .tool-row-desc { font-size: var(--text-sm); color: var(--color-muted); }
`;

module.exports = { SITE_CSS, FONT_WOFF2_URL };

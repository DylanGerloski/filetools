'use strict';

/**
 * The site's one stylesheet, inlined into every page's <head> (src/shell.js)
 * for fast static delivery with no render-blocking request. Built from
 * DESIGN_TOKENS (src/tokens.js) -- every color/size/spacing value below is a
 * var(--token), never a literal hex or px, so the whole palette/scale can be
 * changed from one file.
 */

const { DESIGN_TOKENS, designTokensCss } = require('./tokens.js');

const SITE_CSS = `
  :root {
${designTokensCss(DESIGN_TOKENS)}
  }

  * { box-sizing: border-box; }

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
    outline: none;
    box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-accent);
    border-radius: var(--radius-sm);
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
    transition: top 0.15s ease;
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
    transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
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
  .dropzone[data-state="error"] {
    border-color: var(--color-danger);
  }
  .dropzone[data-state="done"] {
    border-color: var(--color-success);
  }
  .dz-icon { color: var(--color-border-strong); width: 48px; height: 48px; }
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
    width: 100%;
    max-width: 320px;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--color-surface-alt);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--color-accent);
    border-radius: var(--radius-pill);
    transition: width 0.15s ease;
  }

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
     How-it-works / FAQ
     ------------------------------------------------------------------- */
  .how-steps {
    padding-left: var(--space-5);
  }
  .how-steps li { max-width: var(--measure); }

  .faq-item { margin-bottom: var(--space-5); max-width: var(--measure); }
  .faq-item h3 { font-size: var(--text-md); margin-bottom: var(--space-2); }
  .faq-item p { margin: 0; color: var(--color-text); }

  /* -------------------------------------------------------------------
     Related tools
     ------------------------------------------------------------------- */
  .related-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
    margin: var(--space-5) 0;
  }
  @media (min-width: 768px) {
    .related-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 1440px) {
    .related-grid { grid-template-columns: repeat(3, 1fr); }
  }
  .related-card {
    display: block;
    padding: var(--space-4);
    background: var(--color-surface);
    border-top: 3px solid var(--color-accent);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    text-decoration: none;
    color: var(--color-text);
  }
  .related-card:hover { box-shadow: var(--shadow-md); color: var(--color-text); }
  .related-card h3 { margin: 0 0 var(--space-2); font-size: var(--text-md); }
  .related-card p { margin: 0; max-width: none; color: var(--color-muted); font-size: var(--text-sm); }

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
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-muted);
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
  .newsletter-fields {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .newsletter-fields input[type="email"] {
    flex: 1 1 220px;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    border: var(--border-hairline) solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    background: var(--color-bg);
    color: var(--color-text);
  }
  .newsletter-fields button {
    min-height: 44px;
    padding: var(--space-2) var(--space-4);
    border: var(--border-hairline) solid var(--color-accent);
    border-radius: var(--radius-sm);
    background: var(--color-accent);
    color: var(--color-surface);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .newsletter-fields button:hover { background: var(--color-accent-hover); }

  /* -------------------------------------------------------------------
     404
     ------------------------------------------------------------------- */
  .not-found ul { padding-left: var(--space-5); }

  /* -------------------------------------------------------------------
     Home page
     ------------------------------------------------------------------- */
  .hero { padding: var(--space-6) 0 var(--space-5); text-align: center; }
  .hero h1 { margin-bottom: var(--space-3); }
  .hero .deck { margin: 0 auto var(--space-2); }
  .tool-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
    margin: var(--space-6) 0;
  }
  @media (min-width: 768px) { .tool-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1440px) { .tool-grid { grid-template-columns: repeat(3, 1fr); } }
`;

module.exports = { SITE_CSS };

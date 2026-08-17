/**
 * The example-panel registry -- auto-discovers every src/examples/*.mjs
 * module the same way src/tools/index.js auto-discovers src/tools/*.js
 * (see that file's header comment for the full rationale). Adding a new
 * tool's example is purely additive: write src/examples/<slug>.mjs
 * exporting { slug, ariaLabel, render(escapeHtml) } (see compare-csv.mjs)
 * -- no other file needs to change, so later tool examples can each add
 * files here in parallel with zero conflicts.
 *
 * Module-level top-level await: this file is loaded once, lazily, from
 * src/build.js's async build() via a single `await import(...)`, so the
 * cost of resolving every example at once is paid exactly once per build,
 * not per tool page.
 *
 * ESM, not CJS, deliberately: every src/pure/*.mjs module (what the
 * examples run to produce a REAL result, not a mock -- see compare-csv.mjs
 * for why) is already pure ESM. Loading them from CJS build.js would need
 * the same async import()-of-an-.mjs bridge this file already is; putting
 * that bridge here, once, keeps every individual example module simple
 * synchronous ESM that just imports its pure module directly.
 */

import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Escapes for HTML text content -- identical implementation to
 * src/shell.js's escapeHtml, duplicated rather than imported because
 * shell.js is CommonJS and this file is ESM with no shared runtime module
 * between them today (same accepted-duplication shape as
 * src/pages/toolPage.js's MAX_BYTES_BY_CLIENT comment describes for a
 * different pair of files). Passed into every example module's render()
 * so no example module has to reimplement or reimport it.
 *
 * @param {*} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Generic fallback note, used when an example module doesn't export its
 * own more specific `note` string (see compare-csv.mjs for a tool-specific
 * example). */
export const DEFAULT_NOTE = 'Sample data, generated when this page was built. Your files are read on your device and never uploaded.';

const files = readdirSync(__dirname)
  .filter((f) => f.endsWith('.mjs') && f !== 'index.mjs')
  .sort();

// eslint-disable-next-line no-restricted-syntax -- intentional top-level await
const modules = await Promise.all(
  files.map((f) => import(pathToFileURL(path.join(__dirname, f)).href))
);

const EXAMPLES = new Map(modules.map((m) => [m.slug, m]));

/**
 * @param {string} slug a tool slug (src/tools/index.js's TOOLS[].slug).
 * @returns {string} the example's rendered HTML body, or '' if that tool
 *   has no example module yet -- toolPage.js treats '' as "render the
 *   plain single-column how-steps list, no two-column band".
 */
export function exampleFor(slug) {
  const mod = EXAMPLES.get(slug);
  if (!mod) return '';
  return mod.render(escapeHtml);
}

/**
 * @param {string} slug
 * @returns {string} the example's figure aria-label, or '' if there's no
 *   example for that slug.
 */
export function ariaLabelFor(slug) {
  const mod = EXAMPLES.get(slug);
  return mod ? mod.ariaLabel : '';
}

/**
 * @param {string} slug
 * @returns {string} the caption note under the example -- the module's own
 *   `note` export if it has one (compare-csv.mjs does, with copy specific
 *   to its own fixture), otherwise DEFAULT_NOTE.
 */
export function noteFor(slug) {
  const mod = EXAMPLES.get(slug);
  if (!mod) return '';
  return mod.note || DEFAULT_NOTE;
}

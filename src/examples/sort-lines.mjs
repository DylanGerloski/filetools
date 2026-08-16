/**
 * The sort-lines example panel (Pattern B, "before-after-tables" -- see
 * src/examples/index.mjs for the module contract). Runs the tool's OWN
 * pure module (sortLines.mjs) on a tiny fixture at build time and renders
 * the real result, so this panel inherits the site's existing table CSS
 * and can never drift from reality.
 *
 * Markup mirrors src/browser/sortLines.client.js's real result table
 * exactly: a single "Line" column holding each full line's raw text (the
 * tool sorts whole lines by a chosen field, it does not split a line into
 * separate rendered cells) -- so this example looks identical in shape to
 * what a visitor actually sees after using the tool.
 *
 * Fixture sorts numerically descending by the second field (score) so the
 * reordering is unambiguous at a glance: nothing is removed or added here
 * (a sort only reorders), so no data-diff-status marking applies -- see
 * dedupe-lines.mjs/split-csv.mjs for tools where it does.
 *
 * Do not change the fixture without also updating
 * test/examples.test.mjs's assertions against sortLines()'s real return
 * value.
 */

import { sortLines } from '../pure/sortLines.mjs';

export const slug = 'sort-lines';

export const ariaLabel = 'Example sort of a 3-row list by score, highest first';

export const note = 'Sorted numerically by the score column, highest first. The header line stays pinned at the top.';

const INPUT_LINES = ['name,score', 'Priya,88', 'Omar,95', 'Liu,72'];
const SORT_OPTS = { column: 1, order: 'desc', type: 'numeric', hasHeader: true };

/**
 * @returns {ReturnType<typeof sortLines>} the real sort of the fixture
 *   above -- exported separately from render() so test/examples.test.mjs
 *   can assert against the exact same computed result the page renders.
 */
export function sortFixture() {
  return sortLines(INPUT_LINES, SORT_OPTS);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @param {string[]} lines full raw line text, one per row.
 */
function renderTable(escapeHtml, lines) {
  const body = lines.map((line) => `<tr><td>${escapeHtml(line)}</td></tr>`).join('');
  return `<div class="table-scroll"><table class="extracted-table"><thead><tr><th scope="col">Line</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an .example-before-after block: Input holds the
 *   fixture's lines in original order, Output holds the real sorted order.
 */
export function render(escapeHtml) {
  const outcome = sortFixture();

  return `<div class="example-before-after">
    <div class="example-ba-col">
      <p class="example-ba-label">Input</p>
      ${renderTable(escapeHtml, INPUT_LINES)}
    </div>
    <span class="example-ba-arrow" aria-hidden="true">&rarr;</span>
    <div class="example-ba-col">
      <p class="example-ba-label">Output</p>
      ${renderTable(escapeHtml, outcome.sorted)}
    </div>
  </div>`;
}

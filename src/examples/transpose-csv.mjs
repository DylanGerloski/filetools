/**
 * The transpose-csv example panel (Pattern B, "before-after-tables" -- see
 * src/examples/index.mjs for the module contract). Runs the tool's OWN
 * pure module (transposeCsv.mjs) on a tiny fixture at build time and
 * renders the real result, so this panel inherits the site's existing
 * table CSS and can never drift from reality.
 *
 * Markup deliberately mirrors src/browser/transposeCsv.client.js's real
 * result rendering exactly: <tbody>-only, no <thead> -- the tool has no
 * concept of a header row, it transposes every parsed row including
 * whatever text is on the first line, so giving the example a <thead>
 * would imply behavior the tool doesn't have.
 *
 * Nothing is removed or added here (a transpose only reshapes), so no
 * data-diff-status marking applies -- see dedupe-lines.mjs/split-csv.mjs
 * for tools where it does.
 *
 * Do not change the fixture without also updating
 * test/examples.test.mjs's assertions against transposeCsv()'s real
 * return value.
 */

import { transposeCsv } from '../pure/transposeCsv.mjs';

export const slug = 'transpose-csv';

export const ariaLabel = 'Example transpose of a 3-row, 3-column CSV table into a 3-row, 3-column table with rows and columns swapped';

export const note = 'Every row becomes a column and every column becomes a row, including the header line.';

const INPUT_CSV = `name,q1,q2
Iris,120,150
Coral,90,110
`;

/**
 * @returns {ReturnType<typeof transposeCsv>} the real transpose of the
 *   fixture above -- exported separately from render() so
 *   test/examples.test.mjs can assert against the exact same computed
 *   result the page renders.
 */
export function transposeFixture() {
  return transposeCsv(INPUT_CSV);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @param {string[][]} rows
 */
function renderTable(escapeHtml, rows) {
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="table-scroll"><table class="extracted-table"><tbody>${body}</tbody></table></div>`;
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an .example-before-after block: Input holds the
 *   fixture's rows as parsed, Output holds the real transposed result.
 */
export function render(escapeHtml) {
  const outcome = transposeFixture();
  const inputRows = INPUT_CSV.trim().split('\n').map((line) => line.split(','));

  return `<div class="example-before-after">
    <div class="example-ba-col">
      <p class="example-ba-label">Input</p>
      ${renderTable(escapeHtml, inputRows)}
    </div>
    <span class="example-ba-arrow" aria-hidden="true">&rarr;</span>
    <div class="example-ba-col">
      <p class="example-ba-label">Output</p>
      ${renderTable(escapeHtml, outcome.transposed)}
    </div>
  </div>`;
}

/**
 * The merge-csv example panel (Pattern B, "before-after-tables" -- see
 * src/examples/index.mjs for the module contract). Runs the tool's OWN
 * pure module (csvMerge.mjs) on two tiny fixture files at build time and
 * renders the real result, so this panel inherits the site's existing
 * table CSS and can never drift from reality -- see compare-csv.mjs for
 * the same reasoning applied to Pattern A.
 *
 * Fixture chosen to demonstrate the tool's actual value proposition --
 * header reconciliation: File B's second column is named differently from
 * File A's ("backorder" vs "qty"), so the merged output has a genuinely
 * new union column and a blank cell wherever a source file didn't have
 * that column, rather than misaligning the two under one guessed name.
 * Kept to two columns per file (rather than three) so each small table
 * fits its half of the already-narrow example figure without the
 * .table-scroll horizontal-scroll affordance hiding a whole column at
 * first glance -- see .example-ba-col's compact table rule in src/css.js.
 * Nothing is removed here (a merge only ever adds rows together), so no
 * data-diff-status marking applies -- see split-csv.mjs/dedupe-lines.mjs
 * for tools where it does.
 *
 * Do not change the fixture without also updating
 * test/examples.test.mjs's assertions against mergeCsvFiles()'s real
 * return value.
 */

import { mergeCsvFiles } from '../pure/csvMerge.mjs';

export const slug = 'merge-csv';

export const ariaLabel = 'Example merge of two small CSV files with different columns into one reconciled table';

export const note = 'Two files with different columns, combined into one table. A missing column becomes a blank cell, not a misaligned row.';

const FILE_A_NAME = 'store-east.csv';
const FILE_A = `sku,qty
A100,12
A101,30
`;

const FILE_B_NAME = 'store-west.csv';
const FILE_B = `sku,backorder
B200,0
B201,5
`;

/**
 * @returns {ReturnType<typeof mergeCsvFiles>} the real merge of the two
 *   fixture files above -- exported separately from render() so
 *   test/examples.test.mjs can assert against the exact same computed
 *   result the page renders, not a re-derived copy.
 */
export function mergeFixture() {
  return mergeCsvFiles(
    [
      { name: FILE_A_NAME, text: FILE_A },
      { name: FILE_B_NAME, text: FILE_B },
    ],
    { hasHeader: true }
  );
}

/**
 * Renders a small CSV file's own text as an unlabeled <tbody>-only table
 * (no <thead>) -- matches how a source file's raw rows would look before
 * any tool has interpreted them, and mirrors the plain data-grid rendering
 * every src/browser/*.client.js result table already uses.
 */
function renderRawFileTable(escapeHtml, csvText) {
  const rows = csvText
    .trim()
    .split('\n')
    .map((line) => line.split(','));
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="table-scroll"><table class="extracted-table"><tbody>${body}</tbody></table></div>`;
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an .example-before-after block: Input holds both
 *   source file previews (labeled by file name), Output holds the real
 *   merged, header-reconciled result with a proper <thead> for the union
 *   column names.
 */
export function render(escapeHtml) {
  const merged = mergeFixture();

  const headCells = merged.headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join('');
  const bodyRows = merged.rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  const outputTable = `<div class="table-scroll"><table class="extracted-table"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;

  return `<div class="example-before-after">
    <div class="example-ba-col">
      <p class="example-ba-label">Input (2 files)</p>
      <p class="example-ba-label">${escapeHtml(FILE_A_NAME)}</p>
      ${renderRawFileTable(escapeHtml, FILE_A)}
      <p class="example-ba-label">${escapeHtml(FILE_B_NAME)}</p>
      ${renderRawFileTable(escapeHtml, FILE_B)}
    </div>
    <span class="example-ba-arrow" aria-hidden="true">&rarr;</span>
    <div class="example-ba-col">
      <p class="example-ba-label">Output</p>
      ${outputTable}
    </div>
  </div>`;
}

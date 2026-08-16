/**
 * The xlsx-to-json example panel -- Pattern C ("grid-to-code" -- an input
 * grid plus the real result rendered as a code block). Renders the tool's
 * OWN pure
 * module (xlsxExtract.mjs -- the module ../browser/xlsxToJson.client.js
 * itself uses, NOT xlsxGrid.mjs, which belongs to the xlsx-to-csv tool's
 * merged-range/sparse-cell handling) run on a tiny authored fixture: an
 * "Input" grid rendered as an .extracted-table, and the REAL resulting
 * JSON records as an "Output" <pre><code>.
 *
 * FIXTURE_GRID stands in for what a real worksheet read would already have
 * produced by the time it reaches xlsxExtract.mjs -- ../browser/
 * xlsxToJson.client.js's worksheetToGrid() calls normalizeCellValue() on
 * every raw exceljs cell value before this point, so this fixture's cells
 * are run through that same real normalizeCellValue() rather than assumed
 * pre-normalized, even though they're already plain values here. The
 * point this example proves -- unlike html-table-to-csv/json-to-csv's
 * CSV grids, which coerce everything to text -- is that xlsx-to-json
 * *keeps types*: the Qty column stays a real JSON number, In Stock stays a
 * real JSON boolean, not the string "12" or "true".
 */

import { normalizeCellValue, rowsToJsonRecords } from '../pure/xlsxExtract.mjs';

export const slug = 'xlsx-to-json';

export const ariaLabel = 'Example conversion of a small spreadsheet grid into typed JSON records';

export const note = 'Numbers and booleans stay real JSON types (12, true), not the text "12" or "true" a CSV would give you.';

/** Raw exceljs-shaped cell values, one row per array entry, header first. */
const FIXTURE_RAW_ROWS = [
  ['Product', 'Qty', 'In Stock'],
  ['Widget', 12, true],
  ['Gadget', 5, false],
];

/**
 * @returns {{grid: (string|number|boolean)[][], records: object[]}} the
 *   real result of running FIXTURE_RAW_ROWS through xlsxExtract.mjs's own
 *   normalizeCellValue and rowsToJsonRecords -- exported separately so
 *   test/examples.test.mjs can assert against the exact same computed
 *   result the page renders.
 */
export function convertFixture() {
  const grid = FIXTURE_RAW_ROWS.map((row) => row.map((cell) => normalizeCellValue(cell)));
  const records = rowsToJsonRecords(grid, true);
  return { grid, records };
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" .table-scroll > .extracted-table of the
 *   fixture grid, then an "Output" <pre><code> of the real typed JSON
 *   records.
 */
export function render(escapeHtml) {
  const { grid, records } = convertFixture();
  const [headerRow, ...dataRows] = grid;

  const headCells = headerRow.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('');
  const bodyRows = dataRows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<p class="caption">Input</p>
<div class="table-scroll"><table class="extracted-table"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>
<p class="caption">Output</p>
<pre class="json-preview"><code>${escapeHtml(JSON.stringify(records, null, 2))}</code></pre>`;
}

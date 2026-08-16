/**
 * The html-table-to-csv example panel -- Pattern C ("code-to-grid" -- an
 * input code block plus the real result rendered as a grid). Renders the
 * tool's OWN pure module (htmlTableExtract.mjs's normalizeTableRows) run on a tiny
 * authored fixture: an "Input" <pre><code> block of the raw HTML markup,
 * and the REAL resulting rectangular grid rendered as an .extracted-table.
 *
 * normalizeTableRows() takes the already-DOM-shaped cell descriptor array
 * (`{text, colSpan, rowSpan, isHeader}` per cell, per row) that
 * ../browser/htmlTableToCsv.client.js's cellRowsForTable() would produce
 * from a real parsed <table> -- that DOM-walking step needs a browser
 * DOMParser, which isn't available in this Node build step (see
 * src/examples/index.mjs's header for why the pure/browser split exists).
 * FIXTURE_CELL_ROWS below is hand-authored to describe exactly the same
 * table FIXTURE_HTML shows, so the two must be kept in sync by hand if
 * either changes -- test/examples.test.mjs's literal assertions exist to
 * catch a drift between them.
 */

import { normalizeTableRows } from '../pure/htmlTableExtract.mjs';

export const slug = 'html-table-to-csv';

export const ariaLabel = 'Example conversion of a small HTML table into a CSV-ready grid';

export const note = 'A 3-row HTML <table> converted into a 2-column grid, header row detected automatically.';

// 5 lines -- inside the 6-8 line hard cap.
export const FIXTURE_HTML = `<table>
  <tr><th>City</th><th>Population</th></tr>
  <tr><td>Reno</td><td>264165</td></tr>
  <tr><td>Boise</td><td>235684</td></tr>
</table>
`;

/**
 * Hand-authored cell-descriptor rows describing the exact same table
 * FIXTURE_HTML shows above -- see this module's header comment for why
 * this can't be derived from FIXTURE_HTML directly in this build step.
 */
const FIXTURE_CELL_ROWS = [
  [
    { text: 'City', isHeader: true },
    { text: 'Population', isHeader: true },
  ],
  [
    { text: 'Reno', isHeader: false },
    { text: '264165', isHeader: false },
  ],
  [
    { text: 'Boise', isHeader: false },
    { text: '235684', isHeader: false },
  ],
];

/**
 * @returns {{grid: string[][], headerRowCount: number}} the real result of
 *   running FIXTURE_CELL_ROWS through htmlTableExtract.mjs -- exported
 *   separately so test/examples.test.mjs can assert against the exact same
 *   computed result the page renders.
 */
export function convertFixture() {
  return normalizeTableRows(FIXTURE_CELL_ROWS);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw HTML markup, then an
 *   "Output" .table-scroll > .extracted-table of the real converted grid.
 */
export function render(escapeHtml) {
  const { grid, headerRowCount } = convertFixture();
  const hasHeader = headerRowCount > 0;
  const headerRow = hasHeader ? grid[0] : null;
  const bodyRows = hasHeader ? grid.slice(1) : grid;

  const headCells = headerRow
    ? `<thead><tr>${headerRow.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('')}</tr></thead>`
    : '';
  const bodyHtml = bodyRows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_HTML.trim())}</code></pre>
<p class="caption">Output</p>
<div class="table-scroll"><table class="extracted-table">${headCells}<tbody>${bodyHtml}</tbody></table></div>`;
}

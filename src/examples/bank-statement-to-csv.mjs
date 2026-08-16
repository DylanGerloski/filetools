/**
 * The bank-statement-to-csv example panel -- Pattern E ("extract-to-grid").
 * Demonstrates this tool's actual differentiator over plain pdf-to-csv:
 * combining a table that repeats its header across multiple pages into one
 * continuous table with the repeated header removed. See pdf-to-csv.mjs's
 * header comment for why the left column is a drawn stand-in rather than a
 * real source render, and src/pure/tableExtract.mjs /
 * src/pure/statementMerge.mjs for the two real pipeline stages this fixture
 * is run through (per-page extraction, then cross-page header-aware merge)
 * -- the same two stages ../browser/statementToCsv.client.js calls.
 *
 * Do not change the fixture without also updating
 * test/examples.test.mjs's assertions against mergeFixture()'s real
 * return value -- in particular the exact row count and row order, which
 * this module's copy also quotes.
 */

import { extractTables } from '../pure/tableExtract.mjs';
import { mergeStatementTables } from '../pure/statementMerge.mjs';
import { ruledSourcePage, svg } from '../pageStripDiagrams.mjs';

export const slug = 'bank-statement-to-csv';

export const ariaLabel = 'Two statement pages, each repeating the column header, combined into one 4-row transaction table with the repeated header removed';

export const note = 'Two pages, each repeating the header row. The repeat is detected and dropped; all 4 transactions combine into one table.';

function item(str, x, y, w, fontName) {
  return { str, x, y, width: w, height: 12, fontName };
}

// Page 1: header + 2 transactions. Page 2: the SAME header text repeated
// (as most statement PDFs do on every page) + 2 more transactions. Column
// gaps sized the same way pdf-to-csv.mjs's fixture is, for the same
// whitespace-gap column-detection reason.
const PAGE_1_ITEMS = [
  item('Date', 50, 100, 32, 'Helvetica-Bold'),
  item('Description', 150, 100, 72, 'Helvetica-Bold'),
  item('Amount', 320, 100, 48, 'Helvetica-Bold'),

  item('03/02', 50, 130, 32, 'Helvetica'),
  item('Coffee Shop', 150, 130, 64, 'Helvetica'),
  item('-4.50', 320, 130, 32, 'Helvetica'),

  item('03/05', 50, 160, 32, 'Helvetica'),
  item('Payroll Deposit', 150, 160, 88, 'Helvetica'),
  item('1200.00', 320, 160, 48, 'Helvetica'),
];

const PAGE_2_ITEMS = [
  item('Date', 50, 100, 32, 'Helvetica-Bold'),
  item('Description', 150, 100, 72, 'Helvetica-Bold'),
  item('Amount', 320, 100, 48, 'Helvetica-Bold'),

  item('03/09', 50, 130, 32, 'Helvetica'),
  item('Grocery Store', 150, 130, 72, 'Helvetica'),
  item('-62.13', 320, 130, 40, 'Helvetica'),

  item('03/14', 50, 160, 32, 'Helvetica'),
  item('Electric Co', 150, 160, 64, 'Helvetica'),
  item('-88.40', 320, 160, 40, 'Helvetica'),
];

/**
 * @returns {ReturnType<typeof mergeStatementTables>} the real result of
 *   running both pages through extractTables() (per-page detection, the
 *   same as pdf-to-csv.mjs) and then mergeStatementTables() (the
 *   cross-page header-dedup stage that's specific to this tool) --
 *   exported separately so test/examples.test.mjs can assert against the
 *   exact same computed result the page renders.
 */
export function mergeFixture() {
  const page1Tables = extractTables(PAGE_1_ITEMS).tables.map((t) => ({
    pageNum: 1,
    rows: t.rows,
    headerRowIndex: t.headerRowIndex,
  }));
  const page2Tables = extractTables(PAGE_2_ITEMS).tables.map((t) => ({
    pageNum: 2,
    rows: t.rows,
    headerRowIndex: t.headerRowIndex,
  }));
  return mergeStatementTables([...page1Tables, ...page2Tables]);
}

export function render(escapeHtml) {
  const { mainTable } = mergeFixture();

  const headCells = mainTable.headerRow.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('');
  const bodyRows = mainTable.rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  const outputTable = `<div class="table-scroll"><table class="extracted-table"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;

  const sourceDrawing = svg(
    `<text x="0" y="12" class="td-label">Page 1</text>${ruledSourcePage(2, 18, { w: 96, h: 78, rows: 3 })}` +
      `<text x="0" y="120" class="td-label">Page 2</text>${ruledSourcePage(2, 126, { w: 96, h: 78, rows: 3 })}`,
    'Two statement pages, each with a repeated column header',
    { viewBox: '0 0 100 216' }
  );

  return `<div class="example-before-after">
    <div class="example-ba-col example-ba-col--source">
      <p class="example-ba-label">Source (2 pages)</p>
      ${sourceDrawing}
    </div>
    <span class="example-ba-arrow" aria-hidden="true">&rarr;</span>
    <div class="example-ba-col">
      <p class="example-ba-label">Combined (${mainTable.rows.length} transactions)</p>
      ${outputTable}
    </div>
  </div>`;
}

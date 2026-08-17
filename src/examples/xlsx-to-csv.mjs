/**
 * The xlsx-to-csv example panel -- Pattern E ("extract-to-grid"). The input
 * is a real .xlsx workbook, which can't be unzipped/parsed at build time
 * (that needs fflate + DOMParser, both browser-side -- see
 * ../pure/xlsxGrid.mjs's header comment), so the left column is a drawn
 * stand-in for a source sheet (src/pageStripDiagrams.mjs's
 * ruledSourcePage() with sheetTabs, matching the `sheet` family icon's own
 * distinguishing motif in src/icons.js) rather than a real render. The
 * right column IS real: a tiny sparse cell list (the {row,col,text} shape
 * xlsxToCsv.client.js's own XML parsing produces) run through the tool's
 * OWN grid-assembly pipeline (buildGrid + expandMergedRanges).
 *
 * Fixture demonstrates a merged cell specifically -- xlsxGrid.mjs's own
 * job (expandMergedRanges) is exactly this: a value that visually spans
 * multiple cells in Excel becomes a plain grid with that value duplicated
 * into every cell the merge covered, so a CSV export (which has no concept
 * of a merged cell) doesn't silently leave one of them blank.
 *
 * Do not change the fixture without also updating
 * test/examples.test.mjs's assertions against gridFixture()'s real return
 * value.
 */

import { buildGrid, expandMergedRanges } from '../pure/xlsxGrid.mjs';
import { ruledSourcePage, svg } from '../pageStripDiagrams.mjs';

export const slug = 'xlsx-to-csv';

export const ariaLabel = 'A small sheet with a merged header cell, unmerged into a real 3-column grid with the header value duplicated';

export const note = 'A1:B1 was one merged "Region" cell in the sheet. Unmerged, its value fills both A1 and B1 rather than leaving one blank.';

const FIXTURE_CELLS = [
  { row: 0, col: 0, text: 'Region' }, // merged A1:B1 in the source sheet
  { row: 1, col: 0, text: 'North' },
  { row: 1, col: 1, text: 'Widget' },
  { row: 1, col: 2, text: '120' },
  { row: 2, col: 0, text: 'North' },
  { row: 2, col: 1, text: 'Gadget' },
  { row: 2, col: 2, text: '75' },
  { row: 3, col: 0, text: 'South' },
  { row: 3, col: 1, text: 'Widget' },
  { row: 3, col: 2, text: '60' },
];
const FIXTURE_MERGES = ['A1:B1'];

/**
 * @returns {string[][]} the real assembled grid for the fixture above --
 *   exported separately so test/examples.test.mjs can assert against the
 *   exact same computed result the page renders.
 */
export function gridFixture() {
  return expandMergedRanges(buildGrid(FIXTURE_CELLS), FIXTURE_MERGES);
}

export function render(escapeHtml) {
  const grid = gridFixture();
  const [headRow, ...dataRows] = grid;

  const headCells = headRow.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('');
  const bodyRows = dataRows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  const outputTable = `<div class="table-scroll"><table class="extracted-table"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;

  const sourceDrawing = svg(ruledSourcePage(2, 2, { w: 96, h: 114, rows: 3, sheetTabs: true }), 'A spreadsheet sheet with a merged header cell', { viewBox: '0 0 100 130' });

  return `<div class="example-before-after">
    <div class="example-ba-col example-ba-col--source">
      <p class="example-ba-label">Source sheet</p>
      ${sourceDrawing}
    </div>
    <span class="example-ba-arrow" aria-hidden="true">&rarr;</span>
    <div class="example-ba-col">
      <p class="example-ba-label">CSV grid</p>
      ${outputTable}
    </div>
  </div>`;
}

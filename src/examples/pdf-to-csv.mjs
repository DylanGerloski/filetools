/**
 * The pdf-to-csv example panel -- Pattern E ("extract-to-grid"). The input
 * is a real PDF, which can't be computed or rendered at build time, so the
 * left column is a drawn stand-in for a source page (src/pageStripDiagrams
 * .mjs's ruledSourcePage(), the Pattern-D visual language) rather than a
 * <pre> of "the input" the way Pattern C's code-based tools can show. The
 * right column IS real: a tiny set of positioned text items (the same
 * {str,x,y,width,height,fontName} shape ../browser/pdfTables.client.js
 * builds from pdf.js's getTextContent(), see ../pure/tableExtract.mjs's
 * header comment) run through the tool's OWN extraction pipeline
 * (extractTables()), so the table shown is a provably real result of that
 * code, not a mock -- see src/examples/index.mjs and compare-csv.mjs for
 * why that matters.
 *
 * Do not change the fixture without also updating
 * test/examples.test.mjs's assertions against extractFixture()'s real
 * return value.
 */

import { extractTables } from '../pure/tableExtract.mjs';
import { ruledSourcePage, svg } from '../pageStripDiagrams.mjs';

export const slug = 'pdf-to-csv';

export const ariaLabel = 'A small order table found on a PDF page, extracted into a real 3-column grid';

export const note = 'A 3-row order table, found by its column alignment and extracted into a CSV-ready grid.';

function item(str, x, y, w, fontName) {
  return { str, x, y, width: w, height: 12, fontName };
}

// A one-page order table: a bold header row (different font from the data
// rows, which is one of extractTables()'s own header signals -- see
// ../pure/tableExtract.mjs's looksLikeHeaderRow) plus 3 data rows. Column
// gaps (Item ends ~x114, Qty column starts x200; Qty ends ~x208, Price
// starts x300) are each comfortably past the whitespace-gap threshold
// computeColumnBoundaries() looks for, so the 3 columns separate reliably.
const FIXTURE_ITEMS = [
  item('Item', 50, 100, 32, 'Helvetica-Bold'),
  item('Qty', 200, 100, 24, 'Helvetica-Bold'),
  item('Price', 300, 100, 36, 'Helvetica-Bold'),

  item('Widget A', 50, 130, 64, 'Helvetica'),
  item('3', 200, 130, 8, 'Helvetica'),
  item('$9.50', 300, 130, 40, 'Helvetica'),

  item('Widget B', 50, 160, 64, 'Helvetica'),
  item('1', 200, 160, 8, 'Helvetica'),
  item('$14.00', 300, 160, 48, 'Helvetica'),

  item('Widget C', 50, 190, 64, 'Helvetica'),
  item('5', 200, 190, 8, 'Helvetica'),
  item('$21.75', 300, 190, 48, 'Helvetica'),
];

/**
 * @returns {ReturnType<typeof extractTables>} the real extraction result
 *   for the fixture above -- exported separately so
 *   test/examples.test.mjs can assert against the exact same computed
 *   result the page renders.
 */
export function extractFixture() {
  return extractTables(FIXTURE_ITEMS);
}

export function render(escapeHtml) {
  const { tables } = extractFixture();
  const table = tables[0];
  const headerIdx = table.headerRowIndex;

  const headCells = headerIdx === 0
    ? table.rows[0].map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('')
    : '';
  const dataRows = headerIdx === 0 ? table.rows.slice(1) : table.rows;
  const bodyRows = dataRows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  const outputTable = `<div class="table-scroll"><table class="extracted-table"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;

  const sourceDrawing = svg(ruledSourcePage(2, 2, { w: 96, h: 120, rows: 4 }), 'A PDF page with a small aligned table on it', { viewBox: '0 0 100 130' });

  return `<div class="example-before-after">
    <div class="example-ba-col example-ba-col--source">
      <p class="example-ba-label">Source (page 1)</p>
      ${sourceDrawing}
    </div>
    <span class="example-ba-arrow" aria-hidden="true">&rarr;</span>
    <div class="example-ba-col">
      <p class="example-ba-label">Extracted</p>
      ${outputTable}
    </div>
  </div>`;
}

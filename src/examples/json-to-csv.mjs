/**
 * The json-to-csv example panel -- Pattern C ("code-to-grid" -- an input
 * code block plus the real result rendered as a grid). Renders the tool's
 * OWN pure
 * module (jsonToCsv.mjs) run on a tiny authored fixture: a small "Input"
 * <pre><code> block of the raw JSON, and the REAL resulting column/row
 * grid rendered as an .extracted-table -- the same table markup
 * ../browser/jsonToCsv.client.js's own preview renders, so this panel is
 * provably identical in shape to the live result. See
 * src/examples/index.mjs and compare-csv.mjs for why a real computed
 * result beats a hand-drawn mock.
 *
 * Do not change the fixture without checking test/examples.test.mjs's
 * literal assertions against it still hold.
 */

import { parseJsonArray, jsonToCsvRows } from '../pure/jsonToCsv.mjs';

export const slug = 'json-to-csv';

export const ariaLabel = 'Example conversion of a small JSON array of objects into a CSV-ready grid';

export const note = 'A 3-record JSON array converted into a 3-column grid. Nested objects become dot-notation columns.';

// 5 lines -- comfortably inside the 6-8 line hard cap the spec sets for the
// input code block.
export const FIXTURE_TEXT = `[
  { "sku": "A100", "name": "Widget", "price": 9.5 },
  { "sku": "A101", "name": "Gadget", "price": 14 },
  { "sku": "A102", "name": "Gizmo", "price": 21.75 }
]
`;

/**
 * @returns {{columns: string[], dataRows: string[][]}} the real result of
 *   running the fixture through jsonToCsv.mjs -- exported separately so
 *   test/examples.test.mjs can assert against the exact same computed
 *   result the page renders, not a re-derived copy.
 */
export function convertFixture() {
  const parsed = parseJsonArray(FIXTURE_TEXT);
  if (!parsed.ok) throw new Error(`json-to-csv example fixture failed to parse: ${parsed.error}`);
  return jsonToCsvRows(parsed.records);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw JSON, then an
 *   "Output" .table-scroll > .extracted-table of the real converted grid --
 *   the code-to-grid shape section 3.4 specifies for this tool.
 */
export function render(escapeHtml) {
  const { columns, dataRows } = convertFixture();

  const headCells = columns.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('');
  const bodyRows = dataRows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT.trim())}</code></pre>
<p class="caption">Output</p>
<div class="table-scroll"><table class="extracted-table"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
}

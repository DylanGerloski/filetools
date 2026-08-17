/**
 * The split-csv example panel (Pattern B, "before-after-tables" -- see
 * src/examples/index.mjs for the module contract). Runs the tool's OWN
 * pure module (splitCsv.mjs) on a tiny fixture at build time and renders
 * the real result, so this panel inherits the site's existing table CSS
 * and can never drift from reality.
 *
 * Fixture: 5 data rows split at 3 rows per file, so the real output is two
 * uneven files (3 then 2 rows) -- the exact case that demonstrates the
 * tool splits by row count rather than into equal halves, and that the
 * header line is repeated in every output file.
 *
 * Do not change the fixture without also updating
 * test/examples.test.mjs's assertions against splitCsv()'s real return
 * value.
 */

import { splitCsv } from '../pure/splitCsv.mjs';

export const slug = 'split-csv';

export const ariaLabel = 'Example split of a 5-row CSV file into two smaller files, 3 rows then 2';

export const note = 'One file split into smaller ones by row count. The header row repeats in every output file.';

const INPUT_NAME = 'orders';
const INPUT_CSV = `id,name,amount
1,Alice,20
2,Bob,15
3,Cara,40
4,Drew,5
5,Elle,60
`;
const ROWS_PER_FILE = 3;

/**
 * @returns {ReturnType<typeof splitCsv>} the real split of the fixture
 *   above -- exported separately from render() so test/examples.test.mjs
 *   can assert against the exact same computed result the page renders.
 */
export function splitFixture() {
  return splitCsv(INPUT_CSV, { rowsPerFile: ROWS_PER_FILE, hasHeader: true, baseName: INPUT_NAME });
}

/**
 * @param {(str: *) => string} escapeHtml
 * @param {string[][]} rows including the repeated header row.
 */
function renderTable(escapeHtml, rows) {
  const [head, ...body] = rows;
  const headCells = head.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join('');
  const bodyRows = body
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="table-scroll"><table class="extracted-table"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an .example-before-after block: Input holds the one
 *   source file, Output holds the real generated file chunks (labeled by
 *   the same generated file names splitCsv() itself produces).
 */
export function render(escapeHtml) {
  const result = splitFixture();
  const inputRows = INPUT_CSV.trim().split('\n').map((line) => line.split(','));

  const outputHtml = result.files
    .map(
      (f) => `<p class="example-ba-label">${escapeHtml(f.name)}</p>
      ${renderTable(escapeHtml, f.rows)}`
    )
    .join('\n      ');

  return `<div class="example-before-after">
    <div class="example-ba-col">
      <p class="example-ba-label">Input</p>
      ${renderTable(escapeHtml, inputRows)}
    </div>
    <span class="example-ba-arrow" aria-hidden="true">&rarr;</span>
    <div class="example-ba-col">
      <p class="example-ba-label">Output (${escapeHtml(String(result.files.length))} files)</p>
      ${outputHtml}
    </div>
  </div>`;
}

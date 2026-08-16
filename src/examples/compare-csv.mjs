/**
 * The compare-csv example panel. Renders the tool's OWN pure module
 * (csvDiff.mjs) run on a tiny fixture, using the exact classes/attributes
 * the real client (src/browser/csvDiff.client.js) emits, so this panel
 * inherits the site's existing diff-table CSS with zero new rules and is
 * provably identical in appearance to the live result -- see
 * src/examples/index.mjs for why this beats a hand-drawn mock (it cannot
 * drift from reality).
 *
 * Do not change the fixture without also updating
 * test/examples.test.mjs's literal status assertions, which exist
 * precisely so a change to the diff algorithm breaks this test rather
 * than silently shipping a wrong picture.
 */

import { diffCsvFiles } from '../pure/csvDiff.mjs';

export const slug = 'compare-csv';

export const ariaLabel = 'Example comparison of two 4-row CSV files, matched by the id column';

export const note = 'Two 4-row files compared by the id column. Rows that moved still match.';

const FILE_A = `id,name,plan,seats
1001,Northwind,Team,12
1002,Contoso,Team,4
1003,Fabrikam,Free,1
1005,Adventure Works,Team,7
`;

const FILE_B = `id,name,plan,seats
1001,Northwind,Team,12
1002,Contoso,Business,9
1004,Tailspin,Free,2
1005,Adventure Works,Team,7
`;

/** Mirrors src/browser/csvDiff.client.js's STATUS_LABEL exactly, so the
 * generated example reads identically to the live result. */
const STATUS_LABEL = {
  unchanged: 'Unchanged',
  changed: 'Changed',
  added: 'Added',
  removed: 'Removed',
};

/** Mirrors src/browser/csvDiff.client.js's columnLabel() exactly. */
function columnLabel(outcome, col) {
  const fromB = outcome.headerB && col < outcome.headerB.length ? outcome.headerB[col].trim() : '';
  const fromA = outcome.headerA && col < outcome.headerA.length ? outcome.headerA[col].trim() : '';
  return fromB || fromA || `Column ${col + 1}`;
}

/**
 * @returns {ReturnType<typeof diffCsvFiles>} the real diff of the fixture
 *   above -- exported separately from render() so test/examples.test.mjs
 *   can assert against the exact same computed result the page renders,
 *   not a re-derived copy.
 */
export function diffFixture() {
  return diffCsvFiles(FILE_A, FILE_B);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an <div class="table-scroll"> wrapping an
 *   .extracted-table, matching csvDiff.client.js's renderResult() markup
 *   cell for cell (status column first, data-diff-status on each <tr>,
 *   data-diff-cell="changed" plus .diff-cell-old/.diff-cell-new on a
 *   changed cell). All 5 rows are shown -- the client's "show unchanged
 *   rows" toggle is intentionally not replicated here, since a static
 *   control that does nothing would read as broken.
 */
export function render(escapeHtml) {
  const outcome = diffFixture();

  const headCells = [`<th scope="col">${escapeHtml('Status')}</th>`]
    .concat(
      Array.from({ length: outcome.columnCount }, (_, c) => `<th scope="col">${escapeHtml(columnLabel(outcome, c))}</th>`)
    )
    .join('');

  const bodyRows = outcome.rows
    .map((r) => {
      const cells = [
        `<td class="diff-status-cell" data-diff-status="${escapeHtml(r.status)}">${escapeHtml(STATUS_LABEL[r.status])}</td>`,
      ];
      for (let c = 0; c < outcome.columnCount; c += 1) {
        if (r.status === 'changed' && r.changedCells.includes(c)) {
          const av = r.a && c < r.a.length ? r.a[c] : '';
          const bv = r.b && c < r.b.length ? r.b[c] : '';
          cells.push(
            `<td data-diff-cell="changed"><span class="diff-cell-old">${escapeHtml(av)}</span><span class="diff-cell-new">${escapeHtml(bv)}</span></td>`
          );
        } else {
          const src = r.b || r.a || [];
          const v = c < src.length ? src[c] : '';
          cells.push(`<td>${escapeHtml(v)}</td>`);
        }
      }
      return `<tr data-diff-status="${escapeHtml(r.status)}">${cells.join('')}</tr>`;
    })
    .join('');

  return `<div class="table-scroll"><table class="extracted-table"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
}

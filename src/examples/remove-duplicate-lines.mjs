/**
 * The remove-duplicate-lines example panel (Pattern B, "before-after-
 * tables" -- see src/examples/index.mjs for the module contract). Runs the
 * tool's OWN pure module (dedupeLines.mjs) on a tiny fixture at build time
 * and renders the real result, so this panel inherits the site's existing
 * table CSS and can never drift from reality.
 *
 * The one tool among this pattern's tools where a row is genuinely
 * removed, so this is the one that uses the same data-diff-status row
 * tinting as Pattern A
 * (compare-csv): every duplicate line in the Input table gets
 * data-diff-status="removed" (the same .extracted-table red-tint rule
 * compare-csv's example already relies on -- no new CSS) plus a Status
 * column using .diff-status-cell, since color is never the sole carrier of
 * meaning. Output shows only what src/browser/dedupeLines.client.js's own
 * live result actually renders: the kept lines, in original order.
 *
 * Do not change the fixture without also updating
 * test/examples.test.mjs's assertions against dedupeLines()'s real return
 * value.
 */

import { dedupeLines } from '../pure/dedupeLines.mjs';

export const slug = 'remove-duplicate-lines';

export const ariaLabel = 'Example removal of duplicate lines from a 5-line list, keeping the first occurrence of each';

export const note = 'Exact duplicate lines are removed, keeping the first occurrence. Everything else keeps its original order.';

const INPUT_LINES = ['apple', 'banana', 'apple', 'cherry', 'banana'];

/**
 * @returns {ReturnType<typeof dedupeLines>} the real dedupe of the fixture
 *   above -- exported separately from render() so test/examples.test.mjs
 *   can assert against the exact same computed result the page renders.
 */
export function dedupeFixture() {
  return dedupeLines(INPUT_LINES);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an .example-before-after block: Input holds every
 *   original line with a Status column (Kept/Duplicate), Output holds only
 *   the kept lines -- matching the live tool's own result, which never
 *   shows a removed line at all.
 */
export function render(escapeHtml) {
  const outcome = dedupeFixture();
  const removedSet = new Set(outcome.removedIndices);

  const inputRows = INPUT_LINES.map((line, i) => {
    const status = removedSet.has(i) ? 'removed' : 'unchanged';
    const label = removedSet.has(i) ? 'Duplicate' : 'Kept';
    return `<tr data-diff-status="${escapeHtml(status)}"><td class="diff-status-cell" data-diff-status="${escapeHtml(status)}">${escapeHtml(label)}</td><td>${escapeHtml(line)}</td></tr>`;
  }).join('');
  const inputTable = `<div class="table-scroll"><table class="extracted-table"><thead><tr><th scope="col">Status</th><th scope="col">Line</th></tr></thead><tbody>${inputRows}</tbody></table></div>`;

  const outputRows = outcome.kept.map((line) => `<tr><td>${escapeHtml(line)}</td></tr>`).join('');
  const outputTable = `<div class="table-scroll"><table class="extracted-table"><thead><tr><th scope="col">Line</th></tr></thead><tbody>${outputRows}</tbody></table></div>`;

  return `<div class="example-before-after">
    <div class="example-ba-col">
      <p class="example-ba-label">Input</p>
      ${inputTable}
    </div>
    <span class="example-ba-arrow" aria-hidden="true">&rarr;</span>
    <div class="example-ba-col">
      <p class="example-ba-label">Output</p>
      ${outputTable}
    </div>
  </div>`;
}

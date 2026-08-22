/**
 * The word-frequency-counter example panel. Runs the tool's OWN pure
 * module (wordFrequency.mjs) on a tiny fixture at build time and renders
 * the real result, so this panel inherits the site's existing table CSS
 * and can never drift from reality -- same discipline as
 * ../examples/sort-lines.mjs.
 *
 * This tool has no "before" state to show (there's no source format being
 * transformed, just one text turned into one ranked table), so unlike
 * Pattern B's before-after-tables shape (sort-lines.mjs, remove-
 * duplicate-lines.mjs) this renders a single output table only -- the
 * same "no computed result to diff against" reasoning
 * ../examples/merge-pdf.mjs's header comment documents for a
 * page-level operation, except here there IS a real computed result
 * (just no meaningful "before" to pair it with).
 */

import { computeWordFrequency } from '../pure/wordFrequency.mjs';

export const slug = 'word-frequency-counter';

export const ariaLabel = 'Example word frequency table for a short sample sentence';

export const note = 'Counted with default options (case-insensitive, no filters). Your own text is read on your device and never uploaded.';

const SAMPLE_TEXT = 'The quick brown fox jumps over the lazy dog. The dog barks, but the fox is already gone.';

/**
 * @returns {ReturnType<typeof computeWordFrequency>} the real frequency
 *   count of the fixture above -- exported separately from render() so
 *   test/examples.test.mjs can assert against the exact same computed
 *   result the page renders.
 */
export function frequencyFixture() {
  return computeWordFrequency(SAMPLE_TEXT, {});
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an .example-before-after-free-standing table block:
 *   the top 5 ranked words from the fixture, same column shape (Rank,
 *   Word, Count, % of total) as the tool's own live result table.
 */
export function render(escapeHtml) {
  const outcome = frequencyFixture();
  const top = outcome.entries.slice(0, 5);

  const rows = top
    .map(
      (entry, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(entry.word)}</td><td>${entry.count}</td><td>${entry.percent.toFixed(1)}%</td></tr>`
    )
    .join('');

  return `<div class="table-scroll"><table class="extracted-table"><thead><tr><th scope="col">Rank</th><th scope="col">Word</th><th scope="col">Count</th><th scope="col">% of total</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

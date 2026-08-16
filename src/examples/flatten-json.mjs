/**
 * The flatten-json example panel -- Pattern C ("code-to-code" -- an input
 * code block plus the real result rendered as a second code block).
 * Renders the tool's OWN pure module (flattenJson.mjs) run on a tiny
 * authored fixture: an "Input" <pre><code> of the raw nested JSON, and the
 * REAL flattened records as an "Output" <pre><code>, with each flattened
 * key styled at `font-weight: var(--weight-medium)` -- the keys are the
 * whole point of this tool (a nested path collapsed into one dot-notation
 * name), so they carry the visual emphasis, not the values. The weight is
 * applied via an inline `style` attribute referencing the design-tokens
 * custom property directly, rather than a new CSS class, since no other
 * element on this page needs that same emphasis; if that changes, this can
 * switch to a dedicated class.
 */

import { detectMode, flattenRecords, flattenValue } from '../pure/flattenJson.mjs';

export const slug = 'flatten-json';

export const ariaLabel = 'Example flattening of nested JSON objects into dot-notation keys';

export const note = 'Nested objects become dot-notation keys (customer.name) so every record is one flat level deep.';

// 4 lines -- inside the 6-8 line hard cap.
export const FIXTURE_TEXT = `[
  { "order": "A1", "customer": { "name": "Priya", "city": "Austin" } },
  { "order": "A2", "customer": { "name": "Omar", "city": "Reno" } }
]
`;

const FLATTEN_OPTIONS = { delimiter: '.', flattenArrays: true };

/**
 * @returns {Object[]} the real flattened records -- exported separately so
 *   test/examples.test.mjs can assert against the exact same computed
 *   result the page renders, not a re-derived copy.
 */
export function flattenFixture() {
  const parsed = JSON.parse(FIXTURE_TEXT);
  const mode = detectMode(parsed);
  if (mode === 'records') return flattenRecords(parsed, FLATTEN_OPTIONS);
  // Not reached by the current fixture (an array of plain objects always
  // detects as 'records') -- kept for honesty about what detectMode can
  // return, mirroring ../browser/flattenJson.client.js's own two-mode
  // handling, rather than assuming 'records' is the only possible shape.
  return [flattenValue(parsed, FLATTEN_OPTIONS)];
}

/**
 * @param {*} value a flattened leaf value (string/number/boolean/null, or
 *   an object/array leaf per flattenJson.mjs's own documented behavior).
 * @returns {string} JSON-literal text for that value.
 */
function valueLiteral(value) {
  if (value === undefined) return 'null';
  return JSON.stringify(value);
}

/**
 * @param {Object[]} flatRecords
 * @param {(str: *) => string} escapeHtml
 * @returns {string} a JSON-array-shaped text block, hand-built (not
 *   JSON.stringify + regex) so each key can be individually wrapped in the
 *   weight-medium span this module's header comment explains.
 */
function renderFlatRecordsAsCode(flatRecords, escapeHtml) {
  const records = flatRecords.map((rec) => {
    const lines = Object.keys(rec).map((key, i, arr) => {
      const comma = i < arr.length - 1 ? ',' : '';
      const keySpan = `<span style="font-weight:var(--weight-medium)">${escapeHtml(JSON.stringify(key))}</span>`;
      return `    ${keySpan}: ${escapeHtml(valueLiteral(rec[key]))}${comma}`;
    });
    return `  {\n${lines.join('\n')}\n  }`;
  });
  return `[\n${records.join(',\n')}\n]`;
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw nested JSON, then an
 *   "Output" <pre><code> of the real flattened records, with each key at
 *   weight-medium.
 */
export function render(escapeHtml) {
  const flatRecords = flattenFixture();

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT.trim())}</code></pre>
<p class="caption">Output</p>
<pre class="json-preview"><code>${renderFlatRecordsAsCode(flatRecords, escapeHtml)}</code></pre>`;
}

/**
 * The html-entity-encode-decode example panel -- Pattern C ("code-to-code":
 * an input code block plus the real result rendered as a second code
 * block), same shape as src/examples/yaml-to-json.mjs. Runs the tool's OWN
 * pure module (htmlEntity.mjs) on a tiny fixture at build time and renders
 * the real result, so this panel can never drift from what the live tool
 * actually does.
 *
 * Shows the Encode direction specifically (the tool itself defaults to
 * Encode too -- see src/browser/htmlEntity.client.js's initial
 * optionState), with default options (scope: 'reserved', format: 'named'),
 * so the fixture demonstrates exactly what a first-time visitor sees: only
 * the five HTML-significant characters are escaped, and the accented
 * letter is left untouched since "encode all non-ASCII" is off by default.
 */

import { encodeHtmlEntities } from '../pure/htmlEntity.mjs';

export const slug = 'html-entity-encode-decode';

export const ariaLabel = 'Example encoding of text containing HTML-significant characters into HTML entities';

export const note = 'Only the five HTML-significant characters are escaped by default; café’s accented letter is left as-is unless you turn on "encode all non-ASCII characters".';

// One line, inside the site's short-fixture convention (compare
// yaml-to-json.mjs's 5-line cap for a multi-line fixture).
export const FIXTURE_TEXT = 'Tom & Jerry\'s café <b>bold</b> "quote"';

/**
 * @returns {ReturnType<typeof encodeHtmlEntities>} the real encode of the
 *   fixture above, with the tool's own default options -- exported
 *   separately so test/examples.test.mjs can assert against the exact same
 *   computed result the page renders.
 */
export function convertFixture() {
  return encodeHtmlEntities(FIXTURE_TEXT, { scope: 'reserved', format: 'named' });
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw text, then an
 *   "Output" <pre><code> of the real encoded result.
 */
export function render(escapeHtml) {
  const outcome = convertFixture();

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT)}</code></pre>
<p class="caption">Output</p>
<pre class="json-preview"><code>${escapeHtml(outcome.output)}</code></pre>`;
}

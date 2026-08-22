/**
 * The base64-encode-decode example panel -- Pattern C ("code-to-code" -- an
 * input code block plus the real result rendered as a second code block),
 * the same pattern src/examples/yaml-to-json.mjs uses. Runs the tool's OWN
 * pure module (base64.mjs) on a tiny fixture at build time and renders the
 * real result, so this panel inherits the site's existing preview CSS and
 * can never drift from reality.
 */

import { encodeTextToBase64 } from '../pure/base64.mjs';

export const slug = 'base64-encode-decode';

export const ariaLabel = 'Example Base64 encoding of a short piece of text';

export const note = 'Plain text encoded to Base64. Decode mode reverses the same conversion.';

// Short enough to read at a glance, and includes a non-ASCII character so
// the example also demonstrates the UTF-8 handling the tool's FAQ and
// test suite both cover.
export const FIXTURE_TEXT = 'filetools: café edition';

/**
 * @returns {string} the real Base64 encoding of FIXTURE_TEXT -- exported
 *   separately from render() so test/examples.test.mjs can assert against
 *   the exact same computed result the page renders.
 */
export function encodeFixture() {
  return encodeTextToBase64(FIXTURE_TEXT);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw text, then an
 *   "Output" <pre><code> of the real encoded Base64.
 */
export function render(escapeHtml) {
  const encoded = encodeFixture();

  return `<p class="caption">Input (text)</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT)}</code></pre>
<p class="caption">Output (Base64)</p>
<pre class="json-preview"><code>${escapeHtml(encoded)}</code></pre>`;
}

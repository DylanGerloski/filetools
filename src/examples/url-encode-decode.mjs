/**
 * The url-encode-decode example panel -- Pattern C ("code-to-code" -- an
 * input code block plus the real result rendered as a second code block).
 * Renders the tool's OWN pure module (urlEncode.mjs) fed a tiny authored
 * fixture: an "Input" <pre><code> of the raw text, and the REAL resulting
 * percent-encoded text as an "Output" <pre><code> -- the same "run the real
 * code" principle src/examples/index.mjs's header explains for every
 * example, and the same structure src/examples/yaml-to-json.mjs uses.
 */

import { encodeUrlText, decodeUrlText } from '../pure/urlEncode.mjs';

export const slug = 'url-encode-decode';

export const ariaLabel = 'Example of text encoded as a URL-safe string, and decoded back';

export const note = 'A short piece of text with a space and an accented letter, encoded then decoded back to the original.';

// Chosen to show three things a plain-ASCII fixture wouldn't: a space
// (-> %20), a reserved character (& -> %26), and a multi-byte UTF-8
// character (é -> %C3%A9).
export const FIXTURE_TEXT = 'café & code';

/**
 * @returns {string} the real percent-encoded result of running the fixture
 *   through this tool's own encodeUrlText -- exported separately so
 *   test/examples.test.mjs can assert against the exact same computed
 *   result the page renders.
 */
export function encodeFixture() {
  return encodeUrlText(FIXTURE_TEXT);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw text, then an
 *   "Output" <pre><code> of the real percent-encoded result.
 */
export function render(escapeHtml) {
  const encoded = encodeFixture();
  const decoded = decodeUrlText(encoded);
  if (!decoded.ok || decoded.value !== FIXTURE_TEXT) {
    throw new Error(`url-encode-decode example fixture failed to round-trip: ${decoded.ok ? decoded.value : decoded.error}`);
  }

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT)}</code></pre>
<p class="caption">Output</p>
<pre class="json-preview"><code>${escapeHtml(encoded)}</code></pre>`;
}

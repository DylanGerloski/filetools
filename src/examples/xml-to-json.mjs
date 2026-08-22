/**
 * The xml-to-json example panel -- Pattern C ("code-to-code", same pattern
 * ../examples/yaml-to-json.mjs uses: an input code block plus the real
 * result rendered as a second code block).
 *
 * Renders the tool's OWN pure module (../pure/xmlToJson.mjs's
 * documentToJsonValue) fed a hand-authored PlainXmlNode describing exactly
 * the same small document FIXTURE_XML shows as text. Unlike yaml-to-json's
 * example (which can call js-yaml directly, a real Node dependency), this
 * tool's actual parsing step is the browser's own DOMParser -- not
 * available in this Node build step (see
 * ../examples/html-table-to-csv.mjs's header for the same constraint on
 * another DOMParser-based tool). FIXTURE_ROOT_NODE is hand-authored to
 * describe exactly the same document FIXTURE_XML shows, so the two must be
 * kept in sync by hand if either changes -- test/examples.test.mjs's
 * literal assertions exist to catch a drift between them.
 */

import { documentToJsonValue } from '../pure/xmlToJson.mjs';

export const slug = 'xml-to-json';

export const ariaLabel = 'Example conversion of a small XML document into JSON';

export const note = 'An attribute becomes an "@" key; child elements become their own keys.';

// 5 lines -- inside the 6-8 line hard cap.
export const FIXTURE_XML = `<order id="1">
  <item>Coffee</item>
  <price>4.50</price>
</order>
`;

/**
 * Hand-authored PlainXmlNode describing the exact same document
 * FIXTURE_XML shows above -- see this module's header comment for why
 * this can't be derived from FIXTURE_XML directly in this build step. The
 * whitespace-only text nodes between <item> and <price> mirror exactly
 * what a real DOMParser would hand ../browser/xmlToJson.client.js's
 * domElementToPlainNode() for this indented source text.
 */
const FIXTURE_ROOT_NODE = {
  tag: 'order',
  attrs: [['id', '1']],
  children: [
    { type: 'text', text: '\n  ' },
    { type: 'element', node: { tag: 'item', attrs: [], children: [{ type: 'text', text: 'Coffee' }] } },
    { type: 'text', text: '\n  ' },
    { type: 'element', node: { tag: 'price', attrs: [], children: [{ type: 'text', text: '4.50' }] } },
    { type: 'text', text: '\n' },
  ],
};

/**
 * @returns {string} pretty-printed JSON text, the real result of running
 *   FIXTURE_ROOT_NODE through xmlToJson.mjs's own documentToJsonValue --
 *   exported separately so test/examples.test.mjs can assert against the
 *   exact same computed result the page renders.
 */
export function convertFixture() {
  return JSON.stringify(documentToJsonValue(FIXTURE_ROOT_NODE), null, 2);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw XML, then an
 *   "Output" <pre><code> of the real converted JSON.
 */
export function render(escapeHtml) {
  const jsonText = convertFixture();

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_XML.trim())}</code></pre>
<p class="caption">Output</p>
<pre class="json-preview"><code>${escapeHtml(jsonText)}</code></pre>`;
}

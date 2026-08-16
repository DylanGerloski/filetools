/**
 * The yaml-to-json example panel -- Pattern C ("code-to-code" -- an input
 * code block plus the real result rendered as a second code block).
 * Renders the tool's OWN pure
 * module (yamlToJson.mjs) fed a REAL js-yaml parse of a tiny authored
 * fixture: an "Input" <pre><code> of the raw YAML, and the REAL resulting
 * JSON text as an "Output" <pre><code> -- js-yaml is a real npm dependency
 * (package.json, pinned 4.3.1) with a proper ESM build, so this module
 * imports it directly rather than mocking a parse result, the same "run
 * the real code" principle src/examples/index.mjs's header explains for
 * every example.
 */

import yaml from 'js-yaml';
import { combineDocuments, jsonSafeValue, formatYamlError } from '../pure/yamlToJson.mjs';

export const slug = 'yaml-to-json';

export const ariaLabel = 'Example conversion of a small YAML document into JSON';

export const note = 'A single YAML document converted into JSON.';

// 5 lines -- inside the 6-8 line hard cap.
export const FIXTURE_TEXT = `name: Widget
price: 9.5
tags:
  - hardware
  - sale
`;

/**
 * @returns {string} pretty-printed JSON text, the real result of running
 *   the fixture through js-yaml's loadAll() and yamlToJson.mjs's own
 *   combineDocuments/jsonSafeValue -- exported separately so
 *   test/examples.test.mjs can assert against the exact same computed
 *   result the page renders.
 */
export function convertFixture() {
  const docs = yaml.loadAll(FIXTURE_TEXT);
  const combined = combineDocuments(docs);
  if (!combined.ok) throw new Error(`yaml-to-json example fixture failed: ${formatYamlError({ message: combined.error })}`);
  return JSON.stringify(jsonSafeValue(combined.value), null, 2);
}

/**
 * @param {(str: *) => string} escapeHtml
 * @returns {string} an "Input" <pre><code> of the raw YAML, then an
 *   "Output" <pre><code> of the real converted JSON.
 */
export function render(escapeHtml) {
  const jsonText = convertFixture();

  return `<p class="caption">Input</p>
<pre class="json-preview"><code>${escapeHtml(FIXTURE_TEXT.trim())}</code></pre>
<p class="caption">Output</p>
<pre class="json-preview"><code>${escapeHtml(jsonText)}</code></pre>`;
}

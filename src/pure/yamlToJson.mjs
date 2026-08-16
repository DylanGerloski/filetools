/**
 * YAML -> JSON shaping logic -- the shared math behind the "convert YAML to
 * JSON" tool. js-yaml (dist/js-yaml.mjs, vendored -- see
 * ../browser/yamlToJson.client.js's header) does the actual YAML parsing
 * via its loadAll(); this module only combines/JSON-safes what that
 * already-parsed result contains and turns a caught error into a friendly
 * message. Pure data in, pure data out -- no js-yaml import, no DOM --
 * directly unit-testable in Node (test/yamlToJson.test.mjs), same
 * pure/browser split ../pure/xlsxExtract.mjs uses for exceljs.
 *
 * A YAML file can hold more than one "document" (each starting with a
 * `---` separator). This is documented behavior, not a silent choice: one
 * document converts to that document's own JSON value at the top level;
 * two or more convert to a JSON array holding each document in order --
 * the same reasoning a `yamlToJsonResult`'s caller (the tool page's FAQ)
 * states in plain language.
 */

/**
 * @param {*[]} docs the array js-yaml's loadAll() returns -- one entry per
 *   `---`-separated YAML document, already truthy-checked as non-empty by
 *   the caller (the client reads and trims the raw text before ever
 *   calling loadAll(), the same "empty input" guard
 *   ../pure/jsonToCsv.mjs's parseJsonArray uses -- so an empty `docs` here
 *   should not normally happen, but is still handled rather than trusted).
 * @returns {{ok:true, value:*, multiDoc:boolean} | {ok:false, error:string}}
 */
export function combineDocuments(docs) {
  if (!Array.isArray(docs) || docs.length === 0) {
    return { ok: false, error: 'That YAML is empty - there’s nothing to convert.' };
  }
  if (docs.length === 1) {
    return { ok: true, value: docs[0], multiDoc: false };
  }
  return { ok: true, value: docs, multiDoc: true };
}

/**
 * JSON has no representation for NaN or +/-Infinity -- `JSON.stringify`
 * silently turns each into the literal `null`, which would quietly drop
 * real data a visitor's YAML actually contained (YAML's core schema
 * supports `.nan`, `.inf`, and `-.inf` as real numeric scalars). Rather
 * than let that happen invisibly, this walks the parsed value and turns
 * each into its plain string name instead, so the JSON output still shows
 * "NaN"/"Infinity"/"-Infinity" as a visible string cell rather than
 * silently becoming indistinguishable from a real `null`.
 *
 * A `Date` (from a YAML `!!timestamp`) is left as-is here -- `JSON.
 * stringify` already calls its native `.toJSON()` (an ISO 8601 string) on
 * its own, no special-casing needed, matching ../pure/xlsxExtract.mjs's
 * same ISO-string choice for a spreadsheet date cell.
 *
 * @param {*} value
 * @returns {*} a value safe to pass to `JSON.stringify` with no silent
 *   data loss.
 */
export function jsonSafeValue(value) {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (value === Infinity) return 'Infinity';
    if (value === -Infinity) return '-Infinity';
    return value;
  }
  if (Array.isArray(value)) return value.map(jsonSafeValue);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [key, v] of Object.entries(value)) out[key] = jsonSafeValue(v);
    return out;
  }
  return value;
}

/**
 * @param {Error} err a caught js-yaml YAMLException (or any Error-shaped
 *   object -- tested with a plain `{message}` too, so this doesn't need a
 *   real js-yaml import to unit-test).
 * @returns {string} a one-line, plain-English message. js-yaml's own
 *   `.message` already names the reason and a "(line:column)" location on
 *   its first line, followed by a multi-line ASCII code-snippet the tool
 *   page's single-line alert box has no layout for (see
 *   ../pages/toolPage.js's `.alert` -- no `white-space: pre-wrap`) -- so
 *   only that first line is kept, wrapped in the same plain-English framing
 *   every other parse error on this site uses (compare
 *   ../pure/jsonToCsv.mjs's parseJsonArray).
 */
export function formatYamlError(err) {
  const raw = err && typeof err.message === 'string' ? err.message : '';
  const reason = raw.split('\n')[0].trim();
  const detail = reason || 'the syntax couldn’t be parsed';
  return `That isn’t valid YAML - ${detail}. Check the indentation and syntax there and try again.`;
}

/**
 * Turns a JSON array of objects into a rectangular row grid ready for
 * ../pure/csv.mjs's rowsToCsv. Pure data in, pure data out -- no DOM --
 * directly unit-testable in Node (test/jsonToCsv.test.mjs) and loaded
 * client-side the same way every other src/pure/*.mjs module is.
 *
 * DOCUMENTED FLATTENING BEHAVIOR (also stated on the tool page's FAQ, so
 * this isn't a silent choice a visitor has to reverse-engineer from the
 * output): a nested object is flattened into dot-notation columns
 * (`{"address":{"city":"Reno"}}` -> a column named `address.city`); an
 * array value at any depth is NOT expanded into columns -- it's kept as one
 * cell containing that array's compact JSON text (so column count stays
 * predictable regardless of how many items a nested array happens to have).
 * `null`/`undefined` become an empty cell, not the string "null".
 */

/**
 * @param {*} v
 * @returns {boolean} true for a non-null, non-array object -- the only
 *   shape this module recurses into when flattening.
 */
export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * @param {*} value a leaf value (anything that isn't a plain object, which
 *   flattenRecord recurses into instead of calling this on).
 * @returns {string} the CSV cell text for that value.
 */
export function flattenValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * @param {*} record one element of the top-level JSON array. Usually a
 *   plain object; a non-object element (a bare string/number/boolean/null,
 *   or an array) is accepted too and mapped to a single "value" column
 *   rather than rejected, so a visitor whose JSON is "almost" an array of
 *   objects still gets a usable CSV instead of a hard error.
 * @param {string} [prefix] internal recursion accumulator -- callers omit
 *   this.
 * @returns {Object<string,string>} flat key -> CSV-ready string cell.
 */
export function flattenRecord(record, prefix = '') {
  if (!isPlainObject(record)) {
    return { [prefix || 'value']: flattenValue(record) };
  }
  const out = {};
  for (const [key, value] of Object.entries(record)) {
    const flatKey = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      Object.assign(out, flattenRecord(value, flatKey));
    } else {
      out[flatKey] = flattenValue(value);
    }
  }
  return out;
}

/**
 * @param {Object<string,string>[]} flatRecords
 * @returns {string[]} every key seen across every record, in first-
 *   appearance order (not alphabetized) -- so column order tracks the
 *   input's own field order, which is the least surprising choice.
 */
export function collectColumns(flatRecords) {
  const seen = new Set();
  const columns = [];
  flatRecords.forEach((rec) => {
    Object.keys(rec).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    });
  });
  return columns;
}

/**
 * @param {string} text raw pasted/uploaded text.
 * @returns {{ok:true, records:*[]} | {ok:false, error:string}} a friendly,
 *   specific error rather than letting a raw JSON.parse SyntaxError reach
 *   the visitor.
 */
export function parseJsonArray(text) {
  const trimmed = String(text == null ? '' : text).trim();
  if (!trimmed) {
    return { ok: false, error: 'That’s empty — paste or drop some JSON first.' };
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return { ok: false, error: 'That isn’t valid JSON — check for a missing comma, bracket, or quote and try again.' };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'The top-level JSON value needs to be an array, like [ {"name": "Coffee"}, {"name": "Tea"} ] — an object or a bare value on its own can’t become CSV rows.' };
  }
  if (parsed.length === 0) {
    return { ok: false, error: 'That JSON array is empty — there’s nothing to convert.' };
  }
  return { ok: true, records: parsed };
}

/**
 * @param {*[]} records the parsed top-level array (parseJsonArray's
 *   `.records`).
 * @returns {{ columns: string[], header: string[], dataRows: string[][],
 *   flatRecords: Object<string,string>[] }} columns/header are the same
 *   array (kept as two names so callers reading "header" don't need to know
 *   it's derived from "columns"); dataRows is ready to concat with [header]
 *   and pass to ../pure/csv.mjs's rowsToCsv. Falls back to a single "value"
 *   column if every record flattened to zero keys (e.g. an array of `{}`),
 *   so the output is never a header-less, zero-column CSV.
 */
export function jsonToCsvRows(records) {
  const flatRecords = records.map((record) => flattenRecord(record));
  let columns = collectColumns(flatRecords);
  if (!columns.length) columns = ['value'];
  const dataRows = flatRecords.map((rec) => columns.map((col) => (rec[col] !== undefined ? rec[col] : '')));
  return { columns, header: columns.slice(), dataRows, flatRecords };
}

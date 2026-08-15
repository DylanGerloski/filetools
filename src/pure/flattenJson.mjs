/**
 * Nested-JSON-flattening logic -- the shared math behind the "flatten
 * nested JSON" tool. Pure data in, pure data out -- no DOM, no JSON.parse
 * of untrusted text here (the caller does that and handles the parse
 * error) -- directly unit-testable in Node (test/flattenJson.test.mjs) and
 * loaded client-side the same way every other src/pure/*.mjs module is.
 *
 * Two output shapes, chosen by detectMode() below:
 *  - "records": the top-level value is an array whose every element is a
 *    plain object (or an empty array) -- suited to a table, one row per
 *    element, columns = every flattened key seen across all elements.
 *  - "single": a plain object, or an array that mixes objects with
 *    anything else -- suited to one flat key/value list.
 *  - "invalid": a bare JSON primitive at the top level (a valid JSON
 *    document can be just `"hello"`, `42`, `true`, or `null`) -- there is
 *    nothing to flatten, so the tool page shows a friendly refusal instead
 *    of a one-entry table keyed by an empty string.
 */

/** @param {*} v @returns {boolean} true for a non-null, non-array object. */
export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * @param {*} parsed the JSON.parse()'d top-level value.
 * @returns {'records'|'single'|'invalid'}
 */
export function detectMode(parsed) {
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return 'records';
    return parsed.every(isPlainObject) ? 'records' : 'single';
  }
  if (isPlainObject(parsed)) return 'single';
  return 'invalid';
}

/**
 * @param {*} value any JSON-parsed value (object, array, or primitive).
 * @param {{delimiter?: string, flattenArrays?: boolean}} [options]
 *   delimiter (default '.'): joins a parent path and a child key/index --
 *     e.g. {a:{b:1}} with delimiter '.' flattens to key "a.b".
 *   flattenArrays (default true): false keeps every array as a single leaf
 *     value (not exploded into per-index keys) -- see cellText()/JSON
 *     download for how that leaf is serialized.
 * @returns {Object<string, *>} a flat object keyed by delimiter-joined
 *   path. Leaf values are primitives (string/number/boolean/null) or, for
 *   an empty object/array (nothing further to flatten into) or any array
 *   when flattenArrays is false, the object/array itself -- so `{"a":{}}`
 *   flattens to `{"a":{}}`, not silently disappearing.
 */
export function flattenValue(value, options = {}) {
  const { delimiter = '.', flattenArrays = true } = options;
  const out = {};

  function joinPath(path, key) {
    return path === '' ? String(key) : `${path}${delimiter}${key}`;
  }

  function walk(node, path) {
    if (Array.isArray(node)) {
      if (!flattenArrays || node.length === 0) {
        out[path] = node;
        return;
      }
      node.forEach((item, i) => walk(item, joinPath(path, i)));
      return;
    }
    if (isPlainObject(node)) {
      const keys = Object.keys(node);
      if (keys.length === 0) {
        out[path] = node;
        return;
      }
      keys.forEach((k) => walk(node[k], joinPath(path, k)));
      return;
    }
    out[path] = node;
  }

  walk(value, '');
  return out;
}

/**
 * @param {Object[]} records plain objects (one per array element in
 *   "records" mode).
 * @param {{delimiter?: string, flattenArrays?: boolean}} [options]
 * @returns {Object[]} each record independently flattened, same order.
 */
export function flattenRecords(records, options) {
  return records.map((r) => flattenValue(r, options));
}

/**
 * @param {Object[]} flatRecords
 * @returns {string[]} every key seen across all records, in first-seen
 *   order -- the CSV/table column order. A record missing a key another
 *   record has simply doesn't contribute it a second time.
 */
export function collectColumns(flatRecords) {
  const seen = new Set();
  const columns = [];
  flatRecords.forEach((rec) => {
    Object.keys(rec).forEach((k) => {
      if (!seen.has(k)) {
        seen.add(k);
        columns.push(k);
      }
    });
  });
  return columns;
}

/**
 * @param {*} leafValue a value from a flattened object -- primitive, or
 *   (per flattenValue's header) an empty object/array, or any array when
 *   flattenArrays was false.
 * @returns {string} the CSV/table-cell text: primitives stringify plainly,
 *   null becomes an empty string (indistinguishable from "missing", which
 *   matches how a spreadsheet already treats a null field), and an
 *   object/array leaf serializes as its JSON literal ("{}", "[1,2]") so
 *   it's visible rather than becoming "[object Object]".
 */
export function cellText(leafValue) {
  if (leafValue === undefined || leafValue === null) return '';
  if (typeof leafValue === 'object') return JSON.stringify(leafValue);
  return String(leafValue);
}

/**
 * @param {Object[]} flatRecords
 * @param {string[]} columns
 * @returns {string[][]} header row + one row per record, ready for
 *   ../pure/csv.mjs's rowsToCsv. A record missing a column gets an empty
 *   cell, same treatment as a null value in that column.
 */
export function recordsToRows(flatRecords, columns) {
  const rows = [columns];
  flatRecords.forEach((rec) => {
    rows.push(columns.map((c) => cellText(rec[c])));
  });
  return rows;
}

/**
 * @param {Object} flatValue a single flattened object (from flattenValue in
 *   "single" mode).
 * @returns {string[][]} a two-column ["Key","Value"] header plus one row
 *   per flattened key, ready for ../pure/csv.mjs's rowsToCsv.
 */
export function singleToRows(flatValue) {
  const rows = [['Key', 'Value']];
  Object.keys(flatValue).forEach((k) => {
    rows.push([k === '' ? '(root)' : k, cellText(flatValue[k])]);
  });
  return rows;
}

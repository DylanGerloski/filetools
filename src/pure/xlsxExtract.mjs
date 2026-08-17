/**
 * Turns exceljs's per-cell value shapes into plain JSON-safe values, and
 * turns a rectangular grid of those values into JSON records. Pure data in,
 * pure data out -- no exceljs import, no DOM -- directly unit-testable in
 * Node (test/xlsxExtract.test.mjs) and loaded client-side the same way
 * every other src/pure/*.mjs module is (see ../browser/xlsxToJson.client.js,
 * which reads a worksheet's raw `cell.value` and passes it straight through
 * normalizeCellValue -- exceljs's own value shapes are already plain
 * objects/primitives, so no exceljs-specific parsing needs to happen here).
 *
 * Unlike src/pure/htmlTableExtract.mjs's rowsToJsonRecords (which coerces
 * every cell to a string, matching HTML's own all-text-content nature),
 * this module preserves a spreadsheet cell's actual type -- a number stays
 * a number, a boolean stays a boolean -- because a typed value is most of
 * the point of converting a spreadsheet to JSON instead of CSV.
 */

/**
 * @param {*} raw one exceljs Cell#value. exceljs represents most cells as a
 *   plain string/number/boolean/null, but several cell kinds use a small
 *   wrapper object instead:
 *     - formula cell:   { formula, result, ... }        -> use `result`
 *     - hyperlink cell:  { text, hyperlink }             -> use `text`
 *     - rich text cell:  { richText: [{text}, ...] }     -> join the runs
 *     - error cell:      { error: '#DIV/0!' }            -> the error code
 *     - date cell:       a native Date                   -> ISO string
 * @returns {string|number|boolean|null} a value safe to pass straight to
 *   JSON.stringify (a Date would also serialize correctly on its own via
 *   its native toJSON, but converting it explicitly here keeps the preview
 *   table and the downloaded JSON showing the exact same string).
 */
export function normalizeCellValue(raw) {
  if (raw == null) return null;
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw !== 'object') return raw;
  if (Array.isArray(raw.richText)) {
    return raw.richText.map((run) => (run && run.text != null ? run.text : '')).join('');
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'result')) {
    return normalizeCellValue(raw.result);
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'error')) {
    return String(raw.error);
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'text')) {
    return raw.text == null ? null : String(raw.text);
  }
  // An unrecognized object shape (a future exceljs cell kind this file
  // doesn't know about yet) -- stringify rather than let JSON.stringify
  // silently drop or mis-render it.
  return String(raw);
}

/**
 * @param {Array<string|number|boolean|null>} headerRow
 * @returns {string[]} header cells with blanks and duplicates made unique
 *   ("", "" -> "column_1", "column_2"; "Amount", "Amount" -> "Amount",
 *   "Amount_2") so every JSON record has a stable, non-colliding key set.
 *   Mirrors ../pure/htmlTableExtract.mjs's private uniqueKeys (not
 *   imported from there directly -- that module intentionally stays
 *   string-only and un-exported for this helper).
 */
export function uniqueKeys(headerRow) {
  const seen = new Map();
  return headerRow.map((raw, i) => {
    const str = raw == null ? '' : String(raw).trim();
    const base = str || `column_${i + 1}`;
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

/**
 * @param {Array<Array<string|number|boolean|null>>} grid a rectangular grid
 *   of already-normalized cell values (every row the same length).
 * @param {boolean} hasHeader true to use grid[0] as the record keys.
 * @returns {object[]} one plain object per data row. With no header, keys
 *   are "column_1", "column_2", etc. A row shorter than the header (a
 *   ragged trailing row) gets `null` for its missing trailing fields.
 */
export function rowsToJsonRecords(grid, hasHeader) {
  if (!grid.length) return [];
  const width = grid[0].length;
  const keys = hasHeader
    ? uniqueKeys(grid[0])
    : Array.from({ length: width }, (_, i) => `column_${i + 1}`);
  const dataRows = hasHeader ? grid.slice(1) : grid;
  return dataRows.map((row) => {
    const record = {};
    keys.forEach((key, i) => {
      record[key] = row[i] === undefined ? null : row[i];
    });
    return record;
  });
}

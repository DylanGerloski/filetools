/**
 * Transposes a CSV/TSV/plain-text table: every row becomes a column and
 * every column becomes a row -- the shared logic behind the "transpose CSV"
 * tool. Pure data in, pure data out -- no DOM -- directly unit-testable in
 * Node (test/transposeCsv.test.mjs) and loaded client-side the same way
 * every other src/pure/*.mjs module is.
 *
 * WHY A FULL CSV PARSER DUPLICATED HERE RATHER THAN IMPORTED FROM
 * csvMerge.mjs: no pure module in this directory imports another (existing
 * convention -- see csvMerge.mjs's own header comment for the same
 * reasoning), so every src/pure/*.mjs file stays a single self-contained
 * unit. This is the same character-by-character RFC 4180 state machine as
 * csvMerge.mjs's parseCsv(), so a quoted field containing an embedded
 * newline or comma is handled correctly rather than mis-split on a raw line
 * boundary.
 *
 * BLANK-ROW HANDLING: a fully blank input line (every cell empty) is
 * dropped before transposing by default, same treatment csvMerge.mjs's
 * mergeCsvFiles gives blank rows -- otherwise a single stray blank line at
 * the end of an export would become an entire extra output column of empty
 * cells. Set skipBlankRows: false to keep a literal 1:1 transpose instead.
 *
 * RAGGED INPUT: a source table doesn't have to be rectangular -- a short
 * row is padded with '' up to the widest row's length before transposing,
 * so the result is always rectangular (every output row has exactly as
 * many cells as there were input rows).
 */

/**
 * @param {string} text raw CSV file text, any line-ending convention.
 * @returns {string[][]} every row as an array of field strings, quotes and
 *   doubled-quote escaping removed. A row is only produced for content that
 *   actually terminates (a line ending, or the end of the text with pending
 *   content) -- a text ending in a line ending does not produce a spurious
 *   trailing empty row. An entirely empty `text` returns [].
 */
export function parseCsv(text) {
  const src = String(text == null ? '' : text);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = src.length;
  let rowHasContent = false;

  function pushField() {
    row.push(field);
    field = '';
  }
  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
    rowHasContent = false;
  }

  while (i < len) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field === '') {
      inQuotes = true;
      rowHasContent = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      rowHasContent = true;
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      if (src[i + 1] === '\n') i += 1;
      pushRow();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    rowHasContent = true;
    i += 1;
  }
  // Trailing content with no final line ending -- flush it. If the text
  // ended exactly on a line ending, pushRow() above already handled it and
  // field/row are both back to empty, so this correctly adds nothing.
  if (field !== '' || row.length > 0 || rowHasContent) {
    pushRow();
  }

  return rows;
}

/**
 * @param {string[]} row
 * @returns {boolean} true if every field is empty (or whitespace-only).
 */
function isBlankRow(row) {
  return row.every((cell) => String(cell).trim() === '');
}

/**
 * @param {string[][]} rows every row, in original order.
 * @returns {string[][]} the transpose: output[c][r] === rows[r][c]. Ragged
 *   rows are padded with '' up to the widest row's length first, so every
 *   output row comes out exactly `rows.length` cells wide. An empty `rows`
 *   array (or one containing only zero-length rows) returns [].
 */
export function transposeRows(rows) {
  const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 0);
  if (maxCols === 0) return [];
  const out = [];
  for (let c = 0; c < maxCols; c += 1) {
    const newRow = [];
    for (let r = 0; r < rows.length; r += 1) {
      newRow.push(c < rows[r].length ? rows[r][c] : '');
    }
    out.push(newRow);
  }
  return out;
}

/**
 * @param {string} text raw CSV/text file content, any line-ending
 *   convention.
 * @param {{skipBlankRows?: boolean}} [opts] skipBlankRows (default true):
 *   drop input rows whose every cell is empty/whitespace-only before
 *   transposing (see file header for why).
 * @returns {{ transposed: string[][], inputRowCount: number }}
 *   transposed.length is the ORIGINAL column count (0 if there was no
 *   input); each row in transposed is `inputRowCount` cells wide -- so a
 *   caller never needs a separate "output shape" field, only these two.
 */
export function transposeCsv(text, opts = {}) {
  const { skipBlankRows = true } = opts;
  let rows = parseCsv(text);
  if (skipBlankRows) rows = rows.filter((r) => !isBlankRow(r));
  return {
    transposed: transposeRows(rows),
    inputRowCount: rows.length,
  };
}

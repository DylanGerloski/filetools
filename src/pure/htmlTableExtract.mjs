/**
 * Turns a flat, DOM-shaped description of one HTML `<table>` element into a
 * rectangular grid of strings (colSpan/rowSpan expanded), plus a JSON-record
 * conversion on top of that grid. Pure data in, pure data out -- no DOM --
 * directly unit-testable in Node (test/htmlTableExtract.test.mjs) and loaded
 * client-side the same way every other src/pure/*.mjs module is.
 *
 * The DOM-reading side (parsing HTML text into `<table>` elements and
 * reading each cell's textContent/colSpan/rowSpan/tagName) lives in
 * ../browser/htmlTableToCsv.client.js instead, via the browser's own
 * DOMParser -- a hand-rolled HTML tokenizer here would be strictly worse at
 * handling the real world's malformed/quirky markup (unclosed tags, HTML
 * entities, comments, implied <tbody>) than the browser's own HTML5 parser
 * already is. See that file's header comment for why parsing untrusted
 * markup with DOMParser is safe (it never executes scripts and the result
 * is never attached to the live document).
 *
 * Input shape expected by normalizeTableRows: one array per row, in
 * document order, each row an array of cell descriptors:
 *   { text: string, colSpan: number, rowSpan: number, isHeader: boolean }
 * -- exactly what you get by walking a real `HTMLTableElement`'s `.rows`
 * (an HTMLCollection that already excludes rows belonging to a nested
 * table) and each row's `.cells` (td/th, in document order).
 */

/**
 * Expands colSpan/rowSpan into a full rectangular grid of strings, using
 * the standard "grid of pending spans" algorithm: for each row, walk its
 * cells left to right, skipping any column position still occupied by a
 * still-open rowSpan from an earlier row, and mark the column(s)/row(s) a
 * cell covers as occupied for the rest of its span.
 *
 * @param {Array<Array<{text:string, colSpan?:number, rowSpan?:number, isHeader?:boolean}>>} cellRows
 * @returns {{ grid: string[][], headerRowCount: number }}
 *   `grid` is rectangular (every row padded to the widest row's width with
 *   empty strings). `headerRowCount` counts the leading rows in which every
 *   cell was marked `isHeader` -- the number of rows a caller should treat
 *   as the header block (0 if the first row isn't all-header cells).
 */
export function normalizeTableRows(cellRows) {
  if (!cellRows.length) return { grid: [], headerRowCount: 0 };

  // pending[col] = { text, rowsLeft } for a rowSpan cell from an earlier
  // row that still occupies this column on rows after its own. rowsLeft
  // counts rows remaining AFTER the row that introduced it.
  const pending = [];
  const grid = [];
  const rowIsHeader = [];

  for (const row of cellRows) {
    const outRow = [];
    let col = 0;
    let cellIdx = 0;

    const place = (colIndex, text) => {
      while (outRow.length <= colIndex) outRow.push('');
      outRow[colIndex] = text;
    };

    // Reading a pending span "uses up" one of the extra rows it was
    // granted -- decremented right here, at the point it's read, so a span
    // created THIS row (rowsLeft already set to rowSpan-1, i.e. rows AFTER
    // its own origin row) is never double-charged for the row that created
    // it.
    const readPending = (colIndex) => {
      const p = pending[colIndex];
      place(colIndex, p.text);
      p.rowsLeft -= 1;
      if (p.rowsLeft <= 0) pending[colIndex] = undefined;
    };

    while (cellIdx < row.length) {
      // Drain any contiguous run of still-open rowSpans sitting at the
      // current column before placing this row's own next cell -- a
      // rowSpan from an earlier row shifts where this row's own cells land.
      while (pending[col] && pending[col].rowsLeft > 0) {
        readPending(col);
        col += 1;
      }
      const cell = row[cellIdx];
      const colSpan = Math.max(1, Number(cell.colSpan) || 1);
      const rowSpan = Math.max(1, Number(cell.rowSpan) || 1);
      const text = String(cell.text == null ? '' : cell.text);
      for (let c = 0; c < colSpan; c += 1) {
        place(col + c, text);
        pending[col + c] = rowSpan > 1 ? { text, rowsLeft: rowSpan - 1 } : undefined;
      }
      col += colSpan;
      cellIdx += 1;
    }
    // Any pending rowSpan past this row's own last cell (e.g. one that
    // began on the previous row's final, right-most column) still needs
    // filling in on this row even though this row placed no new cell there.
    for (let c = col; c < pending.length; c += 1) {
      if (pending[c] && pending[c].rowsLeft > 0) readPending(c);
    }

    grid.push(outRow);
    rowIsHeader.push(row.length > 0 && row.every((c) => c.isHeader));
  }

  const width = Math.max(0, ...grid.map((r) => r.length));
  const padded = grid.map((r) => {
    const copy = r.slice();
    while (copy.length < width) copy.push('');
    return copy;
  });

  let headerRowCount = 0;
  while (headerRowCount < rowIsHeader.length && rowIsHeader[headerRowCount]) headerRowCount += 1;

  return { grid: padded, headerRowCount };
}

/**
 * @param {string[]} headerRow
 * @returns {string[]} header cells with blanks and duplicates made unique
 *   ("", "" -> "column_1", "column_2"; "Amount", "Amount" -> "Amount",
 *   "Amount_2") so every JSON record has a stable, non-colliding key set.
 */
function uniqueKeys(headerRow) {
  const seen = new Map();
  return headerRow.map((raw, i) => {
    const base = raw && raw.trim() ? raw.trim() : `column_${i + 1}`;
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

/**
 * @param {string[][]} grid output of normalizeTableRows (or any rectangular
 *   string grid).
 * @param {boolean} hasHeader true to use grid[0] as the record keys.
 * @returns {object[]} one plain object per data row. With no header,
 *   keys are "column_1", "column_2", etc.
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
      record[key] = row[i] == null ? '' : row[i];
    });
    return record;
  });
}

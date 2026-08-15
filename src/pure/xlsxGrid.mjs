/**
 * Pure, DOM-free helpers for turning parsed OOXML (.xlsx) worksheet data
 * into the same rectangular string-grid shape every other tool here uses
 * (see ../pure/htmlTableExtract.mjs's normalizeTableRows for the sibling
 * HTML-table version). The actual unzip (fflate, self-hosted -- see
 * scripts/copy-vendor.js) and XML parsing (the browser's own DOMParser, in
 * 'application/xml' mode) happen in ../browser/xlsxToCsv.client.js -- this
 * file only knows about the plain {row, col, text} cell shape that
 * produces, so it stays unit-testable in Node without a browser
 * (test/xlsxGrid.test.mjs).
 */

const CELL_REF_RE = /^([A-Z]+)(\d+)$/;

/**
 * @param {string} ref a spreadsheet cell reference, e.g. "B3" or "AA12".
 * @returns {{row:number, col:number}|null} zero-based row/col, or null if
 *   `ref` doesn't look like a cell reference (letters then digits).
 */
export function parseCellRef(ref) {
  const m = CELL_REF_RE.exec(String(ref == null ? '' : ref).trim().toUpperCase());
  if (!m) return null;
  const [, letters, digits] = m;
  let col = 0;
  for (let i = 0; i < letters.length; i += 1) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { row: Number(digits) - 1, col: col - 1 };
}

/**
 * @param {Array<{row:number, col:number, text:string}>} cells sparse cell
 *   list, any order, zero-based row/col (see parseCellRef).
 * @returns {string[][]} a rectangular grid sized to the highest row/col
 *   actually seen, gaps filled with ''. Empty input -> [].
 */
export function buildGrid(cells) {
  if (!cells.length) return [];
  let maxRow = 0;
  let maxCol = 0;
  cells.forEach((c) => {
    if (c.row > maxRow) maxRow = c.row;
    if (c.col > maxCol) maxCol = c.col;
  });
  const grid = Array.from({ length: maxRow + 1 }, () => new Array(maxCol + 1).fill(''));
  cells.forEach((c) => {
    if (c.row >= 0 && c.col >= 0) grid[c.row][c.col] = c.text == null ? '' : String(c.text);
  });
  return grid;
}

/**
 * Duplicates each merged range's top-left value across every cell it
 * visually covers -- the spreadsheet equivalent of ../pure/htmlTableExtract
 * .mjs's colSpan/rowSpan handling, driven by worksheet XML's own
 * <mergeCells><mergeCell ref="A1:C1"/></mergeCells> list instead of
 * per-cell span attributes.
 *
 * @param {string[][]} grid a rectangular grid, e.g. from buildGrid().
 * @param {string[]} ranges raw `ref` strings from <mergeCell> elements,
 *   e.g. ["A1:C1", "B4:B6"].
 * @returns {string[][]} a new grid, grown if any range extends past the
 *   original grid's bounds (padded with '').
 */
export function expandMergedRanges(grid, ranges) {
  if (!ranges || !ranges.length) return grid;

  const parsed = ranges
    .map((r) => {
      const [a, b] = String(r).split(':');
      const start = parseCellRef(a);
      const end = parseCellRef(b || a);
      if (!start || !end) return null;
      return {
        r1: Math.min(start.row, end.row),
        r2: Math.max(start.row, end.row),
        c1: Math.min(start.col, end.col),
        c2: Math.max(start.col, end.col),
      };
    })
    .filter(Boolean);
  if (!parsed.length) return grid;

  let maxRow = grid.length - 1;
  let maxCol = grid.length ? grid[0].length - 1 : -1;
  parsed.forEach((rg) => {
    if (rg.r2 > maxRow) maxRow = rg.r2;
    if (rg.c2 > maxCol) maxCol = rg.c2;
  });

  const out = [];
  for (let r = 0; r <= maxRow; r += 1) {
    const row = grid[r] ? grid[r].slice() : [];
    while (row.length <= maxCol) row.push('');
    out.push(row);
  }

  parsed.forEach((rg) => {
    const topValue = out[rg.r1][rg.c1];
    for (let r = rg.r1; r <= rg.r2; r += 1) {
      for (let c = rg.c1; c <= rg.c2; c += 1) {
        out[r][c] = topValue;
      }
    }
  });

  return out;
}

/**
 * Built-in numFmtId values (ECMA-376 §18.8.30) whose standard format
 * renders as a date, time, or date-time. IDs 0-13 and 23-26/37-44/48/49 are
 * plain-number/currency/text built-ins and deliberately excluded.
 */
const BUILTIN_DATE_NUMFMT_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 57]);

/**
 * @param {number|string} numFmtId the cell's resolved number-format id.
 * @param {string} [formatCode] the custom format string for that id, if
 *   this workbook declared one (styles.xml's <numFmt>) -- built-in ids
 *   (<164) don't carry an explicit formatCode in most files, so callers
 *   pass whichever they have.
 * @returns {boolean} true if this cell's numeric value should be rendered
 *   as a date/time rather than a plain number.
 */
export function isDateNumFmt(numFmtId, formatCode) {
  if (formatCode) {
    // Ignore literal-quoted text segments (e.g. the "cm" in a format like
    // '0.00"cm"' isn't a month token) before checking for date/time tokens.
    const stripped = formatCode.replace(/"[^"]*"/g, '').replace(/\[[^\]]*]/g, '');
    if (!stripped.trim()) return false;
    return /[ymdhs]/i.test(stripped) && !/@/.test(stripped);
  }
  return BUILTIN_DATE_NUMFMT_IDS.has(Number(numFmtId));
}

const MS_PER_DAY = 86400000;
// Excel's date system counts serial days from 1899-12-30. This is the
// standard algorithm every spreadsheet-reading library uses, verified here
// against the widely-documented anchor point serial 25569 = 1970-01-01
// (Date.UTC(1899,11,30) + 25569 days lands exactly on 1970-01-01T00:00:00Z).
// It is exactly correct for every real-world date. The one documented
// quirk: because Excel's own serial numbering includes a fictional
// "1900-02-29" (a Lotus 1-2-3 compatibility bug Excel deliberately
// reproduces), this epoch-arithmetic formula reads serials 1-59 as one
// calendar day earlier than Excel's own display for that specific
// nonexistent-in-reality range (serial 1 -> 1899-12-31, not Excel's
// claimed 1900-01-01) -- irrelevant in practice since no real workbook
// contains January/February 1900 data, and every date from 1900-03-01
// onward (i.e. all real data) is exact.
const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

/**
 * @param {number} serial an Excel date serial number (days since the
 *   epoch; the fractional part is time-of-day). Assumes the default 1900
 *   date system (the vast majority of real-world .xlsx files; the rarer
 *   1904 system is a known, documented limitation -- see the tool's FAQ).
 * @returns {string} an ISO date ("YYYY-MM-DD") if the value has no
 *   time-of-day component, an ISO date-time ("YYYY-MM-DDTHH:MM:SS")
 *   otherwise, or '' if `serial` isn't a finite number.
 */
export function excelSerialToDate(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n)) return '';
  const ms = EXCEL_EPOCH_UTC_MS + Math.round(n * MS_PER_DAY);
  const d = new Date(ms);
  const pad = (x) => String(x).padStart(2, '0');
  const datePart = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const hasTime = Math.abs(n - Math.trunc(n)) > 1e-9;
  if (!hasTime) return datePart;
  return `${datePart}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

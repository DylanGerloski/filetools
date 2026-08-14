/**
 * Stitches per-page table detections (as produced by
 * ../pure/tableExtract.mjs's extractTables, one call per page) into a
 * single continuous transaction table for a multi-page bank/card statement.
 * Pure data in, pure data out -- no DOM, no pdf.js -- directly
 * unit-testable in Node (test/statementMerge.test.mjs) and loaded
 * client-side the same way tableExtract.mjs and csv.mjs already are.
 *
 * Why this exists as its own module rather than folding into
 * tableExtract.mjs: extractTables works one page at a time and has no
 * concept of "the same table continuing onto the next page" -- a
 * multi-page bank statement is exactly that case (the transaction table
 * usually repeats its header on every page). This module's only job is
 * deciding which of a document's detected tables belong to that one
 * continuing table, dropping repeated header rows, and leaving anything
 * that doesn't match alone rather than silently merging it in.
 */

/**
 * @param {string[]} a
 * @param {string[]} b
 * @returns {boolean} true if every cell matches case/whitespace-insensitively.
 */
function rowsMatch(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((cell, i) => String(cell).trim().toLowerCase() === String(b[i] || '').trim().toLowerCase());
}

/**
 * @typedef {{ pageNum: number, rows: string[][], headerRowIndex: number|null }} PageTable
 *   one detected table, in the shape extractTables() already returns per
 *   page (rows are already-assembled cell strings, not raw items).
 */

/**
 * Picks the "primary" column count across every detected table -- the one
 * with the most total data cells, since a statement's transaction table is
 * normally both the widest-attended and most row-heavy table on the page
 * (a stray letterhead line or footer table won't out-weigh it).
 *
 * @param {PageTable[]} tables
 * @returns {number|null} null if no table has any rows.
 */
function primaryColumnCount(tables) {
  const weightByCount = new Map();
  for (const t of tables) {
    const cols = t.rows[0] ? t.rows[0].length : 0;
    if (!cols) continue;
    weightByCount.set(cols, (weightByCount.get(cols) || 0) + t.rows.length);
  }
  let best = null;
  let bestWeight = -1;
  for (const [cols, weight] of weightByCount) {
    if (weight > bestWeight) {
      best = cols;
      bestWeight = weight;
    }
  }
  return best;
}

/**
 * @param {PageTable[]} tables every table detected across the whole
 *   document, in document (page) order.
 * @returns {{
 *   mainTable: { headerRow: string[]|null, rows: string[][], sourcePages: number[], columnCount: number } | null,
 *   otherTables: PageTable[]
 * }}
 *   mainTable is the merged, header-deduplicated transaction table (null if
 *   nothing has any rows at all). otherTables is every detected table whose
 *   column count didn't match the primary shape -- surfaced separately
 *   rather than dropped, since a genuinely different table (a summary box,
 *   a fee schedule) is real content, not noise to discard silently.
 */
export function mergeStatementTables(tables) {
  const withRows = tables.filter((t) => t.rows && t.rows.length);
  if (!withRows.length) return { mainTable: null, otherTables: [] };

  const columnCount = primaryColumnCount(withRows);
  const primary = withRows.filter((t) => (t.rows[0] ? t.rows[0].length : 0) === columnCount);
  const otherTables = withRows.filter((t) => (t.rows[0] ? t.rows[0].length : 0) !== columnCount);

  let headerRow = null;
  const dataRows = [];

  primary.forEach((table, i) => {
    let rows = table.rows;
    let localHeaderRow = null;
    if (table.headerRowIndex !== null && table.headerRowIndex !== undefined) {
      localHeaderRow = rows[table.headerRowIndex];
      rows = rows.filter((_, idx) => idx !== table.headerRowIndex);
    }

    if (i === 0) {
      headerRow = localHeaderRow;
    } else if (localHeaderRow && !(headerRow && rowsMatch(localHeaderRow, headerRow))) {
      // This page's first row looked like a header but doesn't match the
      // document's established header -- keep it as data instead of
      // silently discarding a row that might be a real transaction.
      rows = [localHeaderRow, ...rows];
    }
    // else: localHeaderRow matches the established header (a repeated
    // per-page header row) -- already excluded from `rows` above, and
    // correctly not re-added.

    dataRows.push(...rows);
  });

  return {
    mainTable: {
      headerRow,
      rows: dataRows,
      sourcePages: primary.map((t) => t.pageNum),
      columnCount,
    },
    otherTables,
  };
}

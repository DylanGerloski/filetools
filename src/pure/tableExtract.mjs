/**
 * Table extraction from a PDF page's text-item positions -- the whitespace /
 * text-alignment class of approach (the same class Tabula's "stream" mode
 * and pdfplumber use for tables with no ruling lines, which is the common
 * case in reports and statements). Pure data in, pure data out -- no DOM, no
 * pdf.js -- directly unit-testable in Node (test/tableExtract.test.mjs) and
 * loaded client-side the same way src/pure/pageRange.mjs already is.
 *
 * Item shape expected by every function here:
 *   { str: string, x: number, y: number, width: number, height: number,
 *     fontName: string }
 * The caller (src/browser/pdfTables.client.js) is responsible for reading
 * pdf.js's getTextContent() output and converting its bottom-up transform
 * coordinates into this top-down {x, y, width, height, fontName} shape
 * before calling anything here.
 *
 * The pipeline, in order:
 *   1. clusterRows      -- group items into candidate rows by y-proximity
 *   2. computeColumnBoundaries -- one set of column cuts for the whole page,
 *                           from a whitespace-gap histogram across all rows
 *   3. cellsForRow       -- assign one row's items into cells at those cuts
 *   4. findTableRuns     -- maximal runs of >=3 consecutive rows with the
 *                           same non-empty cell count (>=2)
 *   5. looksLikeHeaderRow -- per-run header heuristic, always overridable
 *   6. extractTables      -- glues 1-5 together into ready-to-render tables
 *
 * Steps 3 (cellsForRow) and thus the cell contents are deliberately
 * re-runnable on their own against a stored set of row items and an edited
 * boundary list -- that is what lets the browser-side correctable preview
 * recompute a table's cells cheaply when a visitor adjusts a column
 * boundary, without re-clustering rows or re-detecting table runs.
 */

/** @param {number[]} nums */
function median(nums) {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Groups text items into candidate rows by y-proximity. Items are assumed
 * to already be in top-down y (y increases downward) -- the caller converts
 * pdf.js's bottom-up viewport coordinates before calling this.
 *
 * @param {Array<{str:string,x:number,y:number,width:number,height:number,fontName:string}>} items
 * @returns {Array<{y:number, items: object[]}>} rows, sorted top to bottom;
 *   within each row, items are sorted left to right.
 */
export function clusterRows(items) {
  const usable = items.filter((it) => it.str && it.str.trim().length);
  if (!usable.length) return [];

  const medianHeight = median(usable.map((it) => it.height || 1)) || 1;
  const tolerance = medianHeight * 0.5;

  const sorted = [...usable].sort((a, b) => a.y - b.y);
  const rows = [];
  let current = null;

  for (const item of sorted) {
    const itemYCenter = item.y + (item.height || 0) / 2;
    if (current && Math.abs(itemYCenter - current.yCenter) < tolerance) {
      current.items.push(item);
      // Running average keeps the tolerance check stable across a wide row.
      current.yCenter = (current.yCenter * (current.items.length - 1) + itemYCenter) / current.items.length;
    } else {
      current = { yCenter: itemYCenter, items: [item] };
      rows.push(current);
    }
  }

  return rows
    .map((row) => ({
      y: median(row.items.map((it) => it.y)),
      items: row.items.slice().sort((a, b) => a.x - b.x),
    }))
    .sort((a, b) => a.y - b.y);
}

/** Merges a list of possibly-overlapping/touching [start,end] intervals. */
function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];
  for (const iv of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end);
    } else {
      merged.push({ ...iv });
    }
  }
  return merged;
}

/**
 * Approximates the width of one space character, since pdf.js text items do
 * not expose an explicit space-glyph width. Uses the median per-character
 * width across every item (width / trimmed-string length) as a stand-in --
 * a coarse but workable proxy for the "how wide is a gap that isn't just a
 * normal word-space" question step 3 needs.
 */
function estimateSpaceWidth(items) {
  const perChar = items
    .filter((it) => it.str && it.str.trim().length && it.width > 0)
    .map((it) => it.width / it.str.trim().length);
  return median(perChar) || 4;
}

/**
 * Builds ONE set of column-boundary x-positions for the whole page, from a
 * whitespace-gap histogram across every candidate row's items. A column
 * boundary is the midpoint of any maximal x-interval with no ink from any
 * row, at least 1.5x the estimated space width.
 *
 * @param {Array<{items: object[]}>} rows output of clusterRows.
 * @returns {number[]} boundary x-positions, ascending.
 */
export function computeColumnBoundaries(rows) {
  const items = rows.flatMap((r) => r.items);
  if (items.length < 2) return [];

  const minX = Math.min(...items.map((it) => it.x));
  const maxX = Math.max(...items.map((it) => it.x + it.width));
  const ink = mergeIntervals(items.map((it) => ({ start: it.x, end: it.x + it.width })));

  const spaceWidth = estimateSpaceWidth(items);
  const minGapWidth = spaceWidth * 1.5;

  const boundaries = [];
  let cursor = minX;
  for (const gap of ink) {
    if (gap.start - cursor >= minGapWidth) {
      boundaries.push((cursor + gap.start) / 2);
    }
    cursor = Math.max(cursor, gap.end);
  }
  if (maxX - cursor >= minGapWidth) {
    // A trailing gap can't be a column boundary (nothing follows it), so it
    // is intentionally not added here.
  }

  return boundaries;
}

/**
 * Assigns one row's items into cells at the given column boundaries, and
 * joins each cell's items left-to-right with a single space.
 *
 * @param {object[]} rowItems one row's items (already left-to-right sorted).
 * @param {number[]} boundaries ascending x-positions, as from
 *   computeColumnBoundaries (or an edited copy of one).
 * @returns {string[]} one string per column, empty string for an empty cell.
 */
export function cellsForRow(rowItems, boundaries) {
  const colCount = boundaries.length + 1;
  const buckets = Array.from({ length: colCount }, () => []);
  for (const item of rowItems) {
    const centerX = item.x + item.width / 2;
    let col = 0;
    while (col < boundaries.length && centerX > boundaries[col]) col += 1;
    buckets[col].push(item);
  }
  return buckets.map((bucket) =>
    bucket
      .slice()
      .sort((a, b) => a.x - b.x)
      .map((it) => it.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Finds maximal runs of 3+ consecutive rows whose assembled cells have the
 * same non-empty-cell count, that count being >=2. Non-empty count (not raw
 * bucket count) is what's compared, since every
 * row gets bucketed into the same page-wide column count regardless of
 * whether it's really part of a table -- ordinary prose rows land almost
 * entirely in one bucket and are excluded by the >=2 non-empty requirement.
 *
 * @param {Array<{y:number, items:object[]}>} rows output of clusterRows.
 * @param {number[]} boundaries output of computeColumnBoundaries.
 * @returns {Array<{startIndex:number, endIndex:number, columnCount:number}>}
 *   inclusive row-index ranges into `rows`, in document order.
 */
export function findTableRuns(rows, boundaries) {
  const nonEmptyCounts = rows.map((row) => {
    const cells = cellsForRow(row.items, boundaries);
    return cells.filter((c) => c.length > 0).length;
  });

  const runs = [];
  let runStart = null;
  let runCols = null;

  function closeRun(endIndex) {
    if (runStart !== null && endIndex - runStart + 1 >= 3) {
      runs.push({ startIndex: runStart, endIndex, columnCount: runCols });
    }
    runStart = null;
    runCols = null;
  }

  nonEmptyCounts.forEach((count, i) => {
    if (count >= 2 && count === runCols) {
      // continue current run
    } else {
      closeRun(i - 1);
      if (count >= 2) {
        runStart = i;
        runCols = count;
      }
    }
  });
  closeRun(nonEmptyCounts.length - 1);

  return runs;
}

const NUMERIC_CELL = /^[\s]*[-+]?[$€£]?[\d,]+(\.\d+)?%?[\s]*$/;

function isNumericCell(cell) {
  return cell.trim().length > 0 && NUMERIC_CELL.test(cell.trim());
}

/**
 * Header heuristic: the first row of a run is
 * treated as a header if its modal font name differs from the rest of the
 * run's, OR if every one of its cells is non-numeric while at least one
 * later row in the run has a numeric cell. Never a silent assumption in the
 * UI -- the caller always exposes this as an overridable toggle.
 *
 * @param {object[]} runRowsWithItems the run's rows (with .items), in order.
 * @param {string[][]} runCells the run's assembled cells, same order.
 * @returns {boolean}
 */
export function looksLikeHeaderRow(runRowsWithItems, runCells) {
  if (!runRowsWithItems.length) return false;
  const [firstRow, ...restRows] = runRowsWithItems;
  const [firstCells, ...restCells] = runCells;

  const modalFont = (items) => {
    const counts = new Map();
    for (const it of items) counts.set(it.fontName, (counts.get(it.fontName) || 0) + 1);
    let best = null;
    let bestCount = -1;
    for (const [font, count] of counts) {
      if (count > bestCount) {
        best = font;
        bestCount = count;
      }
    }
    return best;
  };

  const firstFont = modalFont(firstRow.items);
  const restItems = restRows.flatMap((r) => r.items);
  const restFont = restItems.length ? modalFont(restItems) : null;
  if (firstFont && restFont && firstFont !== restFont) return true;

  const firstAllNonNumeric = firstCells.every((c) => !isNumericCell(c));
  const laterHasNumeric = restCells.some((cells) => cells.some((c) => isNumericCell(c)));
  return firstAllNonNumeric && laterHasNumeric;
}

/**
 * Full pipeline: clusters a page's items into rows, detects one page-wide
 * set of column boundaries, finds table runs, and assembles each run into a
 * ready-to-render table. This is what the browser adapter calls once per
 * page; boundary edits afterwards call cellsForRow directly instead of
 * re-running this whole function (see the module header).
 *
 * @param {object[]} items a single page's text items, top-down y already.
 * @returns {{ rows: Array<{y:number,items:object[]}>, columnBoundaries: number[],
 *   tables: Array<{ startIndex:number, endIndex:number, rows:string[][],
 *   headerRowIndex:number|null, columnBoundaries:number[] }> }}
 */
export function extractTables(items) {
  const rows = clusterRows(items);
  const columnBoundaries = computeColumnBoundaries(rows);
  const runs = findTableRuns(rows, columnBoundaries);

  const tables = runs.map((run) => {
    const runRows = rows.slice(run.startIndex, run.endIndex + 1);
    const cells = runRows.map((row) => cellsForRow(row.items, columnBoundaries));
    const isHeader = looksLikeHeaderRow(runRows, cells);
    return {
      startIndex: run.startIndex,
      endIndex: run.endIndex,
      rows: cells,
      headerRowIndex: isHeader ? 0 : null,
      columnBoundaries,
    };
  });

  return { rows, columnBoundaries, tables };
}

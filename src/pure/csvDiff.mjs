/**
 * Cell-level diff between two CSV files -- the shared logic behind the
 * "compare CSV files" tool. Pure data in, pure data out -- no DOM --
 * directly unit-testable in Node (test/csvDiff.test.mjs) and loaded
 * client-side the same way every other src/pure/*.mjs module is.
 *
 * WHY A FULL RFC 4180 PARSER: reuses the same character-by-character state
 * machine as ../pure/csvMerge.mjs (duplicated here rather than imported --
 * no pure module in this directory imports another, existing convention),
 * so a quoted field with an embedded comma or newline is read as one field,
 * not split apart.
 *
 * THE CORE PROBLEM THIS FILE SOLVES, STATED EXPLICITLY: comparing two CSVs
 * row-by-row-by-INDEX (row 0 vs row 0, row 1 vs row 1, ...) breaks
 * completely the moment a single row is inserted or deleted anywhere but
 * the very end -- every following row then looks "changed" even though
 * nothing in it actually changed. This file avoids that in two ways,
 * offered as two modes:
 *
 * 1. KEY-COLUMN MODE (used whenever a column is unique in BOTH files, auto-
 *    detected by findUniqueKeyColumn() but overridable): rows are matched
 *    by that column's VALUE, not by position, so reordering rows between
 *    the two files has no effect on the diff at all -- a row that moved is
 *    still recognized as the same row.
 *
 * 2. POSITION MODE (the fallback, used when no column is unique in both
 *    files -- most plain lists and many real exports): a classic LCS
 *    (longest-common-subsequence) alignment over each row's full content,
 *    the same algorithm behind `diff`/git's line diff, applied to CSV rows
 *    instead of text lines. This correctly finds the longest run of
 *    untouched rows in order and reports only the genuinely inserted/
 *    removed ones around them, rather than a naive index-zip. It does NOT
 *    recognize a fully reordered set of otherwise-identical rows as
 *    unchanged (neither does `diff`) -- that limitation is disclosed on the
 *    tool page's FAQ, with key-column mode offered as the fix.
 *
 * A "replace" PAIRING PASS runs on top of the position-mode LCS output:
 * where the alignment finds a deleted row immediately next to an inserted
 * row, and the two rows are similar enough (see MIN_CHANGED_ROW_SIMILARITY),
 * they're reported as one "changed" row with cell-level highlighting
 * instead of a separate remove+add -- this is what makes "changed rows,
 * changed cell values" (not just whole-row add/remove) show up under
 * position mode too, not only key mode.
 *
 * PERFORMANCE: the LCS table is O(rows_A * rows_B) time and space. For very
 * large files this would freeze the tab, so position mode refuses (with an
 * honest message, not a silent hang) above MAX_POSITION_DIFF_CELLS -- at
 * that point, picking a key column (which is O(rows_A + rows_B)) has no
 * such limit.
 */

/**
 * @param {string} text raw CSV file text, any line-ending convention.
 * @returns {string[][]} every row as an array of field strings, quotes and
 *   doubled-quote escaping removed. See ../pure/csvMerge.mjs's parseCsv for
 *   full behavior notes (identical implementation).
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
  if (field !== '' || row.length > 0 || rowHasContent) {
    pushRow();
  }

  return rows;
}

/**
 * @param {string[]} row
 * @returns {boolean} true if every field is empty/whitespace-only -- used to
 *   drop stray blank lines before diffing, same as csvMerge.mjs.
 */
function isBlankRow(row) {
  return row.every((cell) => String(cell).trim() === '');
}

/**
 * The DP table for position-mode LCS is (rows_A+1) * (rows_B+1) Int32
 * entries. 9,000,000 caps that around 36MB (Int32Array), comfortably large
 * enough for real-world CSVs (e.g. two ~3000-row files) while staying well
 * short of freezing a tab on a pathological input. Key-column mode has no
 * equivalent limit -- it's linear, not quadratic -- so this is disclosed on
 * the tool page as "use a key column for very large files" rather than a
 * hard wall.
 */
export const MAX_POSITION_DIFF_CELLS = 9_000_000;

/**
 * A "replace" pair (one deleted row immediately next to one inserted row in
 * the LCS alignment) is only reported as a single "changed" row when at
 * least this fraction of its cells (by column index) still match -- below
 * that, the two rows are probably unrelated content that happened to land
 * next to each other, and showing them as a separate removed row + added
 * row is the honest read. Single-column input is exempt (see
 * pairReplaceBlocks): with one column, "changed" and "removed+added" carry
 * the same information anyway.
 */
const MIN_CHANGED_ROW_SIMILARITY = 0.34;

/**
 * @param {string} cell
 * @param {{ignoreWhitespace?: boolean, caseSensitive?: boolean}} opts
 * @returns {string} the value two cells are compared by -- NOT what's kept
 *   for display (the original cell text is always what's shown).
 */
function normalizeCell(cell, opts) {
  let v = cell == null ? '' : String(cell);
  if (opts.ignoreWhitespace) v = v.trim();
  if (!opts.caseSensitive) v = v.toLowerCase();
  return v;
}

/**
 * @param {string[]} row
 * @param {object} opts
 * @returns {string} a single string identity for a whole row, used as the
 *   LCS comparison token in position mode. '' is vanishingly unlikely
 *   to appear in real CSV cell content and is never shown to the visitor,
 *   so a false "equal" from field values that happen to contain it is not a
 *   practical concern.
 */
function rowToken(row, opts) {
  return row.map((c) => normalizeCell(c, opts)).join('');
}

/**
 * @param {string[]} rows every body value in one column.
 * @returns {boolean} true if no two rows share the same value in that
 *   column (comparing raw values, not normalized -- a key column should
 *   distinguish rows exactly, not modulo whitespace/case).
 */
export function columnIsUnique(rows, col) {
  const seen = new Set();
  for (const row of rows) {
    const v = col < row.length ? row[col] : '';
    if (seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

/**
 * @param {string[][]} bodyA
 * @param {string[][]} bodyB
 * @param {number} maxCols
 * @returns {number|null} the lowest column index that's unique within BOTH
 *   bodyA and bodyB, or null if none qualifies. Requires at least 2 rows in
 *   each file -- with 0 or 1 rows, every column is trivially "unique" but
 *   that's not a meaningful signal, so auto-detection stays off and falls
 *   through to position mode instead.
 */
export function findUniqueKeyColumn(bodyA, bodyB, maxCols) {
  if (bodyA.length < 2 || bodyB.length < 2) return null;
  for (let c = 0; c < maxCols; c += 1) {
    if (columnIsUnique(bodyA, c) && columnIsUnique(bodyB, c)) return c;
  }
  return null;
}

/**
 * @param {string[]} rowA
 * @param {string[]} rowB
 * @param {object} opts
 * @returns {{changed: boolean, changedCells: number[], columnCount: number}}
 *   changedCells are 0-based column indices, over the WIDER of the two
 *   rows -- a cell missing on one side (a ragged row, or a row shorter than
 *   the other file's) is compared as if it were an empty string there.
 */
function diffRowCells(rowA, rowB, opts) {
  const width = Math.max(rowA.length, rowB.length);
  const changedCells = [];
  for (let c = 0; c < width; c += 1) {
    const a = c < rowA.length ? rowA[c] : '';
    const b = c < rowB.length ? rowB[c] : '';
    if (normalizeCell(a, opts) !== normalizeCell(b, opts)) changedCells.push(c);
  }
  return { changed: changedCells.length > 0, changedCells, columnCount: width };
}

/**
 * Matches rows between the two files by a key column's value, independent
 * of row order or position. Requires the caller to have already confirmed
 * `keyColumn` is unique in both bodyA and bodyB (see columnIsUnique) --
 * this function does not re-check that, it just uses the first row seen for
 * a given key.
 *
 * Output order: bodyB's rows in bodyB's own order (matched-in-A rows
 * annotated unchanged/changed, unmatched ones added), followed by any
 * bodyA rows whose key never appeared in bodyB, in bodyA's own order,
 * marked removed. Chosen because bodyB (the "new"/"changed" file) is what
 * most visitors read top-to-bottom first; purely-removed rows are still
 * fully reported, just grouped at the end rather than interleaved.
 *
 * @returns {Array<{status:'unchanged'|'changed'|'added'|'removed', a:string[]|null, b:string[]|null, aIndex:number|null, bIndex:number|null, changedCells:number[]}>}
 */
export function diffByKey(bodyA, bodyB, keyColumn, opts) {
  const keyOf = (row) => normalizeCell(keyColumn < row.length ? row[keyColumn] : '', opts);
  const aIndexByKey = new Map();
  bodyA.forEach((row, i) => aIndexByKey.set(keyOf(row), i));

  const rows = [];
  const usedAKeys = new Set();
  bodyB.forEach((rowB, bi) => {
    const k = keyOf(rowB);
    if (aIndexByKey.has(k)) {
      usedAKeys.add(k);
      const ai = aIndexByKey.get(k);
      const rowA = bodyA[ai];
      const cd = diffRowCells(rowA, rowB, opts);
      rows.push({ status: cd.changed ? 'changed' : 'unchanged', a: rowA, b: rowB, aIndex: ai, bIndex: bi, changedCells: cd.changedCells });
    } else {
      rows.push({ status: 'added', a: null, b: rowB, aIndex: null, bIndex: bi, changedCells: [] });
    }
  });
  bodyA.forEach((rowA, ai) => {
    const k = keyOf(rowA);
    if (!usedAKeys.has(k)) {
      rows.push({ status: 'removed', a: rowA, b: null, aIndex: ai, bIndex: null, changedCells: [] });
    }
  });
  return rows;
}

/**
 * Post-processes a raw LCS op sequence: any run of consecutive delete/
 * insert ops between two "equal" ops is a candidate for "replace" pairing
 * -- a deleted row and an inserted row, taken positionally within the run,
 * are reported as one changed row (with cell-level highlighting) rather
 * than a separate remove+add PROVIDED they're similar enough (see
 * MIN_CHANGED_ROW_SIMILARITY). Single-column rows always pair (there's
 * nothing a similarity threshold would usefully filter with one cell).
 *
 * @param {Array<{type:'equal'|'delete'|'insert', ai?:number, bj?:number}>} ops
 */
function pairReplaceBlocks(ops, bodyA, bodyB, opts) {
  const result = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === 'equal') {
      result.push(op);
      i += 1;
      continue;
    }
    let j = i;
    const deletes = [];
    const inserts = [];
    while (j < ops.length && ops[j].type !== 'equal') {
      if (ops[j].type === 'delete') deletes.push(ops[j]);
      else inserts.push(ops[j]);
      j += 1;
    }
    const pairCount = Math.min(deletes.length, inserts.length);
    for (let k = 0; k < pairCount; k += 1) {
      const rowA = bodyA[deletes[k].ai];
      const rowB = bodyB[inserts[k].bj];
      const cd = diffRowCells(rowA, rowB, opts);
      const similarity = cd.columnCount === 0 ? 1 : 1 - cd.changedCells.length / cd.columnCount;
      if (cd.columnCount > 1 && similarity < MIN_CHANGED_ROW_SIMILARITY) {
        result.push(deletes[k]);
        result.push(inserts[k]);
      } else {
        result.push({ type: 'replace', ai: deletes[k].ai, bj: inserts[k].bj });
      }
    }
    for (let k = pairCount; k < deletes.length; k += 1) result.push(deletes[k]);
    for (let k = pairCount; k < inserts.length; k += 1) result.push(inserts[k]);
    i = j;
  }
  return result;
}

/**
 * Position-based (row-order-based) diff: a classic dynamic-programming LCS
 * over each row's full content, then the replace-pairing pass above.
 *
 * @returns {{overLimit: boolean, rows: Array}} overLimit true means
 *   rows_A * rows_B exceeded MAX_POSITION_DIFF_CELLS and no diff was
 *   computed -- the caller should show a message pointing at key-column
 *   mode or smaller files, not silently return an empty/wrong result.
 */
export function diffByPosition(bodyA, bodyB, opts) {
  const n = bodyA.length;
  const m = bodyB.length;
  if (n * m > MAX_POSITION_DIFF_CELLS) {
    return { overLimit: true, rows: [] };
  }

  const tokensA = bodyA.map((r) => rowToken(r, opts));
  const tokensB = bodyB.map((r) => rowToken(r, opts));

  const width = m + 1;
  const dp = new Int32Array((n + 1) * width);
  const idx = (i, j) => i * width + j;
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[idx(i, j)] = tokensA[i] === tokensB[j]
        ? dp[idx(i + 1, j + 1)] + 1
        : Math.max(dp[idx(i + 1, j)], dp[idx(i, j + 1)]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (tokensA[i] === tokensB[j]) {
      ops.push({ type: 'equal', ai: i, bj: j });
      i += 1;
      j += 1;
    } else if (dp[idx(i + 1, j)] >= dp[idx(i, j + 1)]) {
      ops.push({ type: 'delete', ai: i });
      i += 1;
    } else {
      ops.push({ type: 'insert', bj: j });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: 'delete', ai: i });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: 'insert', bj: j });
    j += 1;
  }

  const paired = pairReplaceBlocks(ops, bodyA, bodyB, opts);

  const rows = paired.map((op) => {
    if (op.type === 'equal') {
      return { status: 'unchanged', a: bodyA[op.ai], b: bodyB[op.bj], aIndex: op.ai, bIndex: op.bj, changedCells: [] };
    }
    if (op.type === 'delete') {
      return { status: 'removed', a: bodyA[op.ai], b: null, aIndex: op.ai, bIndex: null, changedCells: [] };
    }
    if (op.type === 'insert') {
      return { status: 'added', a: null, b: bodyB[op.bj], aIndex: null, bIndex: op.bj, changedCells: [] };
    }
    const rowA = bodyA[op.ai];
    const rowB = bodyB[op.bj];
    const cd = diffRowCells(rowA, rowB, opts);
    return { status: 'changed', a: rowA, b: rowB, aIndex: op.ai, bIndex: op.bj, changedCells: cd.changedCells };
  });

  return { overLimit: false, rows };
}

/**
 * The single entry point: parses both files, strips a header row if
 * requested, resolves whether to run key-column or position mode, and
 * returns everything the browser client needs to render the result.
 *
 * @param {string} textA raw text of the first ("original") file.
 * @param {string} textB raw text of the second ("changed") file.
 * @param {{
 *   hasHeader?: boolean,
 *   keyColumn?: number|null,
 *   ignoreWhitespace?: boolean,
 *   caseSensitive?: boolean,
 * }} [opts]
 *   hasHeader (default true): first row of each file excluded from the row
 *     diff and compared separately as `headerDiff`.
 *   keyColumn (default undefined = auto-detect via findUniqueKeyColumn;
 *     pass null to force position mode; pass a column index to force that
 *     column as the key -- if it turns out not to be unique in both files,
 *     falls back to position mode and reports why via `keyColumnNote`).
 *   ignoreWhitespace (default false), caseSensitive (default true): same
 *     meaning as ../pure/dedupeLines.mjs's identically-named options,
 *     applied to every cell comparison (row-matching key comparisons too).
 * @returns {{
 *   headerA: string[]|null, headerB: string[]|null,
 *   headerDiff: {a:string[]|null,b:string[]|null,changed:boolean,changedCells:number[]}|null,
 *   columnCount: number,
 *   mode: 'key'|'position',
 *   keyColumn: number|null,
 *   autoKeyColumn: number|null,
 *   keyColumnNote: 'not-unique'|null,
 *   overLimit: boolean,
 *   rows: Array,
 *   stats: {unchanged:number, changed:number, added:number, removed:number},
 *   totalA: number, totalB: number,
 * }}
 */
export function diffCsvFiles(textA, textB, opts = {}) {
  const {
    hasHeader = true,
    keyColumn,
    ignoreWhitespace = false,
    caseSensitive = true,
  } = opts;
  const cellOpts = { ignoreWhitespace, caseSensitive };

  const allRowsA = parseCsv(textA).filter((r) => !isBlankRow(r));
  const allRowsB = parseCsv(textB).filter((r) => !isBlankRow(r));

  const headerA = hasHeader && allRowsA.length ? allRowsA[0] : null;
  const headerB = hasHeader && allRowsB.length ? allRowsB[0] : null;
  const bodyA = hasHeader ? allRowsA.slice(1) : allRowsA;
  const bodyB = hasHeader ? allRowsB.slice(1) : allRowsB;

  const maxCols = Math.max(
    headerA ? headerA.length : 0,
    headerB ? headerB.length : 0,
    bodyA.reduce((mx, r) => Math.max(mx, r.length), 0),
    bodyB.reduce((mx, r) => Math.max(mx, r.length), 0),
    1
  );

  let headerDiff = null;
  if (hasHeader) {
    const cd = diffRowCells(headerA || [], headerB || [], cellOpts);
    headerDiff = { a: headerA, b: headerB, changed: cd.changed, changedCells: cd.changedCells };
  }

  const autoKeyColumn = findUniqueKeyColumn(bodyA, bodyB, maxCols);
  let resolvedKeyColumn = null;
  let keyColumnNote = null;
  if (keyColumn === undefined) {
    resolvedKeyColumn = autoKeyColumn;
  } else if (keyColumn === null) {
    resolvedKeyColumn = null;
  } else if (columnIsUnique(bodyA, keyColumn) && columnIsUnique(bodyB, keyColumn)) {
    resolvedKeyColumn = keyColumn;
  } else {
    resolvedKeyColumn = null;
    keyColumnNote = 'not-unique';
  }

  let rows;
  let overLimit = false;
  const mode = resolvedKeyColumn !== null ? 'key' : 'position';
  if (mode === 'key') {
    rows = diffByKey(bodyA, bodyB, resolvedKeyColumn, cellOpts);
  } else {
    const posResult = diffByPosition(bodyA, bodyB, cellOpts);
    overLimit = posResult.overLimit;
    rows = posResult.rows;
  }

  const stats = { unchanged: 0, changed: 0, added: 0, removed: 0 };
  rows.forEach((r) => { stats[r.status] += 1; });

  return {
    headerA,
    headerB,
    headerDiff,
    columnCount: maxCols,
    mode,
    keyColumn: resolvedKeyColumn,
    autoKeyColumn,
    keyColumnNote,
    overLimit,
    rows,
    stats,
    totalA: bodyA.length,
    totalB: bodyB.length,
  };
}

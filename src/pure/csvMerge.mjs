/**
 * Parses and merges multiple CSV files into one table -- the shared logic
 * behind the "merge multiple CSV files" tool. Pure data in, pure data out --
 * no DOM -- directly unit-testable in Node (test/csvMerge.test.mjs) and
 * loaded client-side the same way every other src/pure/*.mjs module is.
 *
 * WHY A NEW, FULL CSV PARSER RATHER THAN REUSING sortLines.mjs's
 * parseCsvLine(): that parser (and dedupeLines.mjs's line-splitter) treat
 * one text LINE as one CSV row, which is correct for a line-oriented tool
 * but silently mis-splits a quoted field that legitimately contains an
 * embedded newline (e.g. a multi-line "Notes" column) -- exactly the case a
 * whole-FILE merge tool is likely to hit across several real-world exports.
 * parseCsv() below is a proper character-by-character RFC 4180 state
 * machine that treats a quoted newline as part of the field, not a row
 * boundary. No pure module here imports another (existing convention in
 * this directory), so this file is self-contained; CSV *output*
 * serialization still reuses ../pure/csv.mjs's rowsToCsv client-side (see
 * ../browser/csvMerge.client.js) rather than duplicating that logic.
 *
 * HEADER RECONCILIATION, THE CORE DESIGN DECISION: when every file's first
 * row is treated as a header (hasHeader, the default), the merged output's
 * columns are the UNION of every file's header names, in first-seen order
 * across files. A file missing a column that another file has gets a blank
 * cell there, not a shifted row -- so two exports with almost-but-not-quite
 * the same columns (a common real-world case: monthly exports where a
 * column got added or renamed) still combine into one aligned table instead
 * of silently misaligning data under the wrong header. Column name matching
 * is exact (after trimming surrounding whitespace) and case-SENSITIVE --
 * "Email" and "email" are treated as two different columns, deliberately:
 * silently merging them on a case-insensitive guess risks combining two
 * columns that are only coincidentally similarly named, which would be a
 * much worse failure than asking the visitor to rename one file's header
 * (disclosed on the tool page's FAQ, same "state the exact matching rule
 * rather than guess a fuzzy one" approach dedupeLines.mjs and sortLines.mjs
 * both take).
 */

/**
 * @param {string} text raw CSV file text, any line-ending convention.
 * @returns {string[][]} every row as an array of field strings, quotes and
 *   doubled-quote escaping removed. A row is only produced for content that
 *   actually terminates (a line ending, or the end of the text with pending
 *   content) -- a text ending in a line ending does not produce a spurious
 *   trailing empty row, matching splitLines()'s convention elsewhere in
 *   this codebase. An entirely empty `text` returns [].
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
 * @returns {boolean} true if every field is empty (or whitespace-only) --
 *   used to drop stray blank lines from the merged body rather than
 *   carrying them into the output as a fully-empty row.
 */
function isBlankRow(row) {
  return row.every((cell) => String(cell).trim() === '');
}

/**
 * @param {{name: string, text: string}[]} files each file's name (for the
 *   per-file summary and, if requested, the source-file column) and raw
 *   text content.
 * @param {{hasHeader?: boolean, includeSourceColumn?: boolean}} [opts]
 *   hasHeader (default true): true reconciles columns by header name (see
 *     file header comment); false merges positionally by column index,
 *     padding shorter rows with blank cells up to the widest row across
 *     every file, with no name-based alignment at all.
 *   includeSourceColumn (default false): true prepends a "Source file"
 *     column (the uploaded file's name) to every output row, so a visitor
 *     merging several exports can still tell which source each row came
 *     from after they're combined.
 * @returns {{
 *   headers: string[]|null,
 *   rows: string[][],
 *   perFile: Array<{
 *     name: string, rowCount: number, columnCount: number,
 *     newColumns: string[], missingColumns: string[],
 *   }>,
 *   totalRows: number,
 *   totalColumns: number,
 * }}
 *   headers is null when hasHeader is false (no reconciled name list
 *   exists). rows never includes a header row itself, hasHeader true or
 *   false -- callers that want a header row in their CSV output prepend
 *   `headers` themselves (see csvMerge.client.js). Every row in `rows` is
 *   exactly `totalColumns` wide (including the source-file column, if
 *   requested), so the output is always rectangular regardless of how
 *   ragged the source files were.
 */
export function mergeCsvFiles(files, opts = {}) {
  const { hasHeader = true, includeSourceColumn = false } = opts;
  const parsed = files.map((f) => ({ name: f.name, allRows: parseCsv(f.text) }));

  if (!hasHeader) {
    let maxCols = 0;
    parsed.forEach((f) => f.allRows.forEach((r) => {
      if (r.length > maxCols) maxCols = r.length;
    }));

    const rows = [];
    const perFile = parsed.map((f) => {
      let colCount = 0;
      f.allRows.forEach((r) => {
        if (isBlankRow(r)) return;
        if (r.length > colCount) colCount = r.length;
        const padded = r.slice();
        while (padded.length < maxCols) padded.push('');
        rows.push(includeSourceColumn ? [f.name, ...padded] : padded);
      });
      return {
        name: f.name,
        rowCount: f.allRows.filter((r) => !isBlankRow(r)).length,
        columnCount: colCount,
        newColumns: [],
        missingColumns: [],
      };
    });

    const totalColumns = maxCols + (includeSourceColumn ? 1 : 0);
    return { headers: null, rows, perFile, totalRows: rows.length, totalColumns };
  }

  const unionHeaders = [];
  const headerToIndex = new Map();
  function ensureColumn(name) {
    if (!headerToIndex.has(name)) {
      headerToIndex.set(name, unionHeaders.length);
      unionHeaders.push(name);
    }
    return headerToIndex.get(name);
  }

  const perFileHeaderRow = parsed.map((f) => (f.allRows.length ? f.allRows[0].map((c) => c.trim()) : []));
  const perFileLocalToUnion = perFileHeaderRow.map((headerRow) =>
    headerRow.map((name) => ensureColumn(name === '' ? '(blank)' : name))
  );

  const rows = [];
  parsed.forEach((f, fi) => {
    const localToUnion = perFileLocalToUnion[fi];
    const body = f.allRows.slice(1);
    body.forEach((r) => {
      if (isBlankRow(r)) return;
      const out = new Array(unionHeaders.length).fill('');
      r.forEach((val, li) => {
        // A body row wider than the file's own header row has extra fields
        // with no column to land in -- dropped, disclosed on the FAQ as a
        // ragged-row limitation, same treatment sortLines.mjs gives a
        // ragged CSV.
        if (li < localToUnion.length) out[localToUnion[li]] = val;
      });
      rows.push(includeSourceColumn ? [f.name, ...out] : out);
    });
  });

  const perFile = parsed.map((f, fi) => {
    const headerRow = perFileHeaderRow[fi];
    const nameSet = new Set(headerRow.map((n) => (n === '' ? '(blank)' : n)));
    const missingColumns = unionHeaders.filter((h) => !nameSet.has(h));

    const earlierNames = new Set();
    for (let j = 0; j < fi; j += 1) {
      perFileHeaderRow[j].forEach((n) => earlierNames.add(n === '' ? '(blank)' : n));
    }
    const newColumns = headerRow
      .map((n) => (n === '' ? '(blank)' : n))
      .filter((n) => !earlierNames.has(n));

    return {
      name: f.name,
      rowCount: f.allRows.slice(1).filter((r) => !isBlankRow(r)).length,
      columnCount: headerRow.length,
      newColumns,
      missingColumns,
    };
  });

  const finalHeaders = includeSourceColumn ? ['Source file', ...unionHeaders] : unionHeaders;
  return {
    headers: finalHeaders,
    rows,
    perFile,
    totalRows: rows.length,
    totalColumns: finalHeaders.length,
  };
}

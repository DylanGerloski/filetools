/**
 * Splits one CSV's rows into multiple smaller files of at most N data rows
 * each -- the shared logic behind the "split CSV by row count" tool. Pure
 * data in, pure data out -- no DOM, no zip encoding -- directly
 * unit-testable in Node (test/splitCsv.test.mjs) and loaded client-side the
 * same way every other src/pure/*.mjs module is.
 *
 * parseCsv() below is a proper character-by-character RFC 4180 state
 * machine rather than a line-splitter: a quoted field legitimately
 * containing an embedded newline (e.g. a multi-line "Notes" column) is one
 * field of one row, not a row boundary -- exactly the case a
 * split-by-row-count tool must not get wrong, since a mis-split there
 * doesn't just look ugly, it changes which file a row lands in and breaks
 * the CSV syntax of both halves. Self-contained by existing convention in
 * this directory (no pure module here imports another); CSV *output*
 * serialization still reuses ../pure/csv.mjs's rowsToCsv client-side (see
 * ../browser/splitCsv.client.js), including its formula-injection
 * neutralization, rather than duplicating that logic.
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
 * Longest base name kept from a visitor-supplied file name. Generous enough
 * for any real export name, short enough that the part suffix and .csv
 * extension never push a generated name anywhere near a filesystem limit.
 */
const MAX_BASE_NAME_LENGTH = 60;

/**
 * @param {string} name a visitor-supplied file name -- untrusted input.
 * @returns {string} a name safe to use as the base of a generated download
 *   filename: extension removed, path separators and '..' sequences and
 *   control characters stripped, length capped, with a plain fallback when
 *   nothing usable remains. The stripping is deliberate security hygiene,
 *   not cosmetics -- a download filename built from untrusted input must
 *   never be able to smuggle a path component.
 */
export function sanitizeBaseName(name) {
  let base = String(name == null ? '' : name);
  const lastDot = base.lastIndexOf('.');
  // lastDot 0 means the whole name is an extension ('.csv') -- slicing to
  // '' is correct there too; the fallback below then takes over.
  if (lastDot >= 0) base = base.slice(0, lastDot);
  base = base
    .replace(/[/\\]/g, '-')
    .replace(/\.\./g, '')
    // eslint-disable-next-line no-control-regex -- stripping control
    // characters from an untrusted filename is the point.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  if (base.length > MAX_BASE_NAME_LENGTH) base = base.slice(0, MAX_BASE_NAME_LENGTH);
  return base || 'split';
}

/**
 * @param {string[]} row
 * @returns {boolean} true if every field is empty (or whitespace-only) --
 *   used to drop stray blank lines rather than carrying them into an output
 *   chunk as a fully-empty row (disclosed on the tool page's FAQ).
 */
function isBlankRow(row) {
  return row.every((cell) => String(cell).trim() === '');
}

/**
 * @param {string} text raw CSV text -- the whole file, untrusted input.
 * @param {{
 *   rowsPerFile: number,
 *   hasHeader?: boolean,
 *   baseName?: string,
 *   maxFiles?: number,
 * }} opts
 *   rowsPerFile: how many DATA rows land in each output file (the repeated
 *     header row, when hasHeader, does not count toward it). Must be a
 *     positive integer -- anything else throws a RangeError, so a broken
 *     caller fails loudly instead of producing a silently-wrong split.
 *   hasHeader (default true): true treats the first parsed non-blank-file
 *     row as a header and repeats it as row 1 of EVERY output file; false
 *     splits purely by position with no header handling at all.
 *   baseName (default 'split'): the source file's name; sanitized here (see
 *     sanitizeBaseName) before it becomes part of any generated filename.
 *   maxFiles (default 2000): ceiling on how many output files one split may
 *     produce. Exceeding it throws a RangeError with a message written for
 *     the visitor -- a 1-row-per-file split of a million-row CSV would
 *     otherwise build a zip directory (and a DOM list) large enough to
 *     freeze the tab, the same failure class the per-file size cap exists
 *     to prevent.
 * @returns {{
 *   baseName: string,
 *   header: string[]|null,
 *   files: Array<{name: string, rows: string[][], dataRowCount: number}>,
 *   totalDataRows: number,
 * }}
 *   Each entry's `rows` is ready for ../pure/csv.mjs's rowsToCsv as-is --
 *   the header row (when hasHeader) is already prepended to every entry.
 *   `files` is empty when the input has no data rows at all.
 */
export function splitCsv(text, opts) {
  const { rowsPerFile, hasHeader = true, baseName = 'split', maxFiles = 2000 } = opts || {};
  if (!Number.isInteger(rowsPerFile) || rowsPerFile < 1) {
    throw new RangeError('Rows per file must be a whole number of 1 or more.');
  }

  const allRows = parseCsv(text);
  const header = hasHeader && allRows.length ? allRows[0] : null;
  const body = (hasHeader ? allRows.slice(1) : allRows).filter((r) => !isBlankRow(r));

  const fileCount = Math.ceil(body.length / rowsPerFile);
  if (fileCount > maxFiles) {
    throw new RangeError(
      `That would produce ${fileCount} files — this tool caps a split at ${maxFiles}. Raise “rows per file” and try again.`
    );
  }

  const base = sanitizeBaseName(baseName);
  // Zero-pad part numbers to a constant width so the files sort correctly
  // by name in any file manager (part-02 before part-10).
  const padWidth = Math.max(2, String(fileCount).length);

  const files = [];
  for (let f = 0; f < fileCount; f += 1) {
    const chunk = body.slice(f * rowsPerFile, (f + 1) * rowsPerFile);
    files.push({
      name: `${base}-part-${String(f + 1).padStart(padWidth, '0')}.csv`,
      rows: header ? [header, ...chunk] : chunk,
      dataRowCount: chunk.length,
    });
  }

  return { baseName: base, header, files, totalDataRows: body.length };
}

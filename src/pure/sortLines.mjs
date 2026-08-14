/**
 * Sorts a pasted/uploaded plain-text list or CSV file by a chosen column --
 * the shared logic behind the "sort text/CSV by column" tool. Every input
 * line is parsed as one CSV row (a plain-text list is just a set of
 * one-field rows under this parsing, so the same code path handles both
 * input shapes without a separate "is this CSV?" branch -- the same
 * reasoning src/pure/dedupeLines.mjs uses for exact-match dedup applies
 * here to column-splitting).
 *
 * Pure data in, pure data out -- no DOM -- directly unit-testable in Node
 * (test/sortLines.test.mjs) and loaded client-side the same way every other
 * src/pure/*.mjs module is.
 *
 * ONE LIMITATION, DISCLOSED ON THE TOOL PAGE'S FAQ RATHER THAN HIDDEN: a
 * quoted CSV field containing an embedded newline is split across two
 * "lines" here, same as splitLines()/parseCsvLine() would show it to a
 * plain text editor -- there is no full RFC 4180 multi-line-field parser.
 */

/**
 * @param {string} text raw input text, any line-ending convention.
 * @returns {string[]} lines with line terminators stripped. Mirrors
 *   dedupeLines.mjs's splitLines() exactly (see that file for the trailing-
 *   newline rule) -- duplicated here rather than imported so every
 *   src/pure/*.mjs module stays a single self-contained file, the existing
 *   convention in this directory (no pure module imports another).
 */
export function splitLines(text) {
  const raw = String(text == null ? '' : text);
  if (raw === '') return [];
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * @param {string[]} lines
 * @returns {string} lines rejoined with '\n' plus one trailing newline.
 */
export function joinLines(lines) {
  return lines.length ? lines.join('\n') + '\n' : '';
}

/**
 * Splits one line into CSV fields: comma-delimited, double-quote enclosed,
 * doubled-quote escaping (RFC 4180 for a single line -- no embedded-newline
 * support, see file header). A line with no comma and no quoting -- i.e.
 * any plain-text list line -- comes back as a single-element array, which
 * is what makes plain text and CSV share one code path throughout this file.
 *
 * @param {string} line
 * @returns {string[]} field values, quotes and doubling removed.
 */
export function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

/**
 * @param {string[]} lines
 * @returns {number} the highest field count across every line -- used to
 *   size the column picker. Returns 1 for an empty `lines` array so callers
 *   never have to special-case "no data yet".
 */
export function columnCount(lines) {
  if (!lines.length) return 1;
  return lines.reduce((max, line) => Math.max(max, parseCsvLine(line).length), 1);
}

/** Matches an integer or decimal, optionally signed, optionally with a
 *  thousands-separated integer part (e.g. "1,234.5" would already have been
 *  split on that comma by parseCsvLine, so this only needs to handle the
 *  plain numeric-cell case: "42", "-3.5", "3.14159", ".5"). */
const NUMERIC_RE = /^-?(\d+(\.\d+)?|\.\d+)$/;

/**
 * @param {string} value
 * @returns {boolean}
 */
function isNumeric(value) {
  return NUMERIC_RE.test(value.trim());
}

/**
 * @param {string[]} values every body-row value in the chosen column
 *   (header excluded).
 * @returns {'numeric'|'alpha'} numeric only if every non-empty value in the
 *   column parses as a number -- a single non-numeric cell (a typo, a unit
 *   suffix, a blank treated as "not a number") falls the whole column back
 *   to alphabetic, since a partially-numeric sort would silently misorder
 *   the non-numeric rows rather than doing anything a visitor would expect.
 */
export function detectColumnType(values) {
  const nonEmpty = values.filter((v) => v.trim() !== '');
  if (!nonEmpty.length) return 'alpha';
  return nonEmpty.every(isNumeric) ? 'numeric' : 'alpha';
}

/**
 * @param {string} value
 * @param {string} type 'numeric'|'alpha'
 * @param {boolean} caseSensitive only used for type:'alpha'.
 * @returns {number|string} a comparable key -- NaN for a non-numeric value
 *   under type:'numeric', so the caller's comparator can push it to the end.
 */
function sortKey(value, type, caseSensitive) {
  if (type === 'numeric') return isNumeric(value) ? parseFloat(value) : NaN;
  return caseSensitive ? value : value.toLowerCase();
}

/**
 * @param {string[]} lines every input line, in original order.
 * @param {{
 *   column?: number,
 *   order?: 'asc'|'desc',
 *   type?: 'auto'|'numeric'|'alpha',
 *   hasHeader?: boolean,
 *   caseSensitive?: boolean,
 * }} [opts]
 *   column (default 0): 0-based field index to sort by. A row shorter than
 *     column+1 fields (a ragged CSV, or a plain-text line when column>0 is
 *     requested) sorts as if that cell were empty, rather than throwing.
 *   order (default 'asc').
 *   type (default 'auto'): 'auto' calls detectColumnType() on the chosen
 *     column's body values; 'numeric'/'alpha' force it explicitly (a visitor
 *     override for a column auto-detection got wrong, e.g. zip codes that
 *     happen to be all-digits but should sort as text).
 *   hasHeader (default false): true keeps lines[0] pinned at the top,
 *     unsorted, and excludes it from both auto-detection and the sort itself.
 *   caseSensitive (default false): alpha-sort case sensitivity. Numeric
 *     values are never case-sensitive (the concept doesn't apply).
 * @returns {{
 *   sorted: string[],
 *   header: string|null,
 *   columnCount: number,
 *   resolvedType: 'numeric'|'alpha',
 *   totalCount: number,
 * }}
 */
export function sortLines(lines, opts = {}) {
  const {
    column = 0,
    order = 'asc',
    type = 'auto',
    hasHeader = false,
    caseSensitive = false,
  } = opts;

  const header = hasHeader && lines.length ? lines[0] : null;
  const body = hasHeader ? lines.slice(1) : lines.slice();

  const cCount = columnCount(lines);
  const col = Math.max(0, Math.min(column, cCount - 1));

  const bodyValues = body.map((line) => {
    const fields = parseCsvLine(line);
    return col < fields.length ? fields[col] : '';
  });

  const resolvedType = type === 'auto' ? detectColumnType(bodyValues) : type;
  const dir = order === 'desc' ? -1 : 1;

  const indexed = body.map((line, i) => ({
    line,
    i,
    key: sortKey(bodyValues[i], resolvedType, caseSensitive),
  }));

  indexed.sort((a, b) => {
    // NaN (a non-numeric value under a numeric sort) always sorts to the
    // end, in EITHER direction -- an "unknown" value isn't meaningfully
    // "highest" or "lowest", and flipping it to the top on a descending
    // sort would look like a bug, not a feature.
    const aNaN = resolvedType === 'numeric' && Number.isNaN(a.key);
    const bNaN = resolvedType === 'numeric' && Number.isNaN(b.key);
    if (aNaN && bNaN) return a.i - b.i;
    if (aNaN) return 1;
    if (bNaN) return -1;

    if (a.key < b.key) return -1 * dir;
    if (a.key > b.key) return 1 * dir;
    return a.i - b.i; // stable tie-break, regardless of sort direction
  });

  const sortedBody = indexed.map((entry) => entry.line);
  const sorted = header !== null ? [header, ...sortedBody] : sortedBody;

  return {
    sorted,
    header,
    columnCount: cCount,
    resolvedType,
    totalCount: lines.length,
  };
}

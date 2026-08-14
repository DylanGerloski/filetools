/**
 * Removes duplicate lines from plain-text input -- the shared logic behind
 * the "remove duplicate lines/rows" tool. Works identically on a plain
 * newline-separated list and on a CSV file: a CSV row that has no quoted
 * field spanning multiple lines is exactly one line of text, so treating
 * every line as an opaque string and comparing lines for exact equality
 * dedupes CSV rows too, without needing a full RFC 4180 parser. See this
 * file's header for the one thing that approach does NOT handle: a quoted
 * CSV field containing an embedded newline would be split across two
 * "lines" here, same as it would look to a plain text editor. That
 * limitation is disclosed on the tool page's FAQ rather than hidden.
 *
 * Pure data in, pure data out -- no DOM -- directly unit-testable in Node
 * (test/dedupeLines.test.mjs) and loaded client-side the same way every
 * other src/pure/*.mjs module is.
 *
 * DEDUP IS EXACT-MATCH, NOT FUZZY: two lines are duplicates only if they
 * compare equal under the options below. Whitespace-only differences
 * ("foo" vs " foo") count as DIFFERENT lines unless ignoreWhitespace is on
 * -- this is a deliberate default (silently treating visually-different
 * input as identical would be a surprising, hard-to-audit thing for a
 * dedup tool to do), documented on the tool page and overridable via the
 * "ignore surrounding whitespace" toggle.
 */

/**
 * @param {string} text raw input text, any line-ending convention.
 * @returns {string[]} lines with line terminators stripped. A single
 *   trailing newline (the common "every line including the last ends with
 *   \n" convention) does not produce a spurious empty final line; any
 *   OTHER blank line -- including more than one trailing newline -- is
 *   preserved as an explicit empty-string line, since it's real content
 *   the visitor typed or the source file contained.
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
 * @param {string} line
 * @param {{caseSensitive?: boolean, ignoreWhitespace?: boolean}} opts
 * @returns {string} the key two lines are compared by -- NOT what gets
 *   kept in the output (the original line text is always what's kept).
 */
function dedupeKey(line, opts) {
  let key = opts.ignoreWhitespace ? line.trim() : line;
  if (!opts.caseSensitive) key = key.toLowerCase();
  return key;
}

/**
 * @param {string[]} lines
 * @param {{caseSensitive?: boolean, ignoreWhitespace?: boolean, skipBlankLines?: boolean}} [opts]
 *   caseSensitive (default true): false makes "Apple"/"apple" duplicates.
 *   ignoreWhitespace (default false): false means "foo"/" foo " are
 *     DIFFERENT lines (see file header); true trims before comparing (and
 *     the ORIGINAL untrimmed text of the first occurrence is what's kept).
 *   skipBlankLines (default false): true removes every blank/whitespace-
 *     only line from the output entirely, rather than deduping them down
 *     to one. Blank lines are otherwise treated like any other line: an
 *     input of five blank lines dedupes to one blank line when this is off.
 * @returns {{ kept: string[], keptIndices: number[], removedIndices: number[],
 *   totalCount: number, duplicateCount: number }}
 */
export function dedupeLines(lines, opts = {}) {
  const { caseSensitive = true, ignoreWhitespace = false, skipBlankLines = false } = opts;
  const seen = new Set();
  const kept = [];
  const keptIndices = [];
  const removedIndices = [];

  lines.forEach((line, i) => {
    if (skipBlankLines && line.trim() === '') {
      removedIndices.push(i);
      return;
    }
    const key = dedupeKey(line, { caseSensitive, ignoreWhitespace });
    if (seen.has(key)) {
      removedIndices.push(i);
      return;
    }
    seen.add(key);
    kept.push(line);
    keptIndices.push(i);
  });

  return {
    kept,
    keptIndices,
    removedIndices,
    totalCount: lines.length,
    duplicateCount: lines.length - kept.length,
  };
}

/**
 * @param {string[]} lines
 * @returns {string} lines rejoined with '\n' plus one trailing newline --
 *   the same convention splitLines() treats as "no spurious empty line",
 *   so splitLines(joinLines(splitLines(x))) round-trips.
 */
export function joinLines(lines) {
  return lines.length ? lines.join('\n') + '\n' : '';
}

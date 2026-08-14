import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitLines, joinLines, parseCsvLine, columnCount, detectColumnType, sortLines } from '../src/pure/sortLines.mjs';

// -- splitLines / joinLines (mirrors dedupeLines.mjs's own tests) ----------

test('splitLines: empty input produces an empty array', () => {
  assert.deepEqual(splitLines(''), []);
});

test('splitLines: a single trailing newline does not create a spurious empty final line', () => {
  assert.deepEqual(splitLines('a\nb\n'), ['a', 'b']);
});

test('splitLines: handles CRLF and lone CR line endings', () => {
  assert.deepEqual(splitLines('a\r\nb\rc'), ['a', 'b', 'c']);
});

test('joinLines: round-trips through splitLines', () => {
  const original = 'a\nb\nc\n';
  assert.equal(joinLines(splitLines(original)), original);
});

// -- parseCsvLine ------------------------------------------------------------

test('parseCsvLine: a plain-text line with no comma is one field', () => {
  assert.deepEqual(parseCsvLine('banana'), ['banana']);
});

test('parseCsvLine: splits unquoted comma-separated fields', () => {
  assert.deepEqual(parseCsvLine('Name,Amount,Date'), ['Name', 'Amount', 'Date']);
});

test('parseCsvLine: a quoted field can contain a comma', () => {
  assert.deepEqual(parseCsvLine('"Smith, John",42'), ['Smith, John', '42']);
});

test('parseCsvLine: doubled quotes inside a quoted field unescape to one quote', () => {
  assert.deepEqual(parseCsvLine('"She said ""hi""",1'), ['She said "hi"', '1']);
});

test('parseCsvLine: an empty line is one empty field', () => {
  assert.deepEqual(parseCsvLine(''), ['']);
});

test('parseCsvLine: trailing comma produces a trailing empty field', () => {
  assert.deepEqual(parseCsvLine('a,b,'), ['a', 'b', '']);
});

// -- columnCount ---------------------------------------------------------------

test('columnCount: empty input is 1 (never 0) so a column picker always has something to offer', () => {
  assert.equal(columnCount([]), 1);
});

test('columnCount: plain-text list is always 1 column', () => {
  assert.equal(columnCount(['apple', 'banana', 'cherry']), 1);
});

test('columnCount: reports the widest row, for a ragged CSV', () => {
  assert.equal(columnCount(['a,b,c', 'd,e']), 3);
});

// -- detectColumnType -----------------------------------------------------------

test('detectColumnType: all-numeric values detect as numeric', () => {
  assert.equal(detectColumnType(['3', '10', '-4.5', '.5']), 'numeric');
});

test('detectColumnType: a single non-numeric value falls the whole column back to alpha', () => {
  assert.equal(detectColumnType(['3', '10', 'N/A']), 'alpha');
});

test('detectColumnType: an all-blank column defaults to alpha rather than throwing', () => {
  assert.equal(detectColumnType(['', '', '']), 'alpha');
});

test('detectColumnType: blank cells are ignored, not counted as non-numeric', () => {
  assert.equal(detectColumnType(['3', '', '10']), 'numeric');
});

// -- sortLines: plain text -------------------------------------------------------

test('sortLines: plain-text list sorts alphabetically ascending by default', () => {
  const result = sortLines(['banana', 'apple', 'cherry']);
  assert.deepEqual(result.sorted, ['apple', 'banana', 'cherry']);
  assert.equal(result.resolvedType, 'alpha');
  assert.equal(result.header, null);
});

test('sortLines: order:desc reverses the comparison', () => {
  const result = sortLines(['banana', 'apple', 'cherry'], { order: 'desc' });
  assert.deepEqual(result.sorted, ['cherry', 'banana', 'apple']);
});

test('sortLines: alpha sort is case-insensitive by default', () => {
  const result = sortLines(['banana', 'Apple', 'cherry']);
  assert.deepEqual(result.sorted, ['Apple', 'banana', 'cherry']);
});

test('sortLines: caseSensitive:true sorts uppercase before lowercase (ASCII order)', () => {
  const result = sortLines(['banana', 'Apple'], { caseSensitive: true });
  assert.deepEqual(result.sorted, ['Apple', 'banana']);
});

test('sortLines: alpha ties (identical values) preserve original relative order (stable)', () => {
  const rows = ['x,3', 'y,1', 'x,2'];
  const result = sortLines(rows, { column: 0 });
  assert.deepEqual(result.sorted, ['x,3', 'x,2', 'y,1']);
});

// -- sortLines: numeric auto-detection -------------------------------------------

test('sortLines: auto-detects a numeric column and sorts numerically, not lexicographically', () => {
  const result = sortLines(['10', '2', '33', '4']);
  assert.equal(result.resolvedType, 'numeric');
  assert.deepEqual(result.sorted, ['2', '4', '10', '33']);
});

test('sortLines: numeric descending', () => {
  const result = sortLines(['10', '2', '33', '4'], { order: 'desc' });
  assert.deepEqual(result.sorted, ['33', '10', '4', '2']);
});

test('sortLines: negative and decimal numbers sort correctly', () => {
  const result = sortLines(['-1.5', '0', '2.25', '-10']);
  assert.deepEqual(result.sorted, ['-10', '-1.5', '0', '2.25']);
});

test('sortLines: numeric ties preserve original relative order', () => {
  const result = sortLines(['a,5', 'b,5', 'c,1'], { column: 1 });
  assert.deepEqual(result.sorted, ['c,1', 'a,5', 'b,5']);
});

// -- sortLines: CSV columns -------------------------------------------------------

test('sortLines: sorts by a chosen column, not the whole line', () => {
  const rows = ['Coffee,4.50', 'Rent,1200', 'Snacks,3.25'];
  const result = sortLines(rows, { column: 1 });
  assert.equal(result.resolvedType, 'numeric');
  assert.deepEqual(result.sorted, ['Snacks,3.25', 'Coffee,4.50', 'Rent,1200']);
});

test('sortLines: hasHeader keeps the header pinned at the top and out of the sort/detection', () => {
  const rows = ['Name,Amount', 'Rent,1200', 'Coffee,4.50', 'Snacks,3.25'];
  const result = sortLines(rows, { column: 1, hasHeader: true });
  assert.equal(result.header, 'Name,Amount');
  assert.deepEqual(result.sorted, ['Name,Amount', 'Snacks,3.25', 'Coffee,4.50', 'Rent,1200']);
});

test('sortLines: a header value like "Amount" would break numeric auto-detection if not excluded', () => {
  // Sanity check that hasHeader really does exclude the header from
  // detectColumnType, not just from the final ordering.
  const rows = ['Amount', '30', '4', '100'];
  const result = sortLines(rows, { hasHeader: true });
  assert.equal(result.resolvedType, 'numeric');
  assert.deepEqual(result.sorted, ['Amount', '4', '30', '100']);
});

test('sortLines: type:"alpha" override forces alphabetic sort on an all-numeric-looking column (e.g. zip codes)', () => {
  const rows = ['02139', '00501', '90210'];
  const result = sortLines(rows, { type: 'alpha' });
  assert.equal(result.resolvedType, 'alpha');
  assert.deepEqual(result.sorted, ['00501', '02139', '90210']);
});

test('sortLines: a mixed numeric/text column falls back to alpha and sorts lexicographically', () => {
  const rows = ['10', '2', 'N/A'];
  const result = sortLines(rows);
  assert.equal(result.resolvedType, 'alpha');
  assert.deepEqual(result.sorted, ['10', '2', 'N/A']);
});

test('sortLines: non-numeric values under a forced numeric sort are pushed to the end, in both directions', () => {
  const rows = ['b,N/A', 'a,3', 'c,1'];
  const asc = sortLines(rows, { column: 1, type: 'numeric' });
  assert.deepEqual(asc.sorted, ['c,1', 'a,3', 'b,N/A']);
  const desc = sortLines(rows, { column: 1, type: 'numeric', order: 'desc' });
  assert.deepEqual(desc.sorted, ['a,3', 'c,1', 'b,N/A']);
});

test('sortLines: a row shorter than the chosen column sorts as if that cell were empty, not throwing', () => {
  const rows = ['a,1,x', 'b', 'c,3,z'];
  const result = sortLines(rows, { column: 2 });
  // 'b' has no field at index 2 -> treated as '' -> sorts first alphabetically.
  assert.deepEqual(result.sorted, ['b', 'a,1,x', 'c,3,z']);
});

test('sortLines: quoted CSV fields containing commas are treated as one field for column selection', () => {
  const rows = ['"Smith, John",42', '"Adams, Amy",7'];
  const result = sortLines(rows, { column: 1 });
  assert.deepEqual(result.sorted, ['"Adams, Amy",7', '"Smith, John",42']);
});

test('sortLines: empty input returns an empty sorted array', () => {
  const result = sortLines([]);
  assert.deepEqual(result.sorted, []);
  assert.equal(result.totalCount, 0);
});

test('sortLines: single-line input returns that line unchanged', () => {
  const result = sortLines(['only-line']);
  assert.deepEqual(result.sorted, ['only-line']);
});

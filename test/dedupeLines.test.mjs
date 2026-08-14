import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitLines, dedupeLines, joinLines } from '../src/pure/dedupeLines.mjs';

// -- splitLines ------------------------------------------------------------

test('splitLines: empty input produces an empty array', () => {
  assert.deepEqual(splitLines(''), []);
});

test('splitLines: a single trailing newline does not create a spurious empty final line', () => {
  assert.deepEqual(splitLines('a\nb\n'), ['a', 'b']);
});

test('splitLines: no trailing newline still splits correctly', () => {
  assert.deepEqual(splitLines('a\nb'), ['a', 'b']);
});

test('splitLines: multiple trailing blank lines are preserved as real empty lines', () => {
  assert.deepEqual(splitLines('a\n\n\n'), ['a', '', '']);
});

test('splitLines: handles CRLF and lone CR line endings', () => {
  assert.deepEqual(splitLines('a\r\nb\rc'), ['a', 'b', 'c']);
});

// -- dedupeLines: core exact-match behavior ---------------------------------

test('dedupeLines: no duplicates returns every line unchanged, in order', () => {
  const result = dedupeLines(['apple', 'banana', 'cherry']);
  assert.deepEqual(result.kept, ['apple', 'banana', 'cherry']);
  assert.equal(result.duplicateCount, 0);
  assert.equal(result.totalCount, 3);
  assert.deepEqual(result.removedIndices, []);
});

test('dedupeLines: all-duplicate input keeps only the first occurrence', () => {
  const result = dedupeLines(['x', 'x', 'x', 'x']);
  assert.deepEqual(result.kept, ['x']);
  assert.equal(result.duplicateCount, 3);
  assert.deepEqual(result.keptIndices, [0]);
  assert.deepEqual(result.removedIndices, [1, 2, 3]);
});

test('dedupeLines: empty input (no lines) is handled cleanly', () => {
  const result = dedupeLines([]);
  assert.deepEqual(result.kept, []);
  assert.equal(result.totalCount, 0);
  assert.equal(result.duplicateCount, 0);
});

test('dedupeLines: keeps first occurrence, removes later duplicates, preserves original order', () => {
  const result = dedupeLines(['a', 'b', 'a', 'c', 'b', 'd']);
  assert.deepEqual(result.kept, ['a', 'b', 'c', 'd']);
  assert.deepEqual(result.keptIndices, [0, 1, 3, 5]);
  assert.deepEqual(result.removedIndices, [2, 4]);
  assert.equal(result.duplicateCount, 2);
});

// -- whitespace-only differences: documented default behavior --------------

test('dedupeLines: whitespace-only differences count as DIFFERENT lines by default (exact match)', () => {
  const result = dedupeLines(['foo', ' foo', 'foo ', '  foo  ']);
  assert.deepEqual(result.kept, ['foo', ' foo', 'foo ', '  foo  ']);
  assert.equal(result.duplicateCount, 0);
});

test('dedupeLines: ignoreWhitespace:true treats whitespace-padded lines as duplicates and keeps the FIRST original (untrimmed) text', () => {
  const result = dedupeLines(['foo', ' foo', 'foo '], { ignoreWhitespace: true });
  assert.deepEqual(result.kept, ['foo']);
  assert.equal(result.duplicateCount, 2);
});

// -- case sensitivity --------------------------------------------------------

test('dedupeLines: case-sensitive by default -- "Apple" and "apple" are different lines', () => {
  const result = dedupeLines(['Apple', 'apple', 'APPLE']);
  assert.deepEqual(result.kept, ['Apple', 'apple', 'APPLE']);
  assert.equal(result.duplicateCount, 0);
});

test('dedupeLines: caseSensitive:false treats differently-cased lines as duplicates and keeps the first casing seen', () => {
  const result = dedupeLines(['Apple', 'apple', 'APPLE'], { caseSensitive: false });
  assert.deepEqual(result.kept, ['Apple']);
  assert.equal(result.duplicateCount, 2);
});

// -- blank lines --------------------------------------------------------------

test('dedupeLines: blank lines dedupe like any other line by default (multiple blanks collapse to one)', () => {
  const result = dedupeLines(['a', '', 'b', '']);
  assert.deepEqual(result.kept, ['a', '', 'b']);
  assert.equal(result.duplicateCount, 1);
});

test('dedupeLines: skipBlankLines:true removes every blank line entirely, not just extras', () => {
  const result = dedupeLines(['a', '', 'b', '', 'c'], { skipBlankLines: true });
  assert.deepEqual(result.kept, ['a', 'b', 'c']);
  assert.equal(result.duplicateCount, 2);
});

test('dedupeLines: skipBlankLines treats a whitespace-only line as blank too', () => {
  const result = dedupeLines(['a', '   ', '\t', 'b'], { skipBlankLines: true });
  assert.deepEqual(result.kept, ['a', 'b']);
});

// -- CSV rows (no embedded-newline quoted fields) behave like any other line -

test('dedupeLines: exact-match dedup works the same on CSV rows as on plain list lines', () => {
  const rows = [
    'Name,Amount',
    'Coffee,4.50',
    'Rent,1200',
    'Coffee,4.50',
  ];
  const result = dedupeLines(rows);
  assert.deepEqual(result.kept, ['Name,Amount', 'Coffee,4.50', 'Rent,1200']);
  assert.equal(result.duplicateCount, 1);
});

test('dedupeLines: a CSV row that differs only by column value is NOT a duplicate', () => {
  const rows = ['Coffee,4.50', 'Coffee,5.00'];
  const result = dedupeLines(rows);
  assert.deepEqual(result.kept, rows);
  assert.equal(result.duplicateCount, 0);
});

// -- joinLines round-trip ------------------------------------------------------

test('joinLines: round-trips through splitLines', () => {
  const original = 'a\nb\nc\n';
  assert.equal(joinLines(splitLines(original)), original);
});

test('joinLines: empty array produces an empty string', () => {
  assert.equal(joinLines([]), '');
});

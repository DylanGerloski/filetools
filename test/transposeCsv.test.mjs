import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, transposeRows, transposeCsv } from '../src/pure/transposeCsv.mjs';

// ---------------------------------------------------------------------------
// parseCsv
// ---------------------------------------------------------------------------

test('parseCsv: a simple two-row CSV', () => {
  assert.deepEqual(parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
});

test('parseCsv: empty text returns no rows', () => {
  assert.deepEqual(parseCsv(''), []);
  assert.deepEqual(parseCsv(null), []);
  assert.deepEqual(parseCsv(undefined), []);
});

test('parseCsv: a trailing newline does not produce a spurious empty row', () => {
  assert.deepEqual(parseCsv('a,b\n1,2\n'), parseCsv('a,b\n1,2'));
});

test('parseCsv: CRLF line endings are treated as a single row boundary', () => {
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
});

test('parseCsv: a quoted field containing a comma is one field', () => {
  assert.deepEqual(parseCsv('Name,Amount\n"Smith, John",42\n'), [['Name', 'Amount'], ['Smith, John', '42']]);
});

test('parseCsv: a quoted field containing an embedded newline stays one field, one row', () => {
  const text = 'Name,Notes\n"Jane","line one\nline two"\n';
  assert.deepEqual(parseCsv(text), [['Name', 'Notes'], ['Jane', 'line one\nline two']]);
});

test('parseCsv: doubled quotes inside a quoted field become one literal quote', () => {
  assert.deepEqual(parseCsv('Label\n"12"" screen"\n'), [['Label'], ['12" screen']]);
});

// ---------------------------------------------------------------------------
// transposeRows
// ---------------------------------------------------------------------------

test('transposeRows: a rectangular 2x3 table becomes 3x2', () => {
  const rows = [['a', 'b', 'c'], ['1', '2', '3']];
  assert.deepEqual(transposeRows(rows), [['a', '1'], ['b', '2'], ['c', '3']]);
});

test('transposeRows: a single row becomes a single column', () => {
  assert.deepEqual(transposeRows([['a', 'b', 'c']]), [['a'], ['b'], ['c']]);
});

test('transposeRows: a single column becomes a single row', () => {
  assert.deepEqual(transposeRows([['a'], ['b'], ['c']]), [['a', 'b', 'c']]);
});

test('transposeRows: transposing twice returns the original table', () => {
  const rows = [['a', 'b', 'c'], ['1', '2', '3'], ['x', 'y', 'z']];
  assert.deepEqual(transposeRows(transposeRows(rows)), rows);
});

test('transposeRows: a ragged row is padded with empty cells before transposing', () => {
  const rows = [['a', 'b', 'c'], ['1', '2']];
  assert.deepEqual(transposeRows(rows), [['a', '1'], ['b', '2'], ['c', '']]);
});

test('transposeRows: empty input returns empty output', () => {
  assert.deepEqual(transposeRows([]), []);
});

test('transposeRows: rows that are all zero-length return empty output', () => {
  assert.deepEqual(transposeRows([[], []]), []);
});

// ---------------------------------------------------------------------------
// transposeCsv
// ---------------------------------------------------------------------------

test('transposeCsv: end-to-end on a simple CSV', () => {
  const result = transposeCsv('Name,Age,City\nAda,30,London\nGrace,34,NYC\n');
  assert.deepEqual(result.transposed, [
    ['Name', 'Ada', 'Grace'],
    ['Age', '30', '34'],
    ['City', 'London', 'NYC'],
  ]);
  assert.equal(result.inputRowCount, 3);
});

test('transposeCsv: blank lines are skipped by default', () => {
  const result = transposeCsv('a,b\n\n1,2\n');
  assert.equal(result.inputRowCount, 2);
  assert.deepEqual(result.transposed, [['a', '1'], ['b', '2']]);
});

test('transposeCsv: skipBlankRows false keeps a literal 1:1 transpose', () => {
  const result = transposeCsv('a,b\n\n1,2\n', { skipBlankRows: false });
  assert.equal(result.inputRowCount, 3);
  assert.deepEqual(result.transposed, [['a', '', '1'], ['b', '', '2']]);
});

test('transposeCsv: empty input produces an empty, well-formed result', () => {
  const result = transposeCsv('');
  assert.deepEqual(result.transposed, []);
  assert.equal(result.inputRowCount, 0);
});

test('transposeCsv: a quoted field with an embedded newline is not split into extra rows', () => {
  const result = transposeCsv('Name,Notes\n"Jane","line one\nline two"\n');
  assert.deepEqual(result.transposed, [
    ['Name', 'Jane'],
    ['Notes', 'line one\nline two'],
  ]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCsv, sanitizeBaseName, splitCsv } from '../src/pure/splitCsv.mjs';

// ---------------------------------------------------------------------
// parseCsv -- the RFC 4180 state machine.

test('parseCsv: plain rows, any line-ending convention', () => {
  assert.deepEqual(parseCsv('a,b\r\n1,2\n3,4'), [['a', 'b'], ['1', '2'], ['3', '4']]);
});

test('parseCsv: quoted field keeps embedded comma and newline as one field', () => {
  const rows = parseCsv('name,notes\r\n"Smith, John","line one\nline two"\r\n');
  assert.deepEqual(rows, [['name', 'notes'], ['Smith, John', 'line one\nline two']]);
});

test('parseCsv: doubled quotes unescape to one quote', () => {
  assert.deepEqual(parseCsv('"say ""hi""",x'), [['say "hi"', 'x']]);
});

test('parseCsv: trailing line ending does not produce a spurious empty row', () => {
  assert.deepEqual(parseCsv('a,b\r\n'), [['a', 'b']]);
  assert.deepEqual(parseCsv(''), []);
});

// ---------------------------------------------------------------------
// sanitizeBaseName -- untrusted-filename hygiene.

test('sanitizeBaseName: strips extension, path separators, dot-dot, and control characters', () => {
  assert.equal(sanitizeBaseName('orders.csv'), 'orders');
  assert.equal(sanitizeBaseName('a/b\\c.csv'), 'a-b-c');
  assert.equal(sanitizeBaseName('..\\..\\windows\\evil.csv'), '--windows-evil');
  assert.ok(!sanitizeBaseName('..\\..\\windows\\evil.csv').includes('..'));
  assert.ok(!/[/\\]/.test(sanitizeBaseName('..\\..\\windows\\evil.csv')));
  assert.equal(sanitizeBaseName('bad\u0000name\u001f.csv'), 'badname');
});

test('sanitizeBaseName: caps length and falls back when nothing usable remains', () => {
  assert.equal(sanitizeBaseName('x'.repeat(200) + '.csv').length, 60);
  assert.equal(sanitizeBaseName(''), 'split');
  assert.equal(sanitizeBaseName('.csv'), 'split');
  assert.equal(sanitizeBaseName(null), 'split');
});

// ---------------------------------------------------------------------
// splitCsv -- the chunking logic itself.

const TEN_ROWS = 'h1,h2\r\n' + Array.from({ length: 10 }, (_, i) => `r${i + 1},v${i + 1}`).join('\r\n') + '\r\n';

test('splitCsv: exact chunk boundaries, header repeated in every file', () => {
  const out = splitCsv(TEN_ROWS, { rowsPerFile: 3, baseName: 'orders.csv' });
  assert.equal(out.totalDataRows, 10);
  assert.equal(out.files.length, 4);
  assert.deepEqual(out.files.map((f) => f.dataRowCount), [3, 3, 3, 1]);
  assert.deepEqual(out.files.map((f) => f.name), [
    'orders-part-01.csv',
    'orders-part-02.csv',
    'orders-part-03.csv',
    'orders-part-04.csv',
  ]);
  // Header is row 0 of every file; data rows follow in order.
  out.files.forEach((f) => assert.deepEqual(f.rows[0], ['h1', 'h2']));
  assert.deepEqual(out.files[0].rows[1], ['r1', 'v1']);
  assert.deepEqual(out.files[3].rows[1], ['r10', 'v10']);
});

test('splitCsv: header row does not count toward rowsPerFile', () => {
  const out = splitCsv(TEN_ROWS, { rowsPerFile: 5 });
  assert.equal(out.files.length, 2);
  assert.equal(out.files[0].rows.length, 6); // header + 5 data rows
});

test('splitCsv: hasHeader false splits purely by position', () => {
  const out = splitCsv('1,2\n3,4\n5,6\n', { rowsPerFile: 2, hasHeader: false });
  assert.equal(out.header, null);
  assert.equal(out.totalDataRows, 3);
  assert.deepEqual(out.files[0].rows, [['1', '2'], ['3', '4']]);
  assert.deepEqual(out.files[1].rows, [['5', '6']]);
});

test('splitCsv: a quoted embedded newline never becomes a row boundary', () => {
  const text = 'name,notes\n"a","first\nsecond"\n"b","plain"\n';
  const out = splitCsv(text, { rowsPerFile: 1 });
  assert.equal(out.files.length, 2);
  assert.deepEqual(out.files[0].rows[1], ['a', 'first\nsecond']);
});

test('splitCsv: fully-blank rows are dropped, rows with any content kept', () => {
  const out = splitCsv('h\na\n\n \nb\n', { rowsPerFile: 10 });
  assert.equal(out.totalDataRows, 2);
  assert.deepEqual(out.files[0].rows, [['h'], ['a'], ['b']]);
});

test('splitCsv: header-only and empty inputs produce zero files, no throw', () => {
  assert.equal(splitCsv('h1,h2\r\n', { rowsPerFile: 5 }).files.length, 0);
  assert.equal(splitCsv('', { rowsPerFile: 5 }).files.length, 0);
});

test('splitCsv: part numbers zero-pad to the width of the file count', () => {
  const body = Array.from({ length: 12 }, (_, i) => `v${i}`).join('\n');
  const out = splitCsv('h\n' + body, { rowsPerFile: 1 });
  assert.equal(out.files.length, 12);
  assert.equal(out.files[0].name, 'split-part-01.csv');
  assert.equal(out.files[11].name, 'split-part-12.csv');
});

test('splitCsv: invalid rowsPerFile throws a RangeError', () => {
  for (const bad of [0, -1, 1.5, NaN, Infinity, '3', undefined]) {
    assert.throws(() => splitCsv('h\na\n', { rowsPerFile: bad }), RangeError);
  }
});

test('splitCsv: exceeding maxFiles throws with a visitor-ready message', () => {
  const body = Array.from({ length: 5 }, (_, i) => `v${i}`).join('\n');
  assert.throws(
    () => splitCsv('h\n' + body, { rowsPerFile: 1, maxFiles: 3 }),
    (err) => err instanceof RangeError && /caps a split at 3/.test(err.message)
  );
});

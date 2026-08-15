import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv,
  columnIsUnique,
  findUniqueKeyColumn,
  diffByKey,
  diffByPosition,
  diffCsvFiles,
  MAX_POSITION_DIFF_CELLS,
} from '../src/pure/csvDiff.mjs';

// ---------------------------------------------------------------------------
// parseCsv (duplicated from csvMerge.mjs -- same coverage, kept minimal here
// since csvMerge.test.mjs already exhaustively covers the shared algorithm)
// ---------------------------------------------------------------------------

test('parseCsv: quoted fields with commas and embedded newlines parse correctly', () => {
  assert.deepEqual(parseCsv('Name,Notes\n"Smith, John","line one\nline two"\n'), [
    ['Name', 'Notes'],
    ['Smith, John', 'line one\nline two'],
  ]);
});

test('parseCsv: empty text returns no rows', () => {
  assert.deepEqual(parseCsv(''), []);
});

// ---------------------------------------------------------------------------
// columnIsUnique / findUniqueKeyColumn
// ---------------------------------------------------------------------------

test('columnIsUnique: true when no two rows share a value in that column', () => {
  assert.equal(columnIsUnique([['1', 'a'], ['2', 'b'], ['3', 'a']], 0), true);
  assert.equal(columnIsUnique([['1', 'a'], ['2', 'b'], ['3', 'a']], 1), false);
});

test('findUniqueKeyColumn: picks the first column unique in both bodies', () => {
  const bodyA = [['1', 'Rent'], ['2', 'Coffee']];
  const bodyB = [['2', 'Coffee'], ['1', 'Rent'], ['3', 'Snacks']];
  assert.equal(findUniqueKeyColumn(bodyA, bodyB, 2), 0);
});

test('findUniqueKeyColumn: null when no column is unique in both', () => {
  const bodyA = [['a', 'x'], ['a', 'x']]; // both columns have a duplicate
  const bodyB = [['b', 'y'], ['b', 'y']];
  assert.equal(findUniqueKeyColumn(bodyA, bodyB, 2), null);
});

test('findUniqueKeyColumn: null when either body has fewer than 2 rows (not a meaningful signal)', () => {
  assert.equal(findUniqueKeyColumn([['1', 'a']], [['1', 'a'], ['2', 'b']], 2), null);
});

// ---------------------------------------------------------------------------
// diffByKey -- the row-order-independent path
// ---------------------------------------------------------------------------

test('diffByKey: matches rows by key regardless of position, detects add/remove/change', () => {
  const bodyA = [
    ['1', 'Rent', '1200'],
    ['2', 'Coffee', '4.50'],
    ['3', 'Gone', '9.00'],
  ];
  const bodyB = [
    ['2', 'Coffee', '5.00'], // changed (amount), reordered to first
    ['1', 'Rent', '1200'], // unchanged, reordered
    ['4', 'New', '2.00'], // added
  ];
  const rows = diffByKey(bodyA, bodyB, 0, { caseSensitive: true, ignoreWhitespace: false });

  const byKey = Object.fromEntries(rows.map((r) => [(r.a || r.b)[0], r]));
  assert.equal(byKey['2'].status, 'changed');
  assert.deepEqual(byKey['2'].changedCells, [2]);
  assert.equal(byKey['1'].status, 'unchanged');
  assert.equal(byKey['4'].status, 'added');
  assert.equal(byKey['3'].status, 'removed');
});

// ---------------------------------------------------------------------------
// diffByPosition -- the LCS path
// ---------------------------------------------------------------------------

test('diffByPosition: a row deleted from the middle does not cascade false changes to every following row', () => {
  const bodyA = [['1'], ['2'], ['3'], ['4'], ['5']];
  const bodyB = [['1'], ['2'], ['4'], ['5']]; // '3' removed
  const { rows } = diffByPosition(bodyA, bodyB, { caseSensitive: true, ignoreWhitespace: false });
  const statuses = rows.map((r) => r.status);
  assert.deepEqual(statuses, ['unchanged', 'unchanged', 'removed', 'unchanged', 'unchanged']);
});

test('diffByPosition: a row inserted in the middle is reported as a single addition, not a cascade', () => {
  const bodyA = [['1'], ['2'], ['4'], ['5']];
  const bodyB = [['1'], ['2'], ['3'], ['4'], ['5']]; // '3' inserted
  const { rows } = diffByPosition(bodyA, bodyB, { caseSensitive: true, ignoreWhitespace: false });
  const statuses = rows.map((r) => r.status);
  assert.deepEqual(statuses, ['unchanged', 'unchanged', 'added', 'unchanged', 'unchanged']);
});

test('diffByPosition: a similar adjacent replace pairs as one "changed" row with cell-level detail', () => {
  const bodyA = [['1', 'Rent', '1200'], ['2', 'Coffee', '4.50']];
  const bodyB = [['1', 'Rent', '1250'], ['2', 'Coffee', '4.50']]; // amount edited
  const { rows } = diffByPosition(bodyA, bodyB, { caseSensitive: true, ignoreWhitespace: false });
  assert.equal(rows[0].status, 'changed');
  assert.deepEqual(rows[0].changedCells, [2]);
  assert.equal(rows[1].status, 'unchanged');
});

test('diffByPosition: a dissimilar adjacent replace is reported as separate removed + added, not a false "changed" pairing', () => {
  const bodyA = [['1', 'Rent', '1200', 'Housing']];
  const bodyB = [['9', 'Totally Unrelated', 'x', 'y']];
  const { rows } = diffByPosition(bodyA, bodyB, { caseSensitive: true, ignoreWhitespace: false });
  const statuses = rows.map((r) => r.status).sort();
  assert.deepEqual(statuses, ['added', 'removed']);
});

test('diffByPosition: single-column rows always pair as "changed" rather than remove+add', () => {
  const bodyA = [['apple']];
  const bodyB = [['banana']];
  const { rows } = diffByPosition(bodyA, bodyB, { caseSensitive: true, ignoreWhitespace: false });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'changed');
});

test('diffByPosition: identical files report everything unchanged', () => {
  const bodyA = [['1', 'a'], ['2', 'b']];
  const bodyB = [['1', 'a'], ['2', 'b']];
  const { rows } = diffByPosition(bodyA, bodyB, { caseSensitive: true, ignoreWhitespace: false });
  assert.ok(rows.every((r) => r.status === 'unchanged'));
});

test('diffByPosition: refuses (overLimit) rather than hangs above MAX_POSITION_DIFF_CELLS', () => {
  const n = Math.ceil(Math.sqrt(MAX_POSITION_DIFF_CELLS)) + 10;
  const bodyA = Array.from({ length: n }, (_, i) => [String(i)]);
  const bodyB = Array.from({ length: n }, (_, i) => [String(i + 1)]);
  const result = diffByPosition(bodyA, bodyB, { caseSensitive: true, ignoreWhitespace: false });
  assert.equal(result.overLimit, true);
  assert.deepEqual(result.rows, []);
});

// ---------------------------------------------------------------------------
// diffCsvFiles -- the full entry point
// ---------------------------------------------------------------------------

test('diffCsvFiles: auto-detects a unique id column and diffs correctly despite reordering', () => {
  const a = 'ID,Name,Amount\n1,Rent,1200\n2,Coffee,4.50\n3,Snacks,3.25\n';
  const b = 'ID,Name,Amount\n2,Coffee,5.00\n1,Rent,1200\n4,New,2.00\n';
  const result = diffCsvFiles(a, b);
  assert.equal(result.mode, 'key');
  assert.equal(result.keyColumn, 0);
  assert.equal(result.autoKeyColumn, 0);
  assert.deepEqual(result.stats, { unchanged: 1, changed: 1, added: 1, removed: 1 });
});

test('diffCsvFiles: falls back to position mode when no column is unique', () => {
  const a = 'Category,Amount\nFood,10\nFood,10\n';
  const b = 'Category,Amount\nFood,10\nFood,10\n';
  const result = diffCsvFiles(a, b);
  assert.equal(result.mode, 'position');
});

test('diffCsvFiles: explicit non-unique keyColumn falls back to position mode with a note', () => {
  const a = 'Category,Amount\nFood,10\nFood,20\n';
  const b = 'Category,Amount\nFood,10\nFood,25\n';
  const result = diffCsvFiles(a, b, { keyColumn: 0 });
  assert.equal(result.mode, 'position');
  assert.equal(result.keyColumnNote, 'not-unique');
});

test('diffCsvFiles: keyColumn null forces position mode even when a unique column exists', () => {
  const a = 'ID,Amount\n1,10\n2,20\n';
  const b = 'ID,Amount\n1,10\n2,25\n';
  const result = diffCsvFiles(a, b, { keyColumn: null });
  assert.equal(result.mode, 'position');
});

test('diffCsvFiles: headerDiff reports a column rename', () => {
  const a = 'ID,Amt\n1,10\n';
  const b = 'ID,Amount\n1,10\n';
  const result = diffCsvFiles(a, b, { keyColumn: null });
  assert.equal(result.headerDiff.changed, true);
  assert.deepEqual(result.headerDiff.changedCells, [1]);
});

test('diffCsvFiles: hasHeader false treats every row (including the first) as data', () => {
  const a = '1,a\n2,b\n';
  const b = '1,a\n2,c\n';
  const result = diffCsvFiles(a, b, { hasHeader: false, keyColumn: null });
  assert.equal(result.headerA, null);
  assert.equal(result.totalA, 2);
});

test('diffCsvFiles: ignoreWhitespace treats " Rent" and "Rent" as equal', () => {
  const a = 'ID,Name\n1, Rent\n';
  const b = 'ID,Name\n1,Rent\n';
  const withWs = diffCsvFiles(a, b, { ignoreWhitespace: false, keyColumn: 0 });
  assert.equal(withWs.rows[0].status, 'changed');
  const noWs = diffCsvFiles(a, b, { ignoreWhitespace: true, keyColumn: 0 });
  assert.equal(noWs.rows[0].status, 'unchanged');
});

test('diffCsvFiles: caseSensitive false treats "Rent" and "rent" as equal', () => {
  const a = 'ID,Name\n1,Rent\n';
  const b = 'ID,Name\n1,rent\n';
  const sensitive = diffCsvFiles(a, b, { caseSensitive: true, keyColumn: 0 });
  assert.equal(sensitive.rows[0].status, 'changed');
  const insensitive = diffCsvFiles(a, b, { caseSensitive: false, keyColumn: 0 });
  assert.equal(insensitive.rows[0].status, 'unchanged');
});

test('diffCsvFiles: blank lines in either file are ignored, not treated as data rows', () => {
  const a = 'ID,Name\n1,Rent\n\n2,Coffee\n';
  const b = 'ID,Name\n1,Rent\n2,Coffee\n';
  const result = diffCsvFiles(a, b, { keyColumn: 0 });
  assert.equal(result.totalA, 2);
  assert.equal(result.stats.changed + result.stats.added + result.stats.removed, 0);
});

test('diffCsvFiles: two empty files diff cleanly with no rows', () => {
  const result = diffCsvFiles('', '');
  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.stats, { unchanged: 0, changed: 0, added: 0, removed: 0 });
});

test('diffCsvFiles: a ragged row (fewer columns than the other file) diffs by treating the missing cell as empty', () => {
  const a = 'ID,Name,Note\n1,Rent,ok\n';
  const b = 'ID,Name,Note\n1,Rent\n'; // Note column missing entirely on this row
  const result = diffCsvFiles(a, b, { keyColumn: 0 });
  assert.equal(result.rows[0].status, 'changed');
  assert.deepEqual(result.rows[0].changedCells, [2]);
});

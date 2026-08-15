import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCellRef, buildGrid, expandMergedRanges, isDateNumFmt, excelSerialToDate } from '../src/pure/xlsxGrid.mjs';

test('parseCellRef reads single- and multi-letter columns correctly', () => {
  assert.deepEqual(parseCellRef('A1'), { row: 0, col: 0 });
  assert.deepEqual(parseCellRef('B3'), { row: 2, col: 1 });
  assert.deepEqual(parseCellRef('Z1'), { row: 0, col: 25 });
  assert.deepEqual(parseCellRef('AA1'), { row: 0, col: 26 });
  assert.deepEqual(parseCellRef('AB10'), { row: 9, col: 27 });
});

test('parseCellRef is case-insensitive and rejects malformed refs', () => {
  assert.deepEqual(parseCellRef('a1'), { row: 0, col: 0 });
  assert.equal(parseCellRef(''), null);
  assert.equal(parseCellRef('1A'), null);
  assert.equal(parseCellRef(null), null);
});

test('buildGrid fills a rectangular grid from sparse cells, gaps as empty string', () => {
  const grid = buildGrid([
    { row: 0, col: 0, text: 'Name' },
    { row: 0, col: 1, text: 'Amount' },
    { row: 1, col: 0, text: 'Coffee' },
    { row: 1, col: 1, text: '4.50' },
    // row 2 has no col 0 -- a merged-looking gap from a sparse sheet
    { row: 2, col: 1, text: '1200' },
  ]);
  assert.deepEqual(grid, [
    ['Name', 'Amount'],
    ['Coffee', '4.50'],
    ['', '1200'],
  ]);
});

test('buildGrid returns [] for no cells', () => {
  assert.deepEqual(buildGrid([]), []);
});

test('expandMergedRanges duplicates a merged range\'s top-left value across the cells it covers', () => {
  const grid = [
    ['Q1 Totals', '', 'North'],
    ['10', '20', '30'],
  ];
  const out = expandMergedRanges(grid, ['A1:B1']);
  assert.deepEqual(out, [
    ['Q1 Totals', 'Q1 Totals', 'North'],
    ['10', '20', '30'],
  ]);
});

test('expandMergedRanges grows the grid if a range extends past its current bounds', () => {
  const grid = [['Title']];
  const out = expandMergedRanges(grid, ['A1:C2']);
  assert.deepEqual(out, [
    ['Title', 'Title', 'Title'],
    ['Title', 'Title', 'Title'],
  ]);
});

test('expandMergedRanges is a no-op for an empty or missing ranges list', () => {
  const grid = [['a', 'b']];
  assert.deepEqual(expandMergedRanges(grid, []), grid);
  assert.deepEqual(expandMergedRanges(grid, undefined), grid);
});

test('isDateNumFmt recognizes the common built-in date/time format ids', () => {
  assert.equal(isDateNumFmt(14), true); // mm-dd-yy
  assert.equal(isDateNumFmt(22), true); // m/d/yy h:mm
  assert.equal(isDateNumFmt(0), false); // General
  assert.equal(isDateNumFmt(2), false); // 0.00
  assert.equal(isDateNumFmt(9), false); // 0%
});

test('isDateNumFmt reads a custom format code when supplied, ignoring quoted literals', () => {
  assert.equal(isDateNumFmt(164, 'yyyy-mm-dd'), true);
  assert.equal(isDateNumFmt(164, 'h:mm:ss'), true);
  assert.equal(isDateNumFmt(164, '0.00"cm"'), false); // literal "cm" isn't a month token
  assert.equal(isDateNumFmt(164, '@'), false); // text format, even though it contains no date letters here
  assert.equal(isDateNumFmt(164, '$#,##0.00'), false);
});

test('excelSerialToDate matches the well-known 1970-01-01 = serial 25569 anchor', () => {
  assert.equal(excelSerialToDate(25569), '1970-01-01');
});

test('excelSerialToDate is exact for real-world (post-1900-02) dates', () => {
  assert.equal(excelSerialToDate(61), '1900-03-01');
  assert.equal(excelSerialToDate(45000), '2023-03-15');
});

test('excelSerialToDate includes a time-of-day component only when the serial has a fractional part', () => {
  assert.equal(excelSerialToDate(45000), '2023-03-15');
  assert.equal(excelSerialToDate(45000.5), '2023-03-15T12:00:00');
  assert.equal(excelSerialToDate(45000.25), '2023-03-15T06:00:00');
});

test('excelSerialToDate returns "" for a non-finite input', () => {
  assert.equal(excelSerialToDate(NaN), '');
  assert.equal(excelSerialToDate('not a number'), '');
});

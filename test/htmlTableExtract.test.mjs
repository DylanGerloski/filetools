import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTableRows, rowsToJsonRecords } from '../src/pure/htmlTableExtract.mjs';

function cell(text, opts = {}) {
  return { text, colSpan: opts.colSpan || 1, rowSpan: opts.rowSpan || 1, isHeader: !!opts.isHeader };
}

test('a plain table with no spans normalizes to the same rectangular grid', () => {
  const rows = [
    [cell('Name', { isHeader: true }), cell('Amount', { isHeader: true })],
    [cell('Coffee'), cell('4.50')],
    [cell('Rent'), cell('1200')],
  ];
  const { grid, headerRowCount } = normalizeTableRows(rows);
  assert.deepEqual(grid, [
    ['Name', 'Amount'],
    ['Coffee', '4.50'],
    ['Rent', '1200'],
  ]);
  assert.equal(headerRowCount, 1);
});

test('colSpan duplicates a cell\'s text across the columns it covers', () => {
  const rows = [
    [cell('Q1', { colSpan: 2, isHeader: true }), cell('Q2', { isHeader: true })],
    [cell('10'), cell('20'), cell('30')],
  ];
  const { grid } = normalizeTableRows(rows);
  assert.deepEqual(grid, [
    ['Q1', 'Q1', 'Q2'],
    ['10', '20', '30'],
  ]);
});

test('rowSpan carries a cell\'s text down into the following row(s) at the same column', () => {
  const rows = [
    [cell('Region', { rowSpan: 2 }), cell('North')],
    [cell('South')],
  ];
  const { grid } = normalizeTableRows(rows);
  assert.deepEqual(grid, [
    ['Region', 'North'],
    ['Region', 'South'],
  ]);
});

test('rowSpan on the last column of a row still fills forward on a shorter following row', () => {
  const rows = [
    [cell('A'), cell('Total', { rowSpan: 3 })],
    [cell('B')],
    [cell('C')],
  ];
  const { grid } = normalizeTableRows(rows);
  assert.deepEqual(grid, [
    ['A', 'Total'],
    ['B', 'Total'],
    ['C', 'Total'],
  ]);
});

test('combined rowSpan and colSpan expand into the correct rectangular grid', () => {
  const rows = [
    [cell('Category', { rowSpan: 2, isHeader: true }), cell('2025', { colSpan: 2, isHeader: true })],
    [cell('Jan', { isHeader: true }), cell('Feb', { isHeader: true })],
    [cell('Sales'), cell('10'), cell('12')],
  ];
  const { grid, headerRowCount } = normalizeTableRows(rows);
  assert.deepEqual(grid, [
    ['Category', '2025', '2025'],
    ['Category', 'Jan', 'Feb'],
    ['Sales', '10', '12'],
  ]);
  assert.equal(headerRowCount, 2, 'both header rows should count since every cell in each is a header cell');
});

test('a row with a mix of header and non-header cells does not count as a header row', () => {
  const rows = [
    [cell('Name', { isHeader: true }), cell('note')],
    [cell('Coffee'), cell('4.50')],
  ];
  const { headerRowCount } = normalizeTableRows(rows);
  assert.equal(headerRowCount, 0);
});

test('an empty input produces an empty grid', () => {
  assert.deepEqual(normalizeTableRows([]), { grid: [], headerRowCount: 0 });
});

test('rowsToJsonRecords uses the header row as keys and the rest as records', () => {
  const grid = [
    ['Name', 'Amount'],
    ['Coffee', '4.50'],
    ['Rent', '1200'],
  ];
  assert.deepEqual(rowsToJsonRecords(grid, true), [
    { Name: 'Coffee', Amount: '4.50' },
    { Name: 'Rent', Amount: '1200' },
  ]);
});

test('rowsToJsonRecords falls back to column_N keys with no header', () => {
  const grid = [
    ['Coffee', '4.50'],
    ['Rent', '1200'],
  ];
  assert.deepEqual(rowsToJsonRecords(grid, false), [
    { column_1: 'Coffee', column_2: '4.50' },
    { column_1: 'Rent', column_2: '1200' },
  ]);
});

test('rowsToJsonRecords de-duplicates blank and repeated header names', () => {
  const grid = [
    ['Name', '', 'Name'],
    ['a', 'b', 'c'],
  ];
  const records = rowsToJsonRecords(grid, true);
  assert.deepEqual(records, [{ Name: 'a', column_2: 'b', Name_2: 'c' }]);
});

test('rowsToJsonRecords on an empty grid returns an empty array', () => {
  assert.deepEqual(rowsToJsonRecords([], true), []);
});

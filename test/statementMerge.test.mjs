import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeStatementTables } from '../src/pure/statementMerge.mjs';

test('mergeStatementTables returns null mainTable and empty otherTables for no input', () => {
  assert.deepEqual(mergeStatementTables([]), { mainTable: null, otherTables: [] });
});

test('mergeStatementTables merges same-shaped tables across pages and drops the repeated header', () => {
  const tables = [
    {
      pageNum: 1,
      headerRowIndex: 0,
      rows: [
        ['Date', 'Description', 'Amount'],
        ['2026-01-02', 'Coffee Shop', '-4.50'],
        ['2026-01-03', 'Paycheck', '1500.00'],
      ],
    },
    {
      pageNum: 2,
      headerRowIndex: 0,
      rows: [
        ['Date', 'Description', 'Amount'],
        ['2026-01-10', 'Grocery Store', '-62.14'],
        ['2026-01-15', 'Electric Co', '-88.20'],
      ],
    },
  ];

  const { mainTable, otherTables } = mergeStatementTables(tables);
  assert.deepEqual(otherTables, []);
  assert.ok(mainTable);
  assert.deepEqual(mainTable.headerRow, ['Date', 'Description', 'Amount']);
  assert.equal(mainTable.columnCount, 3);
  assert.deepEqual(mainTable.sourcePages, [1, 2]);
  assert.deepEqual(mainTable.rows, [
    ['2026-01-02', 'Coffee Shop', '-4.50'],
    ['2026-01-03', 'Paycheck', '1500.00'],
    ['2026-01-10', 'Grocery Store', '-62.14'],
    ['2026-01-15', 'Electric Co', '-88.20'],
  ]);
});

test('mergeStatementTables is case/whitespace-insensitive when matching a repeated header', () => {
  const tables = [
    { pageNum: 1, headerRowIndex: 0, rows: [['Date', 'Amount'], ['1/1', '10.00']] },
    { pageNum: 2, headerRowIndex: 0, rows: [[' date ', ' AMOUNT '], ['1/2', '20.00']] },
  ];
  const { mainTable } = mergeStatementTables(tables);
  assert.deepEqual(mainTable.rows, [['1/1', '10.00'], ['1/2', '20.00']]);
});

test('mergeStatementTables keeps a later page\'s header-shaped first row as data when it does not match the established header', () => {
  const tables = [
    { pageNum: 1, headerRowIndex: 0, rows: [['Date', 'Amount'], ['1/1', '10.00']] },
    // Second page's "header" text differs from page 1's -- not a repeated
    // header, so it must survive as a data row rather than vanish.
    { pageNum: 2, headerRowIndex: 0, rows: [['When', 'How Much'], ['1/2', '20.00']] },
  ];
  const { mainTable } = mergeStatementTables(tables);
  assert.deepEqual(mainTable.rows, [
    ['1/1', '10.00'],
    ['When', 'How Much'],
    ['1/2', '20.00'],
  ]);
});

test('mergeStatementTables picks the column count with the most total rows as primary, and surfaces the rest as otherTables', () => {
  const tables = [
    { pageNum: 1, headerRowIndex: 0, rows: [['Date', 'Description', 'Amount'], ['1/1', 'A', '1.00'], ['1/2', 'B', '2.00'], ['1/3', 'C', '3.00']] },
    // A small 2-column "Account Summary" box elsewhere on the page --
    // fewer total rows than the 3-column transaction table, so it must not
    // become primary and must not be silently dropped either.
    { pageNum: 1, headerRowIndex: null, rows: [['Opening balance', '100.00'], ['Closing balance', '106.00']] },
  ];
  const { mainTable, otherTables } = mergeStatementTables(tables);
  assert.equal(mainTable.columnCount, 3);
  assert.equal(mainTable.rows.length, 3);
  assert.equal(otherTables.length, 1);
  assert.equal(otherTables[0].rows.length, 2);
});

test('mergeStatementTables handles a table with no detected header row (headerRowIndex null) by keeping every row as data', () => {
  const tables = [
    { pageNum: 1, headerRowIndex: null, rows: [['1/1', 'A', '1.00'], ['1/2', 'B', '2.00']] },
  ];
  const { mainTable } = mergeStatementTables(tables);
  assert.equal(mainTable.headerRow, null);
  assert.deepEqual(mainTable.rows, [['1/1', 'A', '1.00'], ['1/2', 'B', '2.00']]);
});

test('mergeStatementTables ignores tables with zero rows entirely', () => {
  const tables = [
    { pageNum: 1, headerRowIndex: null, rows: [] },
    { pageNum: 2, headerRowIndex: 0, rows: [['Date', 'Amount'], ['1/1', '5.00']] },
  ];
  const { mainTable } = mergeStatementTables(tables);
  assert.deepEqual(mainTable.sourcePages, [2]);
  assert.deepEqual(mainTable.rows, [['1/1', '5.00']]);
});

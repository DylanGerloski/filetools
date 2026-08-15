import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCellValue, uniqueKeys, rowsToJsonRecords } from '../src/pure/xlsxExtract.mjs';

test('normalizeCellValue passes plain primitives through unchanged', () => {
  assert.equal(normalizeCellValue('Coffee'), 'Coffee');
  assert.equal(normalizeCellValue(4.5), 4.5);
  assert.equal(normalizeCellValue(true), true);
  assert.equal(normalizeCellValue(null), null);
  assert.equal(normalizeCellValue(undefined), null);
});

test('normalizeCellValue converts a Date cell to an ISO string', () => {
  const d = new Date('2026-08-15T12:00:00.000Z');
  assert.equal(normalizeCellValue(d), '2026-08-15T12:00:00.000Z');
});

test('normalizeCellValue unwraps a formula cell to its cached result, recursively', () => {
  assert.equal(normalizeCellValue({ formula: 'A1+A2', result: 42 }), 42);
  // A formula whose result is itself a date.
  assert.equal(
    normalizeCellValue({ formula: 'TODAY()', result: new Date('2026-08-15T00:00:00.000Z') }),
    '2026-08-15T00:00:00.000Z'
  );
});

test('normalizeCellValue joins a rich-text cell\'s runs into one string', () => {
  assert.equal(
    normalizeCellValue({ richText: [{ text: 'Hello ' }, { text: 'world' }] }),
    'Hello world'
  );
});

test('normalizeCellValue reads the visible text of a hyperlink cell', () => {
  assert.equal(normalizeCellValue({ text: 'filetools', hyperlink: 'https://example.com' }), 'filetools');
});

test('normalizeCellValue stringifies a formula-error cell to its error code', () => {
  assert.equal(normalizeCellValue({ error: '#DIV/0!' }), '#DIV/0!');
});

test('uniqueKeys fills blank headers with column_N and de-duplicates repeats', () => {
  assert.deepEqual(uniqueKeys(['Name', '', 'Name']), ['Name', 'column_2', 'Name_2']);
});

test('rowsToJsonRecords with a header row uses it for keys and preserves cell types', () => {
  const grid = [
    ['Name', 'Price', 'InStock'],
    ['Coffee', 4.5, true],
    ['Tea', 3.25, false],
  ];
  assert.deepEqual(rowsToJsonRecords(grid, true), [
    { Name: 'Coffee', Price: 4.5, InStock: true },
    { Name: 'Tea', Price: 3.25, InStock: false },
  ]);
});

test('rowsToJsonRecords with no header generates column_N keys for every row', () => {
  const grid = [
    ['Coffee', 4.5],
    ['Tea', 3.25],
  ];
  assert.deepEqual(rowsToJsonRecords(grid, false), [
    { column_1: 'Coffee', column_2: 4.5 },
    { column_1: 'Tea', column_2: 3.25 },
  ]);
});

test('rowsToJsonRecords fills a ragged short row\'s missing trailing fields with null', () => {
  const grid = [
    ['Name', 'Price', 'Note'],
    ['Coffee', 4.5],
  ];
  assert.deepEqual(rowsToJsonRecords(grid, true), [
    { Name: 'Coffee', Price: 4.5, Note: null },
  ]);
});

test('rowsToJsonRecords returns an empty array for an empty grid', () => {
  assert.deepEqual(rowsToJsonRecords([], true), []);
});

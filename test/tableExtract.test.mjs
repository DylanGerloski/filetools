import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clusterRows,
  computeColumnBoundaries,
  cellsForRow,
  findTableRuns,
  looksLikeHeaderRow,
  extractTables,
} from '../src/pure/tableExtract.mjs';

/** @param {string} str @param {number} x @param {number} y @param {string} [fontName] */
function item(str, x, y, fontName = 'Helvetica') {
  return { str, x, y, width: str.length * 6, height: 10, fontName };
}

/**
 * A synthetic one-page "document": a short prose sentence, a 3-column table
 * (header + 3 data rows) with real whitespace gaps between columns, and a
 * short prose sentence after it. Prose items are kept narrow and confined
 * to the first column's x-range so they don't spill ink into the
 * inter-column gaps that computeColumnBoundaries looks for -- a real PDF
 * would mostly behave this way too since running text wraps to the page
 * margin, not into a table's column gutters.
 */
function sampleDocItems() {
  return [
    item('Report', 50, 80),
    item('Name', 50, 100), item('Qty', 150, 100), item('Price', 250, 100),
    item('Apples', 50, 112), item('3', 150, 112), item('$1.50', 250, 112),
    item('Bananas', 50, 124), item('12', 150, 124), item('$0.75', 250, 124),
    item('Cherries', 50, 136), item('5', 150, 136), item('$4.20', 250, 136),
    item('End', 50, 156),
  ];
}

test('clusterRows groups items into 6 rows in top-down order', () => {
  const rows = clusterRows(sampleDocItems());
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map((r) => r.items.map((it) => it.str)), [
    ['Report'],
    ['Name', 'Qty', 'Price'],
    ['Apples', '3', '$1.50'],
    ['Bananas', '12', '$0.75'],
    ['Cherries', '5', '$4.20'],
    ['End'],
  ]);
});

test('clusterRows keeps items on the same visual line together even with small y jitter', () => {
  const items = [
    { str: 'A', x: 10, y: 100, width: 6, height: 10, fontName: 'F' },
    { str: 'B', x: 40, y: 101.5, width: 6, height: 10, fontName: 'F' },
    { str: 'C', x: 70, y: 99, width: 6, height: 10, fontName: 'F' },
  ];
  const rows = clusterRows(items);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].items.map((it) => it.str), ['A', 'B', 'C']);
});

test('computeColumnBoundaries finds the two gaps between the three table columns', () => {
  const rows = clusterRows(sampleDocItems());
  const boundaries = computeColumnBoundaries(rows);
  assert.equal(boundaries.length, 2);
  assert.ok(boundaries[0] > 90 && boundaries[0] < 150, `expected first boundary between columns 1/2, got ${boundaries[0]}`);
  assert.ok(boundaries[1] > 168 && boundaries[1] < 250, `expected second boundary between columns 2/3, got ${boundaries[1]}`);
});

test('cellsForRow assigns each item to the correct column bucket and joins with a space', () => {
  const cells = cellsForRow(
    [item('Apples', 50, 112), item('3', 150, 112), item('$1.50', 250, 112)],
    [124, 209]
  );
  assert.deepEqual(cells, ['Apples', '3', '$1.50']);
});

test('cellsForRow joins multiple items in the same cell with a single space', () => {
  const cells = cellsForRow(
    [item('New', 50, 112), item('York', 74, 112)],
    [124]
  );
  assert.deepEqual(cells, ['New York', '']);
});

test('findTableRuns identifies the 4-row table run and excludes the single-cell prose rows', () => {
  const rows = clusterRows(sampleDocItems());
  const boundaries = computeColumnBoundaries(rows);
  const runs = findTableRuns(rows, boundaries);
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0], { startIndex: 1, endIndex: 4, columnCount: 3 });
});

test('findTableRuns requires at least 3 consecutive rows -- a 2-row run is discarded', () => {
  const rows = clusterRows([
    item('A', 50, 100), item('B', 150, 100),
    item('C', 50, 112), item('D', 150, 112),
  ]);
  const boundaries = computeColumnBoundaries(rows);
  assert.deepEqual(findTableRuns(rows, boundaries), []);
});

test('looksLikeHeaderRow: true when the first row is all non-numeric and a later row has numeric cells', () => {
  const rows = clusterRows(sampleDocItems());
  const boundaries = computeColumnBoundaries(rows);
  const runRows = rows.slice(1, 5);
  const cells = runRows.map((r) => cellsForRow(r.items, boundaries));
  assert.equal(looksLikeHeaderRow(runRows, cells), true);
});

test('looksLikeHeaderRow: true when the first row uses a different modal font, even if numeric', () => {
  const runRows = [
    { items: [item('1', 50, 100, 'Bold'), item('2', 150, 100, 'Bold')] },
    { items: [item('10', 50, 112, 'Regular'), item('20', 150, 112, 'Regular')] },
    { items: [item('30', 50, 124, 'Regular'), item('40', 150, 124, 'Regular')] },
  ];
  const cells = runRows.map((r) => r.items.map((it) => it.str));
  assert.equal(looksLikeHeaderRow(runRows, cells), true);
});

test('looksLikeHeaderRow: false for a run of uniformly numeric, same-font data rows', () => {
  const runRows = [
    { items: [item('1', 50, 100), item('2', 150, 100)] },
    { items: [item('10', 50, 112), item('20', 150, 112)] },
    { items: [item('30', 50, 124), item('40', 150, 124)] },
  ];
  const cells = runRows.map((r) => r.items.map((it) => it.str));
  assert.equal(looksLikeHeaderRow(runRows, cells), false);
});

test('extractTables end to end: one table found, header flagged, cells correct, prose excluded', () => {
  const { tables } = extractTables(sampleDocItems());
  assert.equal(tables.length, 1);
  const table = tables[0];
  assert.equal(table.headerRowIndex, 0);
  assert.deepEqual(table.rows, [
    ['Name', 'Qty', 'Price'],
    ['Apples', '3', '$1.50'],
    ['Bananas', '12', '$0.75'],
    ['Cherries', '5', '$4.20'],
  ]);
});

test('extractTables returns no tables for a page of plain prose', () => {
  const items = [
    item('This is just a sentence.', 50, 100),
    item('So is this one.', 50, 112),
    item('And this.', 50, 124),
  ];
  const { tables } = extractTables(items);
  assert.deepEqual(tables, []);
});

test('extractTables returns no tables for an empty page', () => {
  const { tables, rows, columnBoundaries } = extractTables([]);
  assert.deepEqual(tables, []);
  assert.deepEqual(rows, []);
  assert.deepEqual(columnBoundaries, []);
});

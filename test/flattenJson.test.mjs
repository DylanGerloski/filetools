import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPlainObject,
  detectMode,
  flattenValue,
  flattenRecords,
  collectColumns,
  cellText,
  recordsToRows,
  singleToRows,
} from '../src/pure/flattenJson.mjs';

// -- isPlainObject -----------------------------------------------------------

test('isPlainObject: true for a plain object, false for arrays, null, and primitives', () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject({ a: 1 }), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(null), false);
  assert.equal(isPlainObject('x'), false);
  assert.equal(isPlainObject(42), false);
});

// -- detectMode ----------------------------------------------------------------

test('detectMode: a plain object is "single"', () => {
  assert.equal(detectMode({ a: 1 }), 'single');
});

test('detectMode: an array of plain objects is "records"', () => {
  assert.equal(detectMode([{ a: 1 }, { b: 2 }]), 'records');
});

test('detectMode: an empty array is "records" (zero rows)', () => {
  assert.equal(detectMode([]), 'records');
});

test('detectMode: an array mixing objects with non-objects is "single"', () => {
  assert.equal(detectMode([{ a: 1 }, 'x']), 'single');
});

test('detectMode: an array of plain primitives is "single"', () => {
  assert.equal(detectMode([1, 2, 3]), 'single');
});

test('detectMode: a bare top-level primitive is "invalid"', () => {
  assert.equal(detectMode('hello'), 'invalid');
  assert.equal(detectMode(42), 'invalid');
  assert.equal(detectMode(true), 'invalid');
  assert.equal(detectMode(null), 'invalid');
});

// -- flattenValue: core nesting ------------------------------------------------

test('flattenValue: a flat object passes through unchanged (as single keys)', () => {
  assert.deepEqual(flattenValue({ a: 1, b: 'x' }), { a: 1, b: 'x' });
});

test('flattenValue: nested objects join with the default dot delimiter', () => {
  assert.deepEqual(flattenValue({ user: { name: 'Ada', age: 30 } }), {
    'user.name': 'Ada',
    'user.age': 30,
  });
});

test('flattenValue: deep nesting flattens all the way down', () => {
  assert.deepEqual(flattenValue({ a: { b: { c: { d: 1 } } } }), { 'a.b.c.d': 1 });
});

test('flattenValue: a custom delimiter is honored', () => {
  assert.deepEqual(flattenValue({ a: { b: 1 } }, { delimiter: '_' }), { a_b: 1 });
  assert.deepEqual(flattenValue({ a: { b: 1 } }, { delimiter: '/' }), { 'a/b': 1 });
});

// -- flattenValue: arrays --------------------------------------------------------

test('flattenValue: array items get numbered keys by default', () => {
  assert.deepEqual(flattenValue({ roles: ['admin', 'editor'] }), {
    'roles.0': 'admin',
    'roles.1': 'editor',
  });
});

test('flattenValue: nested arrays of objects flatten recursively', () => {
  assert.deepEqual(flattenValue({ items: [{ id: 1 }, { id: 2 }] }), {
    'items.0.id': 1,
    'items.1.id': 2,
  });
});

test('flattenValue: flattenArrays:false keeps the array as one leaf value', () => {
  assert.deepEqual(flattenValue({ roles: ['admin', 'editor'] }, { flattenArrays: false }), {
    roles: ['admin', 'editor'],
  });
});

test('flattenValue: an empty array is kept as a leaf, not dropped', () => {
  assert.deepEqual(flattenValue({ tags: [] }), { tags: [] });
});

// -- flattenValue: empty objects, null, top-level array -------------------------

test('flattenValue: an empty nested object is kept as a leaf, not dropped', () => {
  assert.deepEqual(flattenValue({ meta: {} }), { meta: {} });
});

test('flattenValue: null values are preserved, not treated as an object to descend into', () => {
  assert.deepEqual(flattenValue({ a: null }), { a: null });
});

test('flattenValue: a top-level array (not wrapped in an object) flattens with numeric root keys', () => {
  assert.deepEqual(flattenValue([{ a: 1 }, { a: 2 }]), { '0.a': 1, '1.a': 2 });
});

// -- flattenRecords / collectColumns --------------------------------------------

test('flattenRecords: flattens each record independently', () => {
  const records = [{ a: { b: 1 } }, { a: { b: 2 }, c: 3 }];
  assert.deepEqual(flattenRecords(records), [{ 'a.b': 1 }, { 'a.b': 2, c: 3 }]);
});

test('collectColumns: returns every key seen, in first-seen order, no duplicates', () => {
  const flatRecords = [{ a: 1, b: 2 }, { b: 3, c: 4 }, { a: 5 }];
  assert.deepEqual(collectColumns(flatRecords), ['a', 'b', 'c']);
});

test('collectColumns: an empty array of records yields no columns', () => {
  assert.deepEqual(collectColumns([]), []);
});

// -- cellText ----------------------------------------------------------------

test('cellText: primitives stringify plainly', () => {
  assert.equal(cellText('x'), 'x');
  assert.equal(cellText(42), '42');
  assert.equal(cellText(true), 'true');
  assert.equal(cellText(false), 'false');
});

test('cellText: null and undefined become an empty string', () => {
  assert.equal(cellText(null), '');
  assert.equal(cellText(undefined), '');
});

test('cellText: an object/array leaf serializes as its JSON literal', () => {
  assert.equal(cellText({}), '{}');
  assert.equal(cellText([1, 2]), '[1,2]');
});

// -- recordsToRows -------------------------------------------------------------

test('recordsToRows: builds a header row plus one row per record, missing fields as empty cells', () => {
  const flatRecords = [{ a: 1, b: 2 }, { a: 3 }];
  const columns = collectColumns(flatRecords);
  assert.deepEqual(recordsToRows(flatRecords, columns), [
    ['a', 'b'],
    ['1', '2'],
    ['3', ''],
  ]);
});

// -- singleToRows ----------------------------------------------------------------

test('singleToRows: builds a Key/Value header plus one row per flattened key', () => {
  const flat = flattenValue({ user: { name: 'Ada', age: 30 } });
  assert.deepEqual(singleToRows(flat), [
    ['Key', 'Value'],
    ['user.name', 'Ada'],
    ['user.age', '30'],
  ]);
});

test('singleToRows: a root-level primitive (empty path) is labeled "(root)"', () => {
  // flattenValue on a plain (non-object/array) value produces one entry
  // keyed by the empty-string path -- singleToRows should never emit a
  // literally blank row label for it.
  const flat = flattenValue(42);
  assert.deepEqual(singleToRows(flat), [['Key', 'Value'], ['(root)', '42']]);
});

// -- round trip: flattenValue matches flattenRecords for a single record --------

test('flattenRecords with one record equals flattenValue on that record', () => {
  const record = { a: { b: [1, 2] } };
  assert.deepEqual(flattenRecords([record])[0], flattenValue(record));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlainObject, flattenValue, flattenRecord, collectColumns, parseJsonArray, jsonToCsvRows } from '../src/pure/jsonToCsv.mjs';

// -- isPlainObject -----------------------------------------------------------

test('isPlainObject: true for a plain object', () => {
  assert.equal(isPlainObject({ a: 1 }), true);
});

test('isPlainObject: false for an array, null, and primitives', () => {
  assert.equal(isPlainObject([1, 2]), false);
  assert.equal(isPlainObject(null), false);
  assert.equal(isPlainObject('x'), false);
  assert.equal(isPlainObject(5), false);
  assert.equal(isPlainObject(undefined), false);
});

// -- flattenValue --------------------------------------------------------------

test('flattenValue: null and undefined become an empty string, not the word "null"', () => {
  assert.equal(flattenValue(null), '');
  assert.equal(flattenValue(undefined), '');
});

test('flattenValue: numbers and booleans stringify plainly', () => {
  assert.equal(flattenValue(42), '42');
  assert.equal(flattenValue(true), 'true');
});

test('flattenValue: an array is kept as compact JSON text, not expanded', () => {
  assert.equal(flattenValue(['red', 'blue']), '["red","blue"]');
});

// -- flattenRecord -------------------------------------------------------------

test('flattenRecord: a flat object passes through with its own keys', () => {
  assert.deepEqual(flattenRecord({ name: 'Coffee', price: 4.5 }), { name: 'Coffee', price: '4.5' });
});

test('flattenRecord: a nested object flattens into dot-notation keys', () => {
  const result = flattenRecord({ name: 'Amy', address: { city: 'Reno', zip: '89501' } });
  assert.deepEqual(result, { name: 'Amy', 'address.city': 'Reno', 'address.zip': '89501' });
});

test('flattenRecord: nested objects recurse to any depth', () => {
  const result = flattenRecord({ a: { b: { c: 1 } } });
  assert.deepEqual(result, { 'a.b.c': '1' });
});

test('flattenRecord: an array field is kept as one JSON-text cell, not expanded into columns', () => {
  const result = flattenRecord({ name: 'Amy', tags: ['vip', 'new'] });
  assert.deepEqual(result, { name: 'Amy', tags: '["vip","new"]' });
});

test('flattenRecord: a non-object array item becomes a single "value" column', () => {
  assert.deepEqual(flattenRecord('just a string'), { value: 'just a string' });
  assert.deepEqual(flattenRecord(42), { value: '42' });
  assert.deepEqual(flattenRecord(null), { value: '' });
});

test('flattenRecord: an empty object flattens to no keys', () => {
  assert.deepEqual(flattenRecord({}), {});
});

// -- collectColumns --------------------------------------------------------------

test('collectColumns: union of keys in first-appearance order, not alphabetized', () => {
  const flat = [{ b: '1', a: '2' }, { c: '3', a: '4' }];
  assert.deepEqual(collectColumns(flat), ['b', 'a', 'c']);
});

test('collectColumns: empty input produces no columns', () => {
  assert.deepEqual(collectColumns([]), []);
});

// -- parseJsonArray --------------------------------------------------------------

test('parseJsonArray: valid array of objects parses ok', () => {
  const result = parseJsonArray('[{"a":1},{"a":2}]');
  assert.equal(result.ok, true);
  assert.equal(result.records.length, 2);
});

test('parseJsonArray: empty/whitespace-only input is a friendly error', () => {
  const result = parseJsonArray('   ');
  assert.equal(result.ok, false);
  assert.match(result.error, /empty/i);
});

test('parseJsonArray: malformed JSON is a friendly error, not a raw SyntaxError', () => {
  const result = parseJsonArray('{not: valid}');
  assert.equal(result.ok, false);
  assert.match(result.error, /valid json/i);
});

test('parseJsonArray: a top-level object (not array) is rejected with a specific message', () => {
  const result = parseJsonArray('{"a":1}');
  assert.equal(result.ok, false);
  assert.match(result.error, /array/i);
});

test('parseJsonArray: an empty array is rejected as nothing to convert', () => {
  const result = parseJsonArray('[]');
  assert.equal(result.ok, false);
  assert.match(result.error, /empty/i);
});

// -- jsonToCsvRows ----------------------------------------------------------------

test('jsonToCsvRows: flat objects produce columns in field order and matching rows', () => {
  const { columns, dataRows } = jsonToCsvRows([
    { name: 'Coffee', price: 4.5 },
    { name: 'Tea', price: 3.25 },
  ]);
  assert.deepEqual(columns, ['name', 'price']);
  assert.deepEqual(dataRows, [['Coffee', '4.5'], ['Tea', '3.25']]);
});

test('jsonToCsvRows: a field missing from one object becomes a blank cell, not a shifted row', () => {
  const { columns, dataRows } = jsonToCsvRows([
    { name: 'Coffee', price: 4.5 },
    { name: 'Tea' },
  ]);
  assert.deepEqual(columns, ['name', 'price']);
  assert.deepEqual(dataRows, [['Coffee', '4.5'], ['Tea', '']]);
});

test('jsonToCsvRows: nested objects across records union their dot-notation columns', () => {
  const { columns, dataRows } = jsonToCsvRows([
    { name: 'Amy', address: { city: 'Reno' } },
    { name: 'Bo', address: { city: 'Provo', zip: '84601' } },
  ]);
  assert.deepEqual(columns, ['name', 'address.city', 'address.zip']);
  assert.deepEqual(dataRows, [['Amy', 'Reno', ''], ['Bo', 'Provo', '84601']]);
});

test('jsonToCsvRows: an array of non-object primitives becomes single-column rows', () => {
  const { columns, dataRows } = jsonToCsvRows(['apple', 'banana']);
  assert.deepEqual(columns, ['value']);
  assert.deepEqual(dataRows, [['apple'], ['banana']]);
});

test('jsonToCsvRows: an array of empty objects falls back to a single "value" column rather than zero columns', () => {
  const { columns, dataRows } = jsonToCsvRows([{}, {}]);
  assert.deepEqual(columns, ['value']);
  assert.deepEqual(dataRows, [[''], ['']]);
});

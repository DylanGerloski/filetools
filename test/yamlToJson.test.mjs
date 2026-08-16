import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combineDocuments, jsonSafeValue, formatYamlError } from '../src/pure/yamlToJson.mjs';

// -- combineDocuments --------------------------------------------------------

test('combineDocuments: a single document becomes the top-level value, not wrapped in an array', () => {
  const result = combineDocuments([{ a: 1 }]);
  assert.deepEqual(result, { ok: true, value: { a: 1 }, multiDoc: false });
});

test('combineDocuments: multiple documents become a JSON array of documents, in order', () => {
  const result = combineDocuments([{ a: 1 }, { b: 2 }]);
  assert.deepEqual(result, { ok: true, value: [{ a: 1 }, { b: 2 }], multiDoc: true });
});

test('combineDocuments: a single null document is a real, valid value -- not an error', () => {
  const result = combineDocuments([null]);
  assert.deepEqual(result, { ok: true, value: null, multiDoc: false });
});

test('combineDocuments: zero documents is a friendly error', () => {
  const result = combineDocuments([]);
  assert.equal(result.ok, false);
  assert.match(result.error, /empty/i);
});

test('combineDocuments: a non-array input is a friendly error, not a throw', () => {
  const result = combineDocuments(undefined);
  assert.equal(result.ok, false);
});

// -- jsonSafeValue -------------------------------------------------------------

test('jsonSafeValue: plain primitives pass through unchanged', () => {
  assert.equal(jsonSafeValue('hi'), 'hi');
  assert.equal(jsonSafeValue(42), 42);
  assert.equal(jsonSafeValue(true), true);
  assert.equal(jsonSafeValue(null), null);
});

test('jsonSafeValue: NaN and +/-Infinity become their string name instead of silently becoming null', () => {
  assert.equal(jsonSafeValue(NaN), 'NaN');
  assert.equal(jsonSafeValue(Infinity), 'Infinity');
  assert.equal(jsonSafeValue(-Infinity), '-Infinity');
});

test('jsonSafeValue: recurses into arrays and objects', () => {
  assert.deepEqual(jsonSafeValue({ a: [1, NaN, { b: Infinity }] }), { a: [1, 'NaN', { b: 'Infinity' }] });
});

test('jsonSafeValue: leaves a Date instance untouched (JSON.stringify handles it via toJSON)', () => {
  const d = new Date('2026-08-15T12:00:00.000Z');
  const out = jsonSafeValue({ when: d });
  assert.ok(out.when instanceof Date);
  assert.equal(JSON.stringify(out), '{"when":"2026-08-15T12:00:00.000Z"}');
});

// -- formatYamlError -------------------------------------------------------------

test('formatYamlError: keeps only the first line of a multi-line js-yaml message', () => {
  const err = { message: 'bad indentation of a mapping entry (2:4)\n\n 1 | a: b\n 2 |   c: d\n--------^' };
  const msg = formatYamlError(err);
  assert.match(msg, /^That isn’t valid YAML — bad indentation of a mapping entry \(2:4\)\./);
  assert.doesNotMatch(msg, /\n/);
});

test('formatYamlError: falls back to a generic reason when the error has no message', () => {
  const msg = formatYamlError({});
  assert.match(msg, /the syntax couldn’t be parsed/);
});

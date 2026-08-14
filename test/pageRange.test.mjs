import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePageRange } from '../src/pure/pageRange.mjs';

test('single page numbers', () => {
  assert.deepEqual(parsePageRange('1, 3, 5', 10), [0, 2, 4]);
});

test('a simple range', () => {
  assert.deepEqual(parsePageRange('1-3', 10), [0, 1, 2]);
});

test('mixed ranges and singles, out of order', () => {
  assert.deepEqual(parsePageRange('7, 1-3, 9-12', 12), [0, 1, 2, 6, 8, 9, 10, 11]);
});

test('reversed range is normalized', () => {
  assert.deepEqual(parsePageRange('5-2', 10), [1, 2, 3, 4]);
});

test('duplicates and overlaps are deduplicated', () => {
  assert.deepEqual(parsePageRange('1-3, 2-4, 3', 10), [0, 1, 2, 3]);
});

test('out-of-bounds numbers are clamped away', () => {
  assert.deepEqual(parsePageRange('0, 1-3, 99', 5), [0, 1, 2]);
});

test('whitespace and trailing commas are tolerated', () => {
  assert.deepEqual(parsePageRange('  1 - 3 ,  7 ,  ', 10), [0, 1, 2, 6]);
});

test('empty input returns an empty list rather than throwing', () => {
  assert.deepEqual(parsePageRange('', 10), []);
  assert.deepEqual(parsePageRange('   ', 10), []);
});

test('a string with no parseable number throws a visitor-facing message', () => {
  assert.throws(() => parsePageRange('all of them please', 10), /doesn’t look like a page range/);
});

test('a range that is entirely out of bounds still throws (matched numbers, but nothing survives clamping) is NOT an error -- returns empty', () => {
  // Numbers were matched (so matchedAny=true) even though clamping removes
  // them all -- this is intentionally a valid-but-empty result, not a
  // parse error, so the caller can show a more specific "no pages in range"
  // message instead of a generic parse-failure one.
  assert.deepEqual(parsePageRange('500-600', 10), []);
});

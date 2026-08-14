import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvEscapeField, rowsToCsv } from '../src/pure/csv.mjs';

test('a plain field is returned as-is', () => {
  assert.equal(csvEscapeField('Revenue'), 'Revenue');
});

test('a field containing a comma is quoted', () => {
  assert.equal(csvEscapeField('Smith, John'), '"Smith, John"');
});

test('a field containing a double quote is quoted and the quote is doubled', () => {
  assert.equal(csvEscapeField('12" screen'), '"12"" screen"');
});

test('a field containing a newline is quoted', () => {
  assert.equal(csvEscapeField('line one\nline two'), '"line one\nline two"');
});

test('null and undefined become an empty field', () => {
  assert.equal(csvEscapeField(null), '');
  assert.equal(csvEscapeField(undefined), '');
});

test('numbers are stringified', () => {
  assert.equal(csvEscapeField(42), '42');
});

test('rowsToCsv joins fields with commas and rows with CRLF, quoting as needed', () => {
  const rows = [
    ['Name', 'Amount'],
    ['Smith, John', '1,234.50'],
  ];
  assert.equal(rowsToCsv(rows), 'Name,Amount\r\n"Smith, John","1,234.50"\r\n');
});

test('an empty rows array produces just the trailing CRLF', () => {
  assert.equal(rowsToCsv([]), '\r\n');
});

test('a formula-injection payload starting with = gets a single-quote prefix', () => {
  assert.equal(csvEscapeField('=cmd|"/c calc"!A1'), '"\'=cmd|""/c calc""!A1"');
});

test('a negative number is not treated as formula injection', () => {
  assert.equal(csvEscapeField('-42.5'), '-42.5');
});

test('a negative number with thousands separators is not corrupted', () => {
  assert.equal(csvEscapeField('-1,234.50'), '"-1,234.50"');
});

test('a leading minus that is not a valid number gets a single-quote prefix', () => {
  assert.equal(csvEscapeField('-cmd|calc'), "'-cmd|calc");
});

test('a normal alphanumeric cell is untouched', () => {
  assert.equal(csvEscapeField('Revenue Q3'), 'Revenue Q3');
});

test('a field starting with + gets a single-quote prefix', () => {
  assert.equal(csvEscapeField('+1+1'), "'+1+1");
});

test('a field starting with @ gets a single-quote prefix', () => {
  assert.equal(csvEscapeField('@SUM(1+1)'), "'@SUM(1+1)");
});

test('a field starting with a TAB gets a single-quote prefix', () => {
  assert.equal(csvEscapeField('\t=1+1'), '\'\t=1+1');
});

test('a field starting with a CR gets a single-quote prefix', () => {
  assert.equal(csvEscapeField('\r=1+1'), '"\'\r=1+1"');
});

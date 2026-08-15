import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, mergeCsvFiles } from '../src/pure/csvMerge.mjs';

// ---------------------------------------------------------------------------
// parseCsv
// ---------------------------------------------------------------------------

test('parseCsv: a simple two-row CSV', () => {
  assert.deepEqual(parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
});

test('parseCsv: empty text returns no rows', () => {
  assert.deepEqual(parseCsv(''), []);
  assert.deepEqual(parseCsv(null), []);
  assert.deepEqual(parseCsv(undefined), []);
});

test('parseCsv: a trailing newline does not produce a spurious empty row', () => {
  assert.deepEqual(parseCsv('a,b\n1,2\n'), parseCsv('a,b\n1,2'));
});

test('parseCsv: CRLF line endings are treated as a single row boundary', () => {
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
});

test('parseCsv: bare CR line endings work too', () => {
  assert.deepEqual(parseCsv('a,b\r1,2\r'), [['a', 'b'], ['1', '2']]);
});

test('parseCsv: a quoted field containing a comma is one field', () => {
  assert.deepEqual(parseCsv('Name,Amount\n"Smith, John",42\n'), [['Name', 'Amount'], ['Smith, John', '42']]);
});

test('parseCsv: a quoted field containing an embedded newline stays one field, one row', () => {
  const text = 'Name,Notes\n"Jane","line one\nline two"\n';
  assert.deepEqual(parseCsv(text), [['Name', 'Notes'], ['Jane', 'line one\nline two']]);
});

test('parseCsv: doubled quotes inside a quoted field become one literal quote', () => {
  assert.deepEqual(parseCsv('Label\n"12"" screen"\n'), [['Label'], ['12" screen']]);
});

test('parseCsv: a field with no comma or quoting is returned as-is', () => {
  assert.deepEqual(parseCsv('hello\n'), [['hello']]);
});

test('parseCsv: a single empty quoted field is not lost', () => {
  assert.deepEqual(parseCsv('""'), [['']]);
});

test('parseCsv: a trailing comma with no following value adds a trailing empty field', () => {
  assert.deepEqual(parseCsv('a,b,\n'), [['a', 'b', '']]);
});

// ---------------------------------------------------------------------------
// mergeCsvFiles -- hasHeader: true (default)
// ---------------------------------------------------------------------------

test('mergeCsvFiles: identical headers merge rows in file order', () => {
  const files = [
    { name: 'jan.csv', text: 'Name,Amount\nRent,1200\nCoffee,4.50\n' },
    { name: 'feb.csv', text: 'Name,Amount\nRent,1200\nSnacks,3.25\n' },
  ];
  const result = mergeCsvFiles(files);
  assert.deepEqual(result.headers, ['Name', 'Amount']);
  assert.deepEqual(result.rows, [
    ['Rent', '1200'],
    ['Coffee', '4.50'],
    ['Rent', '1200'],
    ['Snacks', '3.25'],
  ]);
  assert.equal(result.totalRows, 4);
  assert.equal(result.totalColumns, 2);
});

test('mergeCsvFiles: a file with an extra column gets that column added to the union, others blank-filled', () => {
  const files = [
    { name: 'a.csv', text: 'Name,Amount\nRent,1200\n' },
    { name: 'b.csv', text: 'Name,Amount,Category\nCoffee,4.50,Food\n' },
  ];
  const result = mergeCsvFiles(files);
  assert.deepEqual(result.headers, ['Name', 'Amount', 'Category']);
  assert.deepEqual(result.rows, [
    ['Rent', '1200', ''],
    ['Coffee', '4.50', 'Food'],
  ]);
});

test('mergeCsvFiles: per-file summary reports new and missing columns', () => {
  const files = [
    { name: 'a.csv', text: 'Name,Amount\nRent,1200\n' },
    { name: 'b.csv', text: 'Name,Amount,Category\nCoffee,4.50,Food\n' },
  ];
  const result = mergeCsvFiles(files);
  assert.deepEqual(result.perFile[0], {
    name: 'a.csv', rowCount: 1, columnCount: 2, newColumns: ['Name', 'Amount'], missingColumns: ['Category'],
  });
  assert.deepEqual(result.perFile[1], {
    name: 'b.csv', rowCount: 1, columnCount: 3, newColumns: ['Category'], missingColumns: [],
  });
});

test('mergeCsvFiles: columns out of order still align by header name', () => {
  const files = [
    { name: 'a.csv', text: 'Name,Amount\nRent,1200\n' },
    { name: 'b.csv', text: 'Amount,Name\n4.50,Coffee\n' },
  ];
  const result = mergeCsvFiles(files);
  assert.deepEqual(result.headers, ['Name', 'Amount']);
  assert.deepEqual(result.rows, [
    ['Rent', '1200'],
    ['Coffee', '4.50'],
  ]);
});

test('mergeCsvFiles: header matching is case-sensitive', () => {
  const files = [
    { name: 'a.csv', text: 'Email\na@x.com\n' },
    { name: 'b.csv', text: 'email\nb@x.com\n' },
  ];
  const result = mergeCsvFiles(files);
  assert.deepEqual(result.headers, ['Email', 'email']);
  assert.deepEqual(result.rows, [
    ['a@x.com', ''],
    ['', 'b@x.com'],
  ]);
});

test('mergeCsvFiles: header names are trimmed before matching', () => {
  const files = [
    { name: 'a.csv', text: 'Name, Amount\nRent,1200\n' },
    { name: 'b.csv', text: 'Name,Amount \nCoffee,4.50\n' },
  ];
  const result = mergeCsvFiles(files);
  assert.deepEqual(result.headers, ['Name', 'Amount']);
});

test('mergeCsvFiles: a body row wider than its file\'s header drops the extra fields', () => {
  const files = [
    { name: 'a.csv', text: 'Name,Amount\nRent,1200,extra\n' },
  ];
  const result = mergeCsvFiles(files);
  assert.deepEqual(result.rows, [['Rent', '1200']]);
});

test('mergeCsvFiles: blank lines in the body are skipped, not carried into the output', () => {
  const files = [
    { name: 'a.csv', text: 'Name,Amount\nRent,1200\n\nCoffee,4.50\n' },
  ];
  const result = mergeCsvFiles(files);
  assert.equal(result.totalRows, 2);
  assert.deepEqual(result.rows, [['Rent', '1200'], ['Coffee', '4.50']]);
});

test('mergeCsvFiles: an empty file contributes nothing but is still reported', () => {
  const files = [
    { name: 'a.csv', text: 'Name,Amount\nRent,1200\n' },
    { name: 'empty.csv', text: '' },
  ];
  const result = mergeCsvFiles(files);
  assert.equal(result.totalRows, 1);
  assert.deepEqual(result.perFile[1], { name: 'empty.csv', rowCount: 0, columnCount: 0, newColumns: [], missingColumns: ['Name', 'Amount'] });
});

test('mergeCsvFiles: includeSourceColumn prepends the file name to every row and header', () => {
  const files = [
    { name: 'jan.csv', text: 'Name,Amount\nRent,1200\n' },
    { name: 'feb.csv', text: 'Name,Amount\nCoffee,4.50\n' },
  ];
  const result = mergeCsvFiles(files, { includeSourceColumn: true });
  assert.deepEqual(result.headers, ['Source file', 'Name', 'Amount']);
  assert.deepEqual(result.rows, [
    ['jan.csv', 'Rent', '1200'],
    ['feb.csv', 'Coffee', '4.50'],
  ]);
  assert.equal(result.totalColumns, 3);
});

// ---------------------------------------------------------------------------
// mergeCsvFiles -- hasHeader: false
// ---------------------------------------------------------------------------

test('mergeCsvFiles: hasHeader false merges every row positionally, no name matching', () => {
  const files = [
    { name: 'a.csv', text: 'Rent,1200\n' },
    { name: 'b.csv', text: 'Coffee,4.50,Food\n' },
  ];
  const result = mergeCsvFiles(files, { hasHeader: false });
  assert.equal(result.headers, null);
  assert.deepEqual(result.rows, [
    ['Rent', '1200', ''],
    ['Coffee', '4.50', 'Food'],
  ]);
  assert.equal(result.totalColumns, 3);
});

test('mergeCsvFiles: hasHeader false with includeSourceColumn', () => {
  const files = [{ name: 'a.csv', text: 'Rent,1200\n' }];
  const result = mergeCsvFiles(files, { hasHeader: false, includeSourceColumn: true });
  assert.deepEqual(result.rows, [['a.csv', 'Rent', '1200']]);
  assert.equal(result.totalColumns, 3);
});

test('mergeCsvFiles: no files produces an empty, well-formed result', () => {
  const result = mergeCsvFiles([]);
  assert.deepEqual(result.headers, []);
  assert.deepEqual(result.rows, []);
  assert.equal(result.totalRows, 0);
});

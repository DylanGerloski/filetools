import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containsDoctype, nodeToJsonValue, documentToJsonValue, formatXmlParseError } from '../src/pure/xmlToJson.mjs';

// -- containsDoctype ----------------------------------------------------

test('containsDoctype: true for a real DOCTYPE declaration', () => {
  assert.equal(containsDoctype('<?xml version="1.0"?><!DOCTYPE foo><foo/>'), true);
});

test('containsDoctype: case-insensitive', () => {
  assert.equal(containsDoctype('<!doctype foo><foo/>'), true);
});

test('containsDoctype: false for ordinary XML with no DOCTYPE', () => {
  assert.equal(containsDoctype('<foo><bar>hi</bar></foo>'), false);
});

// -- nodeToJsonValue ------------------------------------------------------

test('nodeToJsonValue: a leaf element with only text becomes a plain string', () => {
  const node = { tag: 'name', attrs: [], children: [{ type: 'text', text: 'Coffee' }] };
  assert.equal(nodeToJsonValue(node), 'Coffee');
});

test('nodeToJsonValue: leading/trailing whitespace around leaf text is trimmed', () => {
  const node = { tag: 'name', attrs: [], children: [{ type: 'text', text: '  Coffee  ' }] };
  assert.equal(nodeToJsonValue(node), 'Coffee');
});

test('nodeToJsonValue: an empty element (no attrs, no children, no text) becomes an empty string, not null', () => {
  const node = { tag: 'empty', attrs: [], children: [] };
  assert.equal(nodeToJsonValue(node), '');
});

test('nodeToJsonValue: a whitespace-only element becomes an empty string', () => {
  const node = { tag: 'empty', attrs: [], children: [{ type: 'text', text: '   \n  ' }] };
  assert.equal(nodeToJsonValue(node), '');
});

test('nodeToJsonValue: attributes become "@name" keys holding string values', () => {
  const node = { tag: 'item', attrs: [['id', '5'], ['sku', 'A100']], children: [] };
  assert.deepEqual(nodeToJsonValue(node), { '@id': '5', '@sku': 'A100' });
});

test('nodeToJsonValue: an attribute value that looks numeric stays a string, never auto-coerced', () => {
  const node = { tag: 'zip', attrs: [['code', '00501']], children: [] };
  const value = nodeToJsonValue(node);
  assert.equal(value['@code'], '00501');
  assert.equal(typeof value['@code'], 'string');
});

test('nodeToJsonValue: child elements become keys named after their own tag', () => {
  const node = {
    tag: 'order',
    attrs: [],
    children: [
      { type: 'element', node: { tag: 'item', attrs: [], children: [{ type: 'text', text: 'Coffee' }] } },
      { type: 'element', node: { tag: 'price', attrs: [], children: [{ type: 'text', text: '4.50' }] } },
    ],
  };
  assert.deepEqual(nodeToJsonValue(node), { item: 'Coffee', price: '4.50' });
});

test('nodeToJsonValue: repeated sibling tags become an array, in document order', () => {
  const node = {
    tag: 'items',
    attrs: [],
    children: [
      { type: 'element', node: { tag: 'item', attrs: [], children: [{ type: 'text', text: 'A' }] } },
      { type: 'element', node: { tag: 'item', attrs: [], children: [{ type: 'text', text: 'B' }] } },
      { type: 'element', node: { tag: 'item', attrs: [], children: [{ type: 'text', text: 'C' }] } },
    ],
  };
  assert.deepEqual(nodeToJsonValue(node), { item: ['A', 'B', 'C'] });
});

test('nodeToJsonValue: a single occurrence of a tag stays a plain value, not a one-item array', () => {
  const node = {
    tag: 'items',
    attrs: [],
    children: [{ type: 'element', node: { tag: 'item', attrs: [], children: [{ type: 'text', text: 'A' }] } }],
  };
  assert.deepEqual(nodeToJsonValue(node), { item: 'A' });
});

test('nodeToJsonValue: text alongside attributes becomes a "#text" key', () => {
  const node = { tag: 'note', attrs: [['lang', 'en']], children: [{ type: 'text', text: 'hello' }] };
  assert.deepEqual(nodeToJsonValue(node), { '@lang': 'en', '#text': 'hello' });
});

test('nodeToJsonValue: text alongside child elements becomes a "#text" key (mixed content)', () => {
  const node = {
    tag: 'p',
    attrs: [],
    children: [
      { type: 'text', text: 'Hello ' },
      { type: 'element', node: { tag: 'b', attrs: [], children: [{ type: 'text', text: 'world' }] } },
      { type: 'text', text: '!' },
    ],
  };
  // Mixed-content text runs collapse into one "#text" string, losing their
  // original position relative to <b> -- documented limitation, see
  // ../src/pure/xmlToJson.mjs's header comment.
  assert.deepEqual(nodeToJsonValue(node), { b: 'world', '#text': 'Hello !' });
});

test('nodeToJsonValue: whitespace-only text between child elements (pretty-printed indentation) is dropped, not kept as "#text"', () => {
  const node = {
    tag: 'order',
    attrs: [],
    children: [
      { type: 'text', text: '\n  ' },
      { type: 'element', node: { tag: 'item', attrs: [], children: [{ type: 'text', text: 'Coffee' }] } },
      { type: 'text', text: '\n' },
    ],
  };
  assert.deepEqual(nodeToJsonValue(node), { item: 'Coffee' });
});

test('nodeToJsonValue: attributes with no text and no children still become an object, not a string', () => {
  const node = { tag: 'a', attrs: [['x', '1']], children: [] };
  assert.deepEqual(nodeToJsonValue(node), { '@x': '1' });
});

// -- documentToJsonValue ---------------------------------------------------

test('documentToJsonValue: wraps the result under the root element\'s own tag name', () => {
  const root = { tag: 'note', attrs: [], children: [{ type: 'text', text: 'hi' }] };
  assert.deepEqual(documentToJsonValue(root), { note: 'hi' });
});

test('documentToJsonValue: a realistic small document with an attribute and two child elements', () => {
  const root = {
    tag: 'order',
    attrs: [['id', '1']],
    children: [
      { type: 'element', node: { tag: 'item', attrs: [], children: [{ type: 'text', text: 'Coffee' }] } },
      { type: 'element', node: { tag: 'price', attrs: [], children: [{ type: 'text', text: '4.50' }] } },
    ],
  };
  assert.deepEqual(documentToJsonValue(root), { order: { '@id': '1', item: 'Coffee', price: '4.50' } });
});

// -- formatXmlParseError ----------------------------------------------------

test('formatXmlParseError: extracts the reason from Chromium\'s "error on line N at column M" format', () => {
  const raw = 'This page contains the following errors:\nerror on line 1 at column 20: mismatched tag\nBelow is a rendering of the page up to the first error.';
  const msg = formatXmlParseError(raw);
  assert.equal(msg, 'That isn’t valid XML - mismatched tag. Check the tags and try again.');
});

test('formatXmlParseError: falls back to the first non-empty line for an unrecognized format', () => {
  const msg = formatXmlParseError('Some other parser error text');
  assert.equal(msg, 'That isn’t valid XML - Some other parser error text. Check the tags and try again.');
});

test('formatXmlParseError: falls back to a generic reason for empty/missing error text', () => {
  const msg = formatXmlParseError('');
  assert.match(msg, /the syntax couldn.t be parsed/);
});

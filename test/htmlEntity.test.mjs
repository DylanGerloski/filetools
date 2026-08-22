import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeHtmlEntities, decodeHtmlEntities, NAMED_ENTITY_TO_CHAR } from '../src/pure/htmlEntity.mjs';

// -- encodeHtmlEntities: default scope (reserved) -----------------------------

test('encodeHtmlEntities: default scope only escapes the five HTML-significant characters', () => {
  const result = encodeHtmlEntities('Tom & Jerry\'s <b>bold</b> "quote"');
  assert.equal(result.output, 'Tom &amp; Jerry&apos;s &lt;b&gt;bold&lt;/b&gt; &quot;quote&quot;');
  assert.equal(result.encodedCount, 8);
});

test('encodeHtmlEntities: plain text with nothing to escape passes through unchanged', () => {
  const result = encodeHtmlEntities('just plain text, no markup here');
  assert.equal(result.output, 'just plain text, no markup here');
  assert.equal(result.encodedCount, 0);
  assert.equal(result.totalChars, 31);
});

test('encodeHtmlEntities: default scope leaves accented letters and emoji untouched', () => {
  const result = encodeHtmlEntities('café 😀');
  assert.equal(result.output, 'café 😀');
  assert.equal(result.encodedCount, 0);
});

test('encodeHtmlEntities: empty input produces an empty result, not an error', () => {
  const result = encodeHtmlEntities('');
  assert.equal(result.output, '');
  assert.equal(result.totalChars, 0);
  assert.equal(result.encodedCount, 0);
});

// -- encodeHtmlEntities: scope: all-non-ascii ---------------------------------

test('encodeHtmlEntities: all-non-ascii scope also encodes accented letters', () => {
  const result = encodeHtmlEntities('café', { scope: 'all-non-ascii', format: 'decimal' });
  assert.equal(result.output, 'caf&#233;');
  assert.equal(result.encodedCount, 1);
});

test('encodeHtmlEntities: all-non-ascii scope correctly handles a surrogate-pair emoji as one character', () => {
  const result = encodeHtmlEntities('😀', { scope: 'all-non-ascii', format: 'decimal' });
  assert.equal(result.output, '&#128512;');
  assert.equal(result.totalChars, 1, 'a surrogate-pair emoji should count as one character, not two');
  assert.equal(result.encodedCount, 1);
});

// -- encodeHtmlEntities: format ------------------------------------------------

test('encodeHtmlEntities: format "named" uses a named entity when one exists', () => {
  const result = encodeHtmlEntities('©', { scope: 'all-non-ascii', format: 'named' });
  assert.equal(result.output, '&copy;');
});

test('encodeHtmlEntities: format "named" falls back to decimal numeric when no named entity exists for that character', () => {
  const result = encodeHtmlEntities('京', { scope: 'all-non-ascii', format: 'named' });
  assert.equal(result.output, '&#20140;');
});

test('encodeHtmlEntities: format "decimal" always uses numeric decimal, even for characters with a named entity', () => {
  const result = encodeHtmlEntities('&©', { scope: 'all-non-ascii', format: 'decimal' });
  assert.equal(result.output, '&#38;&#169;');
});

test('encodeHtmlEntities: format "hex" always uses uppercase numeric hex', () => {
  const result = encodeHtmlEntities('©', { scope: 'all-non-ascii', format: 'hex' });
  assert.equal(result.output, '&#xA9;');
});

// -- decodeHtmlEntities: named entities ----------------------------------------

test('decodeHtmlEntities: decodes the five HTML-significant named entities back to their characters', () => {
  const result = decodeHtmlEntities('Tom &amp; Jerry&apos;s &lt;b&gt;bold&lt;/b&gt; &quot;quote&quot;');
  assert.equal(result.output, 'Tom & Jerry\'s <b>bold</b> "quote"');
  assert.equal(result.decodedCount, 8);
  assert.equal(result.unrecognizedCount, 0);
});

test('decodeHtmlEntities: decodes a common named entity outside the five XML ones', () => {
  const result = decodeHtmlEntities('&copy; 2026, all rights reserved &mdash; wait, no dash here');
  assert.ok(result.output.startsWith('© 2026'));
});

test('decodeHtmlEntities: an unrecognized named entity is left exactly as written', () => {
  const result = decodeHtmlEntities('&notarealentity; stays put');
  assert.equal(result.output, '&notarealentity; stays put');
  assert.equal(result.totalEntities, 1);
  assert.equal(result.decodedCount, 0);
  assert.equal(result.unrecognizedCount, 1);
});

// -- decodeHtmlEntities: numeric entities ---------------------------------------

test('decodeHtmlEntities: decodes a decimal numeric entity', () => {
  const result = decodeHtmlEntities('&#169; 2026');
  assert.equal(result.output, '© 2026');
});

test('decodeHtmlEntities: decodes a hex numeric entity, case-insensitively', () => {
  assert.equal(decodeHtmlEntities('&#xA9;').output, '©');
  assert.equal(decodeHtmlEntities('&#XA9;').output, '©');
  assert.equal(decodeHtmlEntities('&#xa9;').output, '©');
});

test('decodeHtmlEntities: decodes a numeric entity outside the Basic Multilingual Plane (an emoji) as one character', () => {
  const result = decodeHtmlEntities('&#x1F600;');
  assert.equal(result.output, '😀');
  assert.equal([...result.output].length, 1);
});

test('decodeHtmlEntities: a numeric entity above the valid Unicode range is left as-is', () => {
  const result = decodeHtmlEntities('&#9999999999;');
  assert.equal(result.output, '&#9999999999;');
  assert.equal(result.unrecognizedCount, 1);
});

test('decodeHtmlEntities: a numeric entity in the lone-surrogate range is left as-is, never throws', () => {
  const result = decodeHtmlEntities('&#xD800;');
  assert.equal(result.output, '&#xD800;');
  assert.equal(result.unrecognizedCount, 1);
});

test('decodeHtmlEntities: a null-code-point numeric entity decodes to the Unicode replacement character, matching browser HTML-parsing behavior', () => {
  const result = decodeHtmlEntities('&#0;');
  assert.equal(result.output, '�');
  assert.equal(result.decodedCount, 1);
});

// -- decodeHtmlEntities: text with no entities at all ---------------------------

test('decodeHtmlEntities: text with no entity-like sequences passes through unchanged', () => {
  const result = decodeHtmlEntities('just plain text & a bare ampersand with no semicolon');
  assert.equal(result.output, 'just plain text & a bare ampersand with no semicolon');
  assert.equal(result.totalEntities, 0);
});

test('decodeHtmlEntities: empty input produces an empty result, not an error', () => {
  const result = decodeHtmlEntities('');
  assert.equal(result.output, '');
  assert.equal(result.totalEntities, 0);
});

// -- round-trip -------------------------------------------------------------------

test('encode then decode round-trips back to the original text (reserved scope)', () => {
  const original = 'Tom & Jerry\'s <b>bold</b> "quote" café 😀';
  const encoded = encodeHtmlEntities(original).output;
  const decoded = decodeHtmlEntities(encoded).output;
  assert.equal(decoded, original);
});

test('encode then decode round-trips back to the original text (all-non-ascii scope, every format)', () => {
  const original = 'Tom & Jerry\'s <b>bold</b> "quote" café 😀 日本語';
  for (const format of ['named', 'decimal', 'hex']) {
    const encoded = encodeHtmlEntities(original, { scope: 'all-non-ascii', format }).output;
    const decoded = decodeHtmlEntities(encoded).output;
    assert.equal(decoded, original, `round-trip failed for format "${format}"`);
  }
});

// -- decoding never produces something that could be mistaken for live markup ---
// (docs/SECURITY_STANDARDS.md -- the caller is responsible for only ever
// writing this result via .textContent, but the pure decode itself should
// never do anything surprising with tag-shaped input either.)

test('decodeHtmlEntities: decoding an entity-encoded script tag produces the literal, inert text', () => {
  const result = decodeHtmlEntities('&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(result.output, '<script>alert(1)</script>');
});

test('every value in NAMED_ENTITY_TO_CHAR is exactly one character (one Unicode code point)', () => {
  for (const [name, ch] of Object.entries(NAMED_ENTITY_TO_CHAR)) {
    assert.equal(Array.from(ch).length, 1, `entity "${name}" maps to more than one code point: ${JSON.stringify(ch)}`);
  }
});

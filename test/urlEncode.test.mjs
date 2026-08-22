import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeUrlText, decodeUrlText, formatDecodeError } from '../src/pure/urlEncode.mjs';

// -- encodeUrlText -------------------------------------------------------------

test('encodeUrlText: percent-encodes spaces and reserved URL characters', () => {
  assert.equal(encodeUrlText('a b/c?d=e&f'), 'a%20b%2Fc%3Fd%3De%26f');
});

test('encodeUrlText: leaves the unreserved character set untouched', () => {
  const s = "abcXYZ019-_.!~*'()";
  assert.equal(encodeUrlText(s), s);
});

test('encodeUrlText: plusForSpace turns %20 into + without touching other characters', () => {
  assert.equal(encodeUrlText('a b c', { plusForSpace: true }), 'a+b+c');
  assert.equal(encodeUrlText('a&b', { plusForSpace: true }), 'a%26b');
});

test('encodeUrlText: a literal + in the input is itself percent-encoded, never left ambiguous', () => {
  assert.equal(encodeUrlText('a+b'), 'a%2Bb');
  assert.equal(encodeUrlText('a+b', { plusForSpace: true }), 'a%2Bb');
});

test('encodeUrlText: encodes multi-byte UTF-8 characters correctly', () => {
  assert.equal(encodeUrlText('café'), 'caf%C3%A9');
});

test('encodeUrlText: empty, null, and undefined input all return an empty string', () => {
  assert.equal(encodeUrlText(''), '');
  assert.equal(encodeUrlText(null), '');
  assert.equal(encodeUrlText(undefined), '');
});

// -- decodeUrlText -------------------------------------------------------------

test('decodeUrlText: decodes a percent-encoded string back to the original', () => {
  assert.deepEqual(decodeUrlText('a%20b%2Fc%3Fd%3De%26f'), { ok: true, value: 'a b/c?d=e&f' });
});

test('decodeUrlText: plusForSpace treats a literal + as a space before decoding', () => {
  assert.deepEqual(decodeUrlText('a+b+c', { plusForSpace: true }), { ok: true, value: 'a b c' });
});

test('decodeUrlText: without plusForSpace, a literal + decodes through unchanged', () => {
  assert.deepEqual(decodeUrlText('a+b'), { ok: true, value: 'a+b' });
});

test('decodeUrlText: plusForSpace does not affect an already-encoded plus sign (%2B)', () => {
  assert.deepEqual(decodeUrlText('a%2Bb', { plusForSpace: true }), { ok: true, value: 'a+b' });
});

test('decodeUrlText: a stray % with no valid hex digits is a friendly error, not a throw', () => {
  const result = decodeUrlText('100%');
  assert.equal(result.ok, false);
  assert.match(result.error, /valid percent-encoding/i);
});

test('decodeUrlText: a chopped multi-byte UTF-8 sequence is a friendly error, not a throw', () => {
  const result = decodeUrlText('%C3');
  assert.equal(result.ok, false);
  assert.match(result.error, /valid percent-encoding/i);
});

test('decodeUrlText: empty input decodes to an empty string, not an error', () => {
  assert.deepEqual(decodeUrlText(''), { ok: true, value: '' });
});

test('decodeUrlText: round-trips whatever encodeUrlText produced, including accents and reserved characters', () => {
  const text = 'héllo wörld/ünïcode?ok=✓&x=1';
  const encoded = encodeUrlText(text);
  assert.deepEqual(decodeUrlText(encoded), { ok: true, value: text });
});

// -- formatDecodeError -------------------------------------------------------------

test('formatDecodeError: returns a non-empty, plain-English message regardless of the caught error', () => {
  const msg = formatDecodeError(new URIError('URI malformed'));
  assert.match(msg, /percent-encoding/i);
  assert.doesNotMatch(msg, /URIError/);
});

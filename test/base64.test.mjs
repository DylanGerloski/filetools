import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bytesToBase64,
  base64ToBytes,
  encodeTextToBase64,
  decodeBase64ToText,
  sniffFileExtension,
} from '../src/pure/base64.mjs';

// ---------------------------------------------------------------------------
// bytesToBase64 / base64ToBytes round trip
// ---------------------------------------------------------------------------

test('bytesToBase64: RFC 4648 test vectors', () => {
  const enc = new TextEncoder();
  assert.equal(bytesToBase64(enc.encode('')), '');
  assert.equal(bytesToBase64(enc.encode('f')), 'Zg==');
  assert.equal(bytesToBase64(enc.encode('fo')), 'Zm8=');
  assert.equal(bytesToBase64(enc.encode('foo')), 'Zm9v');
  assert.equal(bytesToBase64(enc.encode('foob')), 'Zm9vYg==');
  assert.equal(bytesToBase64(enc.encode('fooba')), 'Zm9vYmE=');
  assert.equal(bytesToBase64(enc.encode('foobar')), 'Zm9vYmFy');
});

test('base64ToBytes: RFC 4648 test vectors decode back to the original bytes', () => {
  const dec = new TextDecoder();
  assert.equal(dec.decode(base64ToBytes('Zg==').bytes), 'f');
  assert.equal(dec.decode(base64ToBytes('Zm8=').bytes), 'fo');
  assert.equal(dec.decode(base64ToBytes('Zm9v').bytes), 'foo');
  assert.equal(dec.decode(base64ToBytes('Zm9vYg==').bytes), 'foob');
  assert.equal(dec.decode(base64ToBytes('Zm9vYmE=').bytes), 'fooba');
  assert.equal(dec.decode(base64ToBytes('Zm9vYmFy').bytes), 'foobar');
});

test('bytesToBase64 -> base64ToBytes round-trips arbitrary binary data (all 256 byte values)', () => {
  const bytes = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) bytes[i] = i;
  const b64 = bytesToBase64(bytes);
  const result = base64ToBytes(b64);
  assert.ok(result.ok);
  assert.deepEqual([...result.bytes], [...bytes]);
});

test('base64ToBytes accepts input with no padding, same result as padded', () => {
  const padded = base64ToBytes('Zm9vYmE=');
  const unpadded = base64ToBytes('Zm9vYmE');
  assert.ok(padded.ok && unpadded.ok);
  assert.deepEqual([...padded.bytes], [...unpadded.bytes]);
});

test('base64ToBytes strips embedded whitespace and line breaks before decoding', () => {
  const result = base64ToBytes('Zm9v\nYmFy  ');
  assert.ok(result.ok);
  assert.equal(new TextDecoder().decode(result.bytes), 'foobar');
});

// ---------------------------------------------------------------------------
// URL-safe alphabet
// ---------------------------------------------------------------------------

test('bytesToBase64 with urlSafe uses - and _ instead of + and /', () => {
  // Byte sequence chosen so the standard alphabet actually needs + or /.
  const bytes = new Uint8Array([0xfb, 0xff, 0xbf]);
  const std = bytesToBase64(bytes);
  const urlSafe = bytesToBase64(bytes, { urlSafe: true });
  assert.match(std, /[+/]/);
  assert.doesNotMatch(urlSafe, /[+/]/);
  assert.equal(urlSafe, std.replace(/\+/g, '-').replace(/\//g, '_'));
});

test('base64ToBytes with urlSafe decodes - and _ correctly', () => {
  const bytes = new Uint8Array([0xfb, 0xff, 0xbf]);
  const encoded = bytesToBase64(bytes, { urlSafe: true });
  const result = base64ToBytes(encoded, { urlSafe: true });
  assert.ok(result.ok);
  assert.deepEqual([...result.bytes], [...bytes]);
});

test('base64ToBytes rejects standard-alphabet characters when urlSafe is set', () => {
  const result = base64ToBytes('Zm9v+g==', { urlSafe: true });
  assert.equal(result.ok, false);
  assert.match(result.error, /URL-safe/);
});

// ---------------------------------------------------------------------------
// encodeTextToBase64 / decodeBase64ToText -- Unicode round trip
// ---------------------------------------------------------------------------

test('encodeTextToBase64 -> decodeBase64ToText round-trips plain ASCII', () => {
  const encoded = encodeTextToBase64('Hello, world!');
  const decoded = decodeBase64ToText(encoded);
  assert.deepEqual(decoded, { ok: true, text: 'Hello, world!' });
});

test('encodeTextToBase64 -> decodeBase64ToText round-trips multi-byte Unicode (accents, emoji, CJK)', () => {
  const original = 'Café résumé 日本語 🎉';
  const encoded = encodeTextToBase64(original);
  const decoded = decodeBase64ToText(encoded);
  assert.deepEqual(decoded, { ok: true, text: original });
});

test('encodeTextToBase64 of empty string produces empty Base64', () => {
  assert.equal(encodeTextToBase64(''), '');
});

// ---------------------------------------------------------------------------
// Error handling / grammar validation
// ---------------------------------------------------------------------------

test('base64ToBytes rejects empty input with a plain-English message', () => {
  const result = base64ToBytes('');
  assert.equal(result.ok, false);
  assert.match(result.error, /nothing to decode/);
});

test('base64ToBytes rejects a character outside the Base64 alphabet', () => {
  const result = base64ToBytes('not valid base64!!!');
  assert.equal(result.ok, false);
  assert.match(result.error, /alphabet/);
});

test('base64ToBytes rejects padding in the middle of the string', () => {
  const result = base64ToBytes('Zm9=v');
  assert.equal(result.ok, false);
  assert.match(result.error, /padding/);
});

test('base64ToBytes rejects a length that is impossible for Base64 (remainder of 1)', () => {
  // 5 unpadded characters -> remainder 1, which cannot represent whole bytes.
  const result = base64ToBytes('Zm9vY');
  assert.equal(result.ok, false);
  assert.match(result.error, /wrong length/);
});

test('decodeBase64ToText signals notText for Base64 that decodes to non-UTF-8 binary data', () => {
  // 0xFF 0xFE is not valid UTF-8 on its own.
  const bytes = new Uint8Array([0xff, 0xfe, 0x00, 0x01]);
  const encoded = bytesToBase64(bytes);
  const result = decodeBase64ToText(encoded);
  assert.equal(result.ok, true);
  assert.equal(result.notText, true);
  assert.deepEqual([...result.bytes], [...bytes]);
});

test('decodeBase64ToText propagates a grammar error unchanged', () => {
  const result = decodeBase64ToText('%%%not base64%%%');
  assert.equal(result.ok, false);
  assert.match(result.error, /alphabet/);
});

// ---------------------------------------------------------------------------
// sniffFileExtension
// ---------------------------------------------------------------------------

test('sniffFileExtension recognizes PNG, JPEG, GIF, PDF, WebP, and ZIP signatures', () => {
  assert.deepEqual(sniffFileExtension(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), { ext: 'png', mimeType: 'image/png' });
  assert.deepEqual(sniffFileExtension(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), { ext: 'jpg', mimeType: 'image/jpeg' });
  assert.deepEqual(sniffFileExtension(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), { ext: 'gif', mimeType: 'image/gif' });
  assert.deepEqual(sniffFileExtension(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])), { ext: 'pdf', mimeType: 'application/pdf' });
  assert.deepEqual(
    sniffFileExtension(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    { ext: 'webp', mimeType: 'image/webp' }
  );
  assert.deepEqual(sniffFileExtension(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), { ext: 'zip', mimeType: 'application/zip' });
});

test('sniffFileExtension falls back to a generic binary type for unrecognized bytes', () => {
  assert.deepEqual(sniffFileExtension(new Uint8Array([1, 2, 3, 4])), { ext: 'bin', mimeType: 'application/octet-stream' });
  assert.deepEqual(sniffFileExtension(new Uint8Array([])), { ext: 'bin', mimeType: 'application/octet-stream' });
});

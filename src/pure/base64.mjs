/**
 * Base64 encode/decode -- the shared math behind the "Base64 encode and
 * decode" tool. Pure data in, pure data out -- no DOM, no `btoa`/`atob` --
 * directly unit-testable in Node (test/base64.test.mjs) and loaded
 * client-side the same way every other src/pure/*.mjs module is.
 *
 * WHY NOT `btoa`/`atob`: both operate on a "binary string" (one UTF-16 code
 * unit per byte) and throw on any character above U+00FF, so encoding
 * ordinary Unicode text (an accented name, an emoji) needs an extra
 * escape/unescape dance that's easy to get subtly wrong. A hand-written
 * RFC 4648 codec working directly on bytes (produced by `TextEncoder`, both
 * a Node and browser global -- no DOM needed) sidesteps that entirely and
 * behaves identically in the unit tests and in the browser.
 *
 * ALPHABET: standard Base64 (RFC 4648 sec. 4, `+`/`/`) and Base64URL
 * (RFC 4648 sec. 5, `-`/`_`) share the same 0-63 value space and differ only
 * in the two glyphs for indices 62/63, so one table indexed by a `urlSafe`
 * flag covers both.
 */

const STANDARD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL_SAFE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function alphabetFor(urlSafe) {
  return urlSafe ? URL_SAFE_CHARS : STANDARD_CHARS;
}

/** Built once per alphabet, not per call: char -> 6-bit value. */
const REVERSE_MAPS = new Map();
function reverseMapFor(urlSafe) {
  const key = urlSafe ? 'url' : 'std';
  let map = REVERSE_MAPS.get(key);
  if (!map) {
    map = new Map();
    const chars = alphabetFor(urlSafe);
    for (let i = 0; i < chars.length; i += 1) map.set(chars[i], i);
    REVERSE_MAPS.set(key, map);
  }
  return map;
}

/**
 * @param {Uint8Array} bytes
 * @param {{urlSafe?: boolean}} [opts] urlSafe (default false): use `-`/`_`
 *   in place of `+`/`/`.
 * @returns {string} Base64 text, always padded with `=` to a multiple of 4
 *   characters (padding is optional in RFC 4648 but always emitted here so
 *   output length is predictable; base64ToBytes below accepts input with or
 *   without it).
 */
export function bytesToBase64(bytes, opts = {}) {
  const chars = alphabetFor(opts.urlSafe);
  const out = [];
  const len = bytes.length;
  let i = 0;
  for (; i + 3 <= len; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out.push(
      chars[(chunk >> 18) & 63],
      chars[(chunk >> 12) & 63],
      chars[(chunk >> 6) & 63],
      chars[chunk & 63]
    );
  }
  const remaining = len - i;
  if (remaining === 1) {
    const chunk = bytes[i] << 16;
    out.push(chars[(chunk >> 18) & 63], chars[(chunk >> 12) & 63], '=', '=');
  } else if (remaining === 2) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out.push(chars[(chunk >> 18) & 63], chars[(chunk >> 12) & 63], chars[(chunk >> 6) & 63], '=');
  }
  return out.join('');
}

/**
 * @param {string} text
 * @param {{urlSafe?: boolean}} [opts]
 * @returns {string} Base64 of the UTF-8 encoding of `text`.
 */
export function encodeTextToBase64(text, opts = {}) {
  const bytes = new TextEncoder().encode(String(text == null ? '' : text));
  return bytesToBase64(bytes, opts);
}

/**
 * Explicit grammar check for user-supplied Base64 text, per
 * docs/SECURITY_STANDARDS.md's "validate against an explicit grammar before
 * use" rule -- run before any decode is attempted, so a malformed paste is
 * rejected with a plain-English reason rather than producing garbage bytes
 * or throwing an uncaught error partway through decoding.
 *
 * @param {string} stripped Base64 text with all whitespace already removed.
 * @param {boolean} urlSafe
 * @returns {string|null} a plain-English problem description, or null if
 *   the text is syntactically valid Base64 (ignoring whether it actually
 *   decodes to anything meaningful).
 */
function validateBase64Grammar(stripped, urlSafe) {
  if (stripped === '') return 'there’s nothing to decode';
  // No nested quantifiers -- a single bounded character class repeated
  // once, safe against catastrophic backtracking on any input length.
  // '=' is allowed anywhere at this stage; its position is checked
  // separately below so a misplaced-padding input gets its own specific
  // message instead of being lumped in with "wrong character".
  const allowedRe = urlSafe ? /^[A-Za-z0-9_=-]*$/ : /^[A-Za-z0-9+/=]*$/;
  if (!allowedRe.test(stripped)) {
    return urlSafe
      ? 'it contains a character outside the URL-safe Base64 alphabet (letters, numbers, - and _)'
      : 'it contains a character outside the Base64 alphabet (letters, numbers, + and /)';
  }
  const withoutTrailingPad = stripped.replace(/=+$/, '');
  if (withoutTrailingPad.includes('=')) {
    return 'it has padding (=) in the middle instead of only at the end';
  }
  if (withoutTrailingPad.length > 0 && withoutTrailingPad.length % 4 === 1) {
    return 'it has the wrong length to be valid Base64';
  }
  return null;
}

/**
 * @param {string} rawText Base64 text as pasted/read -- whitespace
 *   (including line breaks some sources wrap long Base64 at) is stripped
 *   before validation, since that's the common real-world shape of pasted
 *   Base64 rather than a syntax error.
 * @param {{urlSafe?: boolean}} [opts]
 * @returns {{ok: true, bytes: Uint8Array} | {ok: false, error: string}}
 */
export function base64ToBytes(rawText, opts = {}) {
  const urlSafe = !!opts.urlSafe;
  const stripped = String(rawText == null ? '' : rawText).replace(/\s+/g, '');
  const problem = validateBase64Grammar(stripped, urlSafe);
  if (problem) {
    return { ok: false, error: `That isn’t valid Base64 - ${problem}.` };
  }

  const unpadded = stripped.replace(/=+$/, '');
  const map = reverseMapFor(urlSafe);
  const outLength = Math.floor((unpadded.length * 3) / 4);
  const bytes = new Uint8Array(outLength);
  let byteIndex = 0;
  let i = 0;
  for (; i + 4 <= unpadded.length; i += 4) {
    const a = map.get(unpadded[i]);
    const b = map.get(unpadded[i + 1]);
    const c = map.get(unpadded[i + 2]);
    const d = map.get(unpadded[i + 3]);
    bytes[byteIndex] = (a << 2) | (b >> 4);
    bytes[byteIndex + 1] = ((b & 15) << 4) | (c >> 2);
    bytes[byteIndex + 2] = ((c & 3) << 6) | d;
    byteIndex += 3;
  }
  const remaining = unpadded.length - i;
  if (remaining === 2) {
    const a = map.get(unpadded[i]);
    const b = map.get(unpadded[i + 1]);
    bytes[byteIndex] = (a << 2) | (b >> 4);
  } else if (remaining === 3) {
    const a = map.get(unpadded[i]);
    const b = map.get(unpadded[i + 1]);
    const c = map.get(unpadded[i + 2]);
    bytes[byteIndex] = (a << 2) | (b >> 4);
    bytes[byteIndex + 1] = ((b & 15) << 4) | (c >> 2);
  }
  return { ok: true, bytes };
}

/**
 * @param {string} rawText
 * @param {{urlSafe?: boolean}} [opts]
 * @returns {{ok: true, text: string} | {ok: true, bytes: Uint8Array, notText: true} | {ok: false, error: string}}
 *   `notText: true` means the Base64 decoded to real bytes but those bytes
 *   are not valid UTF-8 (almost always genuine binary data, e.g. an image)
 *   -- not an error, a signal to the caller to offer a file download
 *   instead of a text result.
 */
export function decodeBase64ToText(rawText, opts = {}) {
  const decoded = base64ToBytes(rawText, opts);
  if (!decoded.ok) return decoded;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(decoded.bytes);
    return { ok: true, text };
  } catch {
    return { ok: true, bytes: decoded.bytes, notText: true };
  }
}

/**
 * Magic-byte sniff for the handful of binary formats a visitor is most
 * likely to be decoding Base64 back into (an embedded image, a PDF, an
 * Office/zip-based document) -- purely cosmetic (picks a nicer download
 * filename/extension than a generic ".bin"), never used for any decision
 * that affects correctness or security.
 *
 * @param {Uint8Array} bytes
 * @returns {{ext: string, mimeType: string}}
 */
export function sniffFileExtension(bytes) {
  const b = bytes;
  const startsWith = (sig, offset = 0) => sig.every((byte, i) => b[offset + i] === byte);
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return { ext: 'png', mimeType: 'image/png' };
  if (startsWith([0xff, 0xd8, 0xff])) return { ext: 'jpg', mimeType: 'image/jpeg' };
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return { ext: 'gif', mimeType: 'image/gif' };
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return { ext: 'pdf', mimeType: 'application/pdf' };
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return { ext: 'webp', mimeType: 'image/webp' };
  if (startsWith([0x50, 0x4b, 0x03, 0x04])) return { ext: 'zip', mimeType: 'application/zip' };
  return { ext: 'bin', mimeType: 'application/octet-stream' };
}

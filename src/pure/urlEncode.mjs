/**
 * URL percent-encoding/decoding -- the shared logic behind the "URL encode
 * and decode" tool. Wraps the browser's own encodeURIComponent/
 * decodeURIComponent rather than a hand-rolled parser: percent-encoding is a
 * fixed, well-defined transform the platform already implements correctly,
 * so there is no untrusted-input grammar here to validate the way, say,
 * ../pure/yamlToJson.mjs's YAML parse needs to be sandboxed. This module's
 * only real job is the "encode/decode spaces as +" option (the one genuine
 * ambiguity in "URL encoding" -- RFC 3986 percent-encoding uses %20 for a
 * space, but the older application/x-www-form-urlencoded convention used by
 * HTML forms and many query strings uses a literal +) and turning a thrown
 * URIError into a friendly, specific message, the same "catch and reword"
 * shape ../pure/yamlToJson.mjs's formatYamlError uses for js-yaml.
 *
 * Pure data in, pure data out -- no DOM -- directly unit-testable in Node
 * (test/urlEncode.test.mjs) and loaded client-side the same way every other
 * src/pure/*.mjs module is.
 *
 * SCOPE NOTE (also stated in the tool page's own FAQ copy): this encodes a
 * single piece of text -- a query parameter value, a search term, any
 * string you want to safely embed inside a URL -- not a whole structured
 * URL. encodeURIComponent percent-encodes ':', '/', '?', '&', and '=' along
 * with everything else non-alphanumeric, which is correct for a value but
 * would mangle a full "https://example.com/path?q=x" URL if you encoded the
 * whole thing at once. That is a deliberate, disclosed limitation, not a
 * bug -- see decodeUrlText's asymmetric note below for why decoding doesn't
 * have the same problem.
 */

/**
 * @param {string} text raw text to percent-encode.
 * @param {{plusForSpace?: boolean}} [opts] plusForSpace (default false):
 *   emit a literal '+' for a space instead of '%20' (the
 *   application/x-www-form-urlencoded convention).
 * @returns {string} percent-encoded text, safe to use as a single query
 *   string parameter value. encodeURIComponent leaves only
 *   A-Z a-z 0-9 - _ . ! ~ * ' ( ) unescaped; everything else, including
 *   reserved URL characters like : / ? & =, is percent-encoded.
 */
export function encodeUrlText(text, opts = {}) {
  const { plusForSpace = false } = opts;
  const src = String(text == null ? '' : text);
  const encoded = encodeURIComponent(src);
  return plusForSpace ? encoded.replace(/%20/g, '+') : encoded;
}

/**
 * @param {string} text percent-encoded text to decode.
 * @param {{plusForSpace?: boolean}} [opts] plusForSpace (default false):
 *   treat a literal '+' in the input as an encoded space before decoding
 *   (the application/x-www-form-urlencoded convention) -- an already
 *   percent-encoded plus sign ('%2B') is unaffected either way, since only
 *   a literal '+' character in the raw text is touched.
 * @returns {{ok:true, value:string} | {ok:false, error:string}} decoded
 *   text, or a friendly error if the input isn't valid percent-encoding
 *   (decodeURIComponent throws a URIError for a stray '%' not followed by
 *   two hex digits, or a percent-encoded byte sequence that isn't valid
 *   UTF-8 -- e.g. a lone continuation byte from a chopped multi-byte
 *   sequence). Native URIErrors carry no line/column detail to surface
 *   (unlike js-yaml's own exceptions), so the message here is necessarily
 *   general rather than pointing at an exact offset.
 */
export function decodeUrlText(text, opts = {}) {
  const { plusForSpace = false } = opts;
  const src = String(text == null ? '' : text);
  const prepped = plusForSpace ? src.replace(/\+/g, ' ') : src;
  try {
    return { ok: true, value: decodeURIComponent(prepped) };
  } catch (err) {
    return { ok: false, error: formatDecodeError(err) };
  }
}

/**
 * @param {Error} _err a caught URIError (unused -- kept as a parameter for
 *   the same shape as ../pure/yamlToJson.mjs's formatYamlError, and so a
 *   future browser that does add positional detail to URIError.message
 *   could be surfaced here without changing every call site).
 * @returns {string} a one-line, plain-English message.
 */
export function formatDecodeError(_err) {
  return 'That isn’t valid percent-encoding - a % isn’t followed by two hex digits, or it splits a multi-byte character in a way that doesn’t decode. Check the text and try again.';
}

/**
 * HTML entity encode/decode -- the shared logic behind the "HTML entity
 * encoder and decoder" tool. Pure data in, pure data out -- no DOM -- directly
 * unit-testable in Node (test/htmlEntity.test.mjs) and loaded client-side the
 * same way every other src/pure/*.mjs module is.
 *
 * SECURITY NOTE (docs/SECURITY_STANDARDS.md): decoding HTML entities is
 * deliberately implemented as a hand-written regex-based table lookup here,
 * NOT via the common `el.innerHTML = str; return el.value` textarea trick.
 * That trick works, but it means handing untrusted, runtime-built text to
 * `innerHTML` -- exactly what the security standard forbids ("innerHTML is
 * permitted only with a string literal interpolating no runtime value").
 * This module never touches the DOM at all, so there is no HTML parser in
 * the loop to have opinions about script execution or resource loading in
 * the first place. The decoded OUTPUT is just a JS string; the caller
 * (../browser/htmlEntity.client.js) is responsible for ever only writing it
 * to the page via `.textContent`, never `innerHTML` -- see that file's own
 * header comment.
 *
 * NAMED_ENTITY_TO_CHAR is a curated set of the HTML4/common HTML5 named
 * character references (the five XML-significant characters, Latin-1
 * Supplement letters, common punctuation/currency/math symbols, arrows, and
 * the Greek alphabet) -- not the full ~2200-entry HTML5 named-reference
 * table. Anything outside this set still encodes and decodes correctly via
 * its numeric form; only the NAMED-entity round-trip is limited to this set,
 * which is disclosed on the tool page's FAQ rather than silently incomplete.
 */

/** @type {Record<string, string>} entity name (no leading & or trailing ;) -> the character it represents. */
export const NAMED_ENTITY_TO_CHAR = {
  // The five XML/HTML-significant characters.
  amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'',

  // Whitespace and invisible formatting characters.
  nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
  zwnj: '‌', zwj: '‍', shy: '­',

  // General punctuation.
  hellip: '…', mdash: '—', ndash: '–',
  lsquo: '‘', rsquo: '’', sbquo: '‚',
  ldquo: '“', rdquo: '”', bdquo: '„',
  laquo: '«', raquo: '»', lsaquo: '‹', rsaquo: '›',
  bull: '•', dagger: '†', Dagger: '‡', permil: '‰',
  prime: '′', Prime: '″', oline: '‾',
  iexcl: '¡', iquest: '¿',

  // Currency.
  cent: '¢', pound: '£', yen: '¥', euro: '€', curren: '¤',

  // Legal / trademark / reference marks.
  copy: '©', reg: '®', trade: '™', sect: '§', para: '¶',

  // Math and technical symbols.
  plusmn: '±', times: '×', divide: '÷', minus: '−',
  frasl: '⁄', infin: '∞', ne: '≠', le: '≤', ge: '≥',
  asymp: '≈', equiv: '≡', radic: '√', sum: '∑', prod: '∏',
  part: '∂', nabla: '∇', int: '∫', sim: '∼', cong: '≅',
  prop: '∝', ang: '∠', fnof: 'ƒ',
  sup1: '¹', sup2: '²', sup3: '³',
  frac12: '½', frac14: '¼', frac34: '¾', frac13: '⅓', frac23: '⅔',
  micro: 'µ', middot: '·', deg: '°',

  // Arrows.
  larr: '←', uarr: '↑', rarr: '→', darr: '↓', harr: '↔', crarr: '↵',
  lArr: '⇐', uArr: '⇑', rArr: '⇒', dArr: '⇓', hArr: '⇔',

  // Card suits and miscellaneous.
  spades: '♠', clubs: '♣', hearts: '♥', diams: '♦', loz: '◊',

  // Latin-1 Supplement letters, lowercase.
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å',
  aelig: 'æ', ccedil: 'ç', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë',
  igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï', eth: 'ð', ntilde: 'ñ',
  ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö', oslash: 'ø',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', yacute: 'ý', thorn: 'þ',
  yuml: 'ÿ', szlig: 'ß',

  // Latin-1 Supplement letters, uppercase.
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Aring: 'Å',
  AElig: 'Æ', Ccedil: 'Ç', Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë',
  Igrave: 'Ì', Iacute: 'Í', Icirc: 'Î', Iuml: 'Ï', ETH: 'Ð', Ntilde: 'Ñ',
  Ograve: 'Ò', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö', Oslash: 'Ø',
  Ugrave: 'Ù', Uacute: 'Ú', Ucirc: 'Û', Uuml: 'Ü', Yacute: 'Ý', THORN: 'Þ',

  // Greek alphabet, upper and lower case.
  Alpha: 'Α', Beta: 'Β', Gamma: 'Γ', Delta: 'Δ', Epsilon: 'Ε', Zeta: 'Ζ',
  Eta: 'Η', Theta: 'Θ', Iota: 'Ι', Kappa: 'Κ', Lambda: 'Λ', Mu: 'Μ',
  Nu: 'Ν', Xi: 'Ξ', Omicron: 'Ο', Pi: 'Π', Rho: 'Ρ', Sigma: 'Σ',
  Tau: 'Τ', Upsilon: 'Υ', Phi: 'Φ', Chi: 'Χ', Psi: 'Ψ', Omega: 'Ω',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ',
  eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ',
  nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π', rho: 'ρ', sigmaf: 'ς',
  sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
};

/**
 * Reverse of NAMED_ENTITY_TO_CHAR, character -> its preferred entity name.
 * Built by a single forward pass so the FIRST name declared above for a
 * given character wins (matters for a few characters that could arguably
 * have more than one name -- none actually collide in the table above today,
 * but this keeps behavior deterministic if a future addition does).
 */
const CHAR_TO_NAMED_ENTITY = {};
for (const [name, ch] of Object.entries(NAMED_ENTITY_TO_CHAR)) {
  if (!(ch in CHAR_TO_NAMED_ENTITY)) CHAR_TO_NAMED_ENTITY[ch] = name;
}

function isReservedChar(ch) {
  return ch === '&' || ch === '<' || ch === '>' || ch === '"' || ch === '\'';
}

/**
 * @param {string} ch a single character (one Unicode code point).
 * @param {'named'|'decimal'|'hex'} format
 * @returns {string} that character's entity form. 'named' falls back to a
 *   decimal numeric entity when no named entity exists for the character.
 */
function formatEntity(ch, format) {
  const code = ch.codePointAt(0);
  if (format === 'named') {
    const name = CHAR_TO_NAMED_ENTITY[ch];
    if (name) return `&${name};`;
    return `&#${code};`;
  }
  if (format === 'hex') return `&#x${code.toString(16).toUpperCase()};`;
  return `&#${code};`;
}

/**
 * @param {string} text raw input text.
 * @param {{scope?: 'reserved'|'all-non-ascii', format?: 'named'|'decimal'|'hex'}} [opts]
 *   scope 'reserved' (default): only the five XML-significant characters
 *     (& < > " ') are encoded. 'all-non-ascii': those five, plus every
 *     character with a code point above 127 (accented letters, symbols,
 *     emoji), so the result is safe to embed anywhere that expects
 *     plain ASCII.
 *   format 'named' (default): use a named entity where one exists in
 *     NAMED_ENTITY_TO_CHAR, otherwise decimal numeric. 'decimal': always
 *     `&#NNN;`. 'hex': always `&#xHHH;`.
 * @returns {{ output: string, totalChars: number, encodedCount: number }}
 *   totalChars counts Unicode code points (a surrogate-pair emoji counts as
 *   one character, matching what a visitor perceives as "one character"),
 *   not UTF-16 code units.
 */
export function encodeHtmlEntities(text, opts = {}) {
  const { scope = 'reserved', format = 'named' } = opts;
  const input = String(text == null ? '' : text);
  // Array.from (not a plain for..of index) iterates by Unicode code point,
  // so a surrogate-pair emoji is handled as one character rather than two
  // lone, individually-invalid halves.
  const chars = Array.from(input);
  let encodedCount = 0;
  let output = '';
  for (const ch of chars) {
    const code = ch.codePointAt(0);
    const needsEncoding = isReservedChar(ch) || (scope === 'all-non-ascii' && code > 127);
    if (needsEncoding) {
      output += formatEntity(ch, format);
      encodedCount += 1;
    } else {
      output += ch;
    }
  }
  return { output, totalChars: chars.length, encodedCount };
}

// Matches &name; / &#NNN; / &#xHHH; -- three flat, bounded alternatives, no
// nested or overlapping quantifiers, so this runs in linear time over the
// input regardless of content (no catastrophic-backtracking risk per
// docs/SECURITY_STANDARDS.md's parser-hygiene rule).
const ENTITY_RE = /&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g;

/**
 * @param {string} text raw input text containing named and/or numeric HTML
 *   entities.
 * @returns {{ output: string, totalEntities: number, decodedCount: number, unrecognizedCount: number }}
 *   An entity-like sequence this function does not recognize (a misspelled
 *   name, or a numeric value outside the valid Unicode range) is left
 *   exactly as written in the output -- decoding never guesses.
 */
export function decodeHtmlEntities(text) {
  const input = String(text == null ? '' : text);
  let totalEntities = 0;
  let decodedCount = 0;

  const output = input.replace(ENTITY_RE, (match, body) => {
    totalEntities += 1;

    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const numStr = isHex ? body.slice(2) : body.slice(1);
      const codePoint = parseInt(numStr, isHex ? 16 : 10);
      // Reject anything outside the valid Unicode range, and lone
      // surrogates (0xD800-0xDFFF are reserved for UTF-16 pairing and are
      // not valid standalone code points) -- both left as literal text
      // rather than risking String.fromCodePoint throwing or producing an
      // unpaired surrogate in the output.
      const outOfRange = !Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10FFFF
        || (codePoint >= 0xD800 && codePoint <= 0xDFFF);
      if (outOfRange) return match;
      decodedCount += 1;
      // A literal NUL code point is a well-known HTML parse error that real
      // browsers replace with U+FFFD rather than emitting a NUL character --
      // matched here so this tool's decode behavior agrees with what a
      // browser would actually do with the same markup.
      return String.fromCodePoint(codePoint === 0 ? 0xFFFD : codePoint);
    }

    const named = NAMED_ENTITY_TO_CHAR[body];
    if (named === undefined) return match;
    decodedCount += 1;
    return named;
  });

  return { output, totalEntities, decodedCount, unrecognizedCount: totalEntities - decodedCount };
}

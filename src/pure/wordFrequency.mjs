/**
 * Word frequency counting logic -- the shared math behind the "word
 * frequency counter/analyzer" tool. Splits free-form text into words,
 * counts how many times each distinct word appears, and returns a table
 * sorted most-frequent-first plus a handful of summary stats.
 *
 * Pure data in, pure data out -- no DOM -- directly unit-testable in Node
 * (test/wordFrequency.test.mjs) and loaded client-side the same way every
 * other src/pure/*.mjs module is.
 *
 * WHAT COUNTS AS A "WORD": a run of Unicode letters/digits, allowing a
 * single internal apostrophe or hyphen ("don't", "well-known") so a
 * contraction or a hyphenated compound counts as one word rather than
 * being split in two -- but a leading/trailing apostrophe, quote mark, or
 * hyphen is never part of a match (the regex requires a letter/digit on
 * both sides of any internal apostrophe/hyphen). This is a plain-text
 * tokenizer, not a locale-aware NLP one -- disclosed on the tool page's
 * FAQ rather than hidden. One consequence, also disclosed: every matched
 * word therefore always STARTS with a letter or digit, never with `=`,
 * `+`, `@`, a hyphen, or whitespace -- which is what makes
 * frequencyToCsv() below safe against formula injection with no separate
 * escaping step for the word column (see that function's own comment).
 */
const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/**
 * @param {string} text raw input text.
 * @returns {string[]} every matched word, in original casing, in the
 *   order it appears. Never throws on empty/null input.
 */
export function tokenizeWords(text) {
  const raw = String(text == null ? '' : text);
  const matches = raw.match(WORD_RE);
  return matches || [];
}

/**
 * A short, deliberately conservative list of very common English function
 * words (articles, pronouns, prepositions, conjunctions, common auxiliary
 * verbs) -- NOT an exhaustive stop-word corpus, and English-only. Turning
 * on "exclude common words" drops exactly these, so what is left in the
 * table is closer to a text's actual subject matter. Matched against the
 * lowercased word regardless of the tool's own case-sensitivity option
 * (a stop word is a stop word whether or not the visitor wants the
 * COUNT to track case).
 */
export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'nor', 'so', 'yet', 'if', 'then',
  'than', 'as', 'because', 'while', 'of', 'at', 'by', 'for', 'with',
  'about', 'against', 'between', 'into', 'through', 'during', 'before',
  'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
  'on', 'off', 'over', 'under', 'again', 'further', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each',
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only',
  'own', 'same', 'too', 'very', 'can', 'will', 'just', 'i', 'me', 'my',
  'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
  'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her',
  'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their',
  'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that',
  'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'would', 'should', 'could', 'ought', 's', 't', 'don', 'now',
]);

const NUMBER_ONLY_RE = /^[\p{N}]+$/u;

/**
 * @param {string} text raw input text, any length.
 * @param {{
 *   caseSensitive?: boolean,
 *   minLength?: number,
 *   excludeNumbers?: boolean,
 *   excludeStopWords?: boolean,
 * }} [opts]
 *   caseSensitive (default false): false means "The" and "the" are the
 *     same word, counted together under the first casing seen; true
 *     tracks them as two distinct rows.
 *   minLength (default 1): words shorter than this (in characters) are
 *     dropped entirely, not merely hidden -- they never reach `entries`,
 *     `totalWords`, or the average/longest-word stats below.
 *   excludeNumbers (default false): true drops any token that is ALL
 *     digits (a run of letters mixed with digits, like "2026s", still
 *     counts as a word).
 *   excludeStopWords (default false): true drops any token whose
 *     lowercased form is in STOP_WORDS.
 * @returns {{
 *   entries: {word: string, count: number, percent: number}[],
 *   rawWordCount: number,
 *   totalWords: number,
 *   uniqueWords: number,
 *   averageLength: number,
 *   longestWord: string,
 *   topWord: {word: string, count: number, percent: number} | null,
 * }}
 *   entries is sorted by count descending, then alphabetically by word to
 *   keep ties in a stable, predictable order regardless of input order.
 *   rawWordCount is every token found before any filter is applied;
 *   totalWords/uniqueWords/averageLength/longestWord are all computed
 *   AFTER filtering, so they describe exactly what the table shows.
 */
export function computeWordFrequency(text, opts = {}) {
  const {
    caseSensitive = false,
    minLength = 1,
    excludeNumbers = false,
    excludeStopWords = false,
  } = opts;

  const rawWords = tokenizeWords(text);
  const counts = new Map(); // key -> { display, count }
  const considered = [];

  for (const word of rawWords) {
    if (word.length < minLength) continue;
    if (excludeNumbers && NUMBER_ONLY_RE.test(word)) continue;
    const lower = word.toLowerCase();
    if (excludeStopWords && STOP_WORDS.has(lower)) continue;

    considered.push(word);
    const key = caseSensitive ? word : lower;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { display: caseSensitive ? word : lower, count: 1 });
    }
  }

  const entries = [...counts.values()]
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
    .map((e) => ({
      word: e.display,
      count: e.count,
      percent: considered.length ? (e.count / considered.length) * 100 : 0,
    }));

  const totalLength = considered.reduce((sum, w) => sum + w.length, 0);
  const longestWord = considered.reduce((longest, w) => (w.length > longest.length ? w : longest), '');

  return {
    entries,
    rawWordCount: rawWords.length,
    totalWords: considered.length,
    uniqueWords: entries.length,
    averageLength: considered.length ? totalLength / considered.length : 0,
    longestWord,
    topWord: entries[0] || null,
  };
}

/**
 * @param {string} value
 * @returns {string} RFC 4180 quoting -- wraps in double quotes and doubles
 *   any embedded quote, only when the value actually contains a comma,
 *   quote, or newline. A plain word (the overwhelmingly common case) is
 *   returned unquoted.
 */
function csvQuote(value) {
  const str = String(value);
  if (/["\n\r,]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/**
 * @param {{word: string, count: number, percent: number}[]} entries a
 *   computeWordFrequency() result's `entries` array (or any array shaped
 *   like it).
 * @returns {string} a complete CSV document (header + one row per entry,
 *   trailing newline), ready to hand to a Blob for download.
 *
 *   FORMULA-INJECTION NOTE (security-standards.md): every `word` value
 *   here comes from tokenizeWords()/computeWordFrequency() above, whose
 *   WORD_RE match can never start with `=`, `+`, `@`, a hyphen, tab, or
 *   CR -- the regex requires a leading Unicode letter or digit. There is
 *   therefore no untrusted-input formula-injection vector for the word
 *   column to neutralize with a prefix character, and neither `count`
 *   (a plain integer) nor `percent` (a fixed-point number string) can
 *   start with one either. csvQuote() above still RFC-4180-quotes a word
 *   containing a comma/quote/newline (reachable via an internal
 *   apostrophe/hyphen match, e.g. a Unicode quote character inside a
 *   contraction), which is a correctness concern, not a security one.
 */
export function frequencyToCsv(entries) {
  const header = 'word,count,percent\n';
  if (!entries.length) return header;
  const rows = entries
    .map((e) => `${csvQuote(e.word)},${e.count},${e.percent.toFixed(2)}`)
    .join('\n');
  return `${header}${rows}\n`;
}

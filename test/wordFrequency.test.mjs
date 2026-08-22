import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeWords, computeWordFrequency, frequencyToCsv, STOP_WORDS } from '../src/pure/wordFrequency.mjs';

// -- tokenizeWords -----------------------------------------------------------

test('tokenizeWords: empty/null/undefined input produces an empty array', () => {
  assert.deepEqual(tokenizeWords(''), []);
  assert.deepEqual(tokenizeWords(null), []);
  assert.deepEqual(tokenizeWords(undefined), []);
});

test('tokenizeWords: splits on whitespace and punctuation', () => {
  assert.deepEqual(tokenizeWords('one, two.  three!'), ['one', 'two', 'three']);
});

test('tokenizeWords: keeps a contraction as one word via an internal apostrophe', () => {
  assert.deepEqual(tokenizeWords("don't stop"), ["don't", 'stop']);
});

test('tokenizeWords: keeps a hyphenated compound as one word via an internal hyphen', () => {
  assert.deepEqual(tokenizeWords('a well-known fact'), ['a', 'well-known', 'fact']);
});

test('tokenizeWords: a leading/trailing quote or hyphen is never part of the match', () => {
  assert.deepEqual(tokenizeWords("'quoted' -word- --dashes--"), ['quoted', 'word', 'dashes']);
});

test('tokenizeWords: digits count as words, and a mixed alphanumeric token stays one word', () => {
  assert.deepEqual(tokenizeWords('2026 was cov1d-era'), ['2026', 'was', 'cov1d-era']);
});

test('tokenizeWords: every matched word starts with a letter or digit, never a special character', () => {
  // Load-bearing for frequencyToCsv()'s formula-injection reasoning.
  const words = tokenizeWords("=cmd '=danger +also @nope -minus \tTAB \rCR real-word don't");
  for (const w of words) {
    assert.match(w, /^[\p{L}\p{N}]/u, `"${w}" does not start with a letter/digit`);
  }
});

// -- computeWordFrequency: core counting -------------------------------------

test('computeWordFrequency: counts distinct words, case-insensitive by default', () => {
  const outcome = computeWordFrequency('The cat sat. The CAT sat!');
  const byWord = Object.fromEntries(outcome.entries.map((e) => [e.word, e.count]));
  assert.equal(byWord.the, 2);
  assert.equal(byWord.cat, 2);
  assert.equal(byWord.sat, 2);
  assert.equal(outcome.totalWords, 6);
  assert.equal(outcome.uniqueWords, 3);
});

test('computeWordFrequency: caseSensitive:true tracks differently-cased words separately', () => {
  const outcome = computeWordFrequency('The the THE', { caseSensitive: true });
  const byWord = Object.fromEntries(outcome.entries.map((e) => [e.word, e.count]));
  assert.equal(byWord.The, 1);
  assert.equal(byWord.the, 1);
  assert.equal(byWord.THE, 1);
  assert.equal(outcome.uniqueWords, 3);
});

test('computeWordFrequency: entries are sorted by count descending, then alphabetically on ties', () => {
  const outcome = computeWordFrequency('b b a a c');
  assert.deepEqual(
    outcome.entries.map((e) => e.word),
    ['a', 'b', 'c']
  );
  assert.equal(outcome.entries[0].count, 2);
  assert.equal(outcome.entries[2].count, 1);
});

test('computeWordFrequency: percent is share of the counted total, not the raw token count', () => {
  const outcome = computeWordFrequency('a a b b');
  for (const e of outcome.entries) assert.equal(e.percent, 50);
});

test('computeWordFrequency: empty input returns an all-zero, empty-entries result without throwing', () => {
  const outcome = computeWordFrequency('');
  assert.deepEqual(outcome.entries, []);
  assert.equal(outcome.totalWords, 0);
  assert.equal(outcome.rawWordCount, 0);
  assert.equal(outcome.uniqueWords, 0);
  assert.equal(outcome.averageLength, 0);
  assert.equal(outcome.longestWord, '');
  assert.equal(outcome.topWord, null);
});

// -- minLength filter ----------------------------------------------------------

test('computeWordFrequency: minLength drops shorter words from entries, totals, and stats', () => {
  const outcome = computeWordFrequency('a bb ccc dddd', { minLength: 3 });
  assert.deepEqual(
    outcome.entries.map((e) => e.word),
    ['ccc', 'dddd']
  );
  assert.equal(outcome.totalWords, 2);
  assert.equal(outcome.rawWordCount, 4, 'rawWordCount reflects every token BEFORE filtering');
});

// -- excludeNumbers filter -------------------------------------------------------

test('computeWordFrequency: excludeNumbers drops all-digit tokens but keeps alphanumeric ones', () => {
  const outcome = computeWordFrequency('2026 was cov1d-era', { excludeNumbers: true });
  const words = outcome.entries.map((e) => e.word);
  assert.ok(!words.includes('2026'));
  assert.ok(words.includes('cov1d-era'), 'a mixed letter+digit token is not "all digits" and should survive');
});

// -- excludeStopWords filter -----------------------------------------------------

test('computeWordFrequency: excludeStopWords drops common function words, keeps content words', () => {
  const outcome = computeWordFrequency('the cat sat on the mat', { excludeStopWords: true });
  const words = outcome.entries.map((e) => e.word);
  assert.deepEqual(words.sort(), ['cat', 'mat', 'sat']);
});

test('STOP_WORDS: matching is against the lowercased word regardless of caseSensitive', () => {
  const outcome = computeWordFrequency('The THE the', { excludeStopWords: true, caseSensitive: true });
  assert.deepEqual(outcome.entries, []);
});

// -- combined filters --------------------------------------------------------------

test('computeWordFrequency: filters combine (minLength + excludeStopWords + excludeNumbers)', () => {
  const outcome = computeWordFrequency('a an 2026 the cats and dogs run', {
    minLength: 3,
    excludeStopWords: true,
    excludeNumbers: true,
  });
  const words = outcome.entries.map((e) => e.word).sort();
  assert.deepEqual(words, ['cats', 'dogs', 'run']);
});

test('computeWordFrequency: filtering out every word returns empty entries, not an error, and rawWordCount still reflects the original text', () => {
  const outcome = computeWordFrequency('the a an', { excludeStopWords: true });
  assert.deepEqual(outcome.entries, []);
  assert.equal(outcome.totalWords, 0);
  assert.equal(outcome.rawWordCount, 3);
});

// -- averageLength / longestWord / topWord ------------------------------------------

test('computeWordFrequency: averageLength and longestWord are computed AFTER filtering', () => {
  const outcome = computeWordFrequency('a bb ccccc', { minLength: 3 });
  // Only "ccccc" (5 chars) survives minLength:3.
  assert.equal(outcome.longestWord, 'ccccc');
  assert.equal(outcome.averageLength, 5);
});

test('computeWordFrequency: topWord is the same object as entries[0]', () => {
  const outcome = computeWordFrequency('x x y');
  assert.equal(outcome.topWord, outcome.entries[0]);
  assert.equal(outcome.topWord.word, 'x');
});

// -- frequencyToCsv -----------------------------------------------------------------

test('frequencyToCsv: header only for an empty entries array', () => {
  assert.equal(frequencyToCsv([]), 'word,count,percent\n');
});

test('frequencyToCsv: one row per entry, percent fixed to 2 decimals', () => {
  const csv = frequencyToCsv([{ word: 'cat', count: 3, percent: 33.333333 }]);
  assert.equal(csv, 'word,count,percent\ncat,3,33.33\n');
});

test('frequencyToCsv: quotes a word containing a comma per RFC 4180 (reachable via a Unicode punctuation match)', () => {
  const csv = frequencyToCsv([{ word: 'a,b', count: 1, percent: 100 }]);
  assert.match(csv, /"a,b",1,100\.00/);
});

test('frequencyToCsv: never produces a word cell starting with =, +, @, or - (formula-injection is structurally unreachable, see wordFrequency.mjs header)', () => {
  const outcome = computeWordFrequency("=cmd '=danger +also @nope -minus real-word don't 123");
  const csv = frequencyToCsv(outcome.entries);
  const dataLines = csv.split('\n').slice(1).filter(Boolean);
  for (const line of dataLines) {
    const firstChar = line.startsWith('"') ? line[1] : line[0];
    assert.doesNotMatch(firstChar, /[=+@\t\r-]/, `CSV line "${line}" starts with a formula-injection character`);
  }
});

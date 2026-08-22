'use strict';

module.exports = {
  slug: 'word-frequency-counter',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-22',
  navLabel: 'Word Frequency Counter',
  h1: 'Count Word Frequency in Text',
  title: 'Word Frequency Counter and Analyzer | filetools',
  metaDescription: 'Paste or drop a text file and get every word ranked by how often it appears, plus quick stats, free and in your browser. No upload, no sign-up.',
  deck: 'Paste any text, or drop a .txt file, and see every word ranked by how often it appears, plus quick stats on length and repetition. Nothing is sent anywhere.',
  clientEntry: 'wordFrequency',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'text',
  mark: { verb: 'count' },
  maxBytes: 20 * 1024 * 1024,
  pasteFile: { name: 'pasted-text.txt', type: 'text/plain' },
  mode: 'word-frequency',
  fileTypeLabel: 'text file',
  accepts: '.txt,.md,text/plain,text/markdown',
  multiple: false,
  pasteInput: {
    label: 'Or paste text',
    placeholder: 'The quick brown fox jumps over the lazy dog. The dog barks, but the fox is already gone. Every day the fox returns, and every day the dog barks again.',
    buttonLabel: 'Count words',
  },
  howSteps: [
    'Drop or choose a .txt file, or paste any text directly into the box.',
    'Turn on “ignore case”, “exclude common words”, or “exclude numbers” if you need them, or set a minimum word length - the table updates immediately.',
    'Review the word count stats and the ranked frequency table, then download it as a CSV.',
  ],
  faqs: [
    {
      q: 'Is my text sent anywhere?',
      answerHtml: 'No. Pasted text and uploaded files are both read entirely on your device - nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What counts as a “word”?',
      answerHtml: 'A run of letters or digits, allowing one internal apostrophe or hyphen so a contraction like <code>don’t</code> or a compound like <code>well-known</code> counts as a single word. Punctuation, quotation marks, and whitespace are treated as breaks between words, not part of them.',
    },
    {
      q: 'Is counting case-sensitive?',
      answerHtml: '“Ignore case” is on by default, so <code>The</code> and <code>the</code> count as the same word. Turn it off if you want <code>USA</code> and <code>usa</code> tracked separately.',
    },
    {
      q: 'Can I filter out common words like “the” and “and”?',
      answerHtml: 'Turn on “exclude common words” to drop a short, fixed list of very frequent English function words (articles, pronouns, prepositions, and similar) from the table, so what is left is closer to the text’s actual subject matter. This list is not exhaustive and is English-only.',
    },
    {
      q: 'How are ties in the ranking broken?',
      answerHtml: 'Words with the same count are listed alphabetically, so the table order stays stable and predictable no matter how you re-run the same text.',
    },
    {
      q: 'Does it count numbers as words?',
      answerHtml: 'Yes, by default a run of digits counts as a word, so <code>2026</code> is counted. Turn on “exclude numbers” to drop number-only entries from the table.',
    },
  ],
  relatedSlugs: ['sort-lines', 'remove-duplicate-lines', 'html-table-to-csv'],
};

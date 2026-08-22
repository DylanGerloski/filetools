'use strict';

module.exports = {
  slug: 'html-entity-encode-decode',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-22',
  navLabel: 'HTML Entity Encode/Decode',
  h1: 'HTML Entity Encoder and Decoder',
  title: 'HTML Entity Encoder and Decoder | filetools',
  metaDescription: 'Encode text to HTML entities or decode HTML entities back to plain text, free and in your browser. No upload, no sign-up.',
  deck: 'Paste text or entity-encoded markup and convert it either direction: escape the characters that are meaningful in HTML, or decode named and numeric entities back to plain text. Nothing is sent anywhere.',
  clientEntry: 'htmlEntity',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'text',
  mark: { verb: 'convert' },
  maxBytes: 20 * 1024 * 1024,
  pasteFile: { name: 'pasted-input.txt', type: 'text/plain' },
  mode: 'html-entity',
  fileTypeLabel: 'text or HTML file',
  accepts: '.txt,.html,.htm,text/plain,text/html',
  multiple: false,
  pasteInput: {
    label: 'Or paste text or markup',
    placeholder: 'Tom & Jerry\'s "favorite" <b>café</b>',
    buttonLabel: 'Convert',
  },
  howSteps: [
    'Drop or choose a .txt/.html file, or paste text directly into the box.',
    'Pick Encode or Decode. When encoding, choose a scope and an entity format - the result updates immediately as you change either.',
    'Copy the result to your clipboard, or download it as a .txt file.',
  ],
  faqs: [
    {
      q: 'Is my text sent anywhere?',
      answerHtml: 'No. Pasted text and uploaded files are both read entirely on your device - nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What exactly gets encoded?',
      answerHtml: 'By default, only the five characters that are meaningful in HTML markup: <code>&amp;</code>, <code>&lt;</code>, <code>&gt;</code>, <code>"</code>, and <code>\'</code>. Turn on “Also encode accented letters, symbols, and emoji” to convert every character above plain ASCII too - useful when you need output that only ever contains ASCII bytes.',
    },
    {
      q: 'Which entity format does the encoder use?',
      answerHtml: 'Choose from three: a named entity where one exists for that character (<code>&amp;copy;</code>), a numeric decimal entity (<code>&amp;#169;</code>), or a numeric hex entity (<code>&amp;#xA9;</code>). A character with no matching named entity always falls back to its numeric form, even in named mode.',
    },
    {
      q: 'What happens to an entity the decoder doesn’t recognize?',
      answerHtml: 'It’s left exactly as it appeared in the input, unchanged - the decoder never guesses at malformed or unknown markup. That covers a misspelled named entity and a numeric entity outside the valid Unicode range alike.',
    },
    {
      q: 'Is decoded output ever rendered as live HTML?',
      answerHtml: 'No. The decoded result is always shown and downloaded as plain text. If it contains something that looks like a tag - decoding <code>&amp;lt;script&amp;gt;</code> produces the literal text <code>&lt;script&gt;</code> - that text is displayed as text, never executed or inserted as markup.',
    },
  ],
  relatedSlugs: ['remove-duplicate-lines', 'sort-lines', 'html-table-to-csv'],
};

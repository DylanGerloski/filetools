'use strict';

module.exports = {
  slug: 'remove-duplicate-lines',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-14',
  navLabel: 'Remove Duplicate Lines/Rows',
  h1: 'Remove Duplicate Lines from a List or CSV',
  title: 'Remove Duplicate Lines or CSV Rows | filetools',
  metaDescription: 'Paste a list or drop a .txt/.csv file and get it back with duplicate lines removed, free and in your browser. No upload, no sign-up.',
  deck: 'Paste a list, or drop a .txt or .csv file, and download it back with every duplicate line removed. Nothing is sent anywhere.',
  clientEntry: 'dedupeLines',
  mode: 'dedupe-lines',
  fileTypeLabel: 'text or CSV file',
  accepts: '.txt,.csv,text/plain,text/csv',
  multiple: false,
  pasteInput: {
    label: 'Or paste a list',
    placeholder: 'apple\nbanana\napple\ncherry',
    buttonLabel: 'Remove duplicates',
  },
  howSteps: [
    'Drop or choose a .txt or .csv file, or paste a list directly into the text box.',
    'Turn on “ignore case”, “ignore surrounding whitespace”, or “skip blank lines” if you need them - the preview and the counts update immediately.',
    'Review the count of duplicates removed and the preview, then download the result.',
  ],
  faqs: [
    {
      q: 'Is my list or file sent anywhere?',
      answerHtml: 'No. Pasted text and uploaded files are both read entirely on your device - nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'How does it decide two lines are duplicates?',
      answerHtml: 'By exact text match, line by line - not a fuzzy or “looks similar” match. <code>foo</code> and <code>&nbsp;foo</code> (with a leading space) count as different lines unless you turn on “ignore surrounding whitespace”, and <code>Apple</code> and <code>apple</code> count as different unless you turn on “ignore case”. This is deliberate: silently treating visually different lines as identical would be a surprising thing for a dedup tool to do without being asked.',
    },
    {
      q: 'Does this work on a CSV file, not just a plain list?',
      answerHtml: 'Yes - each row of a CSV is compared as one line of text, so a row that exactly repeats (every column, in order) is removed the same way a repeated plain-text line is. The one case this does not specially parse is a quoted CSV field that itself contains a line break; a row like that is treated as more than one line, the same way a plain text editor would show it.',
    },
    {
      q: 'Which occurrence of a duplicate is kept?',
      answerHtml: 'The first one. Everything after the first occurrence of an exact-match duplicate is removed; the file’s original row order is otherwise preserved.',
    },
    {
      q: 'What happens to blank lines?',
      answerHtml: 'By default, blank lines are deduped like any other line - five blank lines in a row become one. Turn on “skip blank lines” to remove all of them from the output instead.',
    },
  ],
  relatedSlugs: ['html-table-to-csv', 'pdf-to-csv', 'bank-statement-to-csv', 'url-encode-decode'],
};

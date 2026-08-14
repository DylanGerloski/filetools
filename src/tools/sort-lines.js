'use strict';

module.exports = {
  slug: 'sort-lines',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-14',
  navLabel: 'Sort Text or CSV by Column',
  h1: 'Sort a List or CSV by Column',
  title: 'Sort a Text List or CSV File by Column — In Your Browser | filetools',
  metaDescription: 'Paste a list or drop a .txt/.csv file and get it back sorted alphabetically or numerically by any column, ascending or descending, free and in your browser. No upload, no sign-up.',
  deck: 'Paste a list, or drop a .txt or .csv file, and download it back sorted — pick the column, numeric or alphabetic, ascending or descending. Nothing is sent anywhere.',
  clientEntry: 'sortLines',
  mode: 'sort-lines',
  fileTypeLabel: 'text or CSV file',
  accepts: '.txt,.csv,text/plain,text/csv',
  multiple: false,
  pasteInput: {
    label: 'Or paste a list',
    placeholder: 'banana\napple\ncherry',
    buttonLabel: 'Sort',
  },
  howSteps: [
    'Drop or choose a .txt or .csv file, or paste a list directly into the text box.',
    'For a CSV, pick which column to sort by — the preview and download update immediately. Turn on “first row is a header” to keep the header row pinned at the top.',
    'Choose ascending or descending, and numbers or text if auto-detection picked the wrong one, then download the sorted result.',
  ],
  faqs: [
    {
      q: 'Is my list or file sent anywhere?',
      answerHtml: 'No. Pasted text and uploaded files are both read entirely on your device — nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'How does it decide whether to sort numerically or alphabetically?',
      answerHtml: 'Auto-detect looks at every value in the column you chose: if all of them are plain numbers, it sorts numerically (so <code>9</code> comes before <code>10</code>); otherwise it sorts alphabetically. If a column mixes numbers with text (or auto-detect gets a column like ZIP codes wrong), switch “Sort as” to Numbers or Text yourself.',
    },
    {
      q: 'Does this work on a plain list, not just a CSV?',
      answerHtml: 'Yes — a plain text list with no commas is treated as a single-column file, so the same sort (alphabetical or numeric, ascending or descending) applies to the whole line.',
    },
    {
      q: 'What happens to a header row?',
      answerHtml: 'Turn on “first row is a header” and it stays pinned at the top of the result, excluded from both the sort and from numeric auto-detection. This only appears for files with more than one column.',
    },
    {
      q: 'How are ties and blank or non-numeric values handled?',
      answerHtml: 'Rows with equal sort values keep their original relative order (a stable sort). Under a numeric sort, a blank or non-numeric cell is always pushed to the end of the result, in either direction, rather than being treated as the highest or lowest value.',
    },
    {
      q: 'Does this handle commas inside a quoted CSV field?',
      answerHtml: 'Yes, a field like <code>"Smith, John"</code> is treated as one column, not split on the comma inside the quotes. The one case this doesn’t handle is a quoted field containing a line break — that row is read as more than one line, the same way a plain text editor would show it.',
    },
  ],
  relatedSlugs: ['remove-duplicate-lines', 'html-table-to-csv', 'pdf-to-csv'],
};

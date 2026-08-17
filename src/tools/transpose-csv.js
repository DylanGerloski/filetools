'use strict';

module.exports = {
  slug: 'transpose-csv',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-16',
  navLabel: 'Transpose CSV',
  h1: 'Transpose CSV Rows and Columns',
  title: 'Transpose CSV Rows to Columns - In Your Browser | filetools',
  metaDescription: 'Paste CSV text or drop a .csv file and flip every row into a column and every column into a row, free and in your browser. No upload, no sign-up.',
  deck: 'Paste CSV text, or drop a .csv file, and download it back with every row turned into a column and every column turned into a row. Nothing is sent anywhere.',
  clientEntry: 'transposeCsv',
  mode: 'transpose-csv',
  fileTypeLabel: 'CSV file',
  accepts: '.csv,text/csv,.txt,text/plain',
  multiple: false,
  pasteInput: {
    label: 'Or paste CSV text',
    placeholder: 'Name,Age,City\nAda,30,London\nGrace,34,New York',
    buttonLabel: 'Transpose',
  },
  howSteps: [
    'Drop or choose a .csv file, or paste CSV text directly into the text box.',
    'Review the preview: every original row is now a column, and every original column is now a row.',
    'Download the result as a CSV file, ready to open in Excel, Sheets, or any spreadsheet.',
  ],
  faqs: [
    {
      q: 'Is my CSV sent anywhere?',
      answerHtml: 'No. Pasted text and uploaded files are both read and transposed entirely on your device; nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What does "transpose" actually mean here?',
      answerHtml: 'Every row in your file becomes one column in the output, and every column becomes one row - the same operation as a spreadsheet\'s "Paste Special &gt; Transpose". A 3-row, 5-column table comes back as a 5-row, 3-column table, with the same values, just flipped along the diagonal.',
    },
    {
      q: 'What happens if rows have different numbers of columns (a ragged CSV)?',
      answerHtml: 'Short rows are padded with blank cells up to the width of the widest row before transposing, so the result is always a clean rectangle. Nothing shifts out of place just because one row happened to have fewer fields than another.',
    },
    {
      q: 'What happens to blank lines?',
      answerHtml: 'A completely blank line (no content in any of its cells) is skipped rather than turned into an entirely empty output column. If you need a strict, literal transpose that keeps blank lines as-is, turn off "Skip blank rows" once your file is loaded.',
    },
    {
      q: 'Does this handle quoted fields with commas or line breaks inside them?',
      answerHtml: 'Yes. This tool reads the whole file with a full CSV parser, so a quoted field like <code>"Smith, John"</code> or a quoted field containing its own line break is kept as one field, correctly, before transposing.',
    },
    {
      q: 'Is the downloaded CSV safe to open in Excel or Sheets?',
      answerHtml: 'Yes. Any cell value that would otherwise be interpreted as a spreadsheet formula (starting with <code>=</code>, <code>+</code>, <code>@</code>, or a tab) is automatically neutralized with a leading quote before download, the same protection used across every CSV export on this site.',
    },
  ],
  relatedSlugs: ['merge-csv', 'split-csv', 'sort-lines'],
};

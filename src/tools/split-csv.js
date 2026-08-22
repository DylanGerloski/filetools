'use strict';

module.exports = {
  slug: 'split-csv',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-15',
  navLabel: 'Split CSV',
  h1: 'Split a CSV Into Multiple Files',
  title: 'Split a CSV Into Multiple Files | filetools',
  metaDescription: 'Split a large CSV into smaller files of a set number of rows each, free, with no upload and no sign-up. Downloads as one zip.',
  deck: 'Drop a large CSV and download it split into smaller files of however many rows you choose - the header row repeated in each one, packaged as a single zip. Nothing is uploaded.',
  clientEntry: 'splitCsv',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'csv',
  mark: { verb: 'split', ink: 'csv' },
  maxBytes: 20 * 1024 * 1024,
  pasteFile: { name: 'pasted-input.csv', type: 'text/csv' },
  mode: 'split-csv',
  fileTypeLabel: 'CSV file',
  accepts: '.csv,text/csv,.txt,text/plain',
  multiple: false,
  pasteInput: {
    label: 'Or paste CSV text',
    placeholder: 'Name,Amount\nRent,1200\nCoffee,4.50',
    buttonLabel: 'Split',
  },
  howSteps: [
    'Drop or choose a .csv file, or paste CSV text directly into the text box.',
    'Set “Rows per file” - the file list updates immediately to show exactly which files you’ll get and how many rows land in each.',
    'Leave “First row is a header” on (the default) to repeat the header as the first row of every file, or turn it off to split purely by position.',
    'Download the zip - every piece is a complete, standalone .csv.',
  ],
  faqs: [
    {
      q: 'Does the header row count toward the rows-per-file number?',
      answerHtml: 'No. “Rows per file” counts data rows only - with the header option on, each file gets the header row <em>plus</em> up to that many data rows. Splitting 250 data rows into files of 100 gives you three files: 100, 100, and 50 rows, each with the header on top.',
    },
    {
      q: 'What are the files in the zip called?',
      answerHtml: 'They take the original file’s name with a numbered suffix - <code>orders.csv</code> split three ways becomes <code>orders-part-01.csv</code>, <code>orders-part-02.csv</code>, <code>orders-part-03.csv</code>. The numbers are zero-padded so the files sort in the right order in any file manager.',
    },
    {
      q: 'How are quoted fields with commas or line breaks inside them handled?',
      answerHtml: 'Correctly - this tool reads the whole file with a full CSV parser, so a quoted field like <code>"Smith, John"</code> or a quoted field containing its own line break is kept as one field of one row. That matters more for splitting than almost any other CSV operation: a tool that split on raw line breaks would cut a multi-line field in half and corrupt both output files around it.',
    },
    {
      q: 'Why would I split a CSV at all?',
      answerHtml: 'The usual reasons: a tool or form that caps how many rows it accepts per import (many CRM, email, and e-commerce importers stop at 500–10,000 rows), a spreadsheet that struggles with a very large file, or sharing a big export in reviewable pieces. Set “Rows per file” to whatever your importer’s limit is and each piece comes out ready to load.',
    },
    {
      q: 'Do you upload my file anywhere?',
      answerHtml: 'No. The file is read, split, and zipped entirely on your device. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What happens to blank lines?',
      answerHtml: 'Rows whose cells are all empty are dropped rather than carried into an output file - they’d otherwise waste a slot in a row-count split and show up as empty lines mid-file. Rows with any real content are kept exactly as they are.',
    },
    {
      q: 'Is there a limit on file size or how many pieces I can make?',
      answerHtml: 'The input file is capped at a generous size (shown on the drop zone) so a single huge file can’t freeze the tab, and one split is capped at 2,000 output files - if your settings would produce more, the tool says so and asks you to raise “Rows per file” rather than silently building a zip your browser can’t handle.',
    },
  ],
  relatedSlugs: ['sort-lines', 'remove-duplicate-lines', 'transpose-csv'],
};

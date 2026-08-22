'use strict';

module.exports = {
  slug: 'xlsx-to-json',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-15',
  navLabel: 'Excel to JSON',
  h1: 'Convert Excel (XLSX) to JSON',
  title: 'Convert Excel XLSX to JSON - In Your Browser | filetools',
  metaDescription: 'Drop an .xlsx file and get JSON back - every sheet becomes its own array of records, free and in your browser. No upload, no sign-up.',
  deck: 'Drop an Excel (.xlsx) file and download it as JSON. Every sheet in the workbook becomes its own array of records; nothing is sent anywhere.',
  clientEntry: 'xlsxToJson',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'sheet',
  mark: { verb: 'convert', ink: 'json' },
  maxBytes: 20 * 1024 * 1024,
  mode: 'xlsx-to-json',
  fileTypeLabel: 'Excel file',
  accepts: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  multiple: false,
  howSteps: [
    'Drop or choose an .xlsx file.',
    'Review the preview of each sheet and toggle whether its first row is a header, if the guess looks wrong.',
    'Download the JSON for one sheet, or all sheets at once as a single file keyed by sheet name.',
  ],
  faqs: [
    {
      q: 'Is my spreadsheet sent anywhere?',
      answerHtml: 'No. The file is read and converted entirely on your device - nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What does a converted sheet look like?',
      answerHtml: 'By default, the first row becomes each record\'s field names and every row after it becomes one JSON object, the same shape <code>json-to-csv</code>\'s output has in reverse. If a sheet\'s first row isn\'t really a header, turn the toggle off and every column instead gets a name like <code>column_1</code>, <code>column_2</code>.',
    },
    {
      q: 'Does it keep numbers and dates as their real types, or turn everything into text?',
      answerHtml: 'Real types. A numeric cell becomes a JSON number, a checkbox/boolean cell becomes <code>true</code>/<code>false</code>, and a date cell becomes an ISO 8601 date string (e.g. <code>2026-08-15T00:00:00.000Z</code>) rather than whatever display format Excel happened to show.',
    },
    {
      q: 'What about formulas and merged cells?',
      answerHtml: 'A formula cell exports its last-calculated result, not the formula text itself - open the file in Excel first if you need it recalculated. A merged cell\'s value is only present in its top-left cell; the other cells the merge covers export as empty, matching how the file stores them.',
    },
    {
      q: 'Does this handle every sheet in the workbook?',
      answerHtml: 'Yes. Every visible sheet converts, each into its own array of records; hidden sheets are skipped. With more than one sheet, you can download each one separately or all of them together as one JSON file, keyed by sheet name.',
    },
    {
      q: 'Is there a file size limit?',
      answerHtml: 'Files up to 20MB. A compressed .xlsx unpacks into much more verbose XML in memory, so a very large workbook can be slow or use a lot of memory in the tab; this cap keeps that from freezing your browser.',
    },
  ],
  relatedSlugs: ['json-to-csv', 'html-table-to-csv', 'xlsx-to-csv'],
};

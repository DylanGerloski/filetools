'use strict';

module.exports = {
  slug: 'json-to-csv',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-15',
  navLabel: 'JSON to CSV',
  h1: 'Convert JSON to CSV',
  title: 'Convert JSON to CSV - In Your Browser | filetools',
  metaDescription: 'Paste a JSON array or drop a .json file and get a CSV file back - nested objects flatten into dot-notation columns, free and in your browser. No upload, no sign-up.',
  deck: 'Paste a JSON array of objects, or drop a .json file, and download it as a CSV. Nested objects become dot-notation columns; nothing is sent anywhere.',
  clientEntry: 'jsonToCsv',
  mode: 'json-to-csv',
  fileTypeLabel: 'JSON file',
  accepts: '.json,application/json,text/plain',
  multiple: false,
  pasteInput: {
    label: 'Or paste JSON',
    placeholder: '[\n  {"name": "Coffee", "price": 4.50},\n  {"name": "Tea", "price": 3.25}\n]',
    buttonLabel: 'Convert pasted JSON',
  },
  howSteps: [
    'Drop or choose a .json file, or paste a JSON array directly into the text box.',
    'Review the preview table - every object becomes one row, every field becomes one column.',
    'Download the result as a CSV file, ready to open in Excel, Sheets, or any spreadsheet.',
  ],
  faqs: [
    {
      q: 'Is my JSON sent anywhere?',
      answerHtml: 'No. Pasted JSON and uploaded files are both read and converted entirely on your device - nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What JSON shape does this expect?',
      answerHtml: 'A top-level array of objects, like <code>[ {"name": "Coffee", "price": 4.50}, {"name": "Tea", "price": 3.25} ]</code>. A single object, or an array of anything else (numbers, strings), isn’t rejected outright (each non-object item just becomes a single-column row named "value"), but an array of flat objects is what produces the most useful spreadsheet.',
    },
    {
      q: 'What happens to nested objects and arrays?',
      answerHtml: 'A nested object is flattened into dot-notation columns - <code>{"address": {"city": "Reno"}}</code> becomes a column named <code>address.city</code>. A nested array is kept as-is, written into its cell as compact JSON text (e.g. <code>["red","blue"]</code>), rather than expanded into extra columns - that keeps the column count predictable no matter how many items a nested array happens to have.',
    },
    {
      q: 'What if different objects in the array have different fields?',
      answerHtml: 'Every field seen across every object gets its own column, in the order it first appears. An object missing a given field just gets a blank cell there, rather than shifting the other columns out of place.',
    },
    {
      q: 'Is the CSV safe to open in Excel or Sheets?',
      answerHtml: 'Yes - any cell value that would otherwise be interpreted as a spreadsheet formula (starting with <code>=</code>, <code>+</code>, <code>@</code>, or a tab) is automatically neutralized with a leading quote before download, the same protection used across every CSV export on this site.',
    },
  ],
  relatedSlugs: ['html-table-to-csv', 'sort-lines', 'remove-duplicate-lines'],
};

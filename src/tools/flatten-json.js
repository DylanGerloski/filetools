'use strict';

module.exports = {
  slug: 'flatten-json',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-15',
  navLabel: 'Flatten Nested JSON',
  h1: 'Flatten Nested JSON to a Flat Object or CSV',
  title: 'Flatten Nested JSON to CSV or a Flat Object | filetools',
  metaDescription: 'Paste nested JSON or drop a .json file and get it back flattened to dot-notation keys, downloadable as JSON or CSV, free and in your browser.',
  deck: 'Paste nested JSON, or drop a .json file, and download it flattened to dot-notation keys (or your own delimiter), as JSON or CSV. Nothing is sent anywhere.',
  clientEntry: 'flattenJson',
  mode: 'flatten-json',
  fileTypeLabel: 'JSON file',
  accepts: '.json,application/json,text/plain',
  multiple: false,
  pasteInput: {
    label: 'Or paste JSON',
    placeholder: '{\n  "user": {\n    "name": "Ada",\n    "roles": ["admin", "editor"]\n  }\n}',
    buttonLabel: 'Flatten pasted JSON',
  },
  howSteps: [
    'Drop or choose a .json file, or paste JSON directly into the text box.',
    'Pick a delimiter for the flattened keys (dot, underscore, or slash), and choose whether array items get their own numbered key. The result updates immediately.',
    'Review the flattened result: a table for an array of records, a key/value list for a single object. Then download it as JSON or CSV.',
  ],
  faqs: [
    {
      q: 'Is my JSON sent anywhere?',
      answerHtml: 'No. Pasted JSON and uploaded files are both read entirely on your device: nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'How are nested objects turned into flat keys?',
      answerHtml: 'Each level of nesting is joined with your chosen delimiter. With the default dot delimiter, <code>{"user":{"name":"Ada"}}</code> flattens to a single key <code>user.name</code> with value <code>Ada</code>. Choose underscore or slash instead if that suits your spreadsheet or downstream tool better.',
    },
    {
      q: 'What happens to arrays?',
      answerHtml: 'By default each array item gets its own numbered key, so <code>{"roles":["admin","editor"]}</code> becomes <code>roles.0</code> and <code>roles.1</code>. Turn off “give array items their own numbered key” to keep each array as a single JSON value instead. That’s useful when an array is really one piece of data (like a list of tags) rather than something you want spread across columns.',
    },
    {
      q: 'Can I flatten a list of records at once, not just one object?',
      answerHtml: 'Yes. If the top level of your JSON is an array where every item is an object (a typical API response or export), each item becomes one row of a table, with every field it contains as a column. Download that as CSV to open it straight in a spreadsheet, or as JSON to get the same flattened records back as an array.',
    },
    {
      q: 'What if two records in my array have different fields?',
      answerHtml: 'Every field seen across any record becomes a column; a record that doesn’t have a given field just gets an empty cell there, the same way a missing or <code>null</code> value is shown.',
    },
  ],
  relatedSlugs: ['html-table-to-csv', 'remove-duplicate-lines', 'sort-lines'],
};

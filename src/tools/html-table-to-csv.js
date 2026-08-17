'use strict';

module.exports = {
  slug: 'html-table-to-csv',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-14',
  navLabel: 'HTML Table to CSV/JSON',
  h1: 'Convert an HTML Table to CSV or JSON',
  title: 'HTML Table to CSV or JSON - In Your Browser | filetools',
  metaDescription: 'Turn an HTML <table> (pasted markup or an .html file) into a CSV or JSON file, free and in your browser. No upload, no sign-up.',
  deck: 'Paste HTML markup or drop an .html file and get every table it contains as a CSV or JSON download. Nothing is sent anywhere.',
  clientEntry: 'htmlTableToCsv',
  mode: 'html-table',
  fileTypeLabel: 'HTML file',
  accepts: 'text/html,.html,.htm',
  multiple: false,
  pasteInput: {
    label: 'Or paste HTML markup',
    placeholder: '<table>\n  <tr><th>Name</th><th>Amount</th></tr>\n  <tr><td>Coffee</td><td>4.50</td></tr>\n</table>',
    buttonLabel: 'Convert pasted markup',
  },
  howSteps: [
    'Drop or choose an .html file, or paste HTML markup directly into the text box.',
    'Review each table it found - a real preview, with a toggle for whether the first row is a header and a × button to drop a stray row.',
    'Download one table as CSV or JSON, or download every table found at once.',
  ],
  faqs: [
    {
      q: 'Is my markup or file sent anywhere?',
      answerHtml: 'No. Pasted markup and uploaded files are both read entirely on your device - the parsing happens in your browser’s own HTML engine, nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Does this handle merged cells (colspan/rowspan)?',
      answerHtml: 'Yes. A cell that spans multiple columns or rows is expanded so every row in the CSV/JSON output has the same number of columns, with the merged cell’s value repeated into each cell it visually covers.',
    },
    {
      q: 'What if the page has more than one table?',
      answerHtml: 'Every <code>&lt;table&gt;</code> found, including one nested inside another, is shown as its own separate block with its own download buttons, plus a “Download all” option if more than one was found.',
    },
    {
      q: 'How does it know which row is the header?',
      answerHtml: 'A row is treated as a header if every one of its cells is a <code>&lt;th&gt;</code>, which is how most real-world tables mark their header row. Use the checkbox above the table to override it either way - the JSON export uses whichever row is currently marked as the header for its field names.',
    },
    {
      q: 'Is my pasted markup run as code?',
      answerHtml: 'No. Your markup is parsed as inert data only - any <code>&lt;script&gt;</code> tag inside it is never executed, and nothing from it is ever inserted into this page.',
    },
  ],
  relatedSlugs: ['pdf-to-csv', 'bank-statement-to-csv', 'merge-pdf'],
};

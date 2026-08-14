'use strict';

module.exports = {
  slug: 'pdf-to-csv',
  category: 'pdf',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-13',
  navLabel: 'PDF Tables to CSV',
  h1: 'Extract Tables from PDF to CSV',
  title: 'Extract Tables from PDF to CSV — In Your Browser | filetools',
  metaDescription: 'Pull tables out of a PDF into CSV files you can open in a spreadsheet, free and in your browser. No upload, no sign-up. Fix the columns before you export.',
  deck: 'Finds the tables in a PDF, shows you exactly what it found, and lets you fix a column before exporting to CSV. Nothing is uploaded.',
  clientEntry: 'pdfTables',
  mode: 'tables',
  accepts: 'application/pdf',
  multiple: false,
  howSteps: [
    'Choose or drop one PDF file.',
    'Review the tables it found — each one shown as a real table, with a toggle for whether the first row is a header and controls to fix a column boundary or drop a stray row.',
    'Download the CSV for one table, or all of them at once.',
  ],
  faqs: [
    {
      q: 'How accurate is the extraction?',
      answerHtml: 'It depends on the PDF. This tool reads the table structure from the text positions in the file, which works well for most reports and statements that aren’t scanned images. You’ll see exactly what it found before you download anything, and you can fix a misplaced column boundary or drop a stray row if something looks off.',
    },
    {
      q: 'Does this work on scanned PDFs?',
      answerHtml: 'No. If a page is a scanned image rather than real text, there’s nothing for this tool to read, and it will tell you so rather than guessing. This tool does not do OCR (optical character recognition).',
    },
    {
      q: 'Can I export to Excel (.xlsx) instead of CSV?',
      answerHtml: 'Not yet — this tool exports CSV, which opens directly in Excel, Google Sheets, and Numbers. A native .xlsx export may come later.',
    },
    {
      q: 'Is my file uploaded to a server?',
      answerHtml: 'No. Every table is found and extracted entirely on your device. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What if it finds the wrong number of columns?',
      answerHtml: 'Use the column boundary controls under the table to add, remove, or nudge a boundary — the table updates immediately so you can check the result before downloading.',
    },
  ],
  relatedSlugs: ['merge-pdf', 'split-pdf', 'bank-statement-to-csv'],
};

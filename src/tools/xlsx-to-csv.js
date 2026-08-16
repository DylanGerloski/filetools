'use strict';

module.exports = {
  slug: 'xlsx-to-csv',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-15',
  navLabel: 'Excel (XLSX) to CSV',
  h1: 'Convert Excel (.xlsx) to CSV',
  title: 'Convert Excel XLSX to CSV - In Your Browser | filetools',
  metaDescription: 'Turn an .xlsx spreadsheet into a CSV file for every sheet it contains, free and in your browser. No upload, no sign-up, no Excel needed.',
  deck: 'Drop an .xlsx workbook and get a real, correctable preview of every sheet it contains, then download each one as CSV. Nothing is sent anywhere.',
  clientEntry: 'xlsxToCsv',
  mode: 'xlsx',
  fileTypeLabel: '.xlsx file',
  accepts: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  multiple: false,
  howSteps: [
    'Drop or choose an .xlsx workbook.',
    'Review each sheet it found: a real preview, with a toggle for whether the first row is a header.',
    'Download one sheet as CSV, or every sheet at once.',
  ],
  faqs: [
    {
      q: 'Is my file uploaded to a server?',
      answerHtml: 'No. The workbook is unzipped and read entirely on your device. Nothing is sent anywhere, and turning off your Wi-Fi after the page loads doesn’t stop it from working.',
    },
    {
      q: 'What about the older .xls format?',
      answerHtml: 'This tool reads .xlsx, the Open XML format Excel has used since 2007, not the older binary .xls format. Re-save an .xls file as .xlsx in Excel, LibreOffice, or Google Sheets first, then convert it here.',
    },
    {
      q: 'Does it handle dates correctly?',
      answerHtml: 'Yes, for the common case: a cell formatted as a date or date-time in the workbook is converted to a readable date (YYYY-MM-DD, or YYYY-MM-DDTHH:MM:SS if it carries a time) rather than the raw serial number spreadsheets store internally.',
    },
    {
      q: 'What if a sheet is hidden, or the workbook has formulas?',
      answerHtml: 'Hidden sheets are skipped, matching what you’d normally see when you open the file. A formula cell exports its last-calculated value, exactly what a plain CSV export from Excel itself would show; the formula text itself is not exported.',
    },
    {
      q: 'Is a password-protected workbook supported?',
      answerHtml: 'No. An encrypted or password-protected .xlsx can’t be read without the password, and this tool never asks for one. Remove the password in Excel first, then convert the file here.',
    },
  ],
  relatedSlugs: ['pdf-to-csv', 'html-table-to-csv', 'bank-statement-to-csv'],
};

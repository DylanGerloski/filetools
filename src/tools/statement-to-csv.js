'use strict';

module.exports = {
  slug: 'bank-statement-to-csv',
  category: 'pdf',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-13',
  navLabel: 'Bank Statement to CSV',
  h1: 'Convert a Bank or Card Statement PDF to CSV',
  title: 'Bank Statement PDF to CSV — In Your Browser | filetools',
  metaDescription: 'Turn a bank or card statement PDF into a CSV of transactions, free and in your browser. No upload, no sign-up — your financial data never leaves your device.',
  deck: 'Reads the transaction table out of a statement PDF, including ones that span several pages, and combines it into a single CSV. Nothing is uploaded, ever.',
  clientEntry: 'statementToCsv',
  mode: 'statement',
  accepts: 'application/pdf',
  multiple: false,
  howSteps: [
    'Choose or drop one statement PDF.',
    'This tool finds the transaction table on every page and combines them into one table, removing the repeated header row that most statements print on each page.',
    'Review the combined table, drop any row that doesn’t belong, then download it as one CSV.',
  ],
  faqs: [
    {
      q: 'Is my statement uploaded anywhere?',
      answerHtml: 'No. A bank or card statement carries real financial data, so this matters more here than almost anywhere else on this site — every table is found and extracted entirely on your device. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Does this work with statements from any bank?',
      answerHtml: 'It works with any statement PDF that has a real text layer laid out as a table — which covers most bank- and card-issuer-generated statements. It reads column positions the same way a person visually lines up a table, so an unusual layout may need a row or two corrected by hand; you will always see exactly what was found before downloading anything.',
    },
    {
      q: 'Does this work on scanned statements?',
      answerHtml: 'No. If a page is a scanned image rather than real text, there’s nothing for this tool to read, and it will tell you so rather than guessing. This tool does not do OCR (optical character recognition).',
    },
    {
      q: 'What happens with a multi-page statement?',
      answerHtml: 'Most statements repeat the transaction table’s header on every page. This tool detects that repeated header, removes the duplicates, and combines every page’s rows into a single continuous table and a single CSV download.',
    },
    {
      q: 'What if it finds the wrong number of columns, or picks up something that isn’t a transaction?',
      answerHtml: 'Use the × button next to a row to drop it before downloading. A box that clearly isn’t part of the transaction table (like an account summary) is shown separately rather than merged in, so it won’t corrupt your transaction CSV in the first place.',
    },
  ],
  relatedSlugs: ['pdf-to-csv', 'merge-pdf', 'split-pdf'],
};

'use strict';

module.exports = {
  slug: 'split-pdf',
  category: 'pdf',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-13',
  navLabel: 'Split PDF',
  h1: 'Split a PDF',
  title: 'Split a PDF — Extract or Separate Pages | filetools',
  metaDescription: 'Pull specific pages out of a PDF, or split every page into its own file, free and in your browser. No upload, no file size limit.',
  deck: 'Pick the pages you want, or split every page into its own file. Nothing is uploaded.',
  clientEntry: 'pdfPages',
  mode: 'split',
  accepts: 'application/pdf',
  multiple: false,
  howSteps: [
    'Choose or drop one PDF file.',
    'Check the pages you want (or type a range like “1-3, 7, 9-12”), and choose whether you want them as one file or as separate files.',
    'Select “Split PDF” and your file(s) download to your device.',
  ],
  faqs: [
    {
      q: 'How do I extract just a few pages?',
      answerHtml: 'Check the pages you want in the grid, or type a range such as “1-3, 7” into the range field — both stay in sync with each other.',
    },
    {
      q: 'Can I get every page as its own separate PDF?',
      answerHtml: 'Yes. Choose “Each page as its own file” before splitting. Each page downloads as its own PDF, one after another.',
    },
    {
      q: 'Is my file uploaded to a server?',
      answerHtml: 'No. The split happens entirely on your device. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Does this work on scanned PDFs?',
      answerHtml: 'Yes — splitting doesn’t need to read any text, so it works on scanned/image-only PDFs the same as any other PDF.',
    },
    {
      q: 'What if my PDF is password-protected?',
      answerHtml: 'A password-protected file can’t be read in the browser without its password. Remove the password first, then split.',
    },
  ],
  relatedSlugs: ['merge-pdf', 'rotate-pdf', 'pdf-to-csv'],
};

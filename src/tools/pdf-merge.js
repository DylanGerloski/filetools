'use strict';

module.exports = {
  slug: 'merge-pdf',
  category: 'pdf',
  // First shipped this date (matches this file's first commit) -- read by
  // scripts/announce.js to detect new tool launches and by
  // buildFeed.js for feed.xml's per-item pubDate. Set once at launch;
  // don't bump it on later edits to this file.
  launchDate: '2026-08-13',
  navLabel: 'Merge PDF',
  h1: 'Merge PDF Files',
  title: 'Merge PDF Files Free — In Your Browser | filetools',
  metaDescription: 'Combine multiple PDFs into one file, free, with no upload and no sign-up. Reorder pages before merging. Your files never leave your device.',
  deck: 'Combine two or more PDFs into a single file. Drag to reorder before merging. Nothing is uploaded.',
  clientEntry: 'pdfPages',
  mode: 'merge',
  accepts: 'application/pdf',
  multiple: true,
  howSteps: [
    'Choose or drop two or more PDF files.',
    'Drag the files (or use the up/down buttons) to set the order they should appear in the merged file.',
    'Select “Merge PDFs” and the combined file downloads straight to your device.',
  ],
  faqs: [
    {
      q: 'Is there a limit on how many PDFs I can merge?',
      answerHtml: 'No. Since everything runs in your browser rather than on a server, the only real limit is your device’s own memory.',
    },
    {
      q: 'Do you upload my files anywhere?',
      answerHtml: 'No. The merge happens entirely on your device using your browser’s own processing power. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Can I change the page order after merging?',
      answerHtml: 'Reorder the source files before merging using the up/down arrows or by dragging. Once merged, use the split or rotate tools if you need to adjust the result.',
    },
    {
      q: 'What happens to password-protected PDFs?',
      answerHtml: 'A password-protected file can’t be read in the browser without its password, so it’s reported as an error rather than silently skipped. Remove the password first, then merge.',
    },
    {
      q: 'Does merging reduce PDF quality?',
      answerHtml: 'No. Pages are copied as-is; nothing is re-rendered or re-compressed, so the result is identical in quality to the source files.',
    },
  ],
  relatedSlugs: ['split-pdf', 'rotate-pdf', 'pdf-to-csv'],
};

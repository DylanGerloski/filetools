'use strict';

module.exports = {
  slug: 'rotate-pdf',
  category: 'pdf',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-13',
  navLabel: 'Rotate PDF',
  h1: 'Rotate a PDF',
  title: 'Rotate PDF Pages Free - In Your Browser | filetools',
  metaDescription: 'Rotate all or individual pages in a PDF, free, with no upload and no sign-up. Your files never leave your device.',
  deck: 'Rotate every page, or just the ones that need it. Nothing is uploaded.',
  clientEntry: 'pdfPages',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'pdf',
  mark: { verb: 'rotate', ink: 'pdf' },
  maxBytes: 200 * 1024 * 1024,
  mode: 'rotate',
  accepts: 'application/pdf',
  multiple: false,
  howSteps: [
    'Choose or drop one PDF file.',
    'Rotate individual pages left or right, or use “Rotate all” to turn every page at once.',
    'Select “Save rotated PDF” and the file downloads to your device.',
  ],
  faqs: [
    {
      q: 'Can I rotate just one page instead of the whole document?',
      answerHtml: 'Yes. Each page has its own rotate-left/rotate-right buttons, so you can fix a single sideways page without touching the rest.',
    },
    {
      q: 'Is the rotation permanent, or just a display setting?',
      answerHtml: 'It’s written into the downloaded file itself, so it opens right-side-up in any PDF viewer - not just in this browser tab.',
    },
    {
      q: 'Do you upload my file anywhere?',
      answerHtml: 'No. The rotation happens entirely on your device. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Does rotating reduce quality?',
      answerHtml: 'No. Only the page orientation metadata changes - nothing is re-rendered or re-compressed.',
    },
    {
      q: 'What if my PDF is password-protected?',
      answerHtml: 'A password-protected file can’t be read in the browser without its password. Remove the password first, then rotate.',
    },
  ],
  relatedSlugs: ['merge-pdf', 'split-pdf', 'pdf-to-csv'],
};

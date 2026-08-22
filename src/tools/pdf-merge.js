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
  title: 'Merge PDF Files Free - In Your Browser | filetools',
  metaDescription: 'Combine multiple PDFs into one file, free, with no upload and no sign-up. Reorder pages before merging. Your files never leave your device.',
  deck: 'Combine two or more PDFs into a single file. Drag to reorder before merging. Nothing is uploaded.',
  clientEntry: 'pdfPages',
  // Registration fragment (2026-08-22 fragment-pattern refactor): this
  // tool's own row in what used to be four hand-maintained shared maps
  // (src/families.js's FAMILY_BY_SLUG, src/icons.js's MARKS,
  // src/pages/toolPage.js + src/browser/dropzone.client.js's
  // MAX_BYTES_BY_CLIENT/PASTE_FILE). src/families.js/icons.js/
  // browserClients.js now assemble those structures FROM the TOOLS
  // registry (src/tools/index.js already auto-discovers this file) --
  // see those three files' own header comments for the assembly step and
  // src/browser/dropzone.client.js's comment for why the browser-facing
  // maps are generated at build time instead. A new tool adds its own
  // src/tools/<slug>.js with these same fields; no existing tool's file
  // changes, so two tool branches can never conflict here.
  //   family: this tool's presentational family (families.js's
  //     familyOf() rule: input format's family, else output's).
  //   mark: { verb, ink?, motif? } -- icons.js's per-slug MARKS row,
  //     minus `plate` (always === family, see icons.js). `ink` defaults
  //     to `family` when omitted (a same-family tool like this one).
  //   maxBytes: this tool's clientEntry's per-file size cap. Every other
  //     tool sharing this same clientEntry (pdf-split.js, pdf-rotate.js)
  //     must declare the identical value -- browserClients.js asserts
  //     that at build time so a mismatch fails loudly, not silently.
  //   pasteFile: only present on a tool with `pasteInput` below --
  //     name/type of the synthetic File a pasted submission is wrapped
  //     in before it reaches this clientEntry's processor.
  family: 'pdf',
  mark: { verb: 'merge', ink: 'pdf' },
  maxBytes: 200 * 1024 * 1024,
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

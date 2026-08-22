'use strict';

module.exports = {
  slug: 'url-encode-decode',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-22',
  navLabel: 'URL Encode / Decode',
  h1: 'URL Encode and Decode',
  title: 'URL Encode and Decode Online - In Your Browser | filetools',
  metaDescription: 'Paste text or a URL and get both the percent-encoded and decoded versions instantly, free and in your browser. No upload, no sign-up.',
  deck: 'Paste any text, query string, or URL and see the percent-encoded and decoded versions side by side, updated instantly. Nothing is sent anywhere.',
  clientEntry: 'urlEncode',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'text',
  mark: { verb: 'convert' },
  maxBytes: 20 * 1024 * 1024,
  pasteFile: { name: 'pasted-input.txt', type: 'text/plain' },
  mode: 'url-encode-decode',
  fileTypeLabel: 'text file',
  accepts: '.txt,text/plain',
  multiple: false,
  pasteInput: {
    label: 'Or paste text or a URL',
    placeholder: 'search?q=café & code',
    buttonLabel: 'Encode and decode',
  },
  howSteps: [
    'Drop or choose a .txt file, or paste text, a query string, or a URL directly into the text box.',
    'Both the percent-encoded and decoded versions render immediately - whichever direction you needed is already there.',
    'Copy or download whichever result you need. Turn on “spaces as +” if you need form-style encoding instead of %20.',
  ],
  faqs: [
    {
      q: 'Is my text sent anywhere?',
      answerHtml: 'No. Pasted text and uploaded files are both read and converted entirely on your device, and nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Does this encode a whole URL, or just a piece of text?',
      answerHtml: 'Just a piece of text - a query parameter value, a search term, or any string you want to safely embed inside a URL. If you paste in a whole URL (like <code>https://example.com/search?q=an example</code>), the <code>:</code> and <code>/</code> characters get encoded too, because this tool treats everything you give it as one value, not as a structured URL with parts that should stay as-is. If you only need to encode the value of one query parameter, paste just that part rather than the entire URL.',
    },
    {
      q: 'Why does the decoded panel sometimes show an error?',
      answerHtml: 'Not every piece of text is valid percent-encoding - if what you pasted was already plain text (not something that had been encoded), decoding it back can hit a stray <code>%</code> with no valid hex digits after it, or a percent sequence that doesn’t form a real character. That’s expected: the encoded panel above it still shows a correct result either way.',
    },
    {
      q: 'What’s the difference between %20 and + for a space?',
      answerHtml: '<code>%20</code> is the standard percent-encoding for a space (RFC 3986). A literal <code>+</code> is an older convention from HTML form submissions (<code>application/x-www-form-urlencoded</code>) that many query strings still use. Turn on “spaces as +” if the system you’re working with expects that style instead.',
    },
    {
      q: 'Which characters actually get encoded?',
      answerHtml: 'Everything except letters, digits, and <code>- _ . ! ~ * \' ( )</code> gets percent-encoded - the same unreserved-character set the browser’s own <code>encodeURIComponent</code> uses, so the result matches what JavaScript, and most other languages’ standard libraries, would produce.',
    },
    {
      q: 'Does this handle accented letters and emoji?',
      answerHtml: 'Yes. Text is encoded as UTF-8 bytes first, then each byte is percent-encoded, so <code>café</code> becomes <code>caf%C3%A9</code> and decodes back to exactly the same text, multi-byte characters included.',
    },
  ],
  relatedSlugs: ['remove-duplicate-lines', 'sort-lines'],
};

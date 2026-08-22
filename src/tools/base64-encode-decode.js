'use strict';

module.exports = {
  slug: 'base64-encode-decode',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-22',
  navLabel: 'Base64 Encode/Decode',
  h1: 'Base64 Encode and Decode',
  title: 'Base64 Encode and Decode - In Your Browser | filetools',
  metaDescription: 'Paste text or Base64, or drop a file, and encode or decode it, free and in your browser. No upload, no sign-up.',
  deck: 'Paste text or Base64, or drop a file, and switch between encode and decode instantly. Nothing is sent anywhere.',
  clientEntry: 'base64',
  mode: 'base64',
  fileTypeLabel: 'file',
  accepts: '',
  multiple: false,
  pasteInput: {
    label: 'Or paste text or Base64',
    placeholder: 'Paste plain text to encode, or a Base64 string to decode',
    buttonLabel: 'Convert',
  },
  howSteps: [
    'Paste text or a Base64 string into the box, or drop a file of any type.',
    'Choose Encode or Decode - the result updates immediately, no need to re-paste.',
    'Copy the result, or download it as a file if it turns out to be binary data rather than text.',
  ],
  faqs: [
    {
      q: 'Is my text or file sent anywhere?',
      answerHtml: 'No. Pasted text and dropped files are both read and converted entirely on your device, and nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What is Base64, in plain terms?',
      answerHtml: 'A way of representing arbitrary bytes (any file, or text with characters outside plain ASCII) using only 64 printable characters - letters, digits, <code>+</code>, and <code>/</code>. It is not encryption and does not hide or protect data; anyone can decode it back to the original with a tool like this one.',
    },
    {
      q: 'Can I encode or decode a whole file, not just text?',
      answerHtml: 'Yes. Drop any file to encode - a common use is turning a small image into a Base64 string to embed directly in CSS or HTML. In decode mode, drop a text file that contains Base64 and download the decoded result as a binary file.',
    },
    {
      q: 'What does "URL-safe" mean, and when do I need it?',
      answerHtml: 'Standard Base64 uses <code>+</code> and <code>/</code>, both of which have special meaning inside a URL. URL-safe Base64 (RFC 4648 section 5) swaps those two characters for <code>-</code> and <code>_</code> instead, so the result can be dropped straight into a URL or filename. Turn the toggle on if the Base64 you are working with came from a URL, a JWT, or an API that documents itself as URL-safe.',
    },
    {
      q: 'What happens if I paste Base64 that decodes to a file, not text?',
      answerHtml: 'The result is checked to see whether it is valid UTF-8 text. If it is not (almost always genuine binary data, such as an image or a PDF), you get a plain message saying so and a download button for the decoded file, rather than a garbled attempt to display it as text.',
    },
    {
      q: 'What happens if I paste something that is not valid Base64?',
      answerHtml: 'You get a plain-English message naming the specific problem - a character outside the Base64 alphabet, padding in the wrong place, or a length that is not possible for Base64 - instead of a silent wrong result. Whitespace and line breaks in the pasted text are ignored rather than treated as errors, since that is how Base64 is often shared.',
    },
  ],
  relatedSlugs: ['remove-duplicate-lines', 'sort-lines'],
};

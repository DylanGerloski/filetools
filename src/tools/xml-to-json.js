'use strict';

module.exports = {
  slug: 'xml-to-json',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-22',
  navLabel: 'XML to JSON',
  h1: 'Convert XML to JSON',
  title: 'Convert XML to JSON - In Your Browser | filetools',
  metaDescription: 'Paste an XML document or drop a .xml file and get JSON back, free and in your browser. No upload, no sign-up.',
  deck: 'Paste XML, or drop a .xml file, and download it as pretty-printed JSON. Nothing is sent anywhere.',
  clientEntry: 'xmlToJson',
  mode: 'xml-to-json',
  fileTypeLabel: 'XML file',
  accepts: '.xml,application/xml,text/xml,text/plain',
  multiple: false,
  pasteInput: {
    label: 'Or paste XML',
    placeholder: '<order id="1">\n  <item>Coffee</item>\n  <price>4.50</price>\n</order>',
    buttonLabel: 'Convert pasted XML',
  },
  howSteps: [
    'Drop or choose a .xml file, or paste XML directly into the text box.',
    'Review the pretty-printed JSON preview.',
    'Download the result as a .json file.',
  ],
  faqs: [
    {
      q: 'Is my XML sent anywhere?',
      answerHtml: 'No. Pasted XML and uploaded files are both read and converted entirely on your device, using your browser’s own XML parser - nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'How are attributes and text represented in the JSON?',
      answerHtml: 'Each attribute becomes a key prefixed with <code>@</code> - <code>&lt;item id="5"&gt;</code> becomes <code>"@id": "5"</code>. An element’s own text (outside its child elements) becomes a <code>#text</code> key when that element also has attributes or child elements; an element with only text becomes a plain JSON string. The document’s root element becomes the single top-level key of the result.',
    },
    {
      q: 'What happens to repeated elements?',
      answerHtml: 'Sibling elements sharing the same tag name become a JSON array, in the order they appear - <code>&lt;items&gt;&lt;item&gt;A&lt;/item&gt;&lt;item&gt;B&lt;/item&gt;&lt;/items&gt;</code> becomes <code>{"item": ["A", "B"]}</code>. A tag that appears only once stays a single value, not a one-item array.',
    },
    {
      q: 'Are numbers and true/false converted to their own JSON types?',
      answerHtml: 'No, on purpose. XML has no type system of its own, so every value - element text and attribute values alike - stays a JSON string. Guessing types silently changes data a visitor didn’t ask to change: a ZIP code like <code>00501</code> auto-converted to the number <code>501</code> loses its leading zero. This tool never does that.',
    },
    {
      q: 'What if my XML has a <!DOCTYPE> declaration?',
      answerHtml: 'It’s refused with a clear message rather than parsed. A <!DOCTYPE> can define custom entities, and resolving those safely and identically across every browser isn’t something this tool can guarantee - refusing the whole document up front closes off that risk rather than relying on it never coming up. Remove the <!DOCTYPE ...> line (most real-world XML - API responses, config files, RSS - doesn’t have one) and try again.',
    },
    {
      q: 'What if my XML has a syntax error?',
      answerHtml: 'You’ll get a plain-English error naming the problem instead of a converted file, or a silent blank result. Fix the tags at that spot and try again.',
    },
  ],
  relatedSlugs: ['yaml-to-json', 'json-to-csv', 'xlsx-to-json'],
};

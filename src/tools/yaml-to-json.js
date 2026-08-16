'use strict';

module.exports = {
  slug: 'yaml-to-json',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-15',
  navLabel: 'YAML to JSON',
  h1: 'Convert YAML to JSON',
  title: 'Convert YAML to JSON - In Your Browser | filetools',
  metaDescription: 'Paste a YAML document or drop a .yaml/.yml file and get JSON back, free and in your browser. No upload, no sign-up.',
  deck: 'Paste YAML, or drop a .yaml/.yml file, and download it as pretty-printed JSON. Nothing is sent anywhere.',
  clientEntry: 'yamlToJson',
  mode: 'yaml-to-json',
  fileTypeLabel: 'YAML file',
  accepts: '.yaml,.yml,application/yaml,text/yaml,text/plain',
  multiple: false,
  pasteInput: {
    label: 'Or paste YAML',
    placeholder: 'name: Coffee\nprice: 4.50\ntags:\n  - hot\n  - drink',
    buttonLabel: 'Convert pasted YAML',
  },
  howSteps: [
    'Drop or choose a .yaml/.yml file, or paste YAML directly into the text box.',
    'Review the pretty-printed JSON preview.',
    'Download the result as a .json file.',
  ],
  faqs: [
    {
      q: 'Is my YAML sent anywhere?',
      answerHtml: 'No. Pasted YAML and uploaded files are both read and converted entirely on your device, and nothing is sent to a server. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What YAML features are supported?',
      answerHtml: 'Standard YAML 1.1/1.2 scalars, mappings, sequences, comments, multi-line strings, anchors/aliases, and timestamps (converted to ISO 8601 date strings, the same choice this site’s Excel-to-JSON tool makes for a date cell). Custom application-specific tags aren’t evaluated as code - only plain data comes out, never executable content.',
    },
    {
      q: 'What if my YAML file has more than one document (separated by ---)?',
      answerHtml: 'Each document is converted, then combined into a single JSON array in the order they appear. A file with just one document (the common case) converts straight to that document’s own JSON value at the top level, not wrapped in an array.',
    },
    {
      q: 'What happens to YAML’s special numbers like .inf or .nan?',
      answerHtml: 'JSON itself has no way to represent infinity or “not a number” - most converters silently turn these into <code>null</code>, quietly losing the original value. This tool writes them out as the visible JSON strings <code>"Infinity"</code>, <code>"-Infinity"</code>, and <code>"NaN"</code> instead, so nothing disappears without a trace.',
    },
    {
      q: 'What if my YAML has a syntax error?',
      answerHtml: 'You’ll get a plain-English error naming the problem and its line and column instead of a converted file. Fix the indentation or syntax at that spot and try again.',
    },
  ],
  relatedSlugs: ['json-to-csv', 'flatten-json', 'xlsx-to-json'],
};

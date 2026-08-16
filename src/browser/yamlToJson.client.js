// YAML-to-JSON processor. Dynamically imported by ./dropzone.client.js
// (routed by #tool's data-client="yamlToJson") on first file selection/
// paste-convert click, or warmed on pointerenter/focus -- same lazy-load
// reasoning as ./sortLines.client.js. This tool has two input paths that
// both land here as the same File shape: a .yaml/.yml file chosen/dropped
// through the normal drop zone, or YAML text typed into the "paste YAML"
// text box (dropzone.client.js wraps the pasted text in a synthetic File
// before calling this module's run(), so this file never needs to know
// which path a given File came from).
//
// js-yaml (MIT, self-hosted from this same origin -- vendor/, copied from
// node_modules at build time by scripts/copy-vendor.js, never a CDN, same
// "turn off your Wi-Fi" constraint ../browser/pdfPages.client.js's header
// explains) does the actual YAML parsing. Its dist/js-yaml.mjs is a real,
// self-contained ES module with named exports and zero further imports of
// its own, so it loads with plain import() -- same mechanism as
// pdf-lib/pdf.js, unlike ExcelJS's UMD bundle (../browser/xlsxToJson.
// client.js has to load that one as a classic <script> tag instead).
//
// Hot-dependency note: a library that parses untrusted structured text
// gets extra scrutiny here (security-standards.md) -- js-yaml is pinned to
// an exact version in package.json (no ^/~; 4.3.1, the first published
// version with the merge-key/omap quadratic-complexity advisories fixed),
// npm audit is clean, and js-yaml 4.x's load()/loadAll() (unlike its own
// long-removed unsafe 3.x load()) resolve only YAML's DEFAULT_SCHEMA --
// standard scalars, mappings, sequences, dates -- with no `!!js/function`,
// `!!js/regexp`, or other code-construction tag support at all (that
// requires separately installing the `js-yaml-js-types` package, which
// this project does not depend on), so there is no dynamic-code path to
// disable here the way pdf.js's isEvalSupported has to be turned off.
//
// The parse/shape logic (combining multiple `---`-separated documents,
// making NaN/Infinity JSON-safe, turning a caught error into a plain-
// English message) is pure and lives in ../pure/yamlToJson.mjs so it stays
// unit-testable without a DOM; this file's job is only to (a) read the
// File's text, (b) call js-yaml's loadAll(), (c) render the read-only JSON
// preview, and (d) build/download the .json file.

const yamlModulePromise = import('../vendor/js-yaml/js-yaml.mjs');

const PREVIEW_CHAR_LIMIT = 200000;

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function jsonBlob(jsonText) {
  return new Blob([jsonText], { type: 'application/json;charset=utf-8' });
}

/**
 * Renders the stats badge, the read-only JSON preview, and the download
 * button. Called once per run() -- like ../browser/jsonToCsv.client.js this
 * tool has no per-visitor option toggles.
 *
 * @param {HTMLElement} resultEl
 * @param {string} jsonText the full, pretty-printed JSON text (already
 *   built from a JSON-safe value -- see ../pure/yamlToJson.mjs's
 *   jsonSafeValue).
 * @param {boolean} multiDoc whether the source YAML held more than one
 *   `---`-separated document.
 */
function renderResult(resultEl, jsonText, multiDoc) {
  resultEl.innerHTML = '';

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';
  const badge = document.createElement('span');
  badge.className = 'page-badge';
  const lineCount = jsonText.split('\n').length;
  badge.textContent = multiDoc
    ? `Multiple YAML documents — combined into one JSON array, ${lineCount} line${lineCount === 1 ? '' : 's'}`
    : `${lineCount} line${lineCount === 1 ? '' : 's'} of JSON`;
  head.appendChild(badge);
  block.appendChild(head);

  const pre = document.createElement('pre');
  pre.className = 'json-preview';
  const truncated = jsonText.length > PREVIEW_CHAR_LIMIT;
  pre.textContent = truncated ? `${jsonText.slice(0, PREVIEW_CHAR_LIMIT)}\n…` : jsonText;
  block.appendChild(pre);

  if (truncated) {
    const previewNote = document.createElement('p');
    previewNote.className = 'caption';
    previewNote.textContent = 'Showing the first part of the result. The download includes all of it.';
    block.appendChild(previewNote);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  downloadBtn.textContent = 'Download converted.json';
  downloadBtn.addEventListener('click', () => {
    downloadBlob(jsonBlob(jsonText), 'converted.json');
  });
  btnRow.appendChild(downloadBtn);
  block.appendChild(btnRow);

  const supportNote = document.createElement('p');
  supportNote.className = 'support-note';
  supportNote.innerHTML = 'That ran entirely on your machine — no servers, no cost to run. If it saved you time, you can buy me a coffee: '
    + '<a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>'
    + ' &middot; '
    + '<a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>.';
  block.appendChild(supportNote);

  resultEl.appendChild(block);
  resultEl.hidden = false;
}

/**
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  const file = files[0];
  setState('working');
  setStatus('Reading that file on this device…');

  const [yaml, { combineDocuments, jsonSafeValue, formatYamlError }] = await Promise.all([
    yamlModulePromise,
    import('../pure/yamlToJson.mjs'),
  ]);

  const text = await file.text();

  resultEl.innerHTML = '';

  if (!text.trim()) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That’s empty — paste or drop some YAML first.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('error');
    setStatus('That’s empty — paste or drop some YAML first.', 'error');
    return;
  }

  let docs;
  try {
    docs = yaml.loadAll(text);
  } catch (err) {
    const friendly = formatYamlError(err);
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = friendly;
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('error');
    setStatus(friendly, 'error');
    return;
  }

  const combined = combineDocuments(docs);
  if (!combined.ok) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = combined.error;
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('error');
    setStatus(combined.error, 'error');
    return;
  }

  const jsonText = JSON.stringify(jsonSafeValue(combined.value), null, 2);
  renderResult(resultEl, jsonText, combined.multiDoc);

  setState('done');
  setStatus(
    combined.multiDoc
      ? `Converted ${docs.length} YAML documents into one JSON array. Review below, then download.`
      : 'Converted. Review below, then download.',
    'success'
  );
}

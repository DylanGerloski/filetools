// Split-a-CSV-by-row-count processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="splitCsv") on first
// file selection or paste, or warmed on pointerenter/focus -- same
// lazy-load reasoning as ../browser/sortLines.client.js.
//
// The actual parsing and chunking logic is pure and lives in
// ../pure/splitCsv.mjs so it stays unit-testable without a DOM; this file's
// job is only to (a) read the File's text, (b) render the option controls,
// per-chunk summary list, and download button, and (c) re-run the pure
// logic in place whenever a visitor changes an option. Output CSV
// serialization (including formula-injection neutralization) reuses
// ../pure/csv.mjs's rowsToCsv, same as every other CSV-producing tool on
// this site. Zip packaging uses fflate, vendored into this site's own
// origin (see scripts/copy-vendor.js) -- never a CDN -- and only imported
// when the visitor actually clicks download, so it costs nothing on page
// load. fflate's synchronous zipSync is used deliberately: its async API
// spins up Workers from generated code, a dynamic-code path this site
// doesn't need for inputs already bounded by the per-file size cap.

const CHUNK_LIST_LIMIT = 50;
const DEFAULT_ROWS_PER_FILE = 1000;
const MAX_ROWS_PER_FILE = 1000000;

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

/**
 * Builds the per-chunk summary list (generated filename + how many data
 * rows landed in it) -- a plain DOM list, same shape as ../css.js's
 * .file-list/.file-row, built with createElement/textContent throughout
 * rather than innerHTML: the chunk names derive from a visitor-supplied
 * file name, so they're untrusted input even after sanitization.
 *
 * @param {Array<{name:string,dataRowCount:number}>} files
 * @param {boolean} hasHeader
 */
function renderChunkList(files, hasHeader) {
  const list = document.createElement('ul');
  list.className = 'file-list';
  files.slice(0, CHUNK_LIST_LIMIT).forEach((f) => {
    const li = document.createElement('li');
    li.className = 'file-row';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = f.name;
    li.appendChild(nameSpan);

    const metaSpan = document.createElement('span');
    metaSpan.className = 'file-meta';
    metaSpan.textContent = `${f.dataRowCount} row${f.dataRowCount === 1 ? '' : 's'}${hasHeader ? ' + header' : ''}`;
    li.appendChild(metaSpan);

    list.appendChild(li);
  });
  return list;
}

/**
 * Renders the options row, chunk summary, and download button. Re-invoked
 * in place whenever a visitor changes an option -- same pattern as
 * ../browser/sortLines.client.js's renderResult.
 *
 * @param {HTMLElement} resultEl
 * @param {{name:string, text:string}} fileInput
 * @param {object} optionState { rowsPerFile, hasHeader }
 * @param {Function} splitCsv from ../pure/splitCsv.mjs.
 * @param {Function} rowsToCsv from ../pure/csv.mjs.
 * @param {Function} setStatus dropzone status line updater.
 */
function renderResult(resultEl, fileInput, optionState, splitCsv, rowsToCsv, setStatus) {
  resultEl.innerHTML = '';

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const badge = document.createElement('span');
  badge.className = 'page-badge';
  head.appendChild(badge);

  const rowsLabel = document.createElement('label');
  const rowsInput = document.createElement('input');
  rowsInput.type = 'number';
  rowsInput.min = '1';
  rowsInput.max = String(MAX_ROWS_PER_FILE);
  rowsInput.step = '1';
  rowsInput.value = String(optionState.rowsPerFile);
  rowsInput.setAttribute('aria-label', 'Rows per file');
  rowsInput.addEventListener('change', () => {
    let next = Math.floor(Number(rowsInput.value));
    if (!Number.isFinite(next) || next < 1) next = 1;
    if (next > MAX_ROWS_PER_FILE) next = MAX_ROWS_PER_FILE;
    optionState.rowsPerFile = next;
    renderResult(resultEl, fileInput, optionState, splitCsv, rowsToCsv, setStatus);
  });
  rowsLabel.appendChild(document.createTextNode('Rows per file '));
  rowsLabel.appendChild(rowsInput);
  head.appendChild(rowsLabel);

  const headerLabel = document.createElement('label');
  const headerToggle = document.createElement('input');
  headerToggle.type = 'checkbox';
  headerToggle.checked = optionState.hasHeader;
  headerToggle.addEventListener('change', () => {
    optionState.hasHeader = headerToggle.checked;
    renderResult(resultEl, fileInput, optionState, splitCsv, rowsToCsv, setStatus);
  });
  headerLabel.appendChild(headerToggle);
  headerLabel.appendChild(document.createTextNode(' First row is a header (repeat it in every file)'));
  head.appendChild(headerLabel);

  block.appendChild(head);

  let outcome = null;
  try {
    outcome = splitCsv(fileInput.text, {
      rowsPerFile: optionState.rowsPerFile,
      hasHeader: optionState.hasHeader,
      baseName: fileInput.name,
    });
  } catch (err) {
    // The pure module throws a RangeError with a visitor-ready message when
    // a split would produce more files than the tool's ceiling.
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = err && err.message ? err.message : 'That split isn’t possible with these settings.';
    block.appendChild(msg);
  }

  if (outcome && outcome.files.length) {
    badge.textContent = `${outcome.totalDataRows} data row${outcome.totalDataRows === 1 ? '' : 's'} → ${outcome.files.length} file${outcome.files.length === 1 ? '' : 's'} of up to ${optionState.rowsPerFile} row${optionState.rowsPerFile === 1 ? '' : 's'}`;
    block.appendChild(renderChunkList(outcome.files, Boolean(outcome.header)));
    if (outcome.files.length > CHUNK_LIST_LIMIT) {
      const moreNote = document.createElement('p');
      moreNote.className = 'caption';
      moreNote.textContent = `Showing the first ${CHUNK_LIST_LIMIT} of ${outcome.files.length} files. The download includes all of them.`;
      block.appendChild(moreNote);
    }
  } else if (outcome) {
    badge.textContent = '0 data rows';
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = outcome.header
      ? 'There’s nothing to split - this file only has a header row.'
      : 'There’s nothing to split - this file is empty.';
    block.appendChild(msg);
  } else {
    badge.textContent = 'Too many files';
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  const zipName = outcome ? `${outcome.baseName}-split.zip` : 'split.zip';
  downloadBtn.textContent = `Download ${zipName}`;
  downloadBtn.disabled = !outcome || outcome.files.length === 0;
  downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    setStatus(`Building ${zipName} on this device…`);
    try {
      const { zipSync } = await import('../vendor/fflate/browser.js');
      const encoder = new TextEncoder();
      const entries = {};
      outcome.files.forEach((f) => {
        // UTF-8 BOM per entry so Excel opens accented text in the right
        // encoding -- same convention as every direct-CSV download on this
        // site (the BOM must be the first bytes of each file, so it's added
        // here, not in rowsToCsv).
        entries[f.name] = encoder.encode('﻿' + rowsToCsv(f.rows));
      });
      downloadBlob(new Blob([zipSync(entries, { level: 6 })], { type: 'application/zip' }), zipName);
      setStatus(`Saved ${zipName} - ${outcome.files.length} file${outcome.files.length === 1 ? '' : 's'} inside.`, 'success');
    } catch (err) {
      setStatus(err && err.message ? err.message : 'Something went wrong building the zip.', 'error');
    } finally {
      downloadBtn.disabled = false;
    }
  });
  btnRow.appendChild(downloadBtn);
  block.appendChild(btnRow);

  const supportNote = document.createElement('p');
  supportNote.className = 'support-note';
  supportNote.innerHTML = 'That ran entirely on your machine - no servers, no cost to run. If it saved you time, you can buy me a coffee: '
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
  setState('working');
  setStatus('Reading your file on this device…');

  const [{ splitCsv }, { rowsToCsv }] = await Promise.all([
    import('../pure/splitCsv.mjs'),
    import('../pure/csv.mjs'),
  ]);

  const file = files[0];
  const text = await file.text();
  const fileInput = { name: file.name, text };

  const optionState = { rowsPerFile: DEFAULT_ROWS_PER_FILE, hasHeader: true };
  renderResult(resultEl, fileInput, optionState, splitCsv, rowsToCsv, setStatus);

  setState('done');
  setStatus('Split preview ready - adjust rows per file below, then download the zip.', 'success');
}

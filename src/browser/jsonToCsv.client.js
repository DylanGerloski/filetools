// JSON-to-CSV processor. Dynamically imported by ./dropzone.client.js
// (routed by #tool's data-client="jsonToCsv") on first file selection/
// paste-convert click, or warmed on pointerenter/focus -- same lazy-load
// reasoning as ./sortLines.client.js. This tool has two input paths that
// both land here as the same File shape: a .json file chosen/dropped
// through the normal drop zone, or JSON text typed into the "paste JSON"
// text box (dropzone.client.js wraps the pasted text in a synthetic File
// before calling this module's run(), so this file never needs to know
// which path a given File came from).
//
// The parse/flatten/column logic is pure and lives in ../pure/jsonToCsv.mjs
// so it stays unit-testable without a DOM; this file's job is only to
// (a) read the File's text, (b) render the read-only preview table, and
// (c) build/download the CSV via ../pure/csv.mjs's rowsToCsv (the same
// formula-injection-neutralizing serializer every other CSV-producing tool
// on this site uses).
//
// JSON.parse never executes code (unlike eval), so parsing untrusted JSON
// text here carries none of the script-injection risk the HTML-table tool
// has to defend against -- see ../pure/jsonToCsv.mjs's header comment for
// the (documented, not silent) flattening rules applied to the parsed
// result.

const PREVIEW_LIMIT = 500;

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

/** UTF-8 BOM prefix so Excel opens accented/CSV text in the right encoding. */
function csvBlob(csvText) {
  return new Blob(['﻿', csvText], { type: 'text/csv;charset=utf-8' });
}

/**
 * Renders the stats badge, the read-only preview table, and the download
 * button. Called once per run() -- unlike sortLines/dedupeLines this tool
 * has no per-visitor option toggles, since the flattening rules are fixed
 * and documented on the page rather than configurable.
 *
 * @param {HTMLElement} resultEl
 * @param {string[]} columns
 * @param {string[][]} dataRows
 * @param {Function} rowsToCsv from ../pure/csv.mjs.
 */
function renderResult(resultEl, columns, dataRows, rowsToCsv) {
  resultEl.innerHTML = '';

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';
  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = `${dataRows.length} row${dataRows.length === 1 ? '' : 's'} — ${columns.length} column${columns.length === 1 ? '' : 's'}`;
  head.appendChild(badge);
  block.appendChild(head);

  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'table-scroll';
  const tableEl = document.createElement('table');
  tableEl.className = 'extracted-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  columns.forEach((col) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = col;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  tableEl.appendChild(thead);

  const tbody = document.createElement('tbody');
  dataRows.slice(0, PREVIEW_LIMIT).forEach((row) => {
    const tr = document.createElement('tr');
    row.forEach((cell) => {
      const td = document.createElement('td');
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tableEl.appendChild(tbody);
  scrollWrap.appendChild(tableEl);
  block.appendChild(scrollWrap);

  if (dataRows.length > PREVIEW_LIMIT) {
    const previewNote = document.createElement('p');
    previewNote.className = 'caption';
    previewNote.textContent = `Showing the first ${PREVIEW_LIMIT} of ${dataRows.length} rows. The download includes all of them.`;
    block.appendChild(previewNote);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  downloadBtn.textContent = 'Download converted.csv';
  downloadBtn.addEventListener('click', () => {
    const csvText = rowsToCsv([columns, ...dataRows]);
    downloadBlob(csvBlob(csvText), 'converted.csv');
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

  const [{ parseJsonArray, jsonToCsvRows }, { rowsToCsv }] = await Promise.all([
    import('../pure/jsonToCsv.mjs'),
    import('../pure/csv.mjs'),
  ]);

  const text = await file.text();
  const parsed = parseJsonArray(text);

  resultEl.innerHTML = '';

  if (!parsed.ok) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = parsed.error;
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('error');
    setStatus(parsed.error, 'error');
    return;
  }

  const { columns, dataRows } = jsonToCsvRows(parsed.records);
  renderResult(resultEl, columns, dataRows, rowsToCsv);

  setState('done');
  setStatus(`Converted ${dataRows.length} record${dataRows.length === 1 ? '' : 's'} into ${columns.length} column${columns.length === 1 ? '' : 's'}. Review below, then download.`, 'success');
}

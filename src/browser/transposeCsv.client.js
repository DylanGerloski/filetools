// Transpose-CSV processor. Dynamically imported by ./dropzone.client.js
// (routed by #tool's data-client="transposeCsv") on first file selection/
// paste-convert click, or warmed on pointerenter/focus -- same lazy-load
// reasoning as ./csvMerge.client.js. This tool has two input paths that
// both land here as the same File shape: a .csv/.txt file chosen/dropped
// through the normal drop zone, or CSV text typed into the "paste CSV
// text" text box (dropzone.client.js wraps the pasted text in a synthetic
// File before calling this module's run(), so this file never needs to
// know which path a given File came from).
//
// The transpose itself -- CSV parsing and the row/column flip -- is pure
// logic that lives in ../pure/transposeCsv.mjs so it stays unit-testable
// without a DOM; this file's job is only to (a) read the File's text,
// (b) render the "skip blank rows" toggle and the preview, and (c) re-run
// the pure logic in place whenever a visitor changes that option. Output
// CSV serialization (including formula-injection neutralization) reuses
// ../pure/csv.mjs's rowsToCsv, same as every other CSV-producing tool on
// this site.

const PREVIEW_LIMIT = 500;
const PREVIEW_COL_LIMIT = 50;

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
 * Renders the option toggle, stats badge, preview table, and download
 * button. Re-invoked in place whenever a visitor changes the option --
 * same pattern as ../browser/csvMerge.client.js's renderResult.
 *
 * @param {HTMLElement} resultEl
 * @param {string} text raw file/paste text.
 * @param {object} optionState { skipBlankRows }.
 * @param {Function} transposeCsv from ../pure/transposeCsv.mjs.
 * @param {Function} rowsToCsv from ../pure/csv.mjs.
 */
function renderResult(resultEl, text, optionState, transposeCsv, rowsToCsv) {
  resultEl.innerHTML = '';

  const outcome = transposeCsv(text, optionState);
  const { transposed } = outcome;
  const outputColumnCount = transposed.length;
  const outputRowCount = outcome.inputRowCount;

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = transposed.length
    ? `${outcome.inputRowCount} row${outcome.inputRowCount === 1 ? '' : 's'} × ${outputColumnCount} column${outputColumnCount === 1 ? '' : 's'} → ${outputColumnCount} row${outputColumnCount === 1 ? '' : 's'} × ${outputRowCount} column${outputRowCount === 1 ? '' : 's'}`
    : '0 rows';
  head.appendChild(badge);

  const skipLabel = document.createElement('label');
  const skipCheckbox = document.createElement('input');
  skipCheckbox.type = 'checkbox';
  skipCheckbox.checked = optionState.skipBlankRows;
  skipCheckbox.addEventListener('change', () => {
    optionState.skipBlankRows = skipCheckbox.checked;
    renderResult(resultEl, text, optionState, transposeCsv, rowsToCsv);
  });
  skipLabel.appendChild(skipCheckbox);
  skipLabel.appendChild(document.createTextNode(' Skip blank rows'));
  head.appendChild(skipLabel);

  block.appendChild(head);

  if (transposed.length) {
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'table-scroll';
    const tableEl = document.createElement('table');
    tableEl.className = 'extracted-table';

    const tbody = document.createElement('tbody');
    transposed.slice(0, PREVIEW_LIMIT).forEach((row) => {
      const tr = document.createElement('tr');
      row.slice(0, PREVIEW_COL_LIMIT).forEach((cell) => {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      });
      if (row.length > PREVIEW_COL_LIMIT) {
        const td = document.createElement('td');
        td.className = 'caption';
        td.textContent = `+${row.length - PREVIEW_COL_LIMIT} more`;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    tableEl.appendChild(tbody);
    scrollWrap.appendChild(tableEl);
    block.appendChild(scrollWrap);

    if (transposed.length > PREVIEW_LIMIT) {
      const previewNote = document.createElement('p');
      previewNote.className = 'caption';
      previewNote.textContent = `Showing the first ${PREVIEW_LIMIT} of ${transposed.length} output rows. The download includes all of them.`;
      block.appendChild(previewNote);
    }
  } else {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'There’s nothing to transpose - that file or pasted text is empty.';
    block.appendChild(msg);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  downloadBtn.textContent = 'Download transposed.csv';
  downloadBtn.disabled = transposed.length === 0;
  downloadBtn.addEventListener('click', () => {
    downloadBlob(csvBlob(rowsToCsv(transposed)), 'transposed.csv');
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
  const file = files[0];
  setState('working');
  setStatus('Reading that file on this device…');

  const [{ transposeCsv }, { rowsToCsv }] = await Promise.all([
    import('../pure/transposeCsv.mjs'),
    import('../pure/csv.mjs'),
  ]);

  const text = await file.text();
  const optionState = { skipBlankRows: true };
  renderResult(resultEl, text, optionState, transposeCsv, rowsToCsv);

  const outcome = transposeCsv(text, optionState);
  setState('done');
  if (outcome.transposed.length) {
    setStatus(`Transposed ${outcome.inputRowCount} row${outcome.inputRowCount === 1 ? '' : 's'}. Review below, then download.`, 'success');
  } else {
    setStatus('Finished reading - no rows found.', 'error');
  }
}

// Sort-by-column processor. Dynamically imported by ./dropzone.client.js
// (routed by #tool's data-client="sortLines") on first file selection/
// paste-convert click, or warmed on pointerenter/focus -- same lazy-load
// reasoning as ./dedupeLines.client.js. This tool has two input paths that
// both land here as the same File shape: a .txt/.csv file chosen/dropped
// through the normal drop zone, or a list typed into the "paste a list"
// text box (dropzone.client.js wraps the pasted text in a synthetic File
// before calling this module's run(), so this file never needs to know
// which path a given File came from).
//
// The sort itself -- CSV field splitting, numeric-vs-alpha auto-detection,
// the actual comparator -- is pure logic that lives in
// ../pure/sortLines.mjs so it stays unit-testable without a DOM; this
// file's job is only to (a) read the File's text, (b) render the column/
// order/type/header controls and the preview, and (c) re-run the pure
// logic in place whenever a visitor changes an option.

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
function textBlob(text, mimeType) {
  return new Blob(['﻿', text], { type: `${mimeType};charset=utf-8` });
}

/**
 * @param {string} originalName the uploaded/pasted File's name.
 * @returns {{ downloadName: string, mimeType: string }} an output filename
 *   that preserves the original extension (defaulting to .txt for anything
 *   else), plus the matching MIME type so a .csv result still opens as CSV.
 */
function outputNaming(originalName) {
  const isCsv = /\.csv$/i.test(originalName);
  return {
    downloadName: isCsv ? 'sorted.csv' : 'sorted.txt',
    mimeType: isCsv ? 'text/csv' : 'text/plain',
  };
}

/**
 * Renders the options row, stats badge, preview table, and download button.
 * Re-invoked in place whenever a visitor changes a control -- same pattern
 * as ../browser/dedupeLines.client.js's renderResult.
 *
 * @param {HTMLElement} resultEl
 * @param {string[]} rawLines every line from the input, in original order.
 * @param {object} optionState { column, order, type, hasHeader, caseSensitive }.
 * @param {{ downloadName: string, mimeType: string }} naming
 * @param {Function} sortLines from ../pure/sortLines.mjs.
 * @param {Function} joinLines from ../pure/sortLines.mjs.
 */
function renderResult(resultEl, rawLines, optionState, naming, sortLines, joinLines) {
  resultEl.innerHTML = '';

  const outcome = sortLines(rawLines, optionState);
  // Clamp a stale column choice (e.g. a re-render after choosing a wider
  // file, then a narrower one) rather than letting the <select> point past
  // the end of the current columnCount.
  if (optionState.column > outcome.columnCount - 1) optionState.column = outcome.columnCount - 1;

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = outcome.columnCount > 1
    ? `${outcome.totalCount} row${outcome.totalCount === 1 ? '' : 's'} - sorted ${outcome.resolvedType === 'numeric' ? 'numerically' : 'alphabetically'} by column ${optionState.column + 1}`
    : `${outcome.totalCount} line${outcome.totalCount === 1 ? '' : 's'} - sorted ${outcome.resolvedType === 'numeric' ? 'numerically' : 'alphabetically'}`;
  head.appendChild(badge);

  if (outcome.columnCount > 1) {
    const columnLabel = document.createElement('label');
    columnLabel.appendChild(document.createTextNode('Sort by column '));
    const columnSelect = document.createElement('select');
    for (let i = 0; i < outcome.columnCount; i++) {
      const option = document.createElement('option');
      option.value = String(i);
      const headerText = optionState.hasHeader && outcome.header ? ` (${outcome.header.split(',')[i] || ''})`.replace(' ()', '') : '';
      option.textContent = `Column ${i + 1}${headerText}`;
      option.selected = i === optionState.column;
      columnSelect.appendChild(option);
    }
    columnSelect.addEventListener('change', () => {
      optionState.column = Number(columnSelect.value);
      renderResult(resultEl, rawLines, optionState, naming, sortLines, joinLines);
    });
    columnLabel.appendChild(columnSelect);
    head.appendChild(columnLabel);
  }

  const orderLabel = document.createElement('label');
  orderLabel.appendChild(document.createTextNode('Order '));
  const orderSelect = document.createElement('select');
  [['asc', 'Ascending (A→Z, 0→9)'], ['desc', 'Descending (Z→A, 9→0)']].forEach(([value, text]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    option.selected = optionState.order === value;
    orderSelect.appendChild(option);
  });
  orderSelect.addEventListener('change', () => {
    optionState.order = orderSelect.value;
    renderResult(resultEl, rawLines, optionState, naming, sortLines, joinLines);
  });
  orderLabel.appendChild(orderSelect);
  head.appendChild(orderLabel);

  const typeLabel = document.createElement('label');
  typeLabel.appendChild(document.createTextNode('Sort as '));
  const typeSelect = document.createElement('select');
  [['auto', 'Auto-detect'], ['numeric', 'Numbers'], ['alpha', 'Text']].forEach(([value, text]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    option.selected = optionState.type === value;
    typeSelect.appendChild(option);
  });
  typeSelect.addEventListener('change', () => {
    optionState.type = typeSelect.value;
    renderResult(resultEl, rawLines, optionState, naming, sortLines, joinLines);
  });
  typeLabel.appendChild(typeSelect);
  head.appendChild(typeLabel);

  if (outcome.columnCount > 1) {
    const headerRowLabel = document.createElement('label');
    const headerCheckbox = document.createElement('input');
    headerCheckbox.type = 'checkbox';
    headerCheckbox.checked = optionState.hasHeader;
    headerCheckbox.addEventListener('change', () => {
      optionState.hasHeader = headerCheckbox.checked;
      renderResult(resultEl, rawLines, optionState, naming, sortLines, joinLines);
    });
    headerRowLabel.appendChild(headerCheckbox);
    headerRowLabel.appendChild(document.createTextNode(' First row is a header (keep it on top)'));
    head.appendChild(headerRowLabel);
  }

  const caseLabel = document.createElement('label');
  const caseCheckbox = document.createElement('input');
  caseCheckbox.type = 'checkbox';
  caseCheckbox.checked = optionState.caseSensitive;
  caseCheckbox.disabled = outcome.resolvedType === 'numeric';
  caseCheckbox.addEventListener('change', () => {
    optionState.caseSensitive = caseCheckbox.checked;
    renderResult(resultEl, rawLines, optionState, naming, sortLines, joinLines);
  });
  caseLabel.appendChild(caseCheckbox);
  caseLabel.appendChild(document.createTextNode(' Case-sensitive'));
  head.appendChild(caseLabel);

  block.appendChild(head);

  if (outcome.sorted.length) {
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'table-scroll';
    const tableEl = document.createElement('table');
    tableEl.className = 'extracted-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = 'Line';
    headRow.appendChild(th);
    thead.appendChild(headRow);
    tableEl.appendChild(thead);

    const tbody = document.createElement('tbody');
    outcome.sorted.slice(0, PREVIEW_LIMIT).forEach((line) => {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.textContent = line;
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    tableEl.appendChild(tbody);
    scrollWrap.appendChild(tableEl);
    block.appendChild(scrollWrap);

    if (outcome.sorted.length > PREVIEW_LIMIT) {
      const previewNote = document.createElement('p');
      previewNote.className = 'caption';
      previewNote.textContent = `Showing the first ${PREVIEW_LIMIT} of ${outcome.sorted.length} lines. The download includes all of them.`;
      block.appendChild(previewNote);
    }
  } else {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'There’s nothing to sort - that file or pasted text is empty.';
    block.appendChild(msg);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  downloadBtn.textContent = `Download ${naming.downloadName}`;
  downloadBtn.disabled = outcome.sorted.length === 0;
  downloadBtn.addEventListener('click', () => {
    downloadBlob(textBlob(joinLines(outcome.sorted), naming.mimeType), naming.downloadName);
  });
  btnRow.appendChild(downloadBtn);
  block.appendChild(btnRow);

  const supportNote = document.createElement('p');
  supportNote.className = 'support-note';
  supportNote.innerHTML = 'That ran entirely on your machine, with no server and no hosting cost on my end. If it saved you time, you can buy me a coffee: '
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

  const [{ splitLines, sortLines, joinLines, columnCount }] = await Promise.all([
    import('../pure/sortLines.mjs'),
  ]);

  const text = await file.text();
  const rawLines = splitLines(text);

  if (!rawLines.length) {
    resultEl.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That file or pasted text is empty - there’s nothing to sort.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('Finished reading - no lines found.', 'error');
    return;
  }

  const multiColumn = columnCount(rawLines) > 1;
  const optionState = {
    column: 0,
    order: 'asc',
    type: 'auto',
    hasHeader: multiColumn,
    caseSensitive: false,
  };
  const naming = outputNaming(file.name);
  renderResult(resultEl, rawLines, optionState, naming, sortLines, joinLines);

  const outcome = sortLines(rawLines, optionState);
  setState('done');
  setStatus(`Sorted ${outcome.totalCount} line${outcome.totalCount === 1 ? '' : 's'}. Review below, then download.`, 'success');
}

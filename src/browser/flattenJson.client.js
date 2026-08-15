// Flatten-nested-JSON processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="flattenJson") on
// first file selection/paste-convert click, or warmed on pointerenter/
// focus -- same lazy-load reasoning as ./dedupeLines.client.js. This tool
// has two input paths that both land here as the same File shape: a .json
// file chosen/dropped through the normal drop zone, or JSON text typed
// into the "paste JSON" text box (dropzone.client.js wraps the pasted text
// in a synthetic File before calling this module's run(), so this file
// never needs to know which path a given File came from).
//
// The flattening math -- mode detection, path-building, CSV row shaping --
// is pure logic that lives in ../pure/flattenJson.mjs so it stays
// unit-testable without a DOM; this file's job is only to (a) read the
// File's text and JSON.parse it, (b) render the delimiter/array-handling
// controls plus a table (records mode) or key/value list (single mode),
// and (c) re-run the pure logic in place whenever a visitor changes an
// option. JSON.parse on untrusted text never executes anything (unlike
// eval) -- it produces plain data or throws, both handled below.

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

function jsonBlob(value) {
  return new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
}

const DELIMITERS = [
  ['.', 'Dot (a.b.c)'],
  ['_', 'Underscore (a_b_c)'],
  ['/', 'Slash (a/b/c)'],
];

/**
 * Renders the options row (delimiter select + "flatten arrays" checkbox),
 * the badge, the result table, and the download buttons. Re-invoked in
 * place whenever a visitor changes an option -- same pattern as
 * ../browser/sortLines.client.js's renderResult.
 *
 * @param {HTMLElement} resultEl
 * @param {*} parsed the JSON.parse()'d top-level value.
 * @param {'records'|'single'} mode
 * @param {object} optionState { delimiter, flattenArrays }.
 * @param {object} pure the imported ../pure/flattenJson.mjs + ../pure/csv.mjs exports.
 */
function renderResult(resultEl, parsed, mode, optionState, pure) {
  resultEl.innerHTML = '';
  const { flattenValue, flattenRecords, collectColumns, recordsToRows, singleToRows, rowsToCsv } = pure;

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const badge = document.createElement('span');
  badge.className = 'page-badge';
  head.appendChild(badge);

  const delimLabel = document.createElement('label');
  delimLabel.appendChild(document.createTextNode('Delimiter '));
  const delimSelect = document.createElement('select');
  DELIMITERS.forEach(([value, text]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    option.selected = optionState.delimiter === value;
    delimSelect.appendChild(option);
  });
  delimSelect.addEventListener('change', () => {
    optionState.delimiter = delimSelect.value;
    renderResult(resultEl, parsed, mode, optionState, pure);
  });
  delimLabel.appendChild(delimSelect);
  head.appendChild(delimLabel);

  const arraysLabel = document.createElement('label');
  const arraysCheckbox = document.createElement('input');
  arraysCheckbox.type = 'checkbox';
  arraysCheckbox.checked = optionState.flattenArrays;
  arraysCheckbox.addEventListener('change', () => {
    optionState.flattenArrays = arraysCheckbox.checked;
    renderResult(resultEl, parsed, mode, optionState, pure);
  });
  arraysLabel.appendChild(arraysCheckbox);
  arraysLabel.appendChild(document.createTextNode(' Give array items their own numbered key'));
  head.appendChild(arraysLabel);

  block.appendChild(head);

  let flatForJson;
  let rows;
  let isEmpty;

  if (mode === 'records') {
    const flatRecords = flattenRecords(parsed, optionState);
    const columns = collectColumns(flatRecords);
    rows = recordsToRows(flatRecords, columns);
    flatForJson = flatRecords;
    isEmpty = flatRecords.length === 0;
    badge.textContent = isEmpty
      ? 'That array is empty — nothing to flatten'
      : `${flatRecords.length} record${flatRecords.length === 1 ? '' : 's'} — ${columns.length} column${columns.length === 1 ? '' : 's'}`;
  } else {
    const flat = flattenValue(parsed, optionState);
    rows = singleToRows(flat);
    flatForJson = flat;
    isEmpty = false;
    const keyCount = Object.keys(flat).length;
    badge.textContent = `${keyCount} flattened key${keyCount === 1 ? '' : 's'}`;
  }

  if (!isEmpty) {
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'table-scroll';
    const tableEl = document.createElement('table');
    tableEl.className = 'extracted-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    rows[0].forEach((cellValue) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = cellValue;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    tableEl.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.slice(1, 1 + PREVIEW_LIMIT).forEach((row) => {
      const tr = document.createElement('tr');
      row.forEach((cellValue) => {
        const td = document.createElement('td');
        td.textContent = cellValue;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tableEl.appendChild(tbody);
    scrollWrap.appendChild(tableEl);
    block.appendChild(scrollWrap);

    const dataRowCount = rows.length - 1;
    if (dataRowCount > PREVIEW_LIMIT) {
      const previewNote = document.createElement('p');
      previewNote.className = 'caption';
      previewNote.textContent = `Showing the first ${PREVIEW_LIMIT} of ${dataRowCount} rows. The download includes all of them.`;
      block.appendChild(previewNote);
    }
  } else {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That array is empty, so there’s nothing to flatten. Try a different file or pasted JSON.';
    block.appendChild(msg);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';

  const jsonBtn = document.createElement('button');
  jsonBtn.type = 'button';
  jsonBtn.className = 'btn-primary';
  jsonBtn.textContent = 'Download flattened.json';
  jsonBtn.disabled = isEmpty;
  jsonBtn.addEventListener('click', () => {
    downloadBlob(jsonBlob(flatForJson), 'flattened.json');
  });
  btnRow.appendChild(jsonBtn);

  const csvBtn = document.createElement('button');
  csvBtn.type = 'button';
  csvBtn.className = 'btn-secondary';
  csvBtn.textContent = 'Download flattened.csv';
  csvBtn.disabled = isEmpty;
  csvBtn.addEventListener('click', () => {
    downloadBlob(csvBlob(rowsToCsv(rows)), 'flattened.csv');
  });
  btnRow.appendChild(csvBtn);

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
  setStatus('Reading that JSON on this device…');

  const [{ detectMode, flattenValue, flattenRecords, collectColumns, recordsToRows, singleToRows }, { rowsToCsv }] = await Promise.all([
    import('../pure/flattenJson.mjs'),
    import('../pure/csv.mjs'),
  ]);

  const text = await file.text();

  if (!text.trim()) {
    resultEl.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That file or pasted text is empty — there’s nothing to flatten.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('Finished reading — no JSON found.', 'error');
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    resultEl.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = `That doesn’t look like valid JSON: ${err.message}`;
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('Finished reading — that wasn’t valid JSON.', 'error');
    return;
  }

  const mode = detectMode(parsed);

  if (mode === 'invalid') {
    resultEl.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That’s valid JSON, but there’s nothing to flatten — the top level needs to be an object ({...}) or an array ([...]), not a bare value.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('Finished reading — nothing to flatten.', 'error');
    return;
  }

  const optionState = { delimiter: '.', flattenArrays: true };
  const pure = { flattenValue, flattenRecords, collectColumns, recordsToRows, singleToRows, rowsToCsv };
  renderResult(resultEl, parsed, mode, optionState, pure);

  setState('done');
  setStatus(
    mode === 'records'
      ? `Found ${parsed.length} record${parsed.length === 1 ? '' : 's'}. Review below, then download.`
      : 'Flattened. Review below, then download.',
    'success'
  );
}

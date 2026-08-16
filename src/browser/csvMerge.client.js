// Merge-multiple-CSV-files processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="csvMerge") on first
// file selection, or warmed on pointerenter/focus -- same lazy-load
// reasoning as ../browser/sortLines.client.js. Multi-file only (this tool
// has no paste input): dropzone.client.js hands every selected/dropped File
// straight through as ctx.files, in the order the visitor chose or dropped
// them.
//
// The actual parsing and header-reconciliation logic -- what makes a
// "merge" here more than string concatenation -- is pure and lives in
// ../pure/csvMerge.mjs so it stays unit-testable without a DOM; this file's
// job is only to (a) read every File's text, (b) render the option toggles,
// per-file summary, and preview table, and (c) re-run the pure logic in
// place whenever a visitor flips an option. Output CSV serialization
// (including formula-injection neutralization) reuses ../pure/csv.mjs's
// rowsToCsv, same as every other CSV-producing tool on this site.

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
 * Builds the per-file summary list (name, row/column count, and any header
 * mismatch against the union) -- a plain DOM list, same shape as
 * ../css.js's .file-list/.file-row (already used by the merge-PDF tool),
 * built with createElement/textContent throughout rather than innerHTML:
 * every value here (file name, column names) came from a visitor-supplied
 * File, so it's untrusted input.
 *
 * @param {Array<{name:string,rowCount:number,columnCount:number,newColumns:string[],missingColumns:string[]}>} perFile
 * @param {boolean} hasHeader
 */
function renderFileSummary(perFile, hasHeader) {
  const list = document.createElement('ul');
  list.className = 'file-list';
  perFile.forEach((f) => {
    const li = document.createElement('li');
    li.className = 'file-row';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = f.name;
    li.appendChild(nameSpan);

    const metaParts = [`${f.rowCount} row${f.rowCount === 1 ? '' : 's'}`];
    if (hasHeader) metaParts.push(`${f.columnCount} column${f.columnCount === 1 ? '' : 's'}`);
    if (hasHeader && f.newColumns.length) metaParts.push(`adds ${f.newColumns.join(', ')}`);
    if (hasHeader && f.missingColumns.length) metaParts.push(`missing ${f.missingColumns.join(', ')} (filled blank)`);
    const metaSpan = document.createElement('span');
    metaSpan.className = 'file-meta';
    metaSpan.textContent = metaParts.join(' · ');
    li.appendChild(metaSpan);

    list.appendChild(li);
  });
  return list;
}

/**
 * Renders the options row, per-file summary, stats badge, preview table,
 * and download button. Re-invoked in place whenever a visitor changes an
 * option -- same pattern as ../browser/sortLines.client.js's renderResult.
 *
 * @param {HTMLElement} resultEl
 * @param {{name:string, text:string}[]} fileInputs
 * @param {object} optionState { hasHeader, includeSourceColumn }
 * @param {Function} mergeCsvFiles from ../pure/csvMerge.mjs.
 * @param {Function} rowsToCsv from ../pure/csv.mjs.
 */
function renderResult(resultEl, fileInputs, optionState, mergeCsvFiles, rowsToCsv) {
  resultEl.innerHTML = '';

  const outcome = mergeCsvFiles(fileInputs, optionState);
  // outcome.headers is [] (not null) whenever hasHeader is true but every
  // file was empty/headerless -- an empty array is still truthy in JS, so
  // this can't be a plain `outcome.headers ? ... : ...` check, or the
  // "nothing to merge" case below would never trigger (allRows would come
  // out as [[]], one row containing zero cells, instead of no rows at all).
  const hasHeaderRow = Boolean(outcome.headers && outcome.headers.length);
  const allRows = hasHeaderRow ? [outcome.headers, ...outcome.rows] : outcome.rows;

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = `${outcome.totalRows} row${outcome.totalRows === 1 ? '' : 's'} from ${fileInputs.length} file${fileInputs.length === 1 ? '' : 's'} - ${outcome.totalColumns} column${outcome.totalColumns === 1 ? '' : 's'}`;
  head.appendChild(badge);

  const headerLabel = document.createElement('label');
  const headerToggle = document.createElement('input');
  headerToggle.type = 'checkbox';
  headerToggle.checked = optionState.hasHeader;
  headerToggle.addEventListener('change', () => {
    optionState.hasHeader = headerToggle.checked;
    renderResult(resultEl, fileInputs, optionState, mergeCsvFiles, rowsToCsv);
  });
  headerLabel.appendChild(headerToggle);
  headerLabel.appendChild(document.createTextNode(' Each file has a header row (align columns by name)'));
  head.appendChild(headerLabel);

  const sourceLabel = document.createElement('label');
  const sourceToggle = document.createElement('input');
  sourceToggle.type = 'checkbox';
  sourceToggle.checked = optionState.includeSourceColumn;
  sourceToggle.addEventListener('change', () => {
    optionState.includeSourceColumn = sourceToggle.checked;
    renderResult(resultEl, fileInputs, optionState, mergeCsvFiles, rowsToCsv);
  });
  sourceLabel.appendChild(sourceToggle);
  sourceLabel.appendChild(document.createTextNode(' Add a "Source file" column'));
  head.appendChild(sourceLabel);

  block.appendChild(head);
  block.appendChild(renderFileSummary(outcome.perFile, optionState.hasHeader));

  if (allRows.length) {
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'table-scroll';
    const tableEl = document.createElement('table');
    tableEl.className = 'extracted-table';

    if (hasHeaderRow) {
      const thead = document.createElement('thead');
      const tr = document.createElement('tr');
      outcome.headers.forEach((h) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = h;
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      tableEl.appendChild(thead);
    }

    const tbody = document.createElement('tbody');
    outcome.rows.slice(0, PREVIEW_LIMIT).forEach((row) => {
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

    if (outcome.rows.length > PREVIEW_LIMIT) {
      const previewNote = document.createElement('p');
      previewNote.className = 'caption';
      previewNote.textContent = `Showing the first ${PREVIEW_LIMIT} of ${outcome.rows.length} rows. The download includes all of them.`;
      block.appendChild(previewNote);
    }
  } else {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'There’s nothing to merge - every file was empty.';
    block.appendChild(msg);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  downloadBtn.textContent = 'Download merged.csv';
  downloadBtn.disabled = allRows.length === 0;
  downloadBtn.addEventListener('click', () => {
    downloadBlob(csvBlob(rowsToCsv(allRows)), 'merged.csv');
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
  setStatus(`Reading ${files.length} file${files.length === 1 ? '' : 's'} on this device…`);

  const [{ mergeCsvFiles }, { rowsToCsv }] = await Promise.all([
    import('../pure/csvMerge.mjs'),
    import('../pure/csv.mjs'),
  ]);

  const fileInputs = [];
  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop -- files must be read in
    // the visitor's chosen order so the merged output's row order matches
    // what they'd expect; Promise.all would still work correctly here
    // since order is preserved either way, but reading sequentially keeps
    // this loop simple to reason about for what's normally a handful of
    // files.
    const text = await file.text();
    fileInputs.push({ name: file.name, text });
  }

  const optionState = { hasHeader: true, includeSourceColumn: false };
  renderResult(resultEl, fileInputs, optionState, mergeCsvFiles, rowsToCsv);

  const outcome = mergeCsvFiles(fileInputs, optionState);
  setState('done');
  setStatus(`Merged ${outcome.totalRows} row${outcome.totalRows === 1 ? '' : 's'} from ${files.length} file${files.length === 1 ? '' : 's'}. Review below, then download.`, 'success');
}

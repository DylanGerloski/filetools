// Compare-two-CSV-files processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="csvDiff") on first
// file selection, or warmed on pointerenter/focus -- same lazy-load
// reasoning as ./csvMerge.client.js. This tool needs exactly two files at
// once: dropzone.client.js's data-multiple="true" lets a visitor select or
// drop more than one File in a single action (the same mechanism
// csvMerge.client.js uses for "two or more"), and this file's own run()
// enforces the "exactly two" rule itself, since the shared dropzone logic
// only enforces "one" vs "any number".
//
// The actual diff algorithm -- CSV parsing, key-column matching, the LCS
// row alignment -- is pure and lives in ../pure/csvDiff.mjs so it stays
// unit-testable without a DOM; this file's job is only to (a) read both
// Files' text, (b) render the option controls, legend, and diff table, and
// (c) re-run the pure logic in place whenever a visitor changes an option
// or swaps which file is "A" and which is "B". Output CSV serialization
// (including formula-injection neutralization) reuses ../pure/csv.mjs's
// rowsToCsv, same as every other CSV-producing tool on this site.

const PREVIEW_LIMIT = 500;

const STATUS_LABEL = {
  unchanged: 'Unchanged',
  changed: 'Changed',
  added: 'Added',
  removed: 'Removed',
};

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
 * @param {object} outcome the diffCsvFiles() result.
 * @param {number} col
 * @returns {string} the label used for a column select option / download
 *   header -- the header B name if present, else header A's, else a plain
 *   "Column N" fallback.
 */
function columnLabel(outcome, col) {
  const fromB = outcome.headerB && col < outcome.headerB.length ? outcome.headerB[col].trim() : '';
  const fromA = outcome.headerA && col < outcome.headerA.length ? outcome.headerA[col].trim() : '';
  return fromB || fromA || `Column ${col + 1}`;
}

/**
 * @param {object} outcome diffCsvFiles() result.
 * @returns {string[][]} a full status-tagged table: ['Status', ...columns]
 *   header, then one row per diff entry -- ALL of them, regardless of the
 *   on-page "show unchanged rows" filter, so the download is always the
 *   complete record. A changed cell's value is rendered as "old → new" so
 *   the cell-level diff survives into the exported file, not just the
 *   on-page view.
 */
function buildDiffRowsForDownload(outcome) {
  const width = outcome.columnCount;
  const header = ['Status'];
  for (let c = 0; c < width; c += 1) header.push(columnLabel(outcome, c));
  const rows = [header];

  outcome.rows.forEach((r) => {
    const cells = [STATUS_LABEL[r.status]];
    for (let c = 0; c < width; c += 1) {
      if (r.status === 'changed' && r.changedCells.includes(c)) {
        const av = r.a && c < r.a.length ? r.a[c] : '';
        const bv = r.b && c < r.b.length ? r.b[c] : '';
        cells.push(`${av} → ${bv}`);
      } else {
        const src = r.b || r.a || [];
        cells.push(c < src.length ? src[c] : '');
      }
    }
    rows.push(cells);
  });
  return rows;
}

/**
 * Renders the option controls, summary badge, and the diff table itself.
 * Re-invoked in place whenever a visitor changes an option or swaps files
 * -- same pattern as ../browser/csvMerge.client.js's renderResult.
 *
 * @param {HTMLElement} resultEl
 * @param {{name:string,text:string}[]} fileInputs exactly two, in A/B order.
 * @param {object} optionState { hasHeader, keyColumnChoice, ignoreWhitespace, caseSensitive, showUnchanged }.
 * @param {Function} diffCsvFiles from ../pure/csvDiff.mjs.
 * @param {Function} rowsToCsv from ../pure/csv.mjs.
 * @param {Function} onSwap called with no args to swap fileInputs[0]/[1].
 */
function renderResult(resultEl, fileInputs, optionState, diffCsvFiles, rowsToCsv, onSwap) {
  resultEl.innerHTML = '';

  const keyColumn = optionState.keyColumnChoice === 'auto'
    ? undefined
    : optionState.keyColumnChoice === 'position'
      ? null
      : Number(optionState.keyColumnChoice);

  const outcome = diffCsvFiles(fileInputs[0].text, fileInputs[1].text, {
    hasHeader: optionState.hasHeader,
    keyColumn,
    ignoreWhitespace: optionState.ignoreWhitespace,
    caseSensitive: optionState.caseSensitive,
  });

  const block = document.createElement('div');
  block.className = 'table-block';

  const filesLine = document.createElement('p');
  filesLine.className = 'caption';
  filesLine.textContent = `Comparing File A "${fileInputs[0].name}" against File B "${fileInputs[1].name}" - added/removed are relative to A → B.`;
  block.appendChild(filesLine);

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = `${outcome.stats.changed} changed · ${outcome.stats.added} added · ${outcome.stats.removed} removed · ${outcome.stats.unchanged} unchanged`;
  head.appendChild(badge);

  const swapBtn = document.createElement('button');
  swapBtn.type = 'button';
  swapBtn.className = 'btn-secondary';
  swapBtn.textContent = 'Swap A ↔ B';
  swapBtn.addEventListener('click', onSwap);
  head.appendChild(swapBtn);

  const headerLabel = document.createElement('label');
  const headerToggle = document.createElement('input');
  headerToggle.type = 'checkbox';
  headerToggle.checked = optionState.hasHeader;
  headerToggle.addEventListener('change', () => {
    optionState.hasHeader = headerToggle.checked;
    renderResult(resultEl, fileInputs, optionState, diffCsvFiles, rowsToCsv, onSwap);
  });
  headerLabel.appendChild(headerToggle);
  headerLabel.appendChild(document.createTextNode(' First row is a header'));
  head.appendChild(headerLabel);

  const keyLabel = document.createElement('label');
  keyLabel.appendChild(document.createTextNode('Match rows by '));
  const keySelect = document.createElement('select');
  const autoOpt = document.createElement('option');
  autoOpt.value = 'auto';
  autoOpt.textContent = outcome.autoKeyColumn !== null
    ? `Auto (detected: ${columnLabel(outcome, outcome.autoKeyColumn)})`
    : 'Auto (no unique column found - uses row position)';
  keySelect.appendChild(autoOpt);
  const posOpt = document.createElement('option');
  posOpt.value = 'position';
  posOpt.textContent = 'Row position (ignore column values)';
  keySelect.appendChild(posOpt);
  for (let c = 0; c < outcome.columnCount; c += 1) {
    const opt = document.createElement('option');
    opt.value = String(c);
    opt.textContent = columnLabel(outcome, c);
    keySelect.appendChild(opt);
  }
  keySelect.value = optionState.keyColumnChoice;
  keySelect.addEventListener('change', () => {
    optionState.keyColumnChoice = keySelect.value;
    renderResult(resultEl, fileInputs, optionState, diffCsvFiles, rowsToCsv, onSwap);
  });
  keyLabel.appendChild(keySelect);
  head.appendChild(keyLabel);

  const wsLabel = document.createElement('label');
  const wsToggle = document.createElement('input');
  wsToggle.type = 'checkbox';
  wsToggle.checked = optionState.ignoreWhitespace;
  wsToggle.addEventListener('change', () => {
    optionState.ignoreWhitespace = wsToggle.checked;
    renderResult(resultEl, fileInputs, optionState, diffCsvFiles, rowsToCsv, onSwap);
  });
  wsLabel.appendChild(wsToggle);
  wsLabel.appendChild(document.createTextNode(' Ignore surrounding whitespace'));
  head.appendChild(wsLabel);

  const caseLabel = document.createElement('label');
  const caseToggle = document.createElement('input');
  caseToggle.type = 'checkbox';
  caseToggle.checked = optionState.caseSensitive;
  caseToggle.addEventListener('change', () => {
    optionState.caseSensitive = caseToggle.checked;
    renderResult(resultEl, fileInputs, optionState, diffCsvFiles, rowsToCsv, onSwap);
  });
  caseLabel.appendChild(caseToggle);
  caseLabel.appendChild(document.createTextNode(' Case-sensitive'));
  head.appendChild(caseLabel);

  const unchangedLabel = document.createElement('label');
  const unchangedToggle = document.createElement('input');
  unchangedToggle.type = 'checkbox';
  unchangedToggle.checked = optionState.showUnchanged;
  unchangedToggle.addEventListener('change', () => {
    optionState.showUnchanged = unchangedToggle.checked;
    renderResult(resultEl, fileInputs, optionState, diffCsvFiles, rowsToCsv, onSwap);
  });
  unchangedLabel.appendChild(unchangedToggle);
  unchangedLabel.appendChild(document.createTextNode(' Show unchanged rows too'));
  head.appendChild(unchangedLabel);

  block.appendChild(head);

  if (optionState.keyColumnNote === undefined) optionState.keyColumnNote = null;
  if (outcome.keyColumnNote === 'not-unique') {
    const note = document.createElement('div');
    note.className = 'alert alert-warn';
    note.setAttribute('role', 'alert');
    note.textContent = 'That column has repeated values in at least one file, so it can’t be used as a unique key - comparing by row position instead.';
    block.appendChild(note);
  }

  if (outcome.headerDiff && outcome.headerDiff.changed) {
    const note = document.createElement('div');
    note.className = 'alert alert-warn';
    note.setAttribute('role', 'alert');
    note.textContent = 'The header row itself differs between the two files (shown pinned at the top of the table below).';
    block.appendChild(note);
  }

  if (outcome.overLimit) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-danger';
    msg.setAttribute('role', 'alert');
    msg.textContent = `These files (${outcome.totalA} and ${outcome.totalB} rows) are too large to compare by row position. Pick a unique column above under “Match rows by” (that has no size limit), or use smaller files.`;
    block.appendChild(msg);
    resultEl.appendChild(block);
    resultEl.hidden = false;
    return;
  }

  const visibleRows = optionState.showUnchanged ? outcome.rows : outcome.rows.filter((r) => r.status !== 'unchanged');

  if (visibleRows.length === 0 && outcome.rows.length > 0) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-success';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'No differences found - every row matched exactly.';
    block.appendChild(msg);
  } else if (outcome.rows.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'There’s nothing to compare - both files are empty.';
    block.appendChild(msg);
  } else {
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'table-scroll';
    const tableEl = document.createElement('table');
    tableEl.className = 'extracted-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const statusTh = document.createElement('th');
    statusTh.scope = 'col';
    statusTh.textContent = 'Status';
    headRow.appendChild(statusTh);
    for (let c = 0; c < outcome.columnCount; c += 1) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = columnLabel(outcome, c);
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    tableEl.appendChild(thead);

    const tbody = document.createElement('tbody');
    visibleRows.slice(0, PREVIEW_LIMIT).forEach((r) => {
      const tr = document.createElement('tr');
      tr.dataset.diffStatus = r.status;

      const statusTd = document.createElement('td');
      statusTd.className = 'diff-status-cell';
      statusTd.dataset.diffStatus = r.status;
      statusTd.textContent = STATUS_LABEL[r.status];
      tr.appendChild(statusTd);

      for (let c = 0; c < outcome.columnCount; c += 1) {
        const td = document.createElement('td');
        if (r.status === 'changed' && r.changedCells.includes(c)) {
          td.dataset.diffCell = 'changed';
          const oldSpan = document.createElement('span');
          oldSpan.className = 'diff-cell-old';
          oldSpan.textContent = r.a && c < r.a.length ? r.a[c] : '';
          const newSpan = document.createElement('span');
          newSpan.className = 'diff-cell-new';
          newSpan.textContent = r.b && c < r.b.length ? r.b[c] : '';
          td.appendChild(oldSpan);
          td.appendChild(newSpan);
        } else {
          const src = r.b || r.a || [];
          td.textContent = c < src.length ? src[c] : '';
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    tableEl.appendChild(tbody);
    scrollWrap.appendChild(tableEl);
    block.appendChild(scrollWrap);

    if (visibleRows.length > PREVIEW_LIMIT) {
      const previewNote = document.createElement('p');
      previewNote.className = 'caption';
      previewNote.textContent = `Showing the first ${PREVIEW_LIMIT} of ${visibleRows.length} rows shown here. The downloaded CSV includes every row.`;
      block.appendChild(previewNote);
    }
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  downloadBtn.textContent = 'Download diff.csv';
  downloadBtn.disabled = outcome.rows.length === 0;
  downloadBtn.addEventListener('click', () => {
    downloadBlob(csvBlob(rowsToCsv(buildDiffRowsForDownload(outcome))), 'diff.csv');
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

  if (files.length !== 2) {
    setState('error');
    setStatus(`This tool compares exactly two CSV files - you selected ${files.length}. Choose (or drag) both files together, in one go.`, 'error');
    return;
  }

  setState('working');
  setStatus('Reading both files on this device…');

  const [{ diffCsvFiles }, { rowsToCsv }] = await Promise.all([
    import('../pure/csvDiff.mjs'),
    import('../pure/csv.mjs'),
  ]);

  const fileInputs = [];
  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop -- exactly two files, read
    // in the visitor's chosen order so "File A" / "File B" match what they
    // selected; see csvMerge.client.js's identical reasoning.
    const text = await file.text();
    fileInputs.push({ name: file.name, text });
  }

  const optionState = {
    hasHeader: true,
    keyColumnChoice: 'auto',
    ignoreWhitespace: false,
    caseSensitive: true,
    showUnchanged: false,
  };

  function swap() {
    fileInputs.reverse();
    renderResult(resultEl, fileInputs, optionState, diffCsvFiles, rowsToCsv, swap);
    const outcome = diffCsvFiles(fileInputs[0].text, fileInputs[1].text, resolveOpts(optionState));
    setStatus(summaryText(outcome), outcome.overLimit ? 'error' : 'success');
  }

  function resolveOpts(state) {
    return {
      hasHeader: state.hasHeader,
      keyColumn: state.keyColumnChoice === 'auto' ? undefined : state.keyColumnChoice === 'position' ? null : Number(state.keyColumnChoice),
      ignoreWhitespace: state.ignoreWhitespace,
      caseSensitive: state.caseSensitive,
    };
  }

  function summaryText(outcome) {
    if (outcome.overLimit) return `Too many rows to compare by position (${outcome.totalA} × ${outcome.totalB}) - pick a key column above.`;
    return `${outcome.stats.changed} changed, ${outcome.stats.added} added, ${outcome.stats.removed} removed, ${outcome.stats.unchanged} unchanged. Review below, then download.`;
  }

  renderResult(resultEl, fileInputs, optionState, diffCsvFiles, rowsToCsv, swap);

  const outcome = diffCsvFiles(fileInputs[0].text, fileInputs[1].text, resolveOpts(optionState));
  setState('done');
  setStatus(summaryText(outcome), outcome.overLimit ? 'error' : 'success');
}

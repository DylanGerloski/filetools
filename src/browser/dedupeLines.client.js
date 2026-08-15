// Remove-duplicate-lines/rows processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="dedupeLines") on
// first file selection/paste-convert click, or warmed on pointerenter/
// focus -- same lazy-load reasoning as ./htmlTableToCsv.client.js. This
// tool has two input paths that both land here as the same File shape: a
// .txt/.csv file chosen/dropped through the normal drop zone, or a list
// typed into the "paste a list" text box (dropzone.client.js wraps the
// pasted text in a synthetic File before calling this module's run(), so
// this file never needs to know which path a given File came from).
//
// The dedup itself is exact-match, line by line -- pure logic that lives in
// ../pure/dedupeLines.mjs so it stays unit-testable without a DOM; this
// file's job is only to (a) read the File's text, (b) render the options/
// stats/preview UI, and (c) re-run the pure logic in place whenever a
// visitor flips an option toggle. See dedupeLines.mjs's header comment for
// exactly what counts as a "duplicate" and why whitespace/case differences
// do NOT collapse by default.

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
 *   else, e.g. a name with no extension at all), plus the matching MIME
 *   type so a .csv result still opens as CSV in the visitor's OS.
 */
function outputNaming(originalName) {
  const isCsv = /\.csv$/i.test(originalName);
  return {
    downloadName: isCsv ? 'deduplicated.csv' : 'deduplicated.txt',
    mimeType: isCsv ? 'text/csv' : 'text/plain',
  };
}

/**
 * Renders the options row, stats badge, preview table, and download button.
 * Re-invoked in place whenever a visitor flips an option checkbox -- same
 * pattern as ../browser/htmlTableToCsv.client.js's renderTableBlock.
 *
 * @param {HTMLElement} resultEl
 * @param {string[]} rawLines every line from the input, in original order.
 * @param {object} optionState { caseSensitive, ignoreWhitespace, skipBlankLines }.
 * @param {{ downloadName: string, mimeType: string }} naming
 * @param {Function} dedupeLines from ../pure/dedupeLines.mjs.
 * @param {Function} joinLines from ../pure/dedupeLines.mjs.
 */
function renderResult(resultEl, rawLines, optionState, naming, dedupeLines, joinLines) {
  resultEl.innerHTML = '';

  const outcome = dedupeLines(rawLines, optionState);

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = outcome.duplicateCount > 0
    ? `${outcome.duplicateCount} duplicate${outcome.duplicateCount === 1 ? '' : 's'} removed — ${outcome.kept.length} of ${outcome.totalCount} lines kept`
    : `No duplicates found — all ${outcome.totalCount} lines kept`;
  head.appendChild(badge);

  const options = [
    { key: 'caseSensitive', invert: true, label: 'Ignore case' },
    { key: 'ignoreWhitespace', invert: false, label: 'Ignore surrounding whitespace' },
    { key: 'skipBlankLines', invert: false, label: 'Skip blank lines' },
  ];
  options.forEach((opt) => {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    // caseSensitive is stored inverted from its checkbox ("Ignore case"
    // checked == caseSensitive:false) so optionState's key names match
    // dedupeLines()'s own option names exactly, with no separate mapping
    // layer to keep in sync.
    checkbox.checked = opt.invert ? !optionState[opt.key] : optionState[opt.key];
    checkbox.addEventListener('change', () => {
      optionState[opt.key] = opt.invert ? !checkbox.checked : checkbox.checked;
      renderResult(resultEl, rawLines, optionState, naming, dedupeLines, joinLines);
    });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${opt.label}`));
    head.appendChild(label);
  });

  block.appendChild(head);

  if (outcome.kept.length) {
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
    outcome.kept.slice(0, PREVIEW_LIMIT).forEach((line) => {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.textContent = line;
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    tableEl.appendChild(tbody);
    scrollWrap.appendChild(tableEl);
    block.appendChild(scrollWrap);

    if (outcome.kept.length > PREVIEW_LIMIT) {
      const previewNote = document.createElement('p');
      previewNote.className = 'caption';
      previewNote.textContent = `Showing the first ${PREVIEW_LIMIT} of ${outcome.kept.length} kept lines. The download includes all of them.`;
      block.appendChild(previewNote);
    }
  } else {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'Every line was blank, so nothing is left to keep. Try a different file, or turn off “skip blank lines”.';
    block.appendChild(msg);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  downloadBtn.textContent = `Download ${naming.downloadName}`;
  downloadBtn.disabled = outcome.kept.length === 0;
  downloadBtn.addEventListener('click', () => {
    downloadBlob(textBlob(joinLines(outcome.kept), naming.mimeType), naming.downloadName);
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

  const [{ splitLines, dedupeLines, joinLines }] = await Promise.all([
    import('../pure/dedupeLines.mjs'),
  ]);

  const text = await file.text();
  const rawLines = splitLines(text);

  if (!rawLines.length) {
    resultEl.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That file or pasted text is empty — there’s nothing to deduplicate.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('Finished reading — no lines found.', 'error');
    return;
  }

  const optionState = { caseSensitive: true, ignoreWhitespace: false, skipBlankLines: false };
  const naming = outputNaming(file.name);
  renderResult(resultEl, rawLines, optionState, naming, dedupeLines, joinLines);

  const outcome = dedupeLines(rawLines, optionState);
  setState('done');
  setStatus(
    outcome.duplicateCount > 0
      ? `Found ${outcome.duplicateCount} duplicate${outcome.duplicateCount === 1 ? '' : 's'}. Review below, then download.`
      : 'No duplicates found. Review below, then download.',
    'success'
  );
}

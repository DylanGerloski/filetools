// Word-frequency-counter processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="wordFrequency") on
// first file selection/paste-convert click, or warmed on pointerenter/
// focus -- same lazy-load reasoning as ./sortLines.client.js. This tool
// has two input paths that both land here as the same File shape: a .txt/
// .md file chosen/dropped through the normal drop zone, or text typed
// into the "paste text" text box (dropzone.client.js wraps the pasted
// text in a synthetic File before calling this module's run(), so this
// file never needs to know which path a given File came from).
//
// Unlike this site's file-format-conversion tools, this one is
// analysis-only: there is no source format to preserve, so the output is
// always the same shape (a ranked frequency table) regardless of whether
// the input was a .txt file or pasted prose. The tokenizing/counting
// logic lives in ../pure/wordFrequency.mjs so it stays unit-testable
// without a DOM; this file's job is only to (a) read the File's text,
// (b) render the options/stats/table UI, and (c) re-run the pure logic
// in place whenever a visitor changes an option.

const PREVIEW_LIMIT = 500;
const MAX_MIN_LENGTH = 30;

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

/** UTF-8 BOM prefix so Excel opens the downloaded CSV in the right
 *  encoding -- same convention every other CSV-producing tool on this
 *  site uses (e.g. ../browser/sortLines.client.js's textBlob). */
function csvBlob(csvText) {
  return new Blob(['﻿', csvText], { type: 'text/csv;charset=utf-8' });
}

/**
 * Renders the options row, stats badge, frequency table, and download
 * button. Re-invoked in place whenever a visitor flips an option -- same
 * pattern as ../browser/dedupeLines.client.js's renderResult.
 *
 * @param {HTMLElement} resultEl
 * @param {string} rawText the full input text, unfiltered.
 * @param {object} optionState { caseSensitive, minLength, excludeNumbers, excludeStopWords }.
 * @param {Function} computeWordFrequency from ../pure/wordFrequency.mjs.
 * @param {Function} frequencyToCsv from ../pure/wordFrequency.mjs.
 */
function renderResult(resultEl, rawText, optionState, computeWordFrequency, frequencyToCsv) {
  resultEl.innerHTML = '';

  const outcome = computeWordFrequency(rawText, optionState);

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = outcome.totalWords
    ? `${outcome.totalWords} word${outcome.totalWords === 1 ? '' : 's'} counted · ${outcome.uniqueWords} unique · avg ${outcome.averageLength.toFixed(1)} letters/word`
    : 'No words matched';
  head.appendChild(badge);

  const caseLabel = document.createElement('label');
  const caseCheckbox = document.createElement('input');
  caseCheckbox.type = 'checkbox';
  // caseSensitive is stored inverted from its checkbox ("Ignore case"
  // checked == caseSensitive:false), same convention
  // ../browser/dedupeLines.client.js's options array uses, so
  // optionState's key names match computeWordFrequency()'s own option
  // names exactly.
  caseCheckbox.checked = !optionState.caseSensitive;
  caseCheckbox.addEventListener('change', () => {
    optionState.caseSensitive = !caseCheckbox.checked;
    renderResult(resultEl, rawText, optionState, computeWordFrequency, frequencyToCsv);
  });
  caseLabel.appendChild(caseCheckbox);
  caseLabel.appendChild(document.createTextNode(' Ignore case'));
  head.appendChild(caseLabel);

  const stopLabel = document.createElement('label');
  const stopCheckbox = document.createElement('input');
  stopCheckbox.type = 'checkbox';
  stopCheckbox.checked = optionState.excludeStopWords;
  stopCheckbox.addEventListener('change', () => {
    optionState.excludeStopWords = stopCheckbox.checked;
    renderResult(resultEl, rawText, optionState, computeWordFrequency, frequencyToCsv);
  });
  stopLabel.appendChild(stopCheckbox);
  stopLabel.appendChild(document.createTextNode(' Exclude common words'));
  head.appendChild(stopLabel);

  const numLabel = document.createElement('label');
  const numCheckbox = document.createElement('input');
  numCheckbox.type = 'checkbox';
  numCheckbox.checked = optionState.excludeNumbers;
  numCheckbox.addEventListener('change', () => {
    optionState.excludeNumbers = numCheckbox.checked;
    renderResult(resultEl, rawText, optionState, computeWordFrequency, frequencyToCsv);
  });
  numLabel.appendChild(numCheckbox);
  numLabel.appendChild(document.createTextNode(' Exclude numbers'));
  head.appendChild(numLabel);

  const lenLabel = document.createElement('label');
  const lenInput = document.createElement('input');
  lenInput.type = 'number';
  lenInput.min = '1';
  lenInput.max = String(MAX_MIN_LENGTH);
  lenInput.step = '1';
  lenInput.value = String(optionState.minLength);
  lenInput.setAttribute('aria-label', 'Minimum word length');
  lenInput.addEventListener('change', () => {
    let next = Math.floor(Number(lenInput.value));
    if (!Number.isFinite(next) || next < 1) next = 1;
    if (next > MAX_MIN_LENGTH) next = MAX_MIN_LENGTH;
    optionState.minLength = next;
    renderResult(resultEl, rawText, optionState, computeWordFrequency, frequencyToCsv);
  });
  lenLabel.appendChild(document.createTextNode('Minimum word length '));
  lenLabel.appendChild(lenInput);
  head.appendChild(lenLabel);

  block.appendChild(head);

  if (outcome.rawWordCount > 0 && outcome.totalWords < outcome.rawWordCount) {
    const filterNote = document.createElement('p');
    filterNote.className = 'caption';
    filterNote.textContent = `${outcome.totalWords} of ${outcome.rawWordCount} words counted after filters.`;
    block.appendChild(filterNote);
  }

  if (outcome.entries.length) {
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'table-scroll';
    const tableEl = document.createElement('table');
    tableEl.className = 'extracted-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Rank', 'Word', 'Count', '% of total'].forEach((label) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    tableEl.appendChild(thead);

    const tbody = document.createElement('tbody');
    outcome.entries.slice(0, PREVIEW_LIMIT).forEach((entry, i) => {
      const tr = document.createElement('tr');
      const rankTd = document.createElement('td');
      rankTd.textContent = String(i + 1);
      const wordTd = document.createElement('td');
      wordTd.textContent = entry.word;
      const countTd = document.createElement('td');
      countTd.textContent = String(entry.count);
      const pctTd = document.createElement('td');
      pctTd.textContent = `${entry.percent.toFixed(1)}%`;
      tr.append(rankTd, wordTd, countTd, pctTd);
      tbody.appendChild(tr);
    });
    tableEl.appendChild(tbody);
    scrollWrap.appendChild(tableEl);
    block.appendChild(scrollWrap);

    if (outcome.entries.length > PREVIEW_LIMIT) {
      const previewNote = document.createElement('p');
      previewNote.className = 'caption';
      previewNote.textContent = `Showing the top ${PREVIEW_LIMIT} of ${outcome.entries.length} distinct words. The download includes all of them.`;
      block.appendChild(previewNote);
    }
  } else {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'Nothing matched your filters - lower the minimum word length, or turn off "exclude common words".';
    block.appendChild(msg);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  downloadBtn.textContent = 'Download word-frequency.csv';
  downloadBtn.disabled = outcome.entries.length === 0;
  downloadBtn.addEventListener('click', () => {
    downloadBlob(csvBlob(frequencyToCsv(outcome.entries)), 'word-frequency.csv');
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
  setStatus('Reading that text on this device…');

  const [{ computeWordFrequency, frequencyToCsv }] = await Promise.all([
    import('../pure/wordFrequency.mjs'),
  ]);

  const text = await file.text();

  if (!text.trim()) {
    resultEl.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That’s empty - paste or drop some text first.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('That’s empty - paste or drop some text first.', 'error');
    return;
  }

  const optionState = {
    caseSensitive: false,
    minLength: 1,
    excludeNumbers: false,
    excludeStopWords: false,
  };
  renderResult(resultEl, text, optionState, computeWordFrequency, frequencyToCsv);

  const outcome = computeWordFrequency(text, optionState);
  setState('done');
  setStatus(
    outcome.totalWords
      ? `Counted ${outcome.totalWords} word${outcome.totalWords === 1 ? '' : 's'}, ${outcome.uniqueWords} unique. Review below, then download.`
      : 'Finished reading - no words found.',
    outcome.totalWords ? 'success' : 'error'
  );
}

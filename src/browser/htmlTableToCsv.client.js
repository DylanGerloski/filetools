// HTML-table-to-CSV/JSON processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="htmlTableToCsv") on
// first file selection/paste-convert click, or warmed on pointerenter/
// focus -- same lazy-load reasoning as ./pdfPages.client.js. This tool has
// two input paths that both land here as the same File shape: an .html
// file chosen/dropped through the normal drop zone, or markup typed into
// the "paste HTML markup" text box (dropzone.client.js wraps the pasted
// text in a synthetic File before calling this module's run(), so this
// file never needs to know which path a given File came from).
//
// Parsing uses the browser's own DOMParser rather than a hand-rolled HTML
// tokenizer -- far more robust against the real world's malformed/quirky
// markup (unclosed tags, implied <tbody>, HTML entities, comments) than
// anything reasonable to hand-write here. The script-execution half of
// this is safe for untrusted input: a document built by `new
// DOMParser().parseFromString(html, 'text/html')` has no browsing context,
// so any <script> in it is parsed but never executed
// (https://html.spec.whatwg.org/#dom-domparser-parsefromstring --
// "scripting is disabled"), and the parsed document is never attached to
// (or its nodes inserted into) this page's own live DOM.
//
// The resource-loading half is more nuanced: MDN documents that a
// DOMParser-parsed document "can download resources specified in <iframe>
// and <img> elements" even while detached, and engine behavior here has
// differed historically. Empirically, current Chromium does not fetch
// those resources for a document that's never inserted into the live DOM
// (see test/htmlTableToCsv.security.e2e.test.mjs, which pointed a full set
// of resource-bearing elements at a logging server and recorded zero
// requests) -- but stripDangerousElements() below removes
// img/iframe/embed/object/video/audio/source/track/link/svg from the
// parsed document before anything else touches it anyway, as defense in
// depth against other engines or future engine changes, and because this
// tool's entire pitch is "your file never leaves your device": an
// unstripped <img src> leaking the visitor's IP/user-agent to an
// attacker-chosen host would make that claim false regardless of whether
// script execution is also blocked.
//
// The actual colspan/rowspan-to-rectangular-grid math is pure and lives in
// ../pure/htmlTableExtract.mjs so it stays unit-testable without a DOM;
// this file's job is only to (a) read parsed <table> elements into the
// plain-data cell shape that module expects and (b) render the preview and
// download UI.
//
// Any text pulled out of the markup (cell content) is untrusted visitor
// content and is only ever written via .textContent, never interpolated
// into an HTML string -- same rule every other tool here follows.

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

/** UTF-8 BOM prefix so Excel opens accented/CSV text in the right encoding -- the single most commonly missed detail in CSV exporters. */
function csvBlob(csvText) {
  return new Blob(['﻿', csvText], { type: 'text/csv;charset=utf-8' });
}

function jsonBlob(records) {
  return new Blob([JSON.stringify(records, null, 2)], { type: 'application/json;charset=utf-8' });
}

/**
 * Every element type MDN documents (or has historically been observed) as
 * able to trigger a resource fetch from a detached/inert document -- see
 * this file's header comment. Removed from the parsed document before
 * anything else touches it, regardless of the empirical Chromium result
 * recorded in the header comment and test/htmlTableToCsv.security.e2e.test.mjs,
 * as defense in depth.
 */
const DANGEROUS_SELECTOR = 'img, iframe, embed, object, video, audio, source, track, link, svg';

/** @param {Document} doc a DOMParser-parsed, still-detached document */
function stripDangerousElements(doc) {
  doc.querySelectorAll(DANGEROUS_SELECTOR).forEach((el) => el.remove());
}

/**
 * A cell's visible text, with any nested table's own text excluded (so a
 * table-inside-a-cell doesn't bleed its rows into the outer table's cell
 * text) and each <br> turned into a space so multi-line cell content
 * doesn't run together into one word.
 */
function cellText(cell) {
  const clone = cell.cloneNode(true);
  clone.querySelectorAll('table').forEach((t) => t.remove());
  clone.querySelectorAll('br').forEach((br) => br.replaceWith(document.createTextNode(' ')));
  return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {HTMLTableElement} tableEl
 * @returns {Array<Array<{text:string,colSpan:number,rowSpan:number,isHeader:boolean}>>}
 *   one array per row from tableEl.rows -- which, per the HTML spec, already
 *   excludes rows belonging to a table nested inside one of this table's
 *   cells, so nesting doesn't need to be handled by hand here.
 */
function cellRowsForTable(tableEl) {
  return Array.from(tableEl.rows).map((tr) =>
    Array.from(tr.cells).map((cell) => ({
      text: cellText(cell),
      colSpan: cell.colSpan || 1,
      rowSpan: cell.rowSpan || 1,
      isHeader: cell.tagName === 'TH',
    }))
  );
}

/**
 * Renders one table's DOM block: the read-only preview table, a "first row
 * is a header" toggle, a per-row drop control, and CSV/JSON download
 * buttons. Re-invoked in place whenever the visitor edits anything.
 *
 * @param {HTMLElement} container
 * @param {object} tableState { grid, headerIsFirstRow, droppedRows: Set<number> }
 * @param {Function} rowsToCsv from ../pure/csv.mjs.
 * @param {Function} rowsToJsonRecords from ../pure/htmlTableExtract.mjs.
 * @param {number} tableCount total tables found in the document.
 * @param {number} tableIndex zero-based index of this table among all.
 */
function renderTableBlock(container, tableState, rowsToCsv, rowsToJsonRecords, tableCount, tableIndex) {
  container.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = tableCount > 1 ? `Table ${tableIndex + 1} of ${tableCount}` : 'Table';
  head.appendChild(badge);

  const headerLabel = document.createElement('label');
  const headerToggle = document.createElement('input');
  headerToggle.type = 'checkbox';
  headerToggle.checked = tableState.headerIsFirstRow;
  headerToggle.addEventListener('change', () => {
    tableState.headerIsFirstRow = headerToggle.checked;
    renderTableBlock(container, tableState, rowsToCsv, rowsToJsonRecords, tableCount, tableIndex);
  });
  headerLabel.appendChild(headerToggle);
  headerLabel.appendChild(document.createTextNode(' First row is a header'));
  head.appendChild(headerLabel);

  container.appendChild(head);

  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'table-scroll';
  const tableEl = document.createElement('table');
  tableEl.className = 'extracted-table';

  const visibleIndices = tableState.grid.map((_, i) => i).filter((i) => !tableState.droppedRows.has(i));
  const headerRowIdx = tableState.headerIsFirstRow ? visibleIndices[0] : null;

  if (headerRowIdx !== undefined && headerRowIdx !== null) {
    // Deliberately no extra <th> reserved for the row-action column -- see
    // ../pure/tableExtract.mjs's sibling comment in pdfTables.client.js for
    // why a visually-hidden header label doesn't reliably clip here.
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    tableState.grid[headerRowIdx].forEach((cellValue) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = cellValue;
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    tableEl.appendChild(thead);
  }

  const tbody = document.createElement('tbody');
  visibleIndices
    .filter((i) => i !== headerRowIdx)
    .forEach((rowIndex) => {
      const tr = document.createElement('tr');
      tableState.grid[rowIndex].forEach((cellValue) => {
        const td = document.createElement('td');
        td.textContent = cellValue;
        tr.appendChild(td);
      });
      const actionTd = document.createElement('td');
      actionTd.className = 'row-action-cell';
      const dropBtn = document.createElement('button');
      dropBtn.type = 'button';
      dropBtn.className = 'btn-icon row-drop';
      dropBtn.setAttribute('aria-label', 'Remove this row from the table');
      dropBtn.textContent = '×';
      dropBtn.addEventListener('click', () => {
        tableState.droppedRows.add(rowIndex);
        renderTableBlock(container, tableState, rowsToCsv, rowsToJsonRecords, tableCount, tableIndex);
      });
      actionTd.appendChild(dropBtn);
      tr.appendChild(actionTd);
      tbody.appendChild(tr);
    });
  tableEl.appendChild(tbody);
  scrollWrap.appendChild(tableEl);
  container.appendChild(scrollWrap);

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';

  const csvBtn = document.createElement('button');
  csvBtn.type = 'button';
  csvBtn.className = 'btn-secondary';
  csvBtn.textContent = `Download CSV (table ${tableIndex + 1})`;
  csvBtn.addEventListener('click', () => {
    const visibleRows = visibleIndices.map((i) => tableState.grid[i]);
    downloadBlob(csvBlob(rowsToCsv(visibleRows)), `table-${tableIndex + 1}.csv`);
  });
  btnRow.appendChild(csvBtn);

  const jsonBtn = document.createElement('button');
  jsonBtn.type = 'button';
  jsonBtn.className = 'btn-secondary';
  jsonBtn.textContent = `Download JSON (table ${tableIndex + 1})`;
  jsonBtn.addEventListener('click', () => {
    const visibleRows = visibleIndices.map((i) => tableState.grid[i]);
    const records = rowsToJsonRecords(visibleRows, tableState.headerIsFirstRow);
    downloadBlob(jsonBlob(records), `table-${tableIndex + 1}.json`);
  });
  btnRow.appendChild(jsonBtn);

  container.appendChild(btnRow);
}

/**
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  const file = files[0];
  setState('working');
  setStatus('Reading that markup on this device…');

  const [{ rowsToCsv }, { normalizeTableRows, rowsToJsonRecords }] = await Promise.all([
    import('../pure/csv.mjs'),
    import('../pure/htmlTableExtract.mjs'),
  ]);

  const text = await file.text();

  let doc;
  try {
    doc = new DOMParser().parseFromString(text, 'text/html');
  } catch (err) {
    setState('error');
    setStatus('That doesn’t look like readable HTML markup.', 'error');
    return;
  }
  // Before any other work touches the parsed document: strip
  // resource-bearing elements, defense in depth against a detached
  // document's <img>/<iframe>/etc leaking a request off-device -- see the
  // header comment above.
  stripDangerousElements(doc);

  const tableEls = Array.from(doc.querySelectorAll('table'));

  resultEl.innerHTML = '';

  if (!tableEls.length) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'No <table> element was found in that markup. Paste the markup that includes the <table>...</table> tags, or choose a different .html file.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('Finished reading — no table found.', 'error');
    return;
  }

  const tableStates = tableEls.map((tableEl) => {
    const cellRows = cellRowsForTable(tableEl);
    const { grid, headerRowCount } = normalizeTableRows(cellRows);
    return { grid, headerIsFirstRow: headerRowCount > 0, droppedRows: new Set() };
  });

  if (tableStates.length > 1) {
    const allRow = document.createElement('div');
    allRow.className = 'download-btn-row';

    const allCsvBtn = document.createElement('button');
    allCsvBtn.type = 'button';
    allCsvBtn.className = 'btn-primary';
    allCsvBtn.textContent = `Download all ${tableStates.length} tables (CSV)`;
    allCsvBtn.addEventListener('click', () => {
      tableStates.forEach((ts, i) => {
        const visibleRows = ts.grid.filter((_, idx) => !ts.droppedRows.has(idx));
        downloadBlob(csvBlob(rowsToCsv(visibleRows)), `table-${i + 1}.csv`);
      });
    });
    allRow.appendChild(allCsvBtn);

    const allJsonBtn = document.createElement('button');
    allJsonBtn.type = 'button';
    allJsonBtn.className = 'btn-primary';
    allJsonBtn.textContent = `Download all ${tableStates.length} tables (JSON)`;
    allJsonBtn.addEventListener('click', () => {
      tableStates.forEach((ts, i) => {
        const visibleRows = ts.grid.filter((_, idx) => !ts.droppedRows.has(idx));
        const records = rowsToJsonRecords(visibleRows, ts.headerIsFirstRow);
        downloadBlob(jsonBlob(records), `table-${i + 1}.json`);
      });
    });
    allRow.appendChild(allJsonBtn);

    resultEl.appendChild(allRow);
  }

  tableStates.forEach((ts, i) => {
    const block = document.createElement('div');
    block.className = 'table-block';
    resultEl.appendChild(block);
    renderTableBlock(block, ts, rowsToCsv, rowsToJsonRecords, tableStates.length, i);
  });

  const supportNote = document.createElement('p');
  supportNote.className = 'support-note';
  supportNote.innerHTML = 'That ran entirely on your machine, with no server and no hosting cost on my end. If it saved you time, you can buy me a coffee: '
    + '<a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>'
    + ' &middot; '
    + '<a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>.';
  resultEl.appendChild(supportNote);

  resultEl.hidden = false;
  setState('done');
  setStatus(`Found ${tableStates.length} table${tableStates.length === 1 ? '' : 's'}. Review below, then download.`, 'success');
}

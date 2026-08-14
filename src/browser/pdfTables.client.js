// PDF-tables-to-CSV processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="pdfTables") on first
// file selection or warmed on pointerenter/focus -- never on page load, for
// the same Lighthouse-payload reason documented in ./pdfPages.client.js.
//
// pdf.js (Apache-2.0) is self-hosted from this same origin (vendor/, copied
// from node_modules at build time by scripts/copy-vendor.js) -- never a
// CDN, for the same "turn off your Wi-Fi" reason as every other tool here.
// The actual table-detection heuristics (row clustering, column-boundary
// detection, cell assembly) live in ../pure/tableExtract.mjs so they stay
// unit-testable without a browser; this file's job is only to (a) read
// pdf.js's per-page text positions into the plain-data shape that module
// expects, and (b) render the correctable preview and CSV export UI.
//
// Any text pulled out of the PDF (table cell content) is untrusted visitor
// content and is only ever written via .textContent, never interpolated
// into an HTML string -- the drop zone accepts arbitrary files, so a PDF
// crafted to contain HTML-looking text must never be able to inject markup.

const PdfJsPromise = import('../vendor/pdfjs-dist/pdf.min.mjs').then((pdfjs) => {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs-dist/pdf.worker.min.mjs', import.meta.url).href;
  return pdfjs;
});

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

/**
 * Converts one pdf.js page's getTextContent() items (bottom-up PDF
 * coordinates) into the plain top-down {str,x,y,width,height,fontName}
 * shape ../pure/tableExtract.mjs expects.
 */
function pageItemsTopDown(textContent, viewport) {
  return textContent.items
    .filter((it) => typeof it.str === 'string' && it.str.length)
    .map((it) => {
      const x = it.transform[4];
      const yBaseline = it.transform[5];
      const height = it.height || Math.hypot(it.transform[2], it.transform[3]) || 10;
      const width = it.width || 0;
      return { str: it.str, x, y: viewport.height - yBaseline - height, width, height, fontName: it.fontName };
    });
}

/**
 * A page with very little text AND at least one embedded image is almost
 * certainly a scan -- there is real text-bearing content to point to
 * instead of guessing. Never emits a garbage CSV for this case; see the
 * OUTPUT/HONEST FAILURE rules this mirrors.
 */
async function pageLooksLikeScan(page, pdfjs, textItemCount) {
  if (textItemCount >= 20) return false;
  try {
    const opList = await page.getOperatorList();
    const imageOps = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintJpegXObject, pdfjs.OPS.paintImageMaskXObject]);
    return opList.fnArray.some((fn) => imageOps.has(fn));
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<Array<{pageNum:number, scan:boolean, rows: object[], tables: object[]}>>}
 *   one entry per page; `rows` is that page's full clustered-row list
 *   (needed afterwards so a boundary edit can re-run cell assembly without
 *   re-clustering), `tables` is extractTables()'s table list for that page.
 */
async function extractFromDocument(pdfJsDoc, pdfjs) {
  const { extractTables } = await import('../pure/tableExtract.mjs');
  const results = [];
  for (let pageNum = 1; pageNum <= pdfJsDoc.numPages; pageNum += 1) {
    // eslint-disable-next-line no-await-in-loop -- pages must be read in
    // order so the status label stays meaningful and the tab stays
    // responsive on large documents (same reasoning as
    // ./pdfPages.client.js's thumbnail loop).
    const page = await pdfJsDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items = pageItemsTopDown(textContent, viewport);
    const scan = await pageLooksLikeScan(page, pdfjs, items.length);
    const { rows, tables } = extractTables(items);
    results.push({ pageNum, scan, rows, tables });
  }
  return results;
}

function isNumericCell(cell) {
  return /^[\s]*[-+]?[$€£]?[\d,]+(\.\d+)?%?[\s]*$/.test(String(cell || '').trim());
}

let tableIdCounter = 0;

/**
 * Builds the mutable, UI-facing state for one detected table -- kept
 * separate from the underlying row items so a boundary edit or a
 * "drop row" click only re-runs cell assembly (cellsForRow), never the
 * row-clustering or table-boundary detection steps.
 */
function makeTableState(pageNum, pageRows, table) {
  tableIdCounter += 1;
  return {
    id: `t${tableIdCounter}`,
    pageNum,
    rowItemsList: pageRows.slice(table.startIndex, table.endIndex + 1).map((r) => r.items),
    boundaries: table.columnBoundaries.slice(),
    headerIsFirstRow: table.headerRowIndex === 0,
    droppedRows: new Set(),
  };
}

function computeCells(tableState, cellsForRow) {
  return tableState.rowItemsList.map((items) => cellsForRow(items, tableState.boundaries));
}

function visibleCsvRows(tableState, cellsForRow) {
  const all = computeCells(tableState, cellsForRow);
  return all.filter((_, i) => !tableState.droppedRows.has(i));
}

/**
 * Renders one table's DOM block: the correctable HTML table, the header
 * toggle, the column-boundary numeric-input editor (the spec's stated
 * fallback for a draggable ruler -- also the more directly keyboard- and
 * screen-reader-accessible of the two), per-row drop controls, and a
 * per-table CSV download button. Re-invoked in place whenever the visitor
 * edits anything, so it always reflects current state.
 *
 * @param {HTMLElement} container
 * @param {object} tableState see makeTableState.
 * @param {Function} cellsForRow from ../pure/tableExtract.mjs.
 * @param {Function} rowsToCsv from ../pure/csv.mjs.
 * @param {number} tableCount total tables in the document (for the
 *   "Table N of M" label).
 * @param {number} tableIndex zero-based index of this table among all.
 */
function renderTableBlock(container, tableState, cellsForRow, rowsToCsv, tableCount, tableIndex) {
  container.innerHTML = '';
  const cells = computeCells(tableState, cellsForRow);

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = tableCount > 1 ? `Page ${tableState.pageNum} · Table ${tableIndex + 1} of ${tableCount}` : `Page ${tableState.pageNum}`;
  head.appendChild(badge);

  const headerLabel = document.createElement('label');
  const headerToggle = document.createElement('input');
  headerToggle.type = 'checkbox';
  headerToggle.checked = tableState.headerIsFirstRow;
  headerToggle.addEventListener('change', () => {
    tableState.headerIsFirstRow = headerToggle.checked;
    renderTableBlock(container, tableState, cellsForRow, rowsToCsv, tableCount, tableIndex);
  });
  headerLabel.appendChild(headerToggle);
  headerLabel.appendChild(document.createTextNode(' First row is a header'));
  head.appendChild(headerLabel);

  container.appendChild(head);

  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'table-scroll';
  const tableEl = document.createElement('table');
  tableEl.className = 'extracted-table';

  const visibleIndices = cells.map((_, i) => i).filter((i) => !tableState.droppedRows.has(i));
  const headerRowIdx = tableState.headerIsFirstRow ? visibleIndices[0] : null;

  if (headerRowIdx !== undefined && headerRowIdx !== null) {
    // Deliberately no extra <th> reserved for the row-action column: a
    // <th> with visually-hidden text does not reliably clip inside a
    // table-cell layout box across engines, and would otherwise render as
    // a genuinely visible stray "Row actions" header. The row-action
    // <td>'s own button carries its own aria-label instead, which is
    // sufficient without a matching header cell.
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    cells[headerRowIdx].forEach((cellText) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = cellText;
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
      cells[rowIndex].forEach((cellText) => {
        const td = document.createElement('td');
        td.className = 'tabular-nums';
        td.textContent = cellText;
        tr.appendChild(td);
      });
      const actionTd = document.createElement('td');
      actionTd.className = 'row-action-cell';
      const dropBtn = document.createElement('button');
      dropBtn.type = 'button';
      dropBtn.className = 'btn-icon row-drop';
      dropBtn.setAttribute('aria-label', `Remove this row from the table`);
      dropBtn.textContent = '×';
      dropBtn.addEventListener('click', () => {
        tableState.droppedRows.add(rowIndex);
        renderTableBlock(container, tableState, cellsForRow, rowsToCsv, tableCount, tableIndex);
      });
      actionTd.appendChild(dropBtn);
      tr.appendChild(actionTd);
      tbody.appendChild(tr);
    });
  tableEl.appendChild(tbody);
  scrollWrap.appendChild(tableEl);
  container.appendChild(scrollWrap);

  // Column-boundary editor -- numeric inputs (points from the page's left
  // edge), the spec's explicitly acceptable fallback for a draggable ruler.
  const editor = document.createElement('div');
  editor.className = 'boundary-editor';
  const editorLabel = document.createElement('p');
  editorLabel.className = 'caption';
  editorLabel.textContent = 'Column boundaries — add, remove, or adjust if a column looks wrong:';
  editor.appendChild(editorLabel);

  const list = document.createElement('div');
  list.className = 'boundary-list';
  tableState.boundaries.forEach((b, i) => {
    const item = document.createElement('span');
    item.className = 'boundary-item';
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '1';
    input.value = Math.round(b);
    input.setAttribute('aria-label', `Column boundary ${i + 1} position in points`);
    input.addEventListener('change', () => {
      const val = Number(input.value);
      if (Number.isFinite(val)) {
        tableState.boundaries[i] = val;
        tableState.boundaries.sort((a, b2) => a - b2);
      }
      renderTableBlock(container, tableState, cellsForRow, rowsToCsv, tableCount, tableIndex);
    });
    item.appendChild(input);
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-icon';
    removeBtn.setAttribute('aria-label', `Remove column boundary ${i + 1}`);
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      tableState.boundaries.splice(i, 1);
      renderTableBlock(container, tableState, cellsForRow, rowsToCsv, tableCount, tableIndex);
    });
    item.appendChild(removeBtn);
    list.appendChild(item);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-icon add-boundary';
  addBtn.setAttribute('aria-label', 'Add a column boundary');
  addBtn.textContent = '+';
  addBtn.addEventListener('click', () => {
    const allItems = tableState.rowItemsList.flat();
    const maxX = allItems.length ? Math.max(...allItems.map((it) => it.x + it.width)) : 100;
    const minX = allItems.length ? Math.min(...allItems.map((it) => it.x)) : 0;
    tableState.boundaries.push((minX + maxX) / 2);
    tableState.boundaries.sort((a, b) => a - b);
    renderTableBlock(container, tableState, cellsForRow, rowsToCsv, tableCount, tableIndex);
  });
  list.appendChild(addBtn);
  editor.appendChild(list);
  container.appendChild(editor);

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-secondary';
  downloadBtn.textContent = `Download CSV (page ${tableState.pageNum})`;
  downloadBtn.addEventListener('click', () => {
    const csvRows = visibleCsvRows(tableState, cellsForRow);
    downloadBlob(csvBlob(rowsToCsv(csvRows)), `table-page-${tableState.pageNum}-${tableIndex + 1}.csv`);
  });
  container.appendChild(downloadBtn);
}

/**
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  const file = files[0];
  setState('working');
  setStatus('Reading your file on this device…');

  const [pdfjs, { cellsForRow }, { rowsToCsv }] = await Promise.all([
    PdfJsPromise,
    import('../pure/tableExtract.mjs'),
    import('../pure/csv.mjs'),
  ]);

  const bytes = await file.arrayBuffer();
  let pdfJsDoc;
  try {
    pdfJsDoc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
  } catch (err) {
    setState('error');
    if (err && String(err.name).toLowerCase().includes('password')) {
      setStatus(`"${file.name}" is password-protected. Remove the password and try again.`, 'error');
    } else {
      setStatus(`"${file.name}" doesn’t look like a valid PDF.`, 'error');
    }
    return;
  }

  setStatus(`Reading ${pdfJsDoc.numPages} page${pdfJsDoc.numPages === 1 ? '' : 's'} on this device…`);

  let pageResults;
  try {
    pageResults = await extractFromDocument(pdfJsDoc, pdfjs);
  } catch (err) {
    setState('error');
    setStatus(err && err.message ? err.message : 'Could not read tables from that file.', 'error');
    return;
  }

  const tableStates = [];
  pageResults.forEach((pr) => {
    pr.tables.forEach((table) => {
      tableStates.push(makeTableState(pr.pageNum, pr.rows, table));
    });
  });

  resultEl.innerHTML = '';

  if (!tableStates.length) {
    const anyScan = pageResults.some((pr) => pr.scan);
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = anyScan
      ? 'This PDF looks like a scanned image — there is no text to extract. This tool does not do OCR.'
      : 'No tables were found in this PDF. This tool looks for at least three rows of consistently aligned columns, so a document without that layout won’t produce a table here.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('Finished reading — no tables found.', 'error');
    return;
  }

  if (tableStates.length > 1) {
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'btn-primary';
    allBtn.textContent = `Download all ${tableStates.length} tables`;
    allBtn.addEventListener('click', () => {
      tableStates.forEach((ts, i) => {
        const csvRows = visibleCsvRows(ts, cellsForRow);
        downloadBlob(csvBlob(rowsToCsv(csvRows)), `table-page-${ts.pageNum}-${i + 1}.csv`);
      });
    });
    resultEl.appendChild(allBtn);
  }

  tableStates.forEach((ts, i) => {
    const block = document.createElement('div');
    block.className = 'table-block';
    resultEl.appendChild(block);
    renderTableBlock(block, ts, cellsForRow, rowsToCsv, tableStates.length, i);
  });

  const scanPages = pageResults.filter((pr) => pr.scan).map((pr) => pr.pageNum);
  if (scanPages.length) {
    const note = document.createElement('p');
    note.className = 'caption';
    note.textContent = `Page${scanPages.length > 1 ? 's' : ''} ${scanPages.join(', ')} looked like scanned image${scanPages.length > 1 ? 's' : ''} and had no text to read, so ${scanPages.length > 1 ? 'they were' : 'it was'} skipped.`;
    resultEl.appendChild(note);
  }

  const supportNote = document.createElement('p');
  supportNote.className = 'support-note';
  supportNote.innerHTML = 'That ran entirely on your machine — no servers, no cost to run. If it saved you time, you can buy me a coffee: '
    + '<a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>'
    + ' &middot; '
    + '<a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>.';
  resultEl.appendChild(supportNote);

  resultEl.hidden = false;
  setState('done');
  setStatus(`Found ${tableStates.length} table${tableStates.length === 1 ? '' : 's'}. Review below, then download.`, 'success');
}

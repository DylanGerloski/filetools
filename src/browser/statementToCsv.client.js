// Bank/card statement PDF -> CSV processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="statementToCsv") on
// first file selection or warmed on pointerenter/focus -- never on page
// load, for the same Lighthouse-payload reason documented in
// ./pdfPages.client.js.
//
// This tool reuses the exact same whitespace-alignment table detector as
// the general PDF-tables-to-CSV tool (../pure/tableExtract.mjs) -- a bank
// or card statement's transaction table is, structurally, just a table.
// The one thing this tool adds on top is ../pure/statementMerge.mjs:
// statements routinely span several pages with the transaction table's
// header repeated on each one, and a visitor wants one combined CSV, not
// one file per page. Everything below is glue: read pdf.js's per-page text
// positions into the plain-data shape tableExtract.mjs expects, merge the
// per-page tables with statementMerge.mjs, and render a single reviewable
// preview + one download button.
//
// pdf.js (Apache-2.0) is self-hosted from this same origin (vendor/,
// copied from node_modules at build time by scripts/copy-vendor.js) --
// never a CDN, for the same "turn off your Wi-Fi" reason as every other
// tool here.
//
// Any text pulled out of the PDF (transaction descriptions, etc.) is
// untrusted visitor content and is only ever written via .textContent,
// never interpolated into an HTML string -- the drop zone accepts
// arbitrary files, so a PDF crafted to contain HTML-looking text must
// never be able to inject markup.

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
 * shape ../pure/tableExtract.mjs expects. Identical to
 * ../pure/pdfTables.client.js's helper of the same name -- kept as a
 * small, independent copy rather than a shared import, matching this
 * codebase's existing pattern of each tool's browser module owning its own
 * pdf.js-adapter glue (see pdfPages.client.js vs pdfTables.client.js).
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
 * instead of guessing. Never emits a garbage CSV for this case.
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
 * @returns {Promise<{ pageTables: Array<{pageNum:number, rows:string[][], headerRowIndex:number|null}>, scanPages: number[] }>}
 *   pageTables is one entry per detected table across the whole document
 *   (a page may contribute zero, one, or more), in document order --
 *   already in the shape ../pure/statementMerge.mjs expects. scanPages is
 *   every page number that looked like a scanned image with no text layer.
 */
async function extractFromDocument(pdfJsDoc, pdfjs) {
  const { extractTables } = await import('../pure/tableExtract.mjs');
  const pageTables = [];
  const scanPages = [];
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
    if (scan) scanPages.push(pageNum);
    const { tables } = extractTables(items);
    tables.forEach((table) => {
      pageTables.push({ pageNum, rows: table.rows, headerRowIndex: table.headerRowIndex });
    });
  }
  return { pageTables, scanPages };
}

/**
 * Renders one read-only table (the merged main table, or one of the
 * "other tables" that didn't match its shape) with a per-row remove
 * control and returns a live accessor for the currently-visible rows --
 * this tool doesn't offer the general tool's column-boundary editor, since
 * a merged table's rows no longer map to any single page's coordinate
 * space; a mis-split column is instead fixable by dropping the affected
 * row and noting it, same as any other correction here.
 *
 * @param {HTMLElement} container
 * @param {string[]|null} headerRow
 * @param {string[][]} rows
 * @param {Function} onChange called (nothing passed) whenever a row is dropped.
 * @returns {{ getVisibleRows: () => string[][], droppedCount: () => number }}
 */
function renderReviewTable(container, headerRow, rows, onChange) {
  const dropped = new Set();

  function render() {
    container.innerHTML = '';
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'table-scroll';
    const tableEl = document.createElement('table');
    tableEl.className = 'extracted-table';

    if (headerRow) {
      const thead = document.createElement('thead');
      const tr = document.createElement('tr');
      headerRow.forEach((cellText) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = cellText;
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      tableEl.appendChild(thead);
    }

    const tbody = document.createElement('tbody');
    rows.forEach((row, rowIndex) => {
      if (dropped.has(rowIndex)) return;
      const tr = document.createElement('tr');
      row.forEach((cellText) => {
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
      dropBtn.setAttribute('aria-label', 'Remove this row from the table');
      dropBtn.textContent = '×';
      dropBtn.addEventListener('click', () => {
        dropped.add(rowIndex);
        render();
        onChange();
      });
      actionTd.appendChild(dropBtn);
      tr.appendChild(actionTd);
      tbody.appendChild(tr);
    });
    tableEl.appendChild(tbody);
    scrollWrap.appendChild(tableEl);
    container.appendChild(scrollWrap);
  }

  render();

  return {
    getVisibleRows: () => rows.filter((_, i) => !dropped.has(i)),
    droppedCount: () => dropped.size,
  };
}

function statementFilename(sourceName) {
  const base = String(sourceName || 'statement').replace(/\.pdf$/i, '');
  return `${base || 'statement'}.csv`;
}

/**
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  const file = files[0];
  setState('working');
  setStatus('Reading your statement on this device…');

  const [pdfjs, { rowsToCsv }, { mergeStatementTables }] = await Promise.all([
    PdfJsPromise,
    import('../pure/csv.mjs'),
    import('../pure/statementMerge.mjs'),
  ]);

  const bytes = await file.arrayBuffer();
  let pdfJsDoc;
  try {
    pdfJsDoc = await pdfjs.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
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

  let pageTables;
  let scanPages;
  try {
    ({ pageTables, scanPages } = await extractFromDocument(pdfJsDoc, pdfjs));
  } catch (err) {
    setState('error');
    setStatus(err && err.message ? err.message : 'Could not read a transaction table from that file.', 'error');
    return;
  }

  const { mainTable, otherTables } = mergeStatementTables(pageTables);

  resultEl.innerHTML = '';

  if (!mainTable) {
    const anyScan = scanPages.length > 0;
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = anyScan
      ? 'This statement looks like a scanned image — there is no text to extract. This tool does not do OCR, and cannot read a statement that has no real text layer.'
      : 'No transaction table was found in this PDF. This tool looks for at least three rows of consistently aligned columns (the shape a statement’s transaction table normally has), so a document without that layout won’t produce a table here.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('Finished reading — no transaction table found.', 'error');
    return;
  }

  const summary = document.createElement('p');
  summary.className = 'caption';
  summary.textContent = mainTable.sourcePages.length > 1
    ? `Combined ${mainTable.rows.length} row${mainTable.rows.length === 1 ? '' : 's'} from ${mainTable.sourcePages.length} pages (${mainTable.sourcePages.join(', ')}) into one table below. A repeated header row on each page was detected and removed automatically.`
    : `Found ${mainTable.rows.length} row${mainTable.rows.length === 1 ? '' : 's'} on page ${mainTable.sourcePages[0]}.`;
  resultEl.appendChild(summary);

  const mainBlock = document.createElement('div');
  mainBlock.className = 'table-block';
  resultEl.appendChild(mainBlock);

  const reviewTableEl = document.createElement('div');
  mainBlock.appendChild(reviewTableEl);

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  downloadBtn.textContent = 'Download CSV';

  const review = renderReviewTable(reviewTableEl, mainTable.headerRow, mainTable.rows, () => {});
  downloadBtn.addEventListener('click', () => {
    const visibleRows = review.getVisibleRows();
    const csvRows = mainTable.headerRow ? [mainTable.headerRow, ...visibleRows] : visibleRows;
    downloadBlob(csvBlob(rowsToCsv(csvRows)), statementFilename(file.name));
  });
  mainBlock.appendChild(downloadBtn);

  if (otherTables.length) {
    const note = document.createElement('p');
    note.className = 'caption';
    note.textContent = `${otherTables.length} other table${otherTables.length === 1 ? '' : 's'} on the page${otherTables.length === 1 ? '' : 's'} didn’t match the main transaction table’s column layout (for example, an account summary box), so ${otherTables.length === 1 ? 'it is' : 'they are'} shown separately below rather than merged in.`;
    resultEl.appendChild(note);

    otherTables.forEach((table, i) => {
      const block = document.createElement('div');
      block.className = 'table-block';
      const head = document.createElement('div');
      head.className = 'table-block-head';
      const badge = document.createElement('span');
      badge.className = 'page-badge';
      badge.textContent = `Page ${table.pageNum}`;
      head.appendChild(badge);
      block.appendChild(head);

      const otherReviewEl = document.createElement('div');
      block.appendChild(otherReviewEl);
      const headerRow = table.headerRowIndex !== null && table.headerRowIndex !== undefined ? table.rows[table.headerRowIndex] : null;
      const bodyRows = headerRow ? table.rows.filter((_, idx) => idx !== table.headerRowIndex) : table.rows;
      const otherReview = renderReviewTable(otherReviewEl, headerRow, bodyRows, () => {});

      const otherDownloadBtn = document.createElement('button');
      otherDownloadBtn.type = 'button';
      otherDownloadBtn.className = 'btn-secondary';
      otherDownloadBtn.textContent = `Download CSV (page ${table.pageNum})`;
      otherDownloadBtn.addEventListener('click', () => {
        const visibleRows = otherReview.getVisibleRows();
        const csvRows = headerRow ? [headerRow, ...visibleRows] : visibleRows;
        downloadBlob(csvBlob(rowsToCsv(csvRows)), `statement-table-page-${table.pageNum}-${i + 1}.csv`);
      });
      block.appendChild(otherDownloadBtn);
      resultEl.appendChild(block);
    });
  }

  if (scanPages.length) {
    const note = document.createElement('p');
    note.className = 'caption';
    note.textContent = `Page${scanPages.length > 1 ? 's' : ''} ${scanPages.join(', ')} looked like scanned image${scanPages.length > 1 ? 's' : ''} and had no text to read, so ${scanPages.length > 1 ? 'they were' : 'it was'} skipped.`;
    resultEl.appendChild(note);
  }

  const supportNote = document.createElement('p');
  supportNote.className = 'support-note';
  supportNote.innerHTML = 'That ran entirely on your machine — no servers, no cost to run. Your statement was never sent anywhere. If it saved you time, you can buy me a coffee: '
    + '<a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>'
    + ' &middot; '
    + '<a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>.';
  resultEl.appendChild(supportNote);

  resultEl.hidden = false;
  setState('done');
  setStatus(`Found ${mainTable.rows.length} transaction row${mainTable.rows.length === 1 ? '' : 's'}. Review below, then download.`, 'success');
}

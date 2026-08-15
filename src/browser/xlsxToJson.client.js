// XLSX-to-JSON processor. Dynamically imported by ./dropzone.client.js
// (routed by #tool's data-client="xlsxToJson") on first file selection, or
// warmed on pointerenter/focus -- same lazy-load reasoning as
// ./pdfPages.client.js.
//
// ExcelJS (MIT, self-hosted from this same origin -- vendor/, copied from
// node_modules at build time by scripts/copy-vendor.js, never a CDN, same
// constraint pdfPages.client.js's header explains) does the actual XLSX
// parsing. Its own published browser bundle is a UMD/browserify build, not
// an ES module -- it has no `export` statement for import() to bind, only
// the side effect of setting `window.ExcelJS` once it runs. So unlike
// pdf-lib/pdf.js (both real ESM builds, loaded with plain import()), this
// file loads it as a classic <script> tag and waits for that to finish
// before touching the resulting global -- more code than one import(), but
// unambiguous about what's actually happening, rather than relying on the
// (technically-legal-but-easy-to-second-guess) trick of import()-ing a
// non-ESM file for its side effect alone.
//
// Every cell's raw exceljs value is normalized by the pure, unit-tested
// ../pure/xlsxExtract.mjs before it ever reaches JSON.stringify or the
// preview table -- see that file's header for exactly which cell shapes
// (formula, hyperlink, rich text, date, error) it handles.
//
// Hot-dependency note: a library that parses untrusted binary/document
// input gets extra scrutiny here -- exceljs is pinned to an exact version
// in package.json (no ^/~), npm audit is clean
// (a transitive `uuid` moderate CVE is pinned out via package.json's
// "overrides" -- exceljs only ever calls uuid's v4(), which that CVE does
// not affect), and vendor/exceljs/exceljs.min.js contains exactly one
// `new Function(...)` call -- the standard `setimmediate` browserify shim's
// fallback path for a *string* passed to setImmediate(), which nothing in
// exceljs or this file ever does. It is dead code given our usage, not a
// reachable dynamic-code path over untrusted spreadsheet content, and
// exceljs exposes no config flag (unlike pdf.js's isEvalSupported) to
// disable it explicitly.

let excelJsPromise = null;
function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!excelJsPromise) {
    excelJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../vendor/exceljs/exceljs.min.js', import.meta.url).href;
      script.onload = () => {
        if (window.ExcelJS) resolve(window.ExcelJS);
        else reject(new Error('The spreadsheet reader loaded but didn’t initialize correctly.'));
      };
      script.onerror = () => reject(new Error('The tool’s code hasn’t finished downloading yet — reconnect for a moment, then try again.'));
      document.head.appendChild(script);
    }).catch((err) => {
      excelJsPromise = null;
      throw err;
    });
  }
  return excelJsPromise;
}

const PREVIEW_ROW_CAP = 50;

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

function jsonBlob(data) {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
}

/** A worksheet name turned into a safe download filename fragment. */
function safeName(name) {
  return String(name).replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'sheet';
}

/**
 * @param {ExcelJS.Worksheet} worksheet
 * @param {Function} normalizeCellValue from ../pure/xlsxExtract.mjs
 * @returns {string[][]} a rectangular grid of already-normalized cell
 *   values for every row this worksheet actually has data in.
 */
function worksheetToGrid(worksheet, normalizeCellValue) {
  const maxCol = worksheet.actualColumnCount || worksheet.columnCount || 0;
  const grid = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values = [];
    for (let c = 1; c <= maxCol; c += 1) {
      values.push(normalizeCellValue(row.getCell(c).value));
    }
    grid.push(values);
  });
  return grid;
}

/**
 * Renders one worksheet's preview block: a badge with its name, a "first
 * row is a header" toggle, a capped-height preview table, and a download
 * button. Re-invoked in place whenever the visitor flips the toggle.
 * Mirrors ./htmlTableToCsv.client.js's renderTableBlock -- same controls,
 * same CSS classes, a different source format on the way in.
 */
function renderSheetBlock(container, sheetState, rowsToJsonRecords, sheetCount, sheetIndex) {
  container.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = sheetCount > 1 ? `Sheet ${sheetIndex + 1} of ${sheetCount}: ${sheetState.name}` : sheetState.name;
  head.appendChild(badge);

  const headerLabel = document.createElement('label');
  const headerToggle = document.createElement('input');
  headerToggle.type = 'checkbox';
  headerToggle.checked = sheetState.headerIsFirstRow;
  headerToggle.addEventListener('change', () => {
    sheetState.headerIsFirstRow = headerToggle.checked;
    renderSheetBlock(container, sheetState, rowsToJsonRecords, sheetCount, sheetIndex);
  });
  headerLabel.appendChild(headerToggle);
  headerLabel.appendChild(document.createTextNode(' First row is a header'));
  head.appendChild(headerLabel);

  container.appendChild(head);

  if (!sheetState.grid.length) {
    const empty = document.createElement('p');
    empty.className = 'dz-caption';
    empty.textContent = 'This sheet has no data.';
    container.appendChild(empty);
    return;
  }

  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'table-scroll';
  const tableEl = document.createElement('table');
  tableEl.className = 'extracted-table';

  const previewRows = sheetState.grid.slice(0, PREVIEW_ROW_CAP);
  const bodyStart = sheetState.headerIsFirstRow ? 1 : 0;

  if (sheetState.headerIsFirstRow && previewRows[0]) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    previewRows[0].forEach((cellValue) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = cellValue == null ? '' : String(cellValue);
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    tableEl.appendChild(thead);
  }

  const tbody = document.createElement('tbody');
  previewRows.slice(bodyStart).forEach((row) => {
    const tr = document.createElement('tr');
    row.forEach((cellValue) => {
      const td = document.createElement('td');
      td.textContent = cellValue == null ? '' : String(cellValue);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tableEl.appendChild(tbody);
  scrollWrap.appendChild(tableEl);
  container.appendChild(scrollWrap);

  if (sheetState.grid.length > PREVIEW_ROW_CAP) {
    const note = document.createElement('p');
    note.className = 'dz-caption';
    note.textContent = `Showing the first ${PREVIEW_ROW_CAP} of ${sheetState.grid.length} rows — the download includes every row.`;
    container.appendChild(note);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const jsonBtn = document.createElement('button');
  jsonBtn.type = 'button';
  jsonBtn.className = 'btn-secondary';
  jsonBtn.textContent = sheetCount > 1 ? `Download JSON (${sheetState.name})` : 'Download JSON';
  jsonBtn.addEventListener('click', () => {
    const records = rowsToJsonRecords(sheetState.grid, sheetState.headerIsFirstRow);
    downloadBlob(jsonBlob(records), `${safeName(sheetState.name)}.json`);
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
  setStatus('Reading that spreadsheet on this device…');

  const [ExcelJS, { normalizeCellValue, rowsToJsonRecords }] = await Promise.all([
    loadExcelJS(),
    import('../pure/xlsxExtract.mjs'),
  ]);

  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch (err) {
    setState('error');
    setStatus(`"${file.name}" doesn’t look like a valid .xlsx file.`, 'error');
    return;
  }

  const sheetStates = workbook.worksheets
    .filter((ws) => ws.state !== 'hidden' && ws.state !== 'veryHidden')
    .map((ws) => {
      const grid = worksheetToGrid(ws, normalizeCellValue);
      return { name: ws.name, grid, headerIsFirstRow: grid.length > 0 };
    });

  resultEl.innerHTML = '';

  if (!sheetStates.length) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That workbook has no visible sheets with data to convert.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('Finished reading — nothing to convert.', 'error');
    return;
  }

  if (sheetStates.length > 1) {
    const allRow = document.createElement('div');
    allRow.className = 'download-btn-row';
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'btn-primary';
    allBtn.textContent = `Download all ${sheetStates.length} sheets (one JSON file)`;
    allBtn.addEventListener('click', () => {
      const combined = {};
      sheetStates.forEach((s) => {
        combined[s.name] = rowsToJsonRecords(s.grid, s.headerIsFirstRow);
      });
      downloadBlob(jsonBlob(combined), `${safeName(file.name.replace(/\.xlsx$/i, ''))}.json`);
    });
    allRow.appendChild(allBtn);
    resultEl.appendChild(allRow);
  }

  sheetStates.forEach((s, i) => {
    const block = document.createElement('div');
    block.className = 'table-block';
    resultEl.appendChild(block);
    renderSheetBlock(block, s, rowsToJsonRecords, sheetStates.length, i);
  });

  const supportNote = document.createElement('p');
  supportNote.className = 'support-note';
  supportNote.innerHTML = 'That ran entirely on your machine — no servers, no cost to run. If it saved you time, you can buy me a coffee: '
    + '<a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>'
    + ' &middot; '
    + '<a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>.';
  resultEl.appendChild(supportNote);

  resultEl.hidden = false;
  setState('done');
  setStatus(`Found ${sheetStates.length} sheet${sheetStates.length === 1 ? '' : 's'}. Review below, then download.`, 'success');
}

// XLSX-to-CSV processor. Dynamically imported by ./dropzone.client.js
// (routed by #tool's data-client="xlsxToCsv") on first file selection, or
// warmed on pointerenter/focus -- same lazy-load reasoning as
// ./pdfPages.client.js.
//
// An .xlsx file is a ZIP archive of XML parts (the OOXML SpreadsheetML
// format). Unzipping uses fflate (MIT, self-hosted from this same origin --
// vendor/, copied from node_modules by scripts/copy-vendor.js -- never a
// CDN, same "turn off your Wi-Fi" reasoning as every other tool here).
// fflate is a zero-dependency, pure-JS (de)compressor -- no eval, no
// dynamic code generation of any kind, nothing to "disable" the way
// pdf.js's isEvalSupported flag needs disabling. XML parsing uses the
// browser's own DOMParser in 'application/xml' mode: browsers do not
// resolve external entities/DTDs for a DOMParser-parsed document (no XXE
// surface), and -- same reasoning as ./htmlTableToCsv.client.js's header
// comment -- the parsed document is inert (scripting disabled) and never
// attached to this page's live DOM. This is untrusted-archive input (a
// visitor-supplied file), so unzip/parse errors are always caught and
// turned into a plain-language message, never left to throw past the UI.
//
// The actual cell-reference math (grid layout, merged-cell expansion,
// Excel-serial date conversion) is pure and lives in ../pure/xlsxGrid.mjs
// so it stays unit-testable without a browser; this file's job is only to
// (a) unzip the archive and read its XML parts into the plain-data cell
// shape that module expects, and (b) render the preview and CSV download
// UI.
//
// Any text pulled out of the workbook (cell content, sheet names) is
// untrusted visitor content and is only ever written via .textContent,
// never interpolated into an HTML string -- same rule every other tool
// here follows.

const FflatePromise = import('../vendor/fflate/fflate.esm.js');

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

const textDecoder = new TextDecoder('utf-8');

/** @param {Record<string, Uint8Array>} entries @param {string} path @returns {string|null} decoded text, or null if that part isn't in the archive. */
function readEntryText(entries, path) {
  const bytes = entries[path];
  if (!bytes) return null;
  return textDecoder.decode(bytes);
}

class InvalidXlsxError extends Error {}

/** @param {string} xmlText @returns {Document} @throws {InvalidXlsxError} if the XML doesn't parse. */
function parseXmlOrThrow(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new InvalidXlsxError('That workbook contains a part that doesn’t parse as valid XML.');
  }
  return doc;
}

/**
 * Reads an element's namespaced attribute by local name, tolerant of
 * whatever prefix the producing application actually used (almost always
 * "r", per the OOXML spec's own convention, but not guaranteed) -- avoids
 * depending on getAttributeNS with an exact namespace URI string.
 */
function attrByLocalName(el, localName) {
  for (const attr of el.attributes) {
    if (attr.name === localName || attr.name.endsWith(`:${localName}`)) return attr.value;
  }
  return null;
}

/** @param {Document} sstDoc @returns {string[]} one entry per <si>, rich-text runs concatenated. */
function parseSharedStrings(sstDoc) {
  if (!sstDoc) return [];
  return Array.from(sstDoc.getElementsByTagName('si')).map((si) => {
    // A shared string is either one direct <t> (plain) or one or more
    // <r><t>...</t></r> runs (rich text) -- excluding any <rPh>
    // (phonetic-guide) text, which isn't part of the visible value.
    const parts = [];
    Array.from(si.children).forEach((child) => {
      if (child.localName === 't') {
        parts.push(child.textContent || '');
      } else if (child.localName === 'r') {
        const t = child.getElementsByTagName('t')[0];
        if (t) parts.push(t.textContent || '');
      }
    });
    return parts.join('');
  });
}

/**
 * @param {Document} stylesDoc
 * @returns {Array<{numFmtId: number, formatCode: string|null}>} one entry
 *   per <cellXfs><xf>, in order -- the array a <c s="N"> style index maps
 *   directly into.
 */
function parseCellStyles(stylesDoc) {
  if (!stylesDoc) return [];
  const customFormats = {};
  Array.from(stylesDoc.getElementsByTagName('numFmt')).forEach((nf) => {
    const id = Number(nf.getAttribute('numFmtId'));
    if (Number.isFinite(id)) customFormats[id] = nf.getAttribute('formatCode') || '';
  });
  const cellXfsEl = stylesDoc.getElementsByTagName('cellXfs')[0];
  if (!cellXfsEl) return [];
  return Array.from(cellXfsEl.children)
    .filter((el) => el.localName === 'xf')
    .map((xf) => {
      const numFmtId = Number(xf.getAttribute('numFmtId') || 0);
      return { numFmtId, formatCode: Object.prototype.hasOwnProperty.call(customFormats, numFmtId) ? customFormats[numFmtId] : null };
    });
}

/**
 * @returns {Array<{id:string, name:string, target:string}>} visible sheets
 *   only (state="hidden"/"veryHidden" excluded), in workbook order.
 */
function parseWorkbookSheets(workbookDoc, relsDoc) {
  const relTargets = {};
  if (relsDoc) {
    Array.from(relsDoc.getElementsByTagName('Relationship')).forEach((rel) => {
      relTargets[rel.getAttribute('Id')] = rel.getAttribute('Target');
    });
  }
  const sheetsEl = workbookDoc.getElementsByTagName('sheets')[0];
  if (!sheetsEl) return [];
  return Array.from(sheetsEl.children)
    .filter((el) => el.localName === 'sheet')
    .map((sheetEl) => {
      const rId = attrByLocalName(sheetEl, 'id');
      const target = rId ? relTargets[rId] : null;
      return {
        name: sheetEl.getAttribute('name') || 'Sheet',
        state: sheetEl.getAttribute('state') || 'visible',
        target,
      };
    })
    .filter((s) => s.state !== 'hidden' && s.state !== 'veryHidden' && s.target);
}

/** Resolves a relationship Target (relative to xl/, per OOXML's package-relative-path convention) into the zip entry key it corresponds to. */
function resolveXlPath(target) {
  if (target.startsWith('/')) return target.slice(1);
  return `xl/${target}`;
}

/**
 * @param {Document} sheetDoc one worksheet's sheetN.xml.
 * @param {string[]} sharedStrings
 * @param {Array<{numFmtId:number, formatCode:string|null}>} cellStyles
 * @returns {{cells: Array<{row:number,col:number,text:string}>, mergedRanges: string[]}}
 */
async function readWorksheet(sheetDoc, sharedStrings, cellStyles) {
  const { parseCellRef, excelSerialToDate, isDateNumFmt } = await import('../pure/xlsxGrid.mjs');

  const cells = [];
  const rows = Array.from(sheetDoc.getElementsByTagName('sheetData')[0]?.children || []).filter((el) => el.localName === 'row');
  let runningRow = 0;
  rows.forEach((rowEl) => {
    const rAttr = rowEl.getAttribute('r');
    const rowIndex = rAttr && Number.isFinite(Number(rAttr)) ? Number(rAttr) - 1 : runningRow;
    let runningCol = 0;
    Array.from(rowEl.children)
      .filter((el) => el.localName === 'c')
      .forEach((cEl) => {
        const ref = cEl.getAttribute('r');
        const parsed = ref ? parseCellRef(ref) : null;
        const row = parsed ? parsed.row : rowIndex;
        const col = parsed ? parsed.col : runningCol;
        runningCol = col + 1;

        const type = cEl.getAttribute('t');
        let text = '';
        if (type === 'inlineStr') {
          const t = cEl.getElementsByTagName('t')[0];
          text = t ? t.textContent || '' : '';
        } else {
          const vEl = cEl.getElementsByTagName('v')[0];
          const raw = vEl ? vEl.textContent || '' : '';
          if (type === 's') {
            const idx = Number(raw);
            text = Number.isFinite(idx) ? (sharedStrings[idx] || '') : '';
          } else if (type === 'str') {
            text = raw; // formula result, already a string
          } else if (type === 'b') {
            text = raw === '1' ? 'TRUE' : 'FALSE';
          } else if (type === 'e') {
            text = raw; // formula error code, e.g. "#DIV/0!"
          } else if (raw === '') {
            text = '';
          } else {
            const styleIndex = Number(cEl.getAttribute('s') || 0);
            const style = cellStyles[styleIndex];
            const wantsDate = style && isDateNumFmt(style.numFmtId, style.formatCode);
            text = wantsDate ? excelSerialToDate(Number(raw)) : raw;
          }
        }
        cells.push({ row, col, text });
      });
    runningRow = rowIndex + 1;
  });

  const mergeCellsEl = sheetDoc.getElementsByTagName('mergeCells')[0];
  const mergedRanges = mergeCellsEl
    ? Array.from(mergeCellsEl.children).filter((el) => el.localName === 'mergeCell').map((el) => el.getAttribute('ref')).filter(Boolean)
    : [];

  return { cells, mergedRanges };
}

/**
 * Renders one sheet's DOM block: a "Sheet name" badge, the read-only
 * preview table, a "first row is a header" toggle, and a per-sheet CSV
 * download button. Re-invoked in place whenever the visitor edits
 * anything, so it always reflects current state.
 */
function renderSheetBlock(container, sheetState, rowsToCsv, sheetCount, sheetIndex) {
  container.innerHTML = '';
  const { grid, name } = sheetState;

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const badge = document.createElement('span');
  badge.className = 'page-badge';
  badge.textContent = sheetCount > 1 ? `Sheet ${sheetIndex + 1} of ${sheetCount}: ${name}` : `Sheet: ${name}`;
  head.appendChild(badge);

  const headerLabel = document.createElement('label');
  const headerToggle = document.createElement('input');
  headerToggle.type = 'checkbox';
  headerToggle.checked = sheetState.headerIsFirstRow;
  headerToggle.addEventListener('change', () => {
    sheetState.headerIsFirstRow = headerToggle.checked;
    renderSheetBlock(container, sheetState, rowsToCsv, sheetCount, sheetIndex);
  });
  headerLabel.appendChild(headerToggle);
  headerLabel.appendChild(document.createTextNode(' First row is a header'));
  head.appendChild(headerLabel);

  container.appendChild(head);

  if (!grid.length) {
    const empty = document.createElement('p');
    empty.className = 'caption';
    empty.textContent = 'This sheet has no cell data.';
    container.appendChild(empty);
  } else {
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'table-scroll';
    const tableEl = document.createElement('table');
    tableEl.className = 'extracted-table';

    const headerRowIdx = sheetState.headerIsFirstRow ? 0 : null;
    if (headerRowIdx !== null) {
      const thead = document.createElement('thead');
      const tr = document.createElement('tr');
      grid[headerRowIdx].forEach((cellValue) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = cellValue;
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      tableEl.appendChild(thead);
    }

    const tbody = document.createElement('tbody');
    grid
      .filter((_, i) => i !== headerRowIdx)
      .forEach((row) => {
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
    container.appendChild(scrollWrap);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  const csvBtn = document.createElement('button');
  csvBtn.type = 'button';
  csvBtn.className = 'btn-secondary';
  csvBtn.textContent = `Download CSV (${name})`;
  csvBtn.disabled = !grid.length;
  csvBtn.addEventListener('click', () => {
    downloadBlob(csvBlob(rowsToCsv(grid)), `${sanitizeFilename(name)}.csv`);
  });
  btnRow.appendChild(csvBtn);
  container.appendChild(btnRow);
}

/** Strips path separators, control characters, and trims length -- same download-filename hygiene every tool here applies to visitor-influenced filenames. */
function sanitizeFilename(name) {
  const cleaned = String(name || 'sheet').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
  return (cleaned || 'sheet').slice(0, 100);
}

/**
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  const file = files[0];
  setState('working');
  setStatus('Reading that workbook on this device…');

  const [{ unzipSync }, { rowsToCsv }, { buildGrid, expandMergedRanges }] = await Promise.all([
    FflatePromise,
    import('../pure/csv.mjs'),
    import('../pure/xlsxGrid.mjs'),
  ]);

  const bytes = new Uint8Array(await file.arrayBuffer());

  let entries;
  try {
    entries = unzipSync(bytes);
  } catch (err) {
    setState('error');
    setStatus(`"${file.name}" doesn’t look like a valid .xlsx file — it may be password-protected, a different format (like the older .xls), or corrupted.`, 'error');
    return;
  }

  const workbookXml = readEntryText(entries, 'xl/workbook.xml');
  if (!workbookXml) {
    setState('error');
    setStatus(`"${file.name}" doesn’t look like a valid .xlsx workbook.`, 'error');
    return;
  }

  let sheetStates;
  try {
    const workbookDoc = parseXmlOrThrow(workbookXml);
    const relsXml = readEntryText(entries, 'xl/_rels/workbook.xml.rels');
    const relsDoc = relsXml ? parseXmlOrThrow(relsXml) : null;
    const sstXml = readEntryText(entries, 'xl/sharedStrings.xml');
    const sharedStrings = sstXml ? parseSharedStrings(parseXmlOrThrow(sstXml)) : [];
    const stylesXml = readEntryText(entries, 'xl/styles.xml');
    const cellStyles = stylesXml ? parseCellStyles(parseXmlOrThrow(stylesXml)) : [];

    const sheetRefs = parseWorkbookSheets(workbookDoc, relsDoc);

    sheetStates = [];
    for (const ref of sheetRefs) {
      const sheetXml = readEntryText(entries, resolveXlPath(ref.target));
      if (!sheetXml) continue; // eslint-disable-line no-continue -- a dangling relationship target with no matching part; skip rather than fail the whole workbook
      // eslint-disable-next-line no-await-in-loop -- sheets must be read in
      // order so sheetStates stays in document order; each sheet is cheap
      // relative to the file read already done above.
      const { cells, mergedRanges } = await readWorksheet(parseXmlOrThrow(sheetXml), sharedStrings, cellStyles);
      const grid = expandMergedRanges(buildGrid(cells), mergedRanges);
      sheetStates.push({ name: ref.name, grid, headerIsFirstRow: grid.length > 0 });
    }
  } catch (err) {
    setState('error');
    setStatus(err instanceof InvalidXlsxError ? err.message : `Could not read "${file.name}" — it doesn’t look like a valid .xlsx workbook.`, 'error');
    return;
  }

  resultEl.innerHTML = '';

  if (!sheetStates.length) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'No visible sheets with data were found in that workbook.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('Finished reading — no sheets found.', 'error');
    return;
  }

  if (sheetStates.length > 1) {
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'btn-primary';
    allBtn.textContent = `Download all ${sheetStates.length} sheets (CSV)`;
    allBtn.addEventListener('click', () => {
      sheetStates.forEach((ss) => {
        if (ss.grid.length) downloadBlob(csvBlob(rowsToCsv(ss.grid)), `${sanitizeFilename(ss.name)}.csv`);
      });
    });
    resultEl.appendChild(allBtn);
  }

  sheetStates.forEach((ss, i) => {
    const block = document.createElement('div');
    block.className = 'table-block';
    resultEl.appendChild(block);
    renderSheetBlock(block, ss, rowsToCsv, sheetStates.length, i);
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

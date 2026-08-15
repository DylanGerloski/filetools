// Mode-specific PDF processing for the three merge/split/rotate tools.
// Dynamically imported by ./dropzone.client.js on first file selection (or
// warmed on pointerenter/focus) -- never on page load, so the ~1MB of PDF
// machinery this file pulls in never counts against a tool page's initial
// Lighthouse Performance payload.
//
// pdf-lib (MIT) and pdf.js (Apache-2.0) are both self-hosted from this same
// origin (vendor/, copied from node_modules at build time by
// scripts/copy-vendor.js) -- never a CDN. That is a real constraint, not a
// preference: a CDN-loaded script would break the "turn off your Wi-Fi and
// this page still works" claim shown on every tool page.

const PDFLibPromise = import('../vendor/pdf-lib/pdf-lib.esm.min.js');
const PdfJsPromise = import('../vendor/pdfjs-dist/pdf.min.mjs').then((pdfjs) => {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs-dist/pdf.worker.min.mjs', import.meta.url).href;
  return pdfjs;
});

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

/**
 * @param {File} file
 * @returns {Promise<import('pdf-lib').PDFDocument>} loaded document, or
 *   throws a visitor-facing Error for a password-protected/corrupt file.
 */
async function loadPdfLibDoc(file, PDFLib) {
  const bytes = await file.arrayBuffer();
  try {
    return await PDFLib.PDFDocument.load(bytes);
  } catch (err) {
    if (String(err && err.message).toLowerCase().includes('encrypt')) {
      throw new Error(`"${file.name}" is password-protected. Remove the password and try again.`);
    }
    throw new Error(`"${file.name}" doesn’t look like a valid PDF.`);
  }
}

/**
 * Renders every page of a pdf.js document to small thumbnail canvases.
 * @returns {Promise<HTMLCanvasElement[]>}
 */
async function renderThumbnails(pdfJsDoc, pdfjs, targetWidth = 160) {
  const canvases = [];
  for (let i = 1; i <= pdfJsDoc.numPages; i += 1) {
    const page = await pdfJsDoc.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    // eslint-disable-next-line no-await-in-loop -- pages must render in
    // order for the progress label below to stay meaningful, and yielding
    // per page (rather than Promise.all) keeps the tab responsive on large
    // documents.
    await page.render({ canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
}

// ---------------------------------------------------------------------------
// MERGE
// ---------------------------------------------------------------------------
async function runMerge(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  if (files.length < 2) {
    setState('error');
    setStatus('Choose two or more PDF files to merge.', 'error');
    return;
  }

  const [PDFLib] = await Promise.all([PDFLibPromise]);

  // Render the merge UI immediately (order-adjustable list); the actual
  // merge only happens once the visitor presses "Merge PDFs" below, so
  // reordering never re-reads the files.
  let order = files.map((f, i) => i);

  function renderList() {
    resultEl.innerHTML = '';
    const list = document.createElement('ul');
    list.className = 'file-list';
    order.forEach((fileIndex, position) => {
      const file = files[fileIndex];
      const li = document.createElement('li');
      li.className = 'file-row';
      li.innerHTML = `
        <span class="file-name">${escapeHtml(file.name)}</span>
        <span class="file-meta">${humanSize(file.size)}</span>
        <span class="file-actions">
          <button type="button" class="btn-icon" data-action="up" aria-label="Move ${escapeHtml(file.name)} up">&uarr;</button>
          <button type="button" class="btn-icon" data-action="down" aria-label="Move ${escapeHtml(file.name)} down">&darr;</button>
          <button type="button" class="btn-icon" data-action="remove" aria-label="Remove ${escapeHtml(file.name)}">&times;</button>
        </span>`;
      li.querySelector('[data-action="up"]').disabled = position === 0;
      li.querySelector('[data-action="down"]').disabled = position === order.length - 1;
      li.querySelector('[data-action="up"]').addEventListener('click', () => {
        if (position > 0) {
          [order[position - 1], order[position]] = [order[position], order[position - 1]];
          renderList();
        }
      });
      li.querySelector('[data-action="down"]').addEventListener('click', () => {
        if (position < order.length - 1) {
          [order[position + 1], order[position]] = [order[position], order[position + 1]];
          renderList();
        }
      });
      li.querySelector('[data-action="remove"]').addEventListener('click', () => {
        order = order.filter((idx) => idx !== fileIndex);
        renderList();
      });
      list.appendChild(li);
    });
    resultEl.appendChild(list);

    const mergeBtn = document.createElement('button');
    mergeBtn.type = 'button';
    mergeBtn.className = 'btn-primary';
    mergeBtn.textContent = 'Merge PDFs';
    mergeBtn.disabled = order.length < 2;
    mergeBtn.addEventListener('click', async () => {
      setState('working');
      setStatus('Merging on this device…');
      try {
        const merged = await PDFLib.PDFDocument.create();
        for (const idx of order) {
          const file = files[idx];
          const src = await loadPdfLibDoc(file, PDFLib);
          const pages = await merged.copyPages(src, src.getPageIndices());
          pages.forEach((p) => merged.addPage(p));
        }
        const bytes = await merged.save();
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'merged.pdf');
        setState('done');
        setStatus('Merged. Your download has started.', 'success');
        appendSupportNote(resultEl);
      } catch (err) {
        setState('error');
        setStatus(err.message || 'Could not merge those files.', 'error');
      }
    });
    resultEl.appendChild(mergeBtn);
    resultEl.hidden = false;
  }

  renderList();
  setState('idle');
  setStatus(`${files.length} files ready. Reorder them, then merge.`);
}

// ---------------------------------------------------------------------------
// SPLIT
// ---------------------------------------------------------------------------
async function runSplit(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  const file = files[0];
  setStatus('Rendering pages…');

  const [PDFLib, pdfjs] = await Promise.all([PDFLibPromise, PdfJsPromise]);
  const bytes = await file.arrayBuffer();
  let pdfJsDoc;
  try {
    pdfJsDoc = await pdfjs.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
  } catch (err) {
    setState('error');
    setStatus(`"${file.name}" doesn’t look like a valid PDF.`, 'error');
    return;
  }

  const { parsePageRange } = await import('../pure/pageRange.mjs');
  const pageCount = pdfJsDoc.numPages;
  const selected = new Set(Array.from({ length: pageCount }, (_, i) => i));

  resultEl.innerHTML = '';
  const rangeRow = document.createElement('div');
  rangeRow.innerHTML = `
    <label for="page-range-input" class="dz-caption">Pages (e.g. “1-3, 7, 9-12”)</label><br>
    <input id="page-range-input" type="text" placeholder="all pages" style="width:100%;max-width:320px;padding:var(--space-2);margin:var(--space-1) 0 var(--space-3);border:1px solid var(--color-border);border-radius:var(--radius-sm);">
    <div>
      <label><input type="radio" name="split-mode" value="one" checked> Selected pages as one PDF</label><br>
      <label><input type="radio" name="split-mode" value="each"> Each page as its own file</label>
    </div>`;
  resultEl.appendChild(rangeRow);

  const grid = document.createElement('div');
  grid.className = 'page-grid';
  resultEl.appendChild(grid);

  const thumbs = await renderThumbnails(pdfJsDoc, pdfjs);
  thumbs.forEach((canvas, i) => {
    const card = document.createElement('label');
    card.className = 'page-card';
    card.dataset.selected = 'true';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.className = 'sr-only';
    cb.addEventListener('change', () => {
      if (cb.checked) selected.add(i); else selected.delete(i);
      card.dataset.selected = String(cb.checked);
    });
    card.appendChild(cb);
    card.appendChild(canvas);
    const num = document.createElement('span');
    num.className = 'page-num';
    num.textContent = `Page ${i + 1}`;
    card.appendChild(num);
    grid.appendChild(card);
  });

  const rangeInput = rangeRow.querySelector('#page-range-input');
  rangeInput.addEventListener('change', () => {
    if (!rangeInput.value.trim()) return;
    try {
      const indices = new Set(parsePageRange(rangeInput.value, pageCount));
      selected.clear();
      indices.forEach((i) => selected.add(i));
      Array.from(grid.children).forEach((card, i) => {
        const checked = indices.has(i);
        card.dataset.selected = String(checked);
        card.querySelector('input').checked = checked;
      });
    } catch (err) {
      setStatus(err.message, 'error');
    }
  });

  const splitBtn = document.createElement('button');
  splitBtn.type = 'button';
  splitBtn.className = 'btn-primary';
  splitBtn.style.marginTop = 'var(--space-4)';
  splitBtn.textContent = 'Split PDF';
  splitBtn.addEventListener('click', async () => {
    const indices = Array.from(selected).sort((a, b) => a - b);
    if (!indices.length) {
      setStatus('Select at least one page.', 'error');
      return;
    }
    setState('working');
    setStatus('Splitting on this device…');
    try {
      const mode = rangeRow.querySelector('input[name="split-mode"]:checked').value;
      const src = await loadPdfLibDoc(file, PDFLib);
      const baseName = file.name.replace(/\.pdf$/i, '');

      if (mode === 'one') {
        const out = await PDFLib.PDFDocument.create();
        const pages = await out.copyPages(src, indices);
        pages.forEach((p) => out.addPage(p));
        const outBytes = await out.save();
        downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName}-selected.pdf`);
      } else {
        for (const idx of indices) {
          const out = await PDFLib.PDFDocument.create();
          const [page] = await out.copyPages(src, [idx]);
          out.addPage(page);
          const outBytes = await out.save();
          // eslint-disable-next-line no-await-in-loop -- sequential
          // downloads are deliberate here. A future version could zip these
          // into one download instead (via a small MIT-licensed zip
          // library), but that's not implemented yet.
          downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName}-page-${idx + 1}.pdf`);
          await new Promise((r) => setTimeout(r, 150));
        }
      }
      setState('done');
      setStatus('Done. Your download has started.', 'success');
      appendSupportNote(resultEl);
    } catch (err) {
      setState('error');
      setStatus(err.message || 'Could not split that file.', 'error');
    }
  });
  resultEl.appendChild(splitBtn);
  resultEl.hidden = false;
  setState('idle');
  setStatus(`${pageCount} pages ready.`);
}

// ---------------------------------------------------------------------------
// ROTATE
// ---------------------------------------------------------------------------
async function runRotate(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  const file = files[0];
  setStatus('Rendering pages…');

  const [PDFLib, pdfjs] = await Promise.all([PDFLibPromise, PdfJsPromise]);
  const bytes = await file.arrayBuffer();
  let pdfJsDoc;
  try {
    pdfJsDoc = await pdfjs.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
  } catch (err) {
    setState('error');
    setStatus(`"${file.name}" doesn’t look like a valid PDF.`, 'error');
    return;
  }

  const pageCount = pdfJsDoc.numPages;
  const rotations = new Array(pageCount).fill(0);

  resultEl.innerHTML = '';
  const rotateAllRow = document.createElement('div');
  rotateAllRow.innerHTML = `
    <button type="button" class="btn-secondary" data-action="rotate-all-left">Rotate all left</button>
    <button type="button" class="btn-secondary" data-action="rotate-all-right">Rotate all right</button>`;
  resultEl.appendChild(rotateAllRow);

  const grid = document.createElement('div');
  grid.className = 'page-grid';
  resultEl.appendChild(grid);

  const thumbs = await renderThumbnails(pdfJsDoc, pdfjs);
  thumbs.forEach((canvas, i) => {
    const card = document.createElement('div');
    card.className = 'page-card';
    card.appendChild(canvas);
    const num = document.createElement('span');
    num.className = 'page-num';
    num.textContent = `Page ${i + 1}`;
    card.appendChild(num);
    const row = document.createElement('div');
    row.className = 'page-rotate-row';
    const left = document.createElement('button');
    left.type = 'button';
    left.className = 'btn-icon';
    left.setAttribute('aria-label', `Rotate page ${i + 1} left`);
    left.textContent = '↺';
    const right = document.createElement('button');
    right.type = 'button';
    right.className = 'btn-icon';
    right.setAttribute('aria-label', `Rotate page ${i + 1} right`);
    right.textContent = '↻';
    function apply(delta) {
      rotations[i] = ((rotations[i] + delta) % 360 + 360) % 360;
      canvas.dataset.rotation = String(rotations[i]);
    }
    left.addEventListener('click', () => apply(-90));
    right.addEventListener('click', () => apply(90));
    row.appendChild(left);
    row.appendChild(right);
    card.appendChild(row);
    grid.appendChild(card);
  });

  rotateAllRow.querySelector('[data-action="rotate-all-left"]').addEventListener('click', () => {
    grid.querySelectorAll('.btn-icon[aria-label^="Rotate"][aria-label$="left"]').forEach((btn) => btn.click());
  });
  rotateAllRow.querySelector('[data-action="rotate-all-right"]').addEventListener('click', () => {
    grid.querySelectorAll('.btn-icon[aria-label^="Rotate"][aria-label$="right"]').forEach((btn) => btn.click());
  });

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn-primary';
  saveBtn.style.marginTop = 'var(--space-4)';
  saveBtn.textContent = 'Save rotated PDF';
  saveBtn.addEventListener('click', async () => {
    setState('working');
    setStatus('Saving on this device…');
    try {
      const src = await loadPdfLibDoc(file, PDFLib);
      const pages = src.getPages();
      pages.forEach((page, i) => {
        if (rotations[i]) {
          const current = page.getRotation().angle;
          page.setRotation(PDFLib.degrees((current + rotations[i]) % 360));
        }
      });
      const outBytes = await src.save();
      const baseName = file.name.replace(/\.pdf$/i, '');
      downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), `${baseName}-rotated.pdf`);
      setState('done');
      setStatus('Saved. Your download has started.', 'success');
      appendSupportNote(resultEl);
    } catch (err) {
      setState('error');
      setStatus(err.message || 'Could not rotate that file.', 'error');
    }
  });
  resultEl.appendChild(saveBtn);
  resultEl.hidden = false;
  setState('idle');
  setStatus(`${pageCount} pages ready.`);
}

function appendSupportNote(resultEl) {
  const note = document.createElement('p');
  note.className = 'support-note';
  note.innerHTML = 'That ran entirely on your machine, with no server and no hosting cost on my end. If it saved you time, you can buy me a coffee: '
    + '<a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>'
    + ' &middot; '
    + '<a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>.';
  resultEl.appendChild(note);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{mode:'merge'|'split'|'rotate', files:File[], section:Element,
 *   dropzone:Element, resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  if (ctx.mode === 'merge') return runMerge(ctx);
  if (ctx.mode === 'split') return runSplit(ctx);
  if (ctx.mode === 'rotate') return runRotate(ctx);
  throw new Error(`Unknown tool mode: ${ctx.mode}`);
}

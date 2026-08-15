// Shared drop-zone controller -- page-agnostic UI/state-machine logic used
// by every tool page on the site. Knows nothing about
// PDFs specifically: it validates file type/count against the #tool
// section's data-accept/data-multiple attributes, manages the dropzone's
// five visual states (idle/dragover/working/error/done -- see src/css.js),
// and hands the chosen FileList off to the mode-specific processor named by
// #tool's data-client attribute (e.g. "pdfPages" -> ./pdfPages.client.js,
// "pdfTables" -> ./pdfTables.client.js -- this is the TOOLS registry's
// `clientEntry` field, see src/tools/index.js). Loaded as a plain
// <script type="module"> (see src/pages/toolPage.js) -- no bundler, no
// build step needed for this file itself to run in a browser.
//
// THE LANGUAGE RULE: the word "upload" never appears in any control, status,
// or error string here. Nothing this site does is actually an upload (the
// whole point is that files never leave the device), so using that word in
// the UI would be actively misleading, not just off-brand.

const toolSection = document.getElementById('tool');
if (toolSection) {
  const mode = toolSection.dataset.mode;
  const clientEntry = toolSection.dataset.client || 'pdfPages';
  const accept = (toolSection.dataset.accept || '').split(',').map((s) => s.trim()).filter(Boolean);
  const multiple = toolSection.dataset.multiple === 'true';

  const dropzone = toolSection.querySelector('.dropzone');
  const fileInput = toolSection.querySelector('#file-input');
  const statusEl = toolSection.querySelector('.dz-status');
  const resultEl = toolSection.querySelector('.result');
  const cancelBtn = toolSection.querySelector('.dz-cancel');

  // "working" state timing (design-standards.md's three response-time
  // limits): a generation counter is bumped on every new file selection
  // AND on Cancel, so a
  // processor that's still running when the visitor cancels can finish
  // its work in the background without ever touching the UI again --
  // that's what makes Cancel real from the visitor's point of view, even
  // though no per-processor AbortSignal plumbing exists to stop the
  // in-flight CPU work itself (out of scope for this pass; noted here so
  // it isn't assumed away).
  let currentGeneration = 0;
  let slowTimer = null;

  function clearSlowTimer() {
    if (slowTimer) { clearTimeout(slowTimer); slowTimer = null; }
    delete dropzone.dataset.slow;
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      currentGeneration += 1;
      clearSlowTimer();
      setState('idle');
      setStatus('Cancelled.');
      resultEl.hidden = true;
      resultEl.innerHTML = '';
    });
  }

  // Known, closed set of processor modules -- an explicit map rather than a
  // template-string import(`./${clientEntry}.client.js`) so an unexpected
  // or malformed data-client value fails loudly (see the catch in
  // handleFileList) instead of silently attempting an arbitrary import.
  const PROCESSORS = {
    pdfPages: () => import('./pdfPages.client.js'),
    pdfTables: () => import('./pdfTables.client.js'),
    statementToCsv: () => import('./statementToCsv.client.js'),
    htmlTableToCsv: () => import('./htmlTableToCsv.client.js'),
    dedupeLines: () => import('./dedupeLines.client.js'),
    sortLines: () => import('./sortLines.client.js'),
    jsonToCsv: () => import('./jsonToCsv.client.js'),
    splitCsv: () => import('./splitCsv.client.js'),
  };

  // Per-tool file-size cap, checked before a file ever reaches its
  // processor. Without this, a large-enough PDF (or a huge pasted/dropped
  // text file) just hangs the tab -- there was no cap of any kind before
  // this. Sizes are generous (these are legitimate client-side PDF/text
  // operations, not something that should refuse ordinary real-world
  // files) but bounded, keyed by clientEntry since a PDF and a plain-text
  // list have very different realistic sizes. Kept here rather than per
  // tool-registry entry so every file-accepting tool is covered by one
  // change, matching PROCESSORS' key space above.
  const MAX_BYTES_BY_CLIENT = {
    pdfPages: 200 * 1024 * 1024, // merge/split/rotate -- can legitimately be a large scanned PDF
    pdfTables: 100 * 1024 * 1024, // renders each page to extract tables -- more work per byte
    statementToCsv: 100 * 1024 * 1024,
    htmlTableToCsv: 20 * 1024 * 1024, // parsed HTML/text, held in the DOM for preview
    dedupeLines: 20 * 1024 * 1024, // plain text lists
    sortLines: 20 * 1024 * 1024,
    jsonToCsv: 20 * 1024 * 1024, // parsed JSON, held in memory for preview
    splitCsv: 20 * 1024 * 1024, // whole CSV held in memory to chunk and zip
  };
  const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

  function formatMb(bytes) {
    return `${Math.round(bytes / (1024 * 1024))}MB`;
  }

  // The synthetic File a "paste" submission is wrapped in (see the
  // pasteButton handler below) needs a name/type each pasteInput-enabled
  // processor recognizes -- keyed by clientEntry, same key space as
  // PROCESSORS above, so adding a new pasteInput tool is a one-line
  // addition here, not a hardcoded name shared by every tool.
  const PASTE_FILE = {
    htmlTableToCsv: { name: 'pasted-table.html', type: 'text/html' },
    dedupeLines: { name: 'pasted-list.txt', type: 'text/plain' },
    sortLines: { name: 'pasted-list.txt', type: 'text/plain' },
    jsonToCsv: { name: 'pasted-input.json', type: 'application/json' },
    splitCsv: { name: 'pasted-input.csv', type: 'text/csv' },
  };

  let processorPromise = null;
  function warmProcessor() {
    if (!processorPromise) {
      const loader = PROCESSORS[clientEntry];
      processorPromise = (loader ? loader() : Promise.reject(new Error(`Unknown tool client: ${clientEntry}`)))
        .catch((err) => {
          // A dynamic import can fail (module not cached yet and the
          // network dropped mid-fetch, a bad deploy, etc). Never let the
          // raw "Failed to fetch dynamically imported module: ..." string
          // reach the visitor -- replace it with a sentence they can act
          // on, and clear the cached promise so the next file selection
          // gets a fresh attempt instead of the same stale rejection.
          processorPromise = null;
          throw new Error('The tool’s code hasn’t finished downloading yet — reconnect for a moment, then try again.');
        });
    }
    return processorPromise;
  }
  // Warm the (larger) pdf.js/pdf-lib import as soon as the visitor shows
  // intent, so the perceived cost at actual file-selection time is near
  // zero for anyone who uses the tool. These two callers don't consume the
  // result, so swallow a warm-time rejection here -- a real failure still
  // surfaces normally from handleFileList's own await below.
  dropzone.addEventListener('pointerenter', () => warmProcessor().catch(() => {}), { once: true });
  dropzone.addEventListener('focusin', () => warmProcessor().catch(() => {}), { once: true });

  // Also warm unconditionally once the page has finished loading and the
  // browser is idle. This is what makes "turn off your Wi-Fi and this page
  // still works" true for a visitor who never hovers or focuses the drop
  // zone before going offline -- the scenario the pre-deploy review found
  // broken. Deferred to idle time rather than fired immediately so it
  // never competes with the initial paint: requestIdleCallback only runs
  // once the browser has nothing more pressing to do, so this costs
  // nothing against Lighthouse Performance.
  function warmOnIdle() {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => warmProcessor().catch(() => {}), { timeout: 4000 });
    } else {
      setTimeout(() => warmProcessor().catch(() => {}), 1000);
    }
  }
  if (document.readyState === 'complete') {
    warmOnIdle();
  } else {
    window.addEventListener('load', warmOnIdle, { once: true });
  }

  function setState(state) {
    dropzone.dataset.state = state;
  }

  function setStatus(message, tone) {
    statusEl.textContent = message || '';
    if (tone) statusEl.dataset.tone = tone;
    else delete statusEl.dataset.tone;
  }

  function fileMatchesAccept(file) {
    if (!accept.length) return true;
    return accept.some((pattern) => {
      // A leading dot is a filename-extension pattern (e.g. ".html") rather
      // than a MIME type -- needed because some browser/OS combinations
      // report an empty or unexpected `file.type` for less common
      // extensions, and checking the extension too is a cheap backstop.
      if (pattern.startsWith('.')) return file.name.toLowerCase().endsWith(pattern.toLowerCase());
      if (pattern.endsWith('/*')) return file.type.startsWith(pattern.slice(0, -1));
      return file.type === pattern;
    });
  }

  async function handleFileList(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    if (!multiple && files.length > 1) {
      setState('error');
      setStatus('This tool works on one file at a time. Choose a single PDF.', 'error');
      return;
    }

    const bad = files.find((f) => !fileMatchesAccept(f));
    if (bad) {
      setState('error');
      setStatus(`"${bad.name}" isn't a PDF — this tool reads PDF files.`, 'error');
      return;
    }

    const maxBytes = MAX_BYTES_BY_CLIENT[clientEntry] || DEFAULT_MAX_BYTES;
    const tooBig = files.find((f) => f.size > maxBytes);
    if (tooBig) {
      setState('error');
      setStatus(`"${tooBig.name}" is too large (${formatMb(tooBig.size)}). This tool handles files up to ${formatMb(maxBytes)} — anything bigger risks freezing your browser tab.`, 'error');
      return;
    }

    const myGeneration = ++currentGeneration;
    function stillCurrent() {
      return myGeneration === currentGeneration;
    }

    setState('working');
    setStatus('Reading your file on this device…');
    resultEl.hidden = true;
    resultEl.innerHTML = '';

    // Past 10s of the SAME job still running, reveal the Cancel button
    // (Nielsen's third response-time limit). Guarded by stillCurrent() so
    // a fast job that already finished doesn't pop it back up late.
    clearSlowTimer();
    slowTimer = setTimeout(() => {
      if (stillCurrent()) dropzone.dataset.slow = 'true';
    }, 10000);

    try {
      const processor = await warmProcessor();
      // setState/setStatus/resultEl are only ever touched by this
      // generation's own processor.run() call below (a plain object, not a
      // wrapped guard) -- the guard applies to the OUTER handling here, so
      // a superseded generation's eventual resolution/rejection can't
      // overwrite what a later (or cancelled) selection already put on
      // screen.
      await processor.run({
        mode,
        files,
        section: toolSection,
        dropzone,
        resultEl,
        setState: (s) => { if (stillCurrent()) setState(s); },
        setStatus: (m, t) => { if (stillCurrent()) setStatus(m, t); },
      });
      if (stillCurrent()) clearSlowTimer();
    } catch (err) {
      if (stillCurrent()) {
        clearSlowTimer();
        setState('error');
        setStatus(err && err.message ? err.message : 'Something went wrong reading that file.', 'error');
      }
    }
  }

  fileInput.addEventListener('change', (e) => {
    handleFileList(e.target.files);
    // Reset so choosing the exact same file twice in a row still fires
    // 'change' the second time.
    e.target.value = '';
  });

  // "Magnetic" target: bind drag/drop to the whole tool section, not just
  // the visual dashed box, so a release slightly outside the dashes still
  // lands.
  ['dragenter', 'dragover'].forEach((evt) => {
    toolSection.addEventListener(evt, (e) => {
      e.preventDefault();
      setState('dragover');
    });
  });
  ['dragleave', 'dragend'].forEach((evt) => {
    toolSection.addEventListener(evt, (e) => {
      if (evt === 'dragleave' && toolSection.contains(e.relatedTarget)) return;
      if (dropzone.dataset.state === 'dragover') setState('idle');
    });
  });
  toolSection.addEventListener('drop', (e) => {
    e.preventDefault();
    setState('idle');
    if (e.dataTransfer && e.dataTransfer.files) handleFileList(e.dataTransfer.files);
  });

  // A drag that misses the tool section entirely should never navigate the
  // tab away and destroy the visitor's in-progress work.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    if (!toolSection.contains(e.target)) e.preventDefault();
  });

  // Optional second input path (src/pages/toolPage.js's `pasteInput`
  // block, currently only html-table-to-csv): pasted text is wrapped in a
  // synthetic File and pushed through the exact same handleFileList/
  // processor.run() path a chosen/dropped file takes, so every tool's
  // processor only ever has to handle one input shape.
  const pasteTextarea = toolSection.querySelector('.paste-textarea');
  const pasteButton = toolSection.querySelector('.paste-convert-btn');
  if (pasteTextarea && pasteButton) {
    pasteButton.addEventListener('click', () => {
      const text = pasteTextarea.value;
      if (!text.trim()) {
        setState('error');
        setStatus('Paste some markup first, or choose a file instead.', 'error');
        return;
      }
      const pasteFile = PASTE_FILE[clientEntry] || { name: 'pasted-input.txt', type: 'text/plain' };
      const file = new File([text], pasteFile.name, { type: pasteFile.type });
      handleFileList([file]);
    });
  }
}

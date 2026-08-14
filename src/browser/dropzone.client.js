// Shared drop-zone controller -- page-agnostic UI/state-machine logic used
// by every merge/split/rotate tool page. Knows nothing about
// PDFs specifically: it validates file type/count against the #tool
// section's data-accept/data-multiple attributes, manages the dropzone's
// five visual states (idle/dragover/working/error/done -- see src/css.js),
// and hands the chosen FileList off to the mode-specific processor in
// ./pdfPages.client.js. Loaded as a plain <script type="module"> (see
// src/pages/toolPage.js) -- no bundler, no build step needed for this file
// itself to run in a browser.
//
// THE LANGUAGE RULE: the word "upload" never appears in any control, status,
// or error string here. Nothing this site does is actually an upload (the
// whole point is that files never leave the device), so using that word in
// the UI would be actively misleading, not just off-brand.

const toolSection = document.getElementById('tool');
if (toolSection) {
  const mode = toolSection.dataset.mode;
  const accept = (toolSection.dataset.accept || '').split(',').map((s) => s.trim()).filter(Boolean);
  const multiple = toolSection.dataset.multiple === 'true';

  const dropzone = toolSection.querySelector('.dropzone');
  const fileInput = toolSection.querySelector('#file-input');
  const statusEl = toolSection.querySelector('.dz-status');
  const resultEl = toolSection.querySelector('.result');

  let processorPromise = null;
  function warmProcessor() {
    if (!processorPromise) {
      processorPromise = import('./pdfPages.client.js');
    }
    return processorPromise;
  }
  // Warm the (larger) pdf.js/pdf-lib import as soon as the visitor shows
  // intent, so the perceived cost at actual file-selection time is near
  // zero for anyone who uses the tool.
  dropzone.addEventListener('pointerenter', warmProcessor, { once: true });
  dropzone.addEventListener('focusin', warmProcessor, { once: true });

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

    setState('working');
    setStatus('Reading your file on this device…');
    resultEl.hidden = true;
    resultEl.innerHTML = '';

    try {
      const processor = await warmProcessor();
      await processor.run({
        mode,
        files,
        section: toolSection,
        dropzone,
        resultEl,
        setState,
        setStatus,
      });
    } catch (err) {
      setState('error');
      setStatus(err && err.message ? err.message : 'Something went wrong reading that file.', 'error');
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
}

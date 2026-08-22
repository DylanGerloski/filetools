// URL encode/decode processor. Dynamically imported by ./dropzone.client.js
// (routed by #tool's data-client="urlEncode") on first file selection/
// paste-convert click, or warmed on pointerenter/focus -- same lazy-load
// reasoning as ./dedupeLines.client.js. This tool has two input paths that
// both land here as the same File shape: a .txt file chosen/dropped through
// the normal drop zone, or text typed into the "paste text or a URL" text
// box (dropzone.client.js wraps the pasted text in a synthetic File before
// calling this module's run(), so this file never needs to know which path
// a given File came from).
//
// Unlike every other tool on this site, this one is bidirectional: the same
// pasted text is run through BOTH encodeUrlText and decodeUrlText at once,
// and both results render side by side (../pure/urlEncode.mjs -- pure
// logic, no DOM, unit-testable). There's no mode toggle to get wrong before
// you've even seen a result -- paste anything and see both directions
// immediately, then copy or download whichever one you actually needed.
// Encoding a real piece of text essentially never throws; decoding
// arbitrary pasted text often will (most real-world text isn't valid
// percent-encoding), so a decode failure only replaces the decoded panel
// with a friendly inline note -- the encoded panel still renders normally.
//
// No third-party dependency: encodeURIComponent/decodeURIComponent are
// browser built-ins, so this tool ships zero vendor bytes -- the lightest
// tool on the site.

const PREVIEW_CHAR_LIMIT = 200000;

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

function textBlob(text) {
  return new Blob([text], { type: 'text/plain;charset=utf-8' });
}

function previewOf(text) {
  return text.length > PREVIEW_CHAR_LIMIT ? `${text.slice(0, PREVIEW_CHAR_LIMIT)}\n…` : text;
}

/**
 * A working copy-to-clipboard button -- the one interaction on this page no
 * other tool on the site has (every other tool's only output action is a
 * file download). Falls back to a plain instruction if the Clipboard API
 * is unavailable or the browser denies permission, rather than failing
 * silently.
 *
 * @param {() => string} getText
 * @param {string} label
 * @param {boolean} primary whether this renders as the page's one
 *   accent-filled action (design-standards.md: exactly one per view).
 */
function makeCopyButton(getText, label, primary) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = primary ? 'btn-primary' : 'btn-secondary';
  btn.textContent = label;
  let resetTimer = null;
  btn.addEventListener('click', async () => {
    if (resetTimer) clearTimeout(resetTimer);
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('no Clipboard API');
      await navigator.clipboard.writeText(getText());
      btn.textContent = 'Copied';
    } catch (err) {
      btn.textContent = 'Couldn’t copy - select the text and copy manually';
    }
    resetTimer = setTimeout(() => { btn.textContent = label; }, 2000);
  });
  return btn;
}

/**
 * One result panel: a labeled, read-only text block plus copy/download
 * actions. Shared by both the encoded and decoded panels.
 *
 * @param {string} title
 * @param {string} text
 * @param {string} downloadName
 * @param {boolean} primary whether this panel's copy button is the page's
 *   one accent-filled action.
 */
function renderPanel(title, text, downloadName, primary) {
  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';
  const badge = document.createElement('span');
  badge.className = 'page-badge';
  const charCount = text.length;
  badge.textContent = `${title} - ${charCount.toLocaleString()} character${charCount === 1 ? '' : 's'}`;
  head.appendChild(badge);
  block.appendChild(head);

  const pre = document.createElement('pre');
  pre.className = 'json-preview';
  pre.textContent = previewOf(text);
  block.appendChild(pre);

  if (text.length > PREVIEW_CHAR_LIMIT) {
    const previewNote = document.createElement('p');
    previewNote.className = 'caption';
    previewNote.textContent = 'Showing the first part of the result. Copy or download to get all of it.';
    block.appendChild(previewNote);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';
  btnRow.appendChild(makeCopyButton(() => text, `Copy ${title.toLowerCase()}`, primary));
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-secondary';
  downloadBtn.textContent = `Download ${downloadName}`;
  downloadBtn.addEventListener('click', () => downloadBlob(textBlob(text), downloadName));
  btnRow.appendChild(downloadBtn);
  block.appendChild(btnRow);

  return block;
}

/**
 * Renders the shared option toggle plus both result panels. Re-invoked in
 * place whenever a visitor flips the option checkbox -- same pattern as
 * ../browser/transposeCsv.client.js's renderResult.
 *
 * @param {HTMLElement} resultEl
 * @param {string} text raw file/paste text.
 * @param {{plusForSpace: boolean}} optionState
 * @param {Function} encodeUrlText from ../pure/urlEncode.mjs.
 * @param {Function} decodeUrlText from ../pure/urlEncode.mjs.
 */
function renderResult(resultEl, text, optionState, encodeUrlText, decodeUrlText) {
  resultEl.innerHTML = '';

  const optionsRow = document.createElement('div');
  optionsRow.className = 'table-block-head';
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = optionState.plusForSpace;
  checkbox.addEventListener('change', () => {
    optionState.plusForSpace = checkbox.checked;
    renderResult(resultEl, text, optionState, encodeUrlText, decodeUrlText);
  });
  label.appendChild(checkbox);
  label.appendChild(document.createTextNode(' Encode/decode spaces as + (form style) instead of %20'));
  optionsRow.appendChild(label);
  resultEl.appendChild(optionsRow);

  const panelsRow = document.createElement('div');
  panelsRow.className = 'dual-result-row';

  const encoded = encodeUrlText(text, optionState);
  panelsRow.appendChild(renderPanel('Percent-encoded', encoded, 'encoded.txt', true));

  const decoded = decodeUrlText(text, optionState);
  if (decoded.ok) {
    panelsRow.appendChild(renderPanel('Decoded', decoded.value, 'decoded.txt', false));
  } else {
    const block = document.createElement('div');
    block.className = 'table-block';
    const head = document.createElement('div');
    head.className = 'table-block-head';
    const badge = document.createElement('span');
    badge.className = 'page-badge';
    badge.textContent = 'Decoded';
    head.appendChild(badge);
    block.appendChild(head);
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = decoded.error;
    block.appendChild(msg);
    panelsRow.appendChild(block);
  }

  resultEl.appendChild(panelsRow);

  const supportNote = document.createElement('p');
  supportNote.className = 'support-note';
  supportNote.innerHTML = 'That ran entirely on your machine - no servers, no cost to run. If it saved you time, you can buy me a coffee: '
    + '<a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>'
    + ' &middot; '
    + '<a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>.';
  resultEl.appendChild(supportNote);

  resultEl.hidden = false;
}

/**
 * @param {{files:File[], resultEl:Element, setState:Function, setStatus:Function}} ctx
 */
export async function run(ctx) {
  const { files, resultEl, setState, setStatus } = ctx;
  const file = files[0];
  setState('working');
  setStatus('Reading that on this device…');

  const [{ encodeUrlText, decodeUrlText }] = await Promise.all([
    import('../pure/urlEncode.mjs'),
  ]);

  const text = await file.text();

  resultEl.innerHTML = '';

  if (!text.trim()) {
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That’s empty - paste or drop some text first.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('error');
    setStatus('That’s empty - paste or drop some text first.', 'error');
    return;
  }

  const optionState = { plusForSpace: false };
  renderResult(resultEl, text, optionState, encodeUrlText, decodeUrlText);

  const decoded = decodeUrlText(text, optionState);
  setState('done');
  setStatus(
    decoded.ok
      ? 'Encoded and decoded below. Copy or download whichever one you need.'
      : 'Encoded below. That text isn’t valid percent-encoding, so there’s nothing meaningful to decode.',
    'success'
  );
}

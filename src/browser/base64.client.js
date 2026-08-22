// Base64 encode/decode processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="base64") on first
// file selection/paste-convert click, or warmed on pointerenter/focus --
// same lazy-load reasoning as ./transposeCsv.client.js. This tool has two
// input paths that both land here as the same File shape: a file of any
// type chosen/dropped through the normal drop zone, or text typed into the
// "paste text or Base64" text box (dropzone.client.js wraps the pasted text
// in a synthetic File before calling this module's run(), so this file
// never needs to know which path a given File came from).
//
// BYTES, NOT TEXT, ARE THE SHARED SOURCE OF TRUTH: this file always reads
// the input File as raw bytes (file.arrayBuffer()), never file.text() --
// text() would run every byte through a lossy UTF-8 decode before this
// tool ever gets a chance to look at it, corrupting exactly the case (a
// dropped binary file being Base64-ENCODED) this tool exists to handle
// correctly. A pasted string wrapped in a File by dropzone.client.js still
// round-trips correctly through arrayBuffer(): the Blob constructor UTF-8-
// encodes a JS string when the File is created, which is the same
// transform src/pure/base64.mjs's own encodeTextToBase64() would apply, so
// the two input paths need no special-casing here at all.
//
// The Base64 codec itself -- the RFC 4648 encode/decode, grammar
// validation, and magic-byte sniff -- is pure logic that lives in
// ../pure/base64.mjs so it stays unit-testable without a DOM; this file's
// job is only to (a) read the File's bytes, (b) render the mode/URL-safe
// toggles, copy button, and result, and (c) re-run the pure logic in place
// whenever a visitor flips a toggle -- same re-render-in-place pattern as
// ../browser/transposeCsv.client.js's renderResult.

const MAX_PREVIEW_CHARS = 200000;

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
 * Renders the mode/URL-safe toggles, the result (text box, binary
 * download, or an error), and the copy/download actions. Re-invoked in
 * place whenever a visitor changes a toggle -- same pattern as
 * ../browser/transposeCsv.client.js's renderResult.
 *
 * @param {HTMLElement} resultEl
 * @param {Uint8Array} rawBytes the raw input bytes, read once at run() time.
 * @param {object} optionState { mode: 'encode'|'decode', urlSafe: boolean }.
 * @param {object} pureModule ../pure/base64.mjs's exports.
 */
function renderResult(resultEl, rawBytes, optionState, pureModule) {
  resultEl.innerHTML = '';
  const { bytesToBase64, decodeBase64ToText, sniffFileExtension } = pureModule;

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';

  ['encode', 'decode'].forEach((value) => {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'base64-mode';
    radio.value = value;
    radio.checked = optionState.mode === value;
    radio.addEventListener('change', () => {
      if (radio.checked) {
        optionState.mode = value;
        renderResult(resultEl, rawBytes, optionState, pureModule);
      }
    });
    label.appendChild(radio);
    label.appendChild(document.createTextNode(` ${value === 'encode' ? 'Encode' : 'Decode'}`));
    head.appendChild(label);
  });

  const urlSafeLabel = document.createElement('label');
  const urlSafeCheckbox = document.createElement('input');
  urlSafeCheckbox.type = 'checkbox';
  urlSafeCheckbox.checked = optionState.urlSafe;
  urlSafeCheckbox.addEventListener('change', () => {
    optionState.urlSafe = urlSafeCheckbox.checked;
    renderResult(resultEl, rawBytes, optionState, pureModule);
  });
  urlSafeLabel.appendChild(urlSafeCheckbox);
  urlSafeLabel.appendChild(document.createTextNode(' URL-safe (- and _ instead of + and /)'));
  head.appendChild(urlSafeLabel);

  block.appendChild(head);

  let resultText = null; // set when there's text to show/copy/download as .txt
  let binaryDownload = null; // set when decode produced non-text bytes

  if (optionState.mode === 'encode') {
    if (rawBytes.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'alert alert-warn';
      msg.setAttribute('role', 'alert');
      msg.textContent = 'There’s nothing to encode - that file or pasted text is empty.';
      block.appendChild(msg);
    } else {
      resultText = bytesToBase64(rawBytes, { urlSafe: optionState.urlSafe });
    }
  } else {
    const outcome = decodeBase64ToText(new TextDecoder('utf-8').decode(rawBytes), { urlSafe: optionState.urlSafe });
    if (!outcome.ok) {
      const msg = document.createElement('div');
      msg.className = 'alert alert-danger';
      msg.setAttribute('role', 'alert');
      msg.textContent = outcome.error;
      block.appendChild(msg);
    } else if (outcome.notText) {
      const { ext, mimeType } = sniffFileExtension(outcome.bytes);
      const msg = document.createElement('div');
      msg.className = 'alert alert-warn';
      msg.setAttribute('role', 'alert');
      msg.textContent = `That Base64 decodes to ${outcome.bytes.length.toLocaleString()} bytes of binary data, not text (likely a .${ext} file) - use the download button below to save it.`;
      block.appendChild(msg);
      binaryDownload = { bytes: outcome.bytes, filename: `decoded.${ext}`, mimeType };
    } else {
      resultText = outcome.text;
    }
  }

  if (resultText !== null) {
    const textarea = document.createElement('textarea');
    textarea.className = 'paste-textarea base64-output';
    textarea.readOnly = true;
    textarea.spellcheck = false;
    textarea.rows = 8;
    textarea.value = resultText.length > MAX_PREVIEW_CHARS
      ? `${resultText.slice(0, MAX_PREVIEW_CHARS)}\n… (${(resultText.length - MAX_PREVIEW_CHARS).toLocaleString()} more characters truncated in this preview - the download and copy both include the full result)`
      : resultText;
    block.appendChild(textarea);

    const badge = document.createElement('span');
    badge.className = 'page-badge';
    badge.textContent = `${resultText.length.toLocaleString()} character${resultText.length === 1 ? '' : 's'}`;
    // Right after the head row, before the textarea -- block currently
    // holds exactly [head, textarea] at this point.
    block.insertBefore(badge, textarea);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';

  if (resultText !== null) {
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn-secondary';
    copyBtn.textContent = 'Copy to clipboard';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(resultText);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy to clipboard'; }, 2000);
      } catch {
        copyBtn.textContent = 'Couldn’t copy - select the text and copy manually';
        setTimeout(() => { copyBtn.textContent = 'Copy to clipboard'; }, 3000);
      }
    });
    btnRow.appendChild(copyBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'btn-primary';
    downloadBtn.textContent = optionState.mode === 'encode' ? 'Download encoded.txt' : 'Download decoded.txt';
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([resultText], { type: 'text/plain;charset=utf-8' });
      downloadBlob(blob, optionState.mode === 'encode' ? 'encoded.txt' : 'decoded.txt');
    });
    btnRow.appendChild(downloadBtn);
  }

  if (binaryDownload) {
    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'btn-primary';
    downloadBtn.textContent = `Download ${binaryDownload.filename}`;
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([binaryDownload.bytes], { type: binaryDownload.mimeType });
      downloadBlob(blob, binaryDownload.filename);
    });
    btnRow.appendChild(downloadBtn);
  }

  if (btnRow.children.length) block.appendChild(btnRow);

  const supportNote = document.createElement('p');
  supportNote.className = 'support-note';
  supportNote.innerHTML = 'That ran entirely on your machine - no servers, no cost to run. If it saved you time, you can buy me a coffee: '
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
  setStatus('Reading that on this device…');

  const pureModule = await import('../pure/base64.mjs');

  const buffer = await file.arrayBuffer();
  const rawBytes = new Uint8Array(buffer);

  // Default mode: a real dropped/chosen file (anything other than the
  // synthetic paste File dropzone.client.js names 'pasted-input.txt') is
  // almost always someone wanting its Base64, i.e. encode; pasted content
  // could be either, so encode stays the default there too since it's the
  // more common first action (competitor tools this page is measured
  // against -- see docs/design/REFERENCE_LIBRARY.md -- default to encode
  // as well) and the mode toggle is one click away either way.
  const optionState = { mode: 'encode', urlSafe: false };
  renderResult(resultEl, rawBytes, optionState, pureModule);

  setState('done');
  if (rawBytes.length === 0) {
    setStatus('Finished reading - nothing there to convert.', 'error');
  } else {
    setStatus(`Read ${rawBytes.length.toLocaleString()} byte${rawBytes.length === 1 ? '' : 's'}. Review below, then copy or download.`, 'success');
  }
}

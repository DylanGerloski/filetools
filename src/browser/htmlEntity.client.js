// HTML entity encode/decode processor. Dynamically imported by
// ./dropzone.client.js (routed by #tool's data-client="htmlEntity") on
// first file selection/paste-convert click, or warmed on pointerenter/
// focus -- same lazy-load reasoning as ./dedupeLines.client.js. This tool
// has two input paths that both land here as the same File shape: a
// .txt/.html file chosen/dropped through the normal drop zone, or text
// typed into the "paste text or markup" text box (dropzone.client.js wraps
// the pasted text in a synthetic File before calling this module's run(),
// so this file never needs to know which path a given File came from).
//
// The actual encode/decode math -- the named-entity table, the numeric
// entity parsing, the character scanning -- is pure logic that lives in
// ../pure/htmlEntity.mjs so it stays unit-testable without a DOM; this
// file's job is only to (a) read the File's text, (b) render the
// direction/scope/format controls and the result, and (c) re-run the pure
// logic in place whenever a visitor changes an option.
//
// SECURITY (docs/SECURITY_STANDARDS.md): the decoded result is untrusted,
// visitor-controlled text that can legitimately contain something that
// LOOKS like markup once decoded (decoding "&lt;script&gt;" produces the
// literal text "<script>"). That text is written to the page via
// `.textContent` ONLY, below (renderResult's outputEl.textContent = ...) --
// never `innerHTML`, never inserted as a DOM node built from a parsed
// string. There is also no DOMParser anywhere in this file: unlike
// ../browser/htmlTableToCsv.client.js, this tool never needs the browser's
// own HTML parser at all (../pure/htmlEntity.mjs's decoder is a
// hand-written regex/table lookup -- see that file's header for why), so
// there is no parsed-but-detached-document resource-loading risk to defend
// against here in the first place.

const PREVIEW_LIMIT = 200000; // characters shown/copied/downloaded -- see run()'s length guard below for the friendly refusal past this.

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

/** UTF-8 BOM prefix so Excel/Notepad open accented text in the right encoding -- same convention every other tool's textBlob() here uses. */
function textBlob(text) {
  return new Blob(['﻿', text], { type: 'text/plain;charset=utf-8' });
}

const SCOPE_OPTIONS = [
  ['reserved', 'Only the required characters (& < > " \')'],
  ['all-non-ascii', 'Also encode accented letters, symbols, and emoji'],
];

const FORMAT_OPTIONS = [
  ['named', 'Named where available (&amp;copy;)'],
  ['decimal', 'Numeric decimal (&amp;#169;)'],
  ['hex', 'Numeric hex (&amp;#xA9;)'],
];

function pluralChar(n) {
  return n === 1 ? 'character' : 'characters';
}

/**
 * Renders the direction/scope/format controls, the stats badge, the
 * read-only result, and the copy/download buttons. Re-invoked in place
 * whenever a visitor changes a control -- same pattern as
 * ../browser/sortLines.client.js's renderResult.
 *
 * @param {HTMLElement} resultEl
 * @param {string} rawText the original input text, unchanged across re-renders.
 * @param {{direction:'encode'|'decode', scope:'reserved'|'all-non-ascii', format:'named'|'decimal'|'hex'}} optionState
 * @param {{encodeHtmlEntities: Function, decodeHtmlEntities: Function}} pure
 */
function renderResult(resultEl, rawText, optionState, pure) {
  resultEl.innerHTML = '';
  const { encodeHtmlEntities, decodeHtmlEntities } = pure;

  const block = document.createElement('div');
  block.className = 'table-block';

  const head = document.createElement('div');
  head.className = 'table-block-head';

  const badge = document.createElement('span');
  badge.className = 'page-badge';
  head.appendChild(badge);

  const directionLabel = document.createElement('label');
  directionLabel.appendChild(document.createTextNode('Direction '));
  const directionSelect = document.createElement('select');
  [['encode', 'Encode (text to entities)'], ['decode', 'Decode (entities to text)']].forEach(([value, text]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    option.selected = optionState.direction === value;
    directionSelect.appendChild(option);
  });
  directionSelect.addEventListener('change', () => {
    optionState.direction = directionSelect.value;
    renderResult(resultEl, rawText, optionState, pure);
  });
  directionLabel.appendChild(directionSelect);
  head.appendChild(directionLabel);

  if (optionState.direction === 'encode') {
    const scopeLabel = document.createElement('label');
    scopeLabel.appendChild(document.createTextNode('Scope '));
    const scopeSelect = document.createElement('select');
    SCOPE_OPTIONS.forEach(([value, text]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      option.selected = optionState.scope === value;
      scopeSelect.appendChild(option);
    });
    scopeSelect.addEventListener('change', () => {
      optionState.scope = scopeSelect.value;
      renderResult(resultEl, rawText, optionState, pure);
    });
    scopeLabel.appendChild(scopeSelect);
    head.appendChild(scopeLabel);

    const formatLabel = document.createElement('label');
    formatLabel.appendChild(document.createTextNode('Entity format '));
    const formatSelect = document.createElement('select');
    FORMAT_OPTIONS.forEach(([value, text]) => {
      const option = document.createElement('option');
      option.value = value;
      // Plain text, not the escaped markup shown in FORMAT_OPTIONS's own
      // label above (which is written straight into an .innerHTML template
      // literal below) -- an <option> takes textContent-safe plain text, so
      // strip the &amp;-escaping back out rather than showing a visitor a
      // literal "&amp;copy;" in the dropdown.
      option.textContent = text.replace(/&amp;/g, '&');
      option.selected = optionState.format === value;
      formatSelect.appendChild(option);
    });
    formatSelect.addEventListener('change', () => {
      optionState.format = formatSelect.value;
      renderResult(resultEl, rawText, optionState, pure);
    });
    formatLabel.appendChild(formatSelect);
    head.appendChild(formatLabel);
  }

  block.appendChild(head);

  let outcomeText;
  if (optionState.direction === 'encode') {
    const outcome = encodeHtmlEntities(rawText, { scope: optionState.scope, format: optionState.format });
    outcomeText = outcome.output;
    badge.textContent = outcome.encodedCount > 0
      ? `${outcome.encodedCount} of ${outcome.totalChars} ${pluralChar(outcome.totalChars)} encoded`
      : `No characters needed encoding - ${outcome.totalChars} ${pluralChar(outcome.totalChars)} unchanged`;
  } else {
    const outcome = decodeHtmlEntities(rawText);
    outcomeText = outcome.output;
    if (outcome.totalEntities === 0) {
      badge.textContent = 'No entities found - nothing to decode';
    } else if (outcome.unrecognizedCount > 0) {
      badge.textContent = `${outcome.decodedCount} of ${outcome.totalEntities} entities decoded - ${outcome.unrecognizedCount} left as-is (not recognized)`;
    } else {
      badge.textContent = `${outcome.decodedCount} ${outcome.decodedCount === 1 ? 'entity' : 'entities'} decoded`;
    }
  }

  // Read-only result. Untrusted, visitor-derived text (a decoded value can
  // legitimately contain "<script>"-looking text) is written via
  // .textContent ONLY -- see this file's header SECURITY note.
  const outputEl = document.createElement('pre');
  outputEl.className = 'entity-output';
  outputEl.textContent = outcomeText;
  block.appendChild(outputEl);

  const btnRow = document.createElement('div');
  btnRow.className = 'download-btn-row';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn-secondary';
  const COPY_LABEL = 'Copy to clipboard';
  copyBtn.textContent = COPY_LABEL;
  copyBtn.disabled = outcomeText.length === 0;
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(outcomeText);
      copyBtn.textContent = 'Copied';
      setTimeout(() => { copyBtn.textContent = COPY_LABEL; }, 2000);
    } catch (err) {
      copyBtn.textContent = 'Couldn’t copy - select the text and copy it manually';
    }
  });
  btnRow.appendChild(copyBtn);

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  const downloadName = optionState.direction === 'encode' ? 'encoded.txt' : 'decoded.txt';
  downloadBtn.textContent = `Download ${downloadName}`;
  downloadBtn.disabled = outcomeText.length === 0;
  downloadBtn.addEventListener('click', () => {
    downloadBlob(textBlob(outcomeText), downloadName);
  });
  btnRow.appendChild(downloadBtn);

  block.appendChild(btnRow);

  const supportNote = document.createElement('p');
  supportNote.className = 'support-note';
  supportNote.innerHTML = 'That ran entirely on your machine, with no server and no hosting cost on my end. If it saved you time, you can buy me a coffee: '
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
  setStatus('Reading that text on this device…');

  const pure = await import('../pure/htmlEntity.mjs');

  const text = await file.text();

  if (!text.trim()) {
    resultEl.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = 'That file or pasted text is empty - there’s nothing to convert.';
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('Finished reading - no text found.', 'error');
    return;
  }

  // The dropzone's own MAX_BYTES_BY_CLIENT already caps the file/paste this
  // tool ever receives (see ./dropzone.client.js's htmlEntity entry) -- this
  // is a second, tighter guard specifically on rendered/copied output length,
  // since an all-non-ascii numeric-entity encode can grow a short input into
  // a much longer string (every emoji becomes up to 8 characters of
  // "&#128512;"), and a wall of text past this length would make the
  // on-page preview and clipboard copy sluggish rather than instant.
  if (text.length > PREVIEW_LIMIT) {
    resultEl.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'alert alert-warn';
    msg.setAttribute('role', 'alert');
    msg.textContent = `That text is too long (${text.length.toLocaleString()} characters). This tool handles up to ${PREVIEW_LIMIT.toLocaleString()} characters at a time - try a shorter selection.`;
    resultEl.appendChild(msg);
    resultEl.hidden = false;
    setState('done');
    setStatus('Finished reading - that text was too long.', 'error');
    return;
  }

  const optionState = { direction: 'encode', scope: 'reserved', format: 'named' };
  renderResult(resultEl, text, optionState, pure);

  setState('done');
  setStatus('Converted. Review below, then copy or download.', 'success');
}

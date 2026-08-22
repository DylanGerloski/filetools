'use strict';

/**
 * Assembles every browser-client-facing structure that used to be
 * hand-maintained per tool (src/pages/toolPage.js's old MAX_BYTES_BY_CLIENT
 * const, src/browser/dropzone.client.js's old MAX_BYTES_BY_CLIENT/
 * PASTE_FILE/PROCESSORS consts) FROM the TOOLS registry's own
 * `clientEntry`/`maxBytes`/`pasteFile` fields -- see src/tools/pdf-merge.js's
 * comment above its own `family` field for what those per-tool fields mean.
 * Mirrors src/tools/index.js's own real discovery mechanism: TOOLS is
 * already auto-discovered from src/tools/*.js, so this file's only job is
 * to re-key that same data by `clientEntry` instead of by `slug`, the shape
 * every browser-facing consumer actually needs.
 *
 * Several tools legitimately share one clientEntry (pdf-merge/pdf-split/
 * pdf-rotate all use 'pdfPages', since they're driven by the same browser
 * client module) -- each of those tools' own src/tools/<slug>.js file
 * still declares the full maxBytes for that clientEntry (duplicated
 * across its sharers, not centralized), so adding a brand new tool is
 * still purely additive to that new tool's own file. What this module
 * buys instead is a build-time consistency check: if two tools that share
 * a clientEntry ever disagree on maxBytes, assembly throws immediately
 * rather than one value winning silently by whichever tool's file
 * happened to load last.
 *
 * maxBytes is required consistency (it gates every file reaching that
 * clientEntry, paste-submitted or not) -- pasteFile is not: a tool that
 * shares a clientEntry but has no `pasteInput` of its own (most sharers)
 * simply has no opinion on that clientEntry's pasteFile shape, so it's
 * excluded from the comparison rather than treated as declaring `null`
 * and conflicting with a sibling that does declare one. Only two tools
 * that BOTH declare a real pasteFile for the same clientEntry are checked
 * against each other.
 */

const { TOOLS } = require('./tools/index.js');

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * @returns {{
 *   CLIENT_FILES: string[],
 *   MAX_BYTES_BY_CLIENT: Record<string, number>,
 *   PASTE_FILE: Record<string, {name: string, type: string}>,
 * }}
 */
function assembleBrowserClients() {
  /** @type {Record<string, {maxBytes: number, pasteFile: object|null, declaredBy: string[]}>} */
  const byClientEntry = {};

  for (const tool of TOOLS) {
    const { clientEntry } = tool;
    if (!clientEntry) continue;
    if (typeof tool.maxBytes !== 'number') {
      throw new Error(`browserClients.js: tool "${tool.slug}" declares clientEntry "${clientEntry}" but no numeric maxBytes.`);
    }
    const entry = {
      maxBytes: tool.maxBytes,
      pasteFile: tool.pasteFile || null,
      declaredBy: [tool.slug],
    };
    const existing = byClientEntry[clientEntry];
    if (!existing) {
      byClientEntry[clientEntry] = entry;
      continue;
    }
    if (existing.maxBytes !== entry.maxBytes) {
      throw new Error(
        `browserClients.js: clientEntry "${clientEntry}" is declared with inconsistent maxBytes -- `
        + `${existing.declaredBy.join(', ')} says ${existing.maxBytes}, ${tool.slug} says ${entry.maxBytes}. `
        + 'Every tool sharing a clientEntry must declare the identical maxBytes.',
      );
    }
    if (existing.pasteFile && entry.pasteFile && !sameJson(existing.pasteFile, entry.pasteFile)) {
      throw new Error(
        `browserClients.js: clientEntry "${clientEntry}" is declared with inconsistent pasteFile -- `
        + `${existing.declaredBy.join(', ')} says ${JSON.stringify(existing.pasteFile)}, ${tool.slug} says ${JSON.stringify(entry.pasteFile)}. `
        + 'Every tool sharing a clientEntry that declares a pasteFile must declare the identical one.',
      );
    }
    if (!existing.pasteFile && entry.pasteFile) existing.pasteFile = entry.pasteFile;
    existing.declaredBy.push(tool.slug);
  }

  const clientEntries = Object.keys(byClientEntry).sort();
  const CLIENT_FILES = clientEntries.map((c) => `${c}.client.js`);
  const MAX_BYTES_BY_CLIENT = {};
  const PASTE_FILE = {};
  for (const c of clientEntries) {
    MAX_BYTES_BY_CLIENT[c] = byClientEntry[c].maxBytes;
    if (byClientEntry[c].pasteFile) PASTE_FILE[c] = byClientEntry[c].pasteFile;
  }

  return { CLIENT_FILES, MAX_BYTES_BY_CLIENT, PASTE_FILE };
}

module.exports = { assembleBrowserClients };

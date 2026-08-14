/**
 * RFC 4180 CSV serialization. Pure data in, pure data out -- no DOM, no
 * pdf.js -- directly unit-testable in Node (test/csv.test.mjs) and loaded
 * client-side the same way src/pure/pageRange.mjs already is.
 */

/**
 * @param {string} field
 * @returns {string} the field, quoted and with internal quotes doubled if
 *   it contains a comma, a double quote, a CR, or an LF -- otherwise
 *   returned as-is.
 */
export function csvEscapeField(field) {
  const str = String(field == null ? '' : field);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * @param {string[][]} rows
 * @returns {string} RFC 4180 CSV text with CRLF row endings. No UTF-8 BOM
 *   here -- the BOM is a download-time concern (it must be the first three
 *   bytes of the actual downloaded blob, not the string), so the caller
 *   that builds the Blob is what prefixes '﻿'.
 */
export function rowsToCsv(rows) {
  return rows.map((row) => row.map(csvEscapeField).join(',')).join('\r\n') + '\r\n';
}

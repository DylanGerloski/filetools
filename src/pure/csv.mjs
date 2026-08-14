/**
 * RFC 4180 CSV serialization. Pure data in, pure data out -- no DOM, no
 * pdf.js -- directly unit-testable in Node (test/csv.test.mjs) and loaded
 * client-side the same way src/pure/pageRange.mjs already is.
 */

/**
 * A leading '=', '+', '@', TAB, or CR makes Excel/Sheets/LibreOffice
 * interpret the cell as a formula when the CSV is opened -- the OWASP
 * "CSV Injection" class. RFC 4180 quoting alone does not neutralize this:
 * a formula-injection payload rarely contains a comma/quote/CR/LF itself,
 * so it can sail through csvEscapeField's quoting check untouched.
 */
const DANGEROUS_LEADING_CHAR_RE = /^[=+@\t\r]/;

/**
 * Bank-statement CSVs (statement-to-csv) legitimately contain leading-minus
 * negative amounts (e.g. '-42.50', '-1,234.50'); OWASP's remediation
 * includes a bare leading '-' in the dangerous set, but blanket-prefixing
 * it would corrupt every such value. Only prefix a leading '-' when what
 * follows isn't a plain negative number.
 */
const NEGATIVE_NUMBER_RE = /^-(\d{1,3}(,\d{3})*|\d+)(\.\d+)?$/;

/**
 * @param {string} str
 * @returns {string} str, or str prefixed with a single quote if its first
 *   character would make a spreadsheet application treat the cell as a
 *   formula on open.
 */
function neutralizeFormulaInjection(str) {
  if (str.length === 0) return str;
  if (DANGEROUS_LEADING_CHAR_RE.test(str)) {
    return `'${str}`;
  }
  if (str[0] === '-' && !NEGATIVE_NUMBER_RE.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * @param {string} field
 * @returns {string} the field, formula-injection-neutralized (see
 *   neutralizeFormulaInjection), then quoted and with internal quotes
 *   doubled if it contains a comma, a double quote, a CR, or an LF --
 *   otherwise returned as-is.
 */
export function csvEscapeField(field) {
  const str = neutralizeFormulaInjection(String(field == null ? '' : field));
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

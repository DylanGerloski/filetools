/**
 * Parses a human-typed page range string ("1-3, 7, 9-12") into a
 * deduplicated, ascending list of zero-based page indices, clamped to
 * [0, pageCount). Pure data in, pure data out -- no DOM, no pdf.js, so it is
 * directly unit-testable in Node (test/pageRange.test.mjs).
 *
 * ESM (not CommonJS): this file is loaded two different ways -- Node's test
 * runner (test/pageRange.test.mjs) and a native browser `import()` from
 * src/browser/pdfPages.client.js, which requires real `export` syntax. The
 * .mjs extension is what makes Node treat it as ESM despite this project's
 * package.json declaring "type": "commonjs" for everything else.
 *
 * Accepts (and is tested against): extra whitespace, reversed ranges
 * ("5-2"), duplicate/overlapping entries, out-of-bounds numbers, and
 * trailing commas. Throws a plain Error with a message meant to be shown to
 * the visitor as-is (src/browser/pdfPages.client.js catches it) for input
 * that contains no parseable number at all.
 *
 * @param {string} input 1-based page range string, as typed by a visitor.
 * @param {number} pageCount total pages in the document, for clamping.
 * @returns {number[]} zero-based page indices, ascending, deduplicated.
 */
export function parsePageRange(input, pageCount) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return [];

  const seen = new Set();
  const parts = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  let matchedAny = false;

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const singleMatch = part.match(/^(\d+)$/);

    if (rangeMatch) {
      matchedAny = true;
      let start = parseInt(rangeMatch[1], 10);
      let end = parseInt(rangeMatch[2], 10);
      if (start > end) [start, end] = [end, start];
      for (let n = start; n <= end; n += 1) {
        if (n >= 1 && n <= pageCount) seen.add(n - 1);
      }
    } else if (singleMatch) {
      matchedAny = true;
      const n = parseInt(singleMatch[1], 10);
      if (n >= 1 && n <= pageCount) seen.add(n - 1);
    }
    // Anything else (stray text) is silently skipped rather than throwing --
    // a partial valid range is more useful to the visitor than an all-or-
    // nothing failure, and the caller can still warn if the result is empty.
  }

  if (!matchedAny) {
    throw new Error(`"${input}" doesn’t look like a page range. Try something like "1-3, 7, 9-12".`);
  }

  return Array.from(seen).sort((a, b) => a - b);
}

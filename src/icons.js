'use strict';

/**
 * Two-part icon marks: replaces the old single-color, single-shape glyph
 * set (24x24 monochrome outline, 8 of 17 tool slugs silently sharing one
 * generic fallback icon) with a per-family icon/color system.
 *
 * Construction ("no taste calls left" once the mark table below is fixed):
 *   FORMAT PLATE (family identity, filled var(--mark-plate), a shared
 *   rounded-rect keyline with a white knockout motif) + ACTION PIP (the
 *   verb, a small ringed badge over the plate's bottom-right corner,
 *   stroked var(--mark-ink)) = every mark. For a converter, the pip is
 *   inked in the TARGET family, so the mark literally reads "this format
 *   becomes that format". 17 marks compose from 5 plates x 9 verbs (14
 *   drawn primitives total) plus 2 motif modifiers for the two
 *   near-duplicate marks (see the `motif` field on MARKS below).
 *
 * Geometry is a fixed 32x32 keyline grid, identical for every mark --
 * that shared grid is what makes the set read as one family:
 *   - Plate: x 2-22, y 3-29 (20x26), rx 3, fill var(--mark-plate).
 *   - Motif: knocked out of the plate in var(--color-surface), inside
 *     roughly x 5-19, y 7-26.
 *   - Pip: circle cx 24.5 cy 24.5 r 6.5, fill var(--color-surface), ring
 *     stroke var(--mark-ink) width 1.5, overlapping the plate's
 *     bottom-right corner.
 *   - Verb glyph: inside a 7x7 box centred on the pip, stroke
 *     var(--mark-ink) width 1.75, fill none, round caps/joins.
 * No hex or rgb literal appears anywhere below -- every color is a CSS
 * custom property, set by the two wrapper classes markFor() emits
 * (`.mark--<family>` for plate/wash, `.mark-ink--<family>` for the pip) --
 * see src/css.js and src/families.js for where those resolve. The only
 * non-var color values are `var(--color-surface)` (the knockout white)
 * and plain numeric `opacity` (never a color channel).
 */

const { familyOf } = require('./families.js');

const SURFACE = 'var(--color-surface)';
const MOTIF_STROKE = `stroke="${SURFACE}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
const PIP_STROKE = 'stroke="var(--mark-ink)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"';

function plateRect() {
  return '<rect x="2" y="3" width="20" height="26" rx="3" fill="var(--mark-plate)"/>';
}

/**
 * `csv`'s grid lines, reused verbatim by `sheet` (sheet = csv grid plus
 * two sheet tabs cut into the bottom edge -- Excel's one unmistakable
 * visual, and what keeps `sheet` from reading as plain `csv`).
 */
function csvGridLines() {
  return `<path d="M8.5 8V26M12 8V26M15.5 8V26" stroke="${SURFACE}" stroke-width="1.5"/>`
    + `<path d="M5 12.5H19M5 17H19M5 21.5H19" stroke="${SURFACE}" stroke-width="1.5"/>`;
}

/**
 * @param {'default'|'html'} variant `html` (html-table-to-csv) swaps the
 *   header-row band for a white angle-bracket pair -- a csv plate whose
 *   input is HTML markup, not an actual table, so the header band (which
 *   implies "these are already columns") would be misleading.
 */
function csvMotif(variant) {
  const header = variant === 'html'
    ? `<path d="M8.5 7.75 5.75 9.75 8.5 11.75M14.5 7.75 17.25 9.75 14.5 11.75" ${MOTIF_STROKE.replace('1.75', '1.5')}/>`
    : `<rect x="5" y="7" width="14" height="5.5" fill="${SURFACE}" opacity="0.22"/>`;
  return header + csvGridLines();
}

/**
 * @param {'default'|'bank'} variant `bank` (bank-statement-to-csv) swaps
 *   the lower ruled line for the currency-squiggle path already drawn for
 *   this tool in the pre-two-part icon set -- reused verbatim (same `d`,
 *   only repositioned via a wrapping <g transform> from its old 24x24
 *   coordinate space into this plate's motif box) rather than redrawn,
 *   so this tool keeps the same distinguishing motif it already had.
 */
function pdfMotif(variant) {
  const fold = `<path d="M15 3 22 3 22 10Z" fill="${SURFACE}" opacity="0.55"/>`;
  const topLine = `<path d="M7 17H17" stroke="${SURFACE}" stroke-width="1.75" stroke-linecap="round"/>`;
  const lowerLine = variant === 'bank'
    // Original path (src/icons.js pre-rewrite, 24x24 space): a 3-hump
    // currency squiggle starting at (6, 14.2). Translated +3/+5.8 to land
    // where the replaced y=21, x7-17 ruled line sat in this 32x32 plate.
    ? `<g transform="translate(3,5.8)"><path d="M6 14.2c0-.7.7-1 1.5-1s1.5.3 1.5 1-.7 1-1.5 1-1.5.3-1.5 1 .7 1 1.5 1 1.5-.3 1.5-1" stroke="${SURFACE}" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`
    : `<path d="M7 21H17" stroke="${SURFACE}" stroke-width="1.75" stroke-linecap="round"/>`;
  return fold + topLine + lowerLine;
}

function jsonMotif() {
  const open = `<path d="M9.5 9c-2 0-2.5 1.2-2.5 2.8v2.2c0 1-.5 1.7-1.5 2 1 .3 1.5 1 1.5 2v2.2c0 1.6.5 2.8 2.5 2.8" ${MOTIF_STROKE}/>`;
  const close = `<path d="M14.5 9c2 0 2.5 1.2 2.5 2.8v2.2c0 1 .5 1.7 1.5 2-1 .3-1.5 1-1.5 2v2.2c0 1.6-.5 2.8-2.5 2.8" ${MOTIF_STROKE}/>`;
  const dot = `<circle cx="12" cy="16.5" r="1" fill="${SURFACE}"/>`;
  return open + close + dot;
}

function sheetMotif() {
  const header = `<rect x="5" y="7" width="14" height="5.5" fill="${SURFACE}" opacity="0.22"/>`;
  const tabs = `<rect x="5" y="26" width="4" height="3" fill="${SURFACE}"/><rect x="10" y="26" width="4" height="3" fill="${SURFACE}"/>`;
  return header + csvGridLines() + tabs;
}

function textMotif() {
  return `<path d="M6 10H18M6 15H15M6 20H17M6 25H12" stroke="${SURFACE}" stroke-width="1.75" stroke-linecap="round"/>`;
}

const PLATE_MOTIFS = {
  pdf: pdfMotif,
  csv: csvMotif,
  json: jsonMotif,
  sheet: sheetMotif,
  text: textMotif,
};

function pipRing() {
  return '<circle cx="24.5" cy="24.5" r="6.5" fill="var(--color-surface)" stroke="var(--mark-ink)" stroke-width="1.5"/>';
}

// The nine verb glyphs, each inside a 7x7 box centred on the pip
// (21-28, 21-28), drawn once and reused across every mark that needs it.
const VERB_PATHS = {
  merge: `<path ${PIP_STROKE} d="M22 22 24.5 24.5 22 27M24.5 24.5 27.3 24.5"/>`,
  split: `<path ${PIP_STROKE} d="M21.3 24.5 24.5 24.5M24.5 24.5 27.5 22M24.5 24.5 27.5 27"/>`,
  rotate: `<path ${PIP_STROKE} d="M24.5 21.3A3.2 3.2 0 1 1 21.3 24.5M20.2 23L21.3 24.5 22.9 23.6"/>`,
  convert: `<path ${PIP_STROKE} d="M21.3 24.5 27.3 24.5M24.8 22 27.3 24.5 24.8 27"/>`,
  compare: `<path ${PIP_STROKE} d="M22 22.8 27 22.8M24.7 21.3 27 22.8 24.7 24.3M27 26.2 22 26.2M24.3 24.7 22 26.2 24.3 27.7"/>`,
  dedupe: `<path ${PIP_STROKE} d="M22 22.3 27 22.3M22 26.7 27 26.7M22 25.3 27 28.1"/>`,
  sort: `<path ${PIP_STROKE} d="M21 21.8 26.5 21.8M21 24.5 25 24.5M21 27.2 23.5 27.2M27.6 21.3V27.3M26.1 25.8 27.6 27.3 29.1 25.8"/>`,
  transpose: `<path ${PIP_STROKE} d="M21.3 22.5 25.5 22.5 25.5 27.3M24.3 26.1 25.5 27.3 26.7 26.1"/>`,
  flatten: `<path ${PIP_STROKE} d="M21.7 23.3 23.2 21.5 24.7 23.3M25.3 23.3 26.8 21.5 28.3 23.3M21.7 27.3 28.3 27.3"/>`,
  // Word-frequency-counter's verb: three descending bars on a shared
  // baseline, reading as a mini ranked bar chart -- tallest bar first,
  // shortest last -- the same shape the tool's own frequency table has
  // (most-frequent word first).
  count: `<path ${PIP_STROKE} d="M22 27V21.7M25 27V24M28 27V25.8"/>`,
};

/**
 * The 17-tool mark table. `plate` = format family (silhouette + wash),
 * `verb` = the pip glyph, `ink` = the pip's color family (the TARGET
 * family for a converter, so the pip literally reads "becomes"). `motif`
 * names one of the two special-case plate variants -- a swapped motif
 * detail on an existing plate, never a whole new plate.
 */
const MARKS = {
  'merge-pdf': { plate: 'pdf', verb: 'merge', ink: 'pdf' },
  'split-pdf': { plate: 'pdf', verb: 'split', ink: 'pdf' },
  'rotate-pdf': { plate: 'pdf', verb: 'rotate', ink: 'pdf' },
  'pdf-to-csv': { plate: 'pdf', verb: 'convert', ink: 'csv' },
  'bank-statement-to-csv': { plate: 'pdf', verb: 'convert', ink: 'csv', motif: 'bank' },

  'merge-csv': { plate: 'csv', verb: 'merge', ink: 'csv' },
  'compare-csv': { plate: 'csv', verb: 'compare', ink: 'csv' },
  'split-csv': { plate: 'csv', verb: 'split', ink: 'csv' },
  'transpose-csv': { plate: 'csv', verb: 'transpose', ink: 'csv' },
  'html-table-to-csv': { plate: 'csv', verb: 'convert', ink: 'csv', motif: 'html' },

  'json-to-csv': { plate: 'json', verb: 'convert', ink: 'csv' },
  'flatten-json': { plate: 'json', verb: 'flatten', ink: 'json' },
  'yaml-to-json': { plate: 'json', verb: 'convert', ink: 'json' },

  'xlsx-to-csv': { plate: 'sheet', verb: 'convert', ink: 'csv' },
  'xlsx-to-json': { plate: 'sheet', verb: 'convert', ink: 'json' },

  'remove-duplicate-lines': { plate: 'text', verb: 'dedupe', ink: 'text' },
  'sort-lines': { plate: 'text', verb: 'sort', ink: 'text' },
  'word-frequency-counter': { plate: 'text', verb: 'count', ink: 'text' },
  'url-encode-decode': { plate: 'text', verb: 'convert', ink: 'text' },
};

// Never hit for a real registry slug (test/icons.test.mjs asserts that) --
// exists only so an unmapped/new slug fails safe instead of throwing.
// familyOf() itself already falls back to 'text'; this mirrors that here
// so a mark can still render (as a plain text/convert/text mark) for a
// brief window before a new tool's MARKS row lands.
function markDef(slug) {
  return MARKS[slug] || { plate: familyOf(slug), verb: 'convert', ink: familyOf(slug) };
}

/**
 * @param {string} slug a tool's `slug` field.
 * @param {string} [extraClass] an additional class to add alongside the
 *   two color-context classes (e.g. `"tool-row-icon"`, `"dz-icon"`) so
 *   callers can size the mark without a second markup pass -- unlike the
 *   old iconFor()+string-replace pattern, markFor() never needs its
 *   output post-processed, since a two-part mark already carries the
 *   `mark mark--<family> mark-ink--<family>` classes that set its own
 *   `--mark-plate`/`--mark-wash`/`--mark-ink` custom properties.
 * @returns {string} inline SVG markup for that tool's mark.
 */
function markFor(slug, extraClass) {
  const def = markDef(slug);
  const classes = ['mark', `mark--${def.plate}`, `mark-ink--${def.ink}`];
  if (extraClass) classes.push(extraClass);
  const motif = PLATE_MOTIFS[def.plate](def.motif);
  const verb = VERB_PATHS[def.verb];
  return `<svg viewBox="0 0 32 32" class="${classes.join(' ')}" aria-hidden="true" focusable="false">${plateRect()}${motif}${pipRing()}${verb}</svg>`;
}

module.exports = { markFor, MARKS, VERB_PATHS, PLATE_MOTIFS };

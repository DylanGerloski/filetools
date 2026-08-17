/**
 * Shared drawing primitives for the "page strip" family of inline SVG
 * diagrams (Pattern D and, for its left-column drawn source, Pattern E --
 * see src/examples/index.mjs's module-header comment). PDF page-level
 * operations (merge, split, rotate) and PDF/XLSX table extraction have no
 * textual result that can be run through a pure module and shown as-is at
 * build time, so these
 * tools get an abstract before/after or source drawing instead of a real
 * computed table -- the honest alternative the spec calls for when a real
 * result genuinely can't be computed at build time.
 *
 * Deliberately NOT inside src/examples/ -- src/examples/index.mjs
 * auto-discovers every *.mjs file in that directory as a tool's example
 * module (expects {slug, ariaLabel, render}), so a shared helper file has
 * to live one level up to avoid being picked up as a (broken) 18th tool.
 *
 * Formerly src/diagrams.js (CJS, top-of-page standalone diagram, only
 * merge-pdf/split-pdf). Retired and folded in here as part of moving those
 * two diagrams into the example-panel system (Pattern D) alongside a new
 * rotate-pdf diagram -- see src/examples/merge-pdf.mjs, split-pdf.mjs,
 * rotate-pdf.mjs. The page()/arrow() drawing logic below is the same
 * geometry src/diagrams.js used, carried over rather than redrawn.
 */

// icons.js is CommonJS; Node's ESM loader supports named imports from a
// CJS module whose exports are a static object-literal assignment (this
// one is: `module.exports = { markFor, MARKS, VERB_PATHS, PLATE_MOTIFS }`),
// so this is a normal static import, not a dynamic/lazy one.
import { VERB_PATHS } from './icons.js';

export const STROKE = 'stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"';

/**
 * @param {number} x
 * @param {number} y
 * @param {{w?:number, h?:number, fill?:string, dashed?:boolean, extraClass?:string}} [opts]
 * @returns {string} a rounded-rect page glyph.
 */
export function page(x, y, opts = {}) {
  const { w = 34, h = 46, fill = 'none', dashed = false, extraClass = '' } = opts;
  const dash = dashed ? ' stroke-dasharray="3 3"' : '';
  const cls = extraClass ? ` class="${extraClass}"` : '';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" ${STROKE}${fill !== 'none' ? ` fill="${fill}"` : ''}${dash}${cls}/>`;
}

/** A straight left-to-right transformation arrow, centred vertically at `y`. */
export function arrow(x, y) {
  return `<path d="M${x} ${y}h28m-8-8 8 8-8 8" ${STROKE}/>`;
}

/**
 * Reuses src/icons.js's `rotate` verb glyph geometry (a 270-degree arc with
 * an arrowhead, drawn there in a 7x7 box centred on a tool mark's action
 * pip) -- extracted from the live VERB_PATHS constant (not a hand-copied
 * literal, so it can't drift from the icon system) and repositioned via a
 * <g transform> into this diagram's larger coordinate space. Recolored to
 * `currentColor` (this diagram's own stroke context) rather than kept as
 * `var(--mark-ink)`, the same "reuse geometry, recolor to destination
 * context" pattern src/icons.js's own pdfMotif('bank') variant already
 * uses for reusing a pre-existing path.
 *
 * @param {number} cx centre x, in this diagram's coordinate space.
 * @param {number} cy centre y.
 * @param {number} [scale] the arc is natively drawn across ~7 units;
 *   scale it up to read clearly at diagram size.
 */
export function rotateArrow(cx, cy, scale = 4.2) {
  const d = ROTATE_ARC_D;
  // The native glyph is centred on (24.5, 24.5) in its own 32x32 box.
  const dx = cx / scale - 24.5;
  const dy = cy / scale - 24.5;
  return `<g transform="scale(${scale}) translate(${dx.toFixed(3)} ${dy.toFixed(3)})"><path d="${d}" stroke="currentColor" stroke-width="${(1.75 / scale).toFixed(3)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

// Extracted once, at module load, from icons.js's own VERB_PATHS.rotate
// string (see rotateArrow's doc comment above for why this is a live
// extraction rather than a copied literal).
const ROTATE_ARC_D = /d="([^"]+)"/.exec(VERB_PATHS.rotate)[1];

/**
 * A small abstract "page of tabular content" -- the drawn stand-in for a
 * source PDF page or spreadsheet sheet that can't be computed/rendered for
 * real at build time (Pattern E's left column). A header band plus ruled
 * rows, in the same restrained currentColor line language as page()/
 * arrow() above.
 *
 * @param {number} x
 * @param {number} y
 * @param {{w?:number, h?:number, rows?:number, sheetTabs?:boolean}} [opts]
 *   `sheetTabs` draws two small tabs on the bottom edge (matching the
 *   `sheet` icon plate's own distinguishing motif in src/icons.js) so an
 *   xlsx source reads as a spreadsheet rather than a generic page.
 */
export function ruledSourcePage(x, y, opts = {}) {
  const { w = 96, h = 120, rows = 4, sheetTabs = false } = opts;
  const pad = 8;
  const headerH = 16;
  const rect = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" ${STROKE}/>`;
  const header = `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${headerH}" fill="currentColor" opacity="0.14"/>`;
  const rowGap = (h - headerH - pad * 1.5) / rows;
  let rules = '';
  for (let i = 0; i < rows; i += 1) {
    const ry = y + headerH + pad + i * rowGap;
    rules += `<path d="M${x + pad} ${ry}H${x + w - pad}" stroke="currentColor" stroke-width="1.5" opacity="0.6" stroke-linecap="round"/>`;
  }
  const tabs = sheetTabs
    ? `<rect x="${x + pad}" y="${y + h}" width="${w * 0.3}" height="6" fill="currentColor" opacity="0.5"/><rect x="${x + pad + w * 0.36}" y="${y + h}" width="${w * 0.3}" height="6" fill="currentColor" opacity="0.5"/>`
    : '';
  return rect + header + rules + tabs;
}

/**
 * @param {string} inner raw SVG content.
 * @param {string} label the diagram's accessible name.
 * @param {{viewBox?:string}} [opts]
 * @returns {string} a bare <svg> -- NOT wrapped in a card div, since this
 *   always renders inside src/pages/toolPage.js's own .output-example
 *   figure/card, and design-standards.md forbids nested cards. Formerly
 *   src/diagrams.js's wrap() also emitted a `.transform-diagram` div
 *   wrapper for its old standalone top-of-page placement; that div (and
 *   its now-unused card styling) is retired along with the file.
 */
export function svg(inner, label, opts = {}) {
  const { viewBox = '0 0 480 140' } = opts;
  return `<svg viewBox="${viewBox}" role="img" aria-label="${label}" class="transform-diagram-svg">${inner}</svg>`;
}

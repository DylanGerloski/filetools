'use strict';

/**
 * Before -> after transformation diagrams -- the Distinctiveness Gate's
 * "at least one visual element unique to this product" item. Each diagram
 * is task-relevant information, not decoration (design-standards.md/
 * security-standards.md both prohibit decorative stock imagery): it shows,
 * rather than describes in prose, exactly what a tool does to a file.
 * Inline SVG so there's no extra request, no CLS, and no new third-party
 * origin.
 *
 * Scoped to the two highest-value tools that exist in this build's TOOLS
 * registry today (merge-pdf, split-pdf -- csv-merge/csv-compare tools
 * aren't merged to master yet). Depth over breadth: two well-made diagrams
 * beat four rushed ones.
 */

const STROKE = 'stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"';

function page(x, y, opts = {}) {
  const { w = 34, h = 46, fill = 'none', dashed = false } = opts;
  const dash = dashed ? ' stroke-dasharray="3 3"' : '';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" ${STROKE}${fill !== 'none' ? ` fill="${fill}"` : ''}${dash}/>`;
}

function arrow(x, y) {
  return `<path d="M${x} ${y}h28m-8-8 8 8-8 8" ${STROKE}/>`;
}

function wrap(inner, label) {
  return `<div class="transform-diagram">
        <svg viewBox="0 0 480 140" role="img" aria-label="${label}" class="transform-diagram-svg">${inner}</svg>
      </div>`;
}

/** Two separate page strips converging into one continuous strip. */
function mergePdfDiagram() {
  const inner = `
    <text x="40" y="24" class="td-label">Before</text>
    ${page(30, 34)}${page(70, 34, { dashed: true })}
    <text x="330" y="24" class="td-label">After</text>
    ${arrow(200, 55)}
    <rect x="300" y="34" width="34" height="46" rx="3" ${STROKE} class="td-accent"/>
    <rect x="336" y="34" width="34" height="46" rx="3" ${STROKE} class="td-accent"/>
    <path d="M334 34v46" ${STROKE} stroke-dasharray="2 3" opacity="0.5"/>
  `;
  return wrap(inner, 'Two PDFs merging into one continuous file');
}

/** One page strip separating into two, with a visible gap opening up. */
function splitPdfDiagram() {
  const inner = `
    <text x="40" y="24" class="td-label">Before</text>
    <rect x="40" y="34" width="34" height="46" rx="3" ${STROKE}/>
    <rect x="76" y="34" width="34" height="46" rx="3" ${STROKE}/>
    <path d="M74 34v46" ${STROKE} stroke-dasharray="2 3" opacity="0.5"/>
    <text x="330" y="24" class="td-label">After</text>
    ${arrow(200, 55)}
    <rect x="300" y="34" width="34" height="46" rx="3" ${STROKE} class="td-accent"/>
    <rect x="352" y="34" width="34" height="46" rx="3" ${STROKE} class="td-accent"/>
  `;
  return wrap(inner, 'One PDF splitting into two separate files');
}

const DIAGRAMS = {
  'merge-pdf': mergePdfDiagram,
  'split-pdf': splitPdfDiagram,
};

/**
 * @param {string} slug
 * @returns {string} diagram markup, or '' if this tool has no diagram yet
 *   (S7 shipped 2 of the spec's 4 recommended diagrams -- see the module
 *   comment; the rest are S8, a follow-on, not a blocker).
 */
function diagramFor(slug) {
  const fn = DIAGRAMS[slug];
  return fn ? fn() : '';
}

module.exports = { diagramFor };

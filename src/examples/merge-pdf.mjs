/**
 * The merge-pdf example panel -- Pattern D ("page-strip"). PDF page-level
 * operations produce no textual result a pure module can compute at build
 * time (the output is page bytes, not data), so this stays an abstract
 * before/after SVG rather than a real computed table -- the honest
 * alternative Pattern D exists for. See src/examples/index.mjs for the
 * module contract and src/pageStripDiagrams.mjs for the shared drawing
 * primitives.
 *
 * Formerly src/diagrams.js's mergePdfDiagram() (moved here verbatim, not
 * redrawn) -- two separate page strips converging into one continuous
 * strip.
 */

import { page, arrow, svg, STROKE } from '../pageStripDiagrams.mjs';

export const slug = 'merge-pdf';

export const ariaLabel = 'Two PDFs merging into one continuous file';

export const note = 'Two separate files become one continuous document. Nothing inside either file is re-rendered.';

export function render() {
  const inner = `
    <text x="40" y="24" class="td-label">Before</text>
    ${page(30, 34)}${page(70, 34, { dashed: true })}
    <text x="330" y="24" class="td-label">After</text>
    ${arrow(200, 55)}
    <rect x="300" y="34" width="34" height="46" rx="3" ${STROKE} class="td-accent"/>
    <rect x="336" y="34" width="34" height="46" rx="3" ${STROKE} class="td-accent"/>
    <path d="M334 34v46" ${STROKE} stroke-dasharray="2 3" opacity="0.5"/>
  `;
  return svg(inner, ariaLabel);
}

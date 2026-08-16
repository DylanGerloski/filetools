/**
 * The split-pdf example panel -- Pattern D ("page-strip"). See
 * merge-pdf.mjs's header comment for why this stays an abstract SVG
 * rather than a computed table, and src/pageStripDiagrams.mjs for the
 * shared drawing primitives.
 *
 * Formerly src/diagrams.js's splitPdfDiagram() (moved here verbatim, not
 * redrawn) -- one page strip separating into two, with a visible gap
 * opening up.
 */

import { arrow, svg, STROKE } from '../pageStripDiagrams.mjs';

export const slug = 'split-pdf';

export const ariaLabel = 'One PDF splitting into two separate files';

export const note = 'One file separates into two independent files at the page you choose.';

export function render() {
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
  return svg(inner, ariaLabel);
}

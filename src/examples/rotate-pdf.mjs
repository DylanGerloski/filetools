/**
 * The rotate-pdf example panel -- Pattern D ("page-strip"). See
 * merge-pdf.mjs's header comment for why this stays an abstract SVG
 * rather than a computed table.
 *
 * New diagram (src/diagrams.js only ever had merge-pdf and split-pdf). An
 * upright page becomes the same page on its side -- drawn as the
 * identical page rect, rotated 90 degrees about its
 * own center via a plain SVG `transform`, so "before" and "after" are
 * provably the same shape rather than two independently-drawn ones. The
 * transformation arrow is the rotate verb's own arc glyph
 * (src/pageStripDiagrams.mjs's rotateArrow(), reused from
 * src/icons.js's VERB_PATHS.rotate) in place of the plain left-to-right
 * arrow merge-pdf/split-pdf use, since a rotation isn't a left-to-right
 * flow.
 */

import { rotateArrow, svg, STROKE } from '../pageStripDiagrams.mjs';

export const slug = 'rotate-pdf';

export const ariaLabel = 'A page turning from upright to lying on its side';

export const note = 'Only the page orientation changes. Nothing on the page is re-rendered.';

export function render() {
  const inner = `
    <text x="40" y="24" class="td-label">Before</text>
    <rect x="40" y="34" width="34" height="46" rx="3" ${STROKE}/>
    <text x="330" y="24" class="td-label">After</text>
    ${rotateArrow(200, 55, 4.5)}
    <rect x="311" y="34" width="34" height="46" rx="3" ${STROKE} class="td-accent" transform="rotate(90 328 57)"/>
  `;
  return svg(inner, ariaLabel);
}

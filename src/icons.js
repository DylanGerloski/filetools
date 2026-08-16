'use strict';

/**
 * Per-tool iconography (design-standards.md Distinctiveness Gate item 4 --
 * "at least one interaction or visual element unique to this product").
 * Before this file, every tool page shared one generic document-outline
 * glyph (src/pages/toolPage.js used to hardcode it); this replaces that
 * with one distinct glyph per tool, keyed by slug.
 *
 * Drawing constraints, so all glyphs read as ONE family:
 *   - 24x24 viewBox, 2px stroke, round caps/joins, fill="none",
 *     stroke="currentColor" so every glyph inherits the dropzone's state
 *     color for free (idle/dragover/working -- see src/css.js).
 *   - Optical alignment on a shared 20px inner box (coordinates roughly
 *     2..22), so no glyph reads visually larger or smaller than another.
 *   - Every glyph depicts the TRANSFORMATION the tool performs, not the
 *     file type -- what makes it informational rather than decorative
 *     (design-standards.md: "every on-page image carries task-relevant
 *     information").
 *   - No glyph uses color to convey meaning (WCAG 1.4.1) -- shape alone
 *     carries the distinction between tools.
 *
 * aria-hidden + focusable="false" on every glyph: the dropzone's own
 * .dz-title text is the accessible label, same as the generic icon these
 * replace.
 */

const ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

const ICONS = {
  // Two page rects converging into one wider rect below.
  'merge-pdf': `<svg ${ATTRS}><rect x="3" y="3" width="7" height="8" rx="1"/><rect x="14" y="3" width="7" height="8" rx="1"/><path d="M6.5 11v2M17.5 11v2"/><rect x="5" y="15" width="14" height="6" rx="1"/></svg>`,

  // One page rect above, separating into two rects below with a gap.
  'split-pdf': `<svg ${ATTRS}><rect x="5" y="3" width="14" height="6" rx="1"/><path d="M9 9v3M15 9v3"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,

  // Page rect with a 90-degree rotation arc + arrowhead at its tip.
  'rotate-pdf': `<svg ${ATTRS}><rect x="6" y="6" width="12" height="14" rx="1"/><path d="M4 5a9 9 0 0 1 9-3"/><path d="M10.5 1.3 13 2l-.6 2.6"/></svg>`,

  // Page rect with ruled horizontal lines, an arrow, then a 2x2 cell grid.
  'pdf-to-csv': `<svg ${ATTRS}><rect x="2" y="4" width="8" height="16" rx="1"/><path d="M4.5 8h3M4.5 11h3M4.5 14h3"/><path d="M11.5 12h3"/><path d="M13 10.2 14.8 12 13 13.8"/><rect x="16" y="6" width="6" height="6"/><path d="M19 6v6M16 9h6"/></svg>`,

  // Same ruled-page-to-grid shape, plus a currency mark distinguishing the
  // statement-specific tool from the generic PDF-table one above.
  'bank-statement-to-csv': `<svg ${ATTRS}><rect x="2" y="4" width="8" height="16" rx="1"/><path d="M4.5 8h3M4.5 11h3"/><path d="M6 14.2c0-.7.7-1 1.5-1s1.5.3 1.5 1-.7 1-1.5 1-1.5.3-1.5 1 .7 1 1.5 1 1.5-.3 1.5-1"/><path d="M11.5 12h3"/><path d="M13 10.2 14.8 12 13 13.8"/><rect x="16" y="6" width="6" height="6"/><path d="M19 6v6M16 9h6"/></svg>`,

  // Angle-bracket pair (markup) -> arrow -> 2x2 cell grid.
  'html-table-to-csv': `<svg ${ATTRS}><path d="M5 6 1 12l4 6"/><path d="M10 6l2 12"/><rect x="15" y="7" width="7" height="10" rx="1"/><path d="M15 12h7M18.5 7v10"/></svg>`,

  // Three stacked lines, the middle one struck through -- removing a
  // duplicate row.
  'remove-duplicate-lines': `<svg ${ATTRS}><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><path d="M2 12h20" stroke-width="2.5"/></svg>`,

  // Three lines of ascending length, plus a down arrow -- reordering by
  // length/value.
  'sort-lines': `<svg ${ATTRS}><path d="M4 5h6"/><path d="M4 10h10"/><path d="M4 15h16"/><path d="M20 3v15"/><path d="M17 15 20 19l3-4"/></svg>`,

  // A wide, short grid (3 columns x 2 rows) rotating into a tall, narrow
  // grid (2 columns x 3 rows) -- rows becoming columns.
  'transpose-csv': `<svg ${ATTRS}><rect x="2" y="4" width="15" height="8" rx="1"/><path d="M2 8h15M7 4v8M12 4v8"/><path d="M14 15.5a8 8 0 0 1 8-3.5" stroke-width="1.6"/><path d="M18.7 10.7l3.3 1.3-1 3.4" stroke-width="1.6"/></svg>`,
};

const DEFAULT_ICON = `<svg ${ATTRS}><path d="M6 3h8l6 6v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v6h6"/></svg>`;

/**
 * @param {string} slug a tool's `slug` field (src/tools/index.js).
 * @returns {string} inline SVG markup for that tool's dropzone/list-row
 *   icon. Never throws -- an unmapped slug (a new tool added without an
 *   icon entry) falls back to a generic document glyph rather than
 *   breaking the build, but every tool in the live registry has a real
 *   entry above.
 */
function iconFor(slug) {
  return ICONS[slug] || DEFAULT_ICON;
}

module.exports = { iconFor, ICONS };

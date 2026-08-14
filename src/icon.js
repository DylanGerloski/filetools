'use strict';

/**
 * The one brand mark used everywhere an icon is needed: favicon, apple
 * touch icon, the default og-image, and the drop zone's decorative glyph
 * (src/browser/dropzone.client.js). A circular accent-colored badge behind
 * a white document silhouette with a folded top-right corner -- reads as
 * "file" at any size, and doubles as the wordmark's implicit logotype since
 * no separate logo asset exists.
 *
 * A data: URI can't reference a CSS custom property, so the two colors
 * below are copied here literally from tokens.js (--color-accent /
 * --color-accent-contrast) rather than interpolated -- this is a
 * self-contained embedded image asset, not page styling, so it is exempt
 * from the "no hardcoded hex outside tokens.js" rule the same way the two
 * sibling assets' own FAVICON_DATA_URI constants are.
 */
const ACCENT = '#0b5f66';
const CONTRAST = '#ffffff';

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="${ACCENT}"/><path d="M22 14h13l9 9v27a2 2 0 0 1-2 2H22a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2z" fill="${CONTRAST}"/><path d="M35 14v9h9" fill="none" stroke="${ACCENT}" stroke-width="2"/></svg>`;

const FAVICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(ICON_SVG)}`;

module.exports = { ICON_SVG, FAVICON_DATA_URI, ACCENT, CONTRAST };

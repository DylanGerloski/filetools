'use strict';

/**
 * The single source of truth for every color, size, and spacing value on
 * the site. No hex or raw px value may appear anywhere outside this file --
 * every rule in src/css.js and every inline style this build ever emits
 * pulls from here through var(--token-name).
 *
 * Typeface note: the display face is Space Grotesk, self-hosted from
 * vendor/fonts/ (see scripts/copy-vendor.js -- same node_modules-to-vendor
 * pattern already used for pdf-lib/pdfjs-dist). Licensed SIL OFL 1.1
 * (vendor/fonts/space-grotesk/LICENSE), which permits bundling and
 * redistribution with software -- a license grant, not a service ToS, so no
 * account or ToS agreement was needed to add it. Applied to h1/h2/h3,
 * <summary>, the wordmark and step-marker numerals only (src/css.js); body
 * text stays on the system stack, so this remains a single extra network
 * request sitewide. The @font-face block (src/css.js) declares
 * font-display: swap; no CLS-safe metric-matched fallback (size-adjust/
 * ascent-override/etc, measured from the real shipped font's own metrics)
 * was built for this pass -- font-display: swap plus heading-only
 * application is a reasonable fallback when those metrics haven't been
 * measured yet. Check Lighthouse CLS after this change rather than
 * assuming it's zero; add the metric-matched fallback if it turns out to
 * matter in practice.
 */
const DESIGN_TOKENS = {
  '--font-sans': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  '--font-display': '"Space Grotesk Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',

  '--color-bg': '#f6f7f9',
  '--color-surface': '#ffffff',
  '--color-surface-alt': '#eceff3',
  '--color-text': '#14181f',
  '--color-muted': '#5a6472',
  '--color-accent': '#0b5f66',
  '--color-accent-hover': '#08474c',
  '--color-accent-contrast': '#ffffff',
  '--color-accent-tint': 'rgba(11, 95, 102, 0.06)',
  '--color-border': '#d8dde5',
  '--color-border-strong': '#9aa5b4',

  '--color-success': '#1a7f4b',
  '--color-success-bg': '#e6f4ec',
  '--color-warn': '#8a5a00',
  '--color-warn-bg': '#fdf3e0',
  '--color-danger': '#a52c1f',
  '--color-danger-bg': '#fbe8e5',

  '--text-xs': '0.75rem',
  '--text-sm': '0.875rem',
  '--text-base': '1rem',
  '--text-md': '1.125rem',
  '--text-lg': '1.375rem',
  '--text-xl': '1.75rem',
  '--text-2xl': 'clamp(2rem, 1.6rem + 1.8vw, 2.75rem)',

  '--leading-tight': '1.15',
  '--leading-snug': '1.3',
  '--leading-normal': '1.6',
  '--leading-relaxed': '1.7',

  '--weight-regular': '400',
  '--weight-medium': '500',
  '--weight-bold': '700',

  '--tracking-tight': '-0.02em',

  '--measure': '66ch',
  '--width-page': '760px',
  '--width-app': '1040px',
  '--width-wide': '1200px',

  '--space-1': '0.25rem',
  '--space-2': '0.5rem',
  '--space-3': '0.75rem',
  '--space-4': '1rem',
  '--space-5': '1.5rem',
  '--space-6': '2rem',
  '--space-7': '3rem',
  '--space-8': '4rem',

  '--radius-sm': '6px',
  '--radius-md': '10px',
  '--radius-lg': '14px',
  '--radius-pill': '999px',

  '--shadow-sm': '0 1px 2px rgba(20, 24, 31, 0.07)',
  '--shadow-md': '0 8px 24px rgba(20, 24, 31, 0.09)',
  '--shadow-drop': '0 0 0 4px rgba(11, 95, 102, 0.06)',

  '--border-hairline': '1px',
  '--border-control': '2px',
  '--border-drop': '2px',

  // Motion system (design-standards.md's required motion token group --
  // previously absent entirely; see docs/CHANGELOG.md for the audit that
  // found it). Values are Material's, as cited in docs/DESIGN_PLAYBOOK.md.
  // Hard cap: no transition in src/css.js may exceed 400ms.
  '--motion-duration-fast': '150ms',
  '--motion-duration-standard': '200ms',
  '--motion-duration-entering': '225ms',
  '--motion-duration-exiting': '195ms',
  // The one permitted looping animation on the site (the working-state
  // indeterminate progress bar) -- encodes ongoing work rather than
  // decorating, and is fully suppressed under prefers-reduced-motion.
  '--motion-duration-loop': '1200ms',
  '--motion-ease-standard': 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  '--motion-ease-decelerate': 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  '--motion-ease-accelerate': 'cubic-bezier(0.4, 0.0, 1, 1)',
  '--motion-ease-sharp': 'cubic-bezier(0.4, 0.0, 0.6, 1)',

  // Focus ring -- the portfolio's one shared interaction signature. Applied
  // identically on :focus-visible for every interactive element.
  '--focus-ring-width': '3px',
  '--focus-ring-offset': '2px',
  '--focus-ring-color': 'var(--color-accent)',
  '--focus-ring-transition': 'var(--motion-duration-fast) var(--motion-ease-standard)',

  // Ad-slot reserved heights (CLS budget) -- same pattern as the two live
  // assets' --ad-min-h-mobile/desktop tokens.
  '--ad-min-h-mobile': '100px',
  '--ad-min-h-desktop': '250px',
};

/**
 * @param {Record<string,string>} tokens
 * @returns {string} one `  --name: value;` line per token, for
 *   interpolation into a `:root { ... }` block.
 */
function designTokensCss(tokens) {
  return Object.entries(tokens)
    .map(([name, value]) => `    ${name}: ${value};`)
    .join('\n');
}

module.exports = { DESIGN_TOKENS, designTokensCss };

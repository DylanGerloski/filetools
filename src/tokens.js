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
  // Darkened from the original #9aa5b4 -- that value only hit ~2.3-2.5:1
  // against --color-bg/--color-surface, short of the 3:1 WCAG 1.4.11
  // non-text contrast this token needs since it draws the visible boundary
  // of .btn-secondary and the dropzone (both real interactive controls).
  // #7b8490 clears 3:1 against both with margin (verified 2026-08-16
  // accessibility pass).
  '--color-border-strong': '#7b8490',

  // Darkened from the original #1a7f4b -- that value measured 4.43:1
  // against --color-success-bg, just under the 4.5:1 WCAG AA text
  // threshold (.alert-success, .dz-status[data-tone="success"],
  // .diff-cell-new, .diff-status-cell[data-diff-status="added"] all render
  // normal-size text in this color). A separate master-side pass (PR #22)
  // independently darkened this same token to #197c4a; superseded here by
  // #146b40, which clears 4.5:1 against every background this token is used
  // on, with margin (verified 2026-08-16 accessibility pass, re-measured
  // post-merge against PR #24's merged surfaces).
  '--color-success': '#146b40',
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

  /* Family ramp -- a categorical color encoding of the tool taxonomy in
   * src/families.js, not decoration. Shared perceptual lightness ladder,
   * five hues run through it:
   *   0:99  1:97  2:92  3:84  4:72  5:60  6:47  7:39  8:30  9:20
   * Only indices 1 / 6 / 8 are emitted (wash / plate / ink) -- the full
   * ladder above is what makes any future index mechanically derivable
   * (same L from the ladder, same H, chroma scaled toward 0 as L
   * approaches 99 or 20) without shipping 50 tokens to use 15.
   *
   * Role: 1 = wash (backgrounds only), 6 = plate (the filled mark),
   * 8 = ink (pip ring + pip glyph stroke). Family hue appears in exactly
   * two places sitewide: inside the icon mark, and as a --family-X-1 wash
   * disc behind the mark on the tool-page dropzone. Never on text, links,
   * buttons, borders, or focus rings -- --color-accent keeps sole
   * ownership of every interactive control.
   *
   * CONTRAST -- measured, not the spec's approximate arithmetic (which
   * treated OKLCH L as CIE L-star and flagged itself as approximate).
   * Verified 2026-08-16 with a real OKLab/OKLCH -> linear-sRGB -> WCAG
   * relative-luminance conversion (Bjorn Ottosson's published OKLab
   * matrices; browser gamut-clamping applied before the luminance sum,
   * matching how a CSS oklch() value actually renders). All pairs clear
   * their requirement with margin, so no L adjustment was needed for any
   * family (spec allowed +/-2 L, never a H change, if a pair had failed):
   *   plate(6) vs white surface   (need >=3:1,  WCAG 1.4.11 non-text):
   *     pdf 7.39:1 | csv 6.83:1 | json 7.35:1 | sheet 6.48:1 | text 6.80:1
   *   ink(8) vs wash(1)           (need >=4.5:1, treated as text-grade):
   *     pdf 12.92:1 | csv 12.49:1 | json 12.95:1 | sheet 12.20:1 | text 12.48:1
   * pdf-1 and csv-8 render slightly outside the sRGB gamut at their exact
   * OKLCH coordinates; browsers gamut-map (clamp) automatically per the
   * CSS Color 4 spec, which is exactly what the measurement above already
   * accounts for -- no separate action needed.
   */
  '--family-pdf-1':   'oklch(97% 0.018 27)',
  '--family-pdf-6':   'oklch(47% 0.155 27)',
  '--family-pdf-8':   'oklch(30% 0.105 27)',
  '--family-csv-1':   'oklch(97% 0.016 250)',
  '--family-csv-6':   'oklch(47% 0.130 250)',
  '--family-csv-8':   'oklch(30% 0.090 250)',
  '--family-json-1':  'oklch(97% 0.017 320)',
  '--family-json-6':  'oklch(47% 0.140 320)',
  '--family-json-8':  'oklch(30% 0.095 320)',
  '--family-sheet-1': 'oklch(97% 0.014 150)',
  '--family-sheet-6': 'oklch(47% 0.110 150)',
  '--family-sheet-8': 'oklch(30% 0.075 150)',
  '--family-text-1':  'oklch(97% 0.004 250)',
  '--family-text-6':  'oklch(47% 0.030 250)',
  '--family-text-8':  'oklch(30% 0.022 250)',

  '--icon-sm': '24px',
  '--icon-md': '32px',
  '--icon-lg': '56px',
  // The dropzone's mark-wash circle (see .dz-icon-wrap in src/css.js) --
  // tokenized here rather than left as a raw px value in that stylesheet,
  // per this file's own no-hardcoded-value rule.
  '--icon-wrap-lg': '72px',
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

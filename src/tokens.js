'use strict';

/**
 * The single source of truth for every color, size, and spacing value on
 * the site. No hex or raw px value may appear anywhere outside this file --
 * every rule in src/css.js and every inline style this build ever emits
 * pulls from here through var(--token-name).
 *
 * Typeface note: the original design called for a self-hosted display face
 * (Space Grotesk) plus a system-UI sans. That webfont was never license-
 * verified before this build, so this build falls back to the system font
 * stack for the display role too -- the layout doesn't depend on the face;
 * the two-tone wordmark (bold, tight tracking, accent-colored tail) carries
 * the brand identity either way. Swapping in a self-hosted webfont later is
 * a one-line change here plus an @font-face block in src/css.js -- nothing
 * else references a typeface.
 */
const DESIGN_TOKENS = {
  '--font-sans': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  '--font-display': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',

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
  // threshold (.alert-success and .dz-status[data-tone="success"] both
  // render normal-size text in this color). #146b40 clears 4.5:1 against
  // every background this token is used on, with margin (verified
  // 2026-08-16 accessibility pass).
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

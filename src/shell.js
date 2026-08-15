'use strict';

/**
 * The shared page shell every page on the site is built from -- home, every
 * tool page, /how-this-works/, /privacy/, and 404. There is no second
 * layout. Header nav, footer "all tools", and the related-tools grid are
 * all derived from the TOOLS registry (src/tools/index.js), so a new tool
 * page never requires touching this file.
 */

const { SITE_NAME, SITE_TAGLINE, BASE_PATH, url, absoluteUrl } = require('./site.js');
const { SITE_CSS } = require('./css.js');
const { FAVICON_DATA_URI } = require('./icon.js');
const { adSlot, adsScriptTag } = require('./ads.js');
const adConfig = require('./adConfig.js');
const { TOOLS, CATEGORY_LABELS, toolBySlug } = require('./tools/index.js');

const GOATCOUNTER_URL = 'https://dg-filetools.goatcounter.com/count';
const KOFI_URL = 'https://ko-fi.com/flavaa';
const BMC_URL = 'https://buymeacoffee.com/dylanger254';
const OG_DEFAULT_IMAGE = absoluteUrl('og-default.png');

/**
 * Shared social-link mark (a ring, a jagged upward line, a dot at the tip)
 * recreated as inline SVG from the operator's own profile picture. Colors
 * are the artist's fixed brand colors, not derived from this site's own
 * token ramp, so the mark stays recognizable and identical across every
 * property and the social profile itself -- same self-contained-asset
 * exemption from the tokens-only rule as icon.js's ICON_SVG.
 */
const SOCIAL_ICON_SVG = '<svg width="18" height="18" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="47" fill="#0f2233"/><circle cx="50" cy="50" r="35" fill="none" stroke="#6f95a1" stroke-width="3"/><path d="M16 74 L38 58 L50 66 L83 27" fill="none" stroke="#c99a44" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="83" cy="27" r="9" fill="#f2e0a8"/></svg>';

/**
 * Portfolio-wide footer credit line -- identical wording/type role on all
 * three properties, naming the operator and linking to the other two. See
 * docs/DESIGN_PLAYBOOK.md's "What stays shared across the portfolio".
 */
function renderFooterCredit() {
  return `<p class="footer-credit">Built by Dylan &mdash; also making <a href="https://repertoire-builder.com" rel="noopener noreferrer">Repertoire Builder</a> and <a href="https://lol-practice-system.com" rel="noopener noreferrer">Solo Queue Practice</a>. <a class="footer-social" href="https://x.com/builtittheycome" rel="noopener noreferrer">${SOCIAL_ICON_SVG}Follow @builtittheycome</a></p>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{title:string, description:string, canonical:string,
 *   ogType?:'website'|'article', jsonLd?:string[], noindex?:boolean}} opts
 * @returns {string} a full <head>...</head> block.
 */
function documentHead(opts) {
  const { title, description, canonical, ogType = 'website', jsonLd = [], noindex, feedUrl } = opts;

  const robotsMeta = noindex ? '\n  <meta name="robots" content="noindex">' : '';
  const feedLink = feedUrl
    ? `\n  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(SITE_NAME)} — new tools" href="${escapeHtml(feedUrl)}">`
    : '';
  const og = `\n  <meta property="og:title" content="${escapeHtml(title)}">` +
    `\n  <meta property="og:description" content="${escapeHtml(description)}">` +
    `\n  <meta property="og:url" content="${escapeHtml(canonical)}">` +
    `\n  <meta property="og:type" content="${escapeHtml(ogType)}">` +
    `\n  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">` +
    `\n  <meta property="og:image" content="${escapeHtml(OG_DEFAULT_IMAGE)}">` +
    `\n  <meta property="og:image:width" content="1200">` +
    `\n  <meta property="og:image:height" content="630">` +
    `\n  <meta name="twitter:card" content="summary_large_image">`;
  const jsonLdBlock = jsonLd.length ? `\n  ${jsonLd.join('\n  ')}` : '';

  return `<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="object-src 'none'; base-uri 'none'">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">${robotsMeta}${og}${feedLink}
  <meta name="google-adsense-account" content="${escapeHtml(adConfig.client)}">
  <link rel="icon" href="${FAVICON_DATA_URI}">
  <link rel="icon" type="image/svg+xml" href="${escapeHtml(url('favicon.svg'))}">
  <link rel="apple-touch-icon" href="${escapeHtml(url('apple-touch-icon.png'))}">
  <style>${SITE_CSS}</style>${jsonLdBlock}
  ${adsScriptTag()}
  <script data-goatcounter="${GOATCOUNTER_URL}" async src="https://gc.zgo.at/count.js"></script>
</head>`;
}

/**
 * @param {string|null} activeSlug the current tool's slug, or null on a
 *   non-tool page.
 */
function renderHeader(activeSlug) {
  const links = TOOLS.map((t) =>
    `<a href="${escapeHtml(url(`${t.category}/${t.slug}/`))}"${activeSlug === t.slug ? ' aria-current="page"' : ''}>${escapeHtml(t.navLabel)}</a>`
  ).join('\n      ');

  return `<header class="site-header">
    <a class="brand" href="${escapeHtml(url())}">file<span class="brand-tail">tools</span></a>
    <nav class="site-nav" aria-label="Tools">
      ${links}
      <a href="${escapeHtml(url('how-this-works/'))}"${activeSlug === 'how-this-works' ? ' aria-current="page"' : ''}>How this works</a>
    </nav>
  </header>`;
}

/**
 * @param {Array<{name:string, href?:string}>} crumbs first entry is Home;
 *   the last entry (current page) should omit href.
 */
function renderBreadcrumb(crumbs) {
  const items = crumbs
    .map((c, i) => {
      const isLast = i === crumbs.length - 1;
      const inner = c.href && !isLast
        ? `<a href="${escapeHtml(c.href)}">${escapeHtml(c.name)}</a>`
        : `<span aria-current="page">${escapeHtml(c.name)}</span>`;
      const sep = i > 0 ? '<span class="sep" aria-hidden="true">/</span>' : '';
      return `${sep}${inner}`;
    })
    .join('');
  return `<nav class="breadcrumb" aria-label="Breadcrumb">${items}</nav>`;
}

// Newsletter signup: wired to the project's Substack publication. The
// embed URL below is the exact value Substack's own "embed a subscribe
// widget" panel generates for that publication (Settings -> Growth), so
// it is the one verified pointer to the right destination -- if the
// provider is ever swapped, replace this one constant. Loaded lazily by
// js/newsletter.client.js (only once its footer slot nears the viewport)
// rather than unconditionally on every page -- an eagerly-loaded iframe
// here cost the whole site's Lighthouse Performance budget, since the
// footer this renders into is sitewide.
const NEWSLETTER_FORM_ACTION = 'https://builtittheycome.substack.com/embed';
const SUBSTACK_PUBLICATION_URL = 'https://builtittheycome.substack.com';

/**
 * Sitewide newsletter signup, rendered inside the shared footer so it
 * appears on every page.
 */
function renderNewsletterSignup() {
  if (!NEWSLETTER_FORM_ACTION) {
    return `<div class="newsletter-signup newsletter-signup--pending">
      <h2 class="newsletter-heading">Hear about new tools</h2>
      <p class="newsletter-description">Email sign-up isn&rsquo;t live yet &mdash; check back soon, or follow the <a href="${escapeHtml(url('feed.xml'))}">RSS feed</a> in the meantime.</p>
    </div>`;
  }
  const embedTitle = 'Email signup for filetools updates';
  return `<div class="newsletter-signup">
      <h2 class="newsletter-heading">Hear about new tools</h2>
      <p class="newsletter-description">One email when a new tool ships. No spam, unsubscribe anytime.</p>
      <div class="newsletter-embed" data-newsletter-slot data-newsletter-src="${escapeHtml(NEWSLETTER_FORM_ACTION)}" data-newsletter-title="${escapeHtml(embedTitle)}"></div>
      <noscript><p class="newsletter-description"><a href="${escapeHtml(SUBSTACK_PUBLICATION_URL)}" target="_blank" rel="noopener noreferrer">Subscribe on Substack</a></p></noscript>
    </div>`;
}

function renderFooter() {
  const groups = Object.entries(CATEGORY_LABELS)
    .map(([catKey, catLabel]) => {
      const items = TOOLS.filter((t) => t.category === catKey)
        .map((t) => `<li><a href="${escapeHtml(url(`${t.category}/${t.slug}/`))}">${escapeHtml(t.navLabel)}</a></li>`)
        .join('\n        ');
      return `<div class="footer-group">
        <h3>${escapeHtml(catLabel)}</h3>
        <ul>
        ${items}
        </ul>
      </div>`;
    })
    .join('\n      ');

  return `<footer class="site-footer">
    <div class="footer-groups">
      ${groups}
      <div class="footer-group">
        <h3>Site</h3>
        <ul>
          <li><a href="${escapeHtml(url('how-this-works/'))}">How this works</a></li>
          <li><a href="${escapeHtml(url('privacy/'))}">Privacy</a></li>
        </ul>
      </div>
    </div>
    <p>No accounts. No file uploads. Your files are processed on your device.</p>
    <p class="footer-legal">
      <a href="${escapeHtml(url('privacy/'))}">Privacy</a>
      <a href="https://ko-fi.com/flavaa" target="_blank" rel="noopener noreferrer">Ko-fi</a>
      <a href="https://buymeacoffee.com/dylanger254" target="_blank" rel="noopener noreferrer">Buy Me a Coffee</a>
    </p>
    ${renderFooterCredit()}
    ${renderNewsletterSignup()}
    ${adSlot('footer')}
    <p class="caption">&copy; ${new Date().getFullYear()} ${escapeHtml(SITE_NAME)}</p>
  </footer>`;
}

/**
 * @param {{slug?:string, title:string, metaDescription:string, h1:string,
 *   deck?:string, breadcrumb?:Array<{name:string, href?:string}>,
 *   mainHtml:string, jsonLd?:string[], canonical:string, wide?:boolean,
 *   noindex?:boolean}} opts
 * @returns {string} a complete standalone HTML document.
 */
function renderPage(opts) {
  const { slug = null, title, metaDescription, breadcrumb, mainHtml, jsonLd, canonical, wide, noindex, skipTarget = '#main', feedUrl } = opts;
  const breadcrumbHtml = breadcrumb ? renderBreadcrumb(breadcrumb) : '';
  const skipLabel = skipTarget === '#tool' ? 'Skip to tool' : 'Skip to content';

  return `<!doctype html>
<html lang="en">
${documentHead({ title, description: metaDescription, canonical, jsonLd, noindex, feedUrl })}
<body>
  <a class="skip-link" href="${escapeHtml(skipTarget)}">${escapeHtml(skipLabel)}</a>
  ${renderHeader(slug)}
  <main id="main" class="page-shell${wide ? ' page-shell-app' : ''}">
    ${breadcrumbHtml}
${mainHtml}
  </main>
  ${renderFooter()}
  <script type="module" src="${escapeHtml(url('js/newsletter.client.js'))}"></script>
</body>
</html>
`;
}

function render404Page() {
  const title = `Page not found | ${SITE_NAME}`;
  const description = `The page you followed a link to doesn’t exist on ${SITE_NAME}. Here are the tools you might have been looking for.`;
  const toolLinks = TOOLS
    .map((t) => `<li><a href="${escapeHtml(url(`${t.category}/${t.slug}/`))}">${escapeHtml(t.navLabel)}</a></li>`)
    .join('\n        ');
  const body = `<div class="not-found">
      <h1>That page doesn’t exist</h1>
      <p class="deck">The link you followed may be out of date, or the page may have moved. Here are the tools:</p>
      <ul>
        ${toolLinks}
        <li><a href="${escapeHtml(url())}">All tools</a></li>
      </ul>
    </div>`;
  return `<!doctype html>
<html lang="en">
${documentHead({ title, description, canonical: absoluteUrl('404.html'), noindex: true })}
<body>
  ${renderHeader(null)}
  <main id="main" class="page-shell">
    ${body}
  </main>
  ${renderFooter()}
  <script type="module" src="${escapeHtml(url('js/newsletter.client.js'))}"></script>
</body>
</html>
`;
}

module.exports = {
  SITE_CSS,
  KOFI_URL,
  BMC_URL,
  escapeHtml,
  documentHead,
  renderHeader,
  renderFooter,
  renderNewsletterSignup,
  renderBreadcrumb,
  renderPage,
  render404Page,
  adSlot,
};

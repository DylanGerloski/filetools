'use strict';

const { renderPage, escapeHtml } = require('../shell.js');
const { websiteJsonLd } = require('../structuredData.js');
const { CATEGORY_LABELS, toolsByCategory } = require('../tools/index.js');
const { url, absoluteUrl, SITE_TAGLINE } = require('../site.js');
const { iconFor } = require('../icons.js');

// Category tint -- the ONLY colour differentiation on the homepage (tools
// are told apart by icon silhouette, not by a per-tool hue, to stay inside
// the token colour budget). Two values, not one per tool, so the site
// stays inside that budget while still separating the two tool families
// visually.
const CATEGORY_TINT_CLASS = { pdf: 'tool-group--pdf', data: 'tool-group--data' };

function renderToolRow(t) {
  return `<a class="tool-row" href="${escapeHtml(url(`${t.category}/${t.slug}/`))}">${iconFor(t.slug).replace('<svg ', '<svg class="tool-row-icon" ')}<span class="tool-row-text"><span class="tool-row-name">${escapeHtml(t.navLabel)}</span><span class="tool-row-desc">${escapeHtml(t.deck)}</span></span></a>`;
}

function renderHomePage() {
  // Two category sections (a real h2 each -- an SEO/topical-structure gain
  // over the old flat single grid), each a dense hairline-separated list
  // rather than a card grid -- see design-standards.md's craft floor on
  // ragged final rows, which a list can't produce as the tool count grows.
  const groups = Object.entries(CATEGORY_LABELS)
    .map(([catKey, catLabel]) => {
      const rows = toolsByCategory(catKey).map(renderToolRow).join('\n        ');
      return `<section class="tool-group ${CATEGORY_TINT_CLASS[catKey] || ''}" aria-labelledby="group-${catKey}">
        <h2 id="group-${catKey}">${escapeHtml(catLabel)}</h2>
        <div class="tool-list">
        ${rows}
        </div>
      </section>`;
    })
    .join('\n    ');

  const mainHtml = `    <div class="hero">
      <h1>File tools that never leave your browser</h1>
      <p class="deck">No account. No file uploads. No sign-up. Every tool below runs entirely on your device: turn off your Wi-Fi and they still work.</p>
    </div>
    ${groups}
    <p class="caption">Read more about how that’s possible on the <a href="${escapeHtml(url('how-this-works/'))}">how this works</a> page.</p>
`;

  return renderPage({
    slug: null,
    title: 'filetools - Free File Utilities, Right In Your Browser',
    metaDescription: SITE_TAGLINE,
    mainHtml,
    jsonLd: [websiteJsonLd()],
    canonical: absoluteUrl(),
    feedUrl: absoluteUrl('feed.xml'),
  });
}

module.exports = { renderHomePage };

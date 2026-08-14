'use strict';

const { renderPage, escapeHtml } = require('../shell.js');
const { websiteJsonLd } = require('../structuredData.js');
const { TOOLS } = require('../tools/index.js');
const { url, absoluteUrl, SITE_TAGLINE } = require('../site.js');

function renderHomePage() {
  const cards = TOOLS.map((t) => `<a class="related-card" href="${escapeHtml(url(`${t.category}/${t.slug}/`))}">
        <h3>${escapeHtml(t.navLabel)}</h3>
        <p>${escapeHtml(t.deck)}</p>
      </a>`).join('\n      ');

  const mainHtml = `    <div class="hero">
      <h1>File tools that never leave your browser</h1>
      <p class="deck">No account. No file uploads. No file size limits. Every tool below runs entirely on your device — turn off your Wi-Fi and they still work.</p>
    </div>
    <h2>Every tool</h2>
    <div class="tool-grid">
      ${cards}
    </div>
    <p class="caption">Read more about how that’s possible on the <a href="${escapeHtml(url('how-this-works/'))}">how this works</a> page.</p>
`;

  return renderPage({
    slug: null,
    title: 'filetools — Free File Utilities, Right In Your Browser',
    metaDescription: SITE_TAGLINE,
    mainHtml,
    jsonLd: [websiteJsonLd()],
    canonical: absoluteUrl(),
    feedUrl: absoluteUrl('feed.xml'),
  });
}

module.exports = { renderHomePage };

'use strict';

/**
 * RSS 2.0 feed generation for tool launches -- the one thing on this site
 * that genuinely updates over time (individual tool pages themselves are
 * static utilities, not editorial content that gets revised on a
 * schedule). One <item> per tool, using its `launchDate` field (see
 * src/tools/pdf-merge.js's launchDate comment for the convention). Pure
 * function, no I/O -- src/build.js is responsible for writing the returned
 * string to dist/feed.xml.
 */

const { absoluteUrl, SITE_NAME, SITE_TAGLINE, BUILD_DATE } = require('./site.js');

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} dateStr an ISO date (YYYY-MM-DD).
 * @returns {string} an RFC 822 date string (RSS <pubDate>'s required
 *   format). Noon UTC so a date-only input never rolls to the adjacent
 *   calendar day depending on the reader's timezone.
 */
function rfc822(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).toUTCString();
}

/**
 * @param {Array<{slug:string, category:string, navLabel:string, deck?:string,
 *   metaDescription?:string, launchDate?:string}>} tools the TOOLS registry
 *   (src/tools/index.js).
 * @returns {string} a complete RSS 2.0 document, newest tool first.
 */
function renderRssXml(tools) {
  const lastBuildDate = rfc822(BUILD_DATE);
  const sorted = [...tools].sort((a, b) => (b.launchDate || '').localeCompare(a.launchDate || ''));
  const itemsXml = sorted
    .map((tool) => {
      const link = absoluteUrl(`${tool.category}/${tool.slug}/`);
      const title = tool.navLabel;
      const description = tool.deck || tool.metaDescription || '';
      const date = tool.launchDate || BUILD_DATE;
      return `  <item>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <guid isPermaLink="true">${escapeXml(link)}</guid>
    <description>${escapeXml(description)}</description>
    <pubDate>${rfc822(date)}</pubDate>
  </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXml(SITE_NAME)}</title>
  <link>${escapeXml(absoluteUrl(''))}</link>
  <description>${escapeXml(SITE_TAGLINE)}</description>
  <language>en-us</language>
  <lastBuildDate>${lastBuildDate}</lastBuildDate>
${itemsXml}
</channel>
</rss>
`;
}

module.exports = { renderRssXml, rfc822 };

'use strict';

/**
 * schema.org JSON-LD builders. Every function returns a ready-to-embed
 * `<script type="application/ld+json">...</script>` string via
 * jsonLdScript() so escaping happens in exactly one place.
 */

const { SITE_NAME, absoluteUrl } = require('./site.js');

function jsonLdScript(obj) {
  const json = JSON.stringify(obj).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

function stripHtmlToText(html) {
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {Array<{name:string, url:string}>} crumbs in order, first to last.
 */
function breadcrumbJsonLd(crumbs) {
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  });
}

/**
 * @param {{name:string, description:string, url:string}} opts
 */
function softwareApplicationJsonLd({ name, description, url }) {
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    url,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any (web browser)',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  });
}

/**
 * @param {Array<{q:string, answerHtml:string}>} faqs
 */
function faqPageJsonLd(faqs) {
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: stripHtmlToText(f.answerHtml) },
    })),
  });
}

function websiteJsonLd() {
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: absoluteUrl(),
  });
}

module.exports = {
  jsonLdScript,
  stripHtmlToText,
  breadcrumbJsonLd,
  softwareApplicationJsonLd,
  faqPageJsonLd,
  websiteJsonLd,
};

'use strict';

/**
 * Site-wide constants: one place to change origin/base-path/branding so a
 * future custom-domain move is a one-line edit plus a rebuild, not a
 * grep-and-replace across every page. Pure data, no I/O -- safe to require
 * from anywhere, including from within a page module.
 *
 * A custom domain costs real money, so it is a human decision, not this
 * build's call -- this ships under a GitHub Pages project path for now.
 * When/if a domain is attached, this file changes SITE_ORIGIN/BASE_PATH and
 * nothing else needs editing: every internal link and every canonical URL
 * goes through url()/absoluteUrl().
 */

const SITE_ORIGIN = 'https://dylangerloski.github.io';
const BASE_PATH = '/filetools/';
const SITE_NAME = 'filetools';
const SITE_TAGLINE = 'Free file utilities that run entirely in your browser. No account, no upload, no file size limit.';
const BUILD_DATE = new Date().toISOString().slice(0, 10);

/** Tool categories, in the order they should appear in nav/footer/home. */
const CATEGORIES = [
  { key: 'pdf', label: 'PDF tools' },
];

/**
 * @param {string} [file] a flat, root-relative path as written under dist/,
 *   e.g. 'pdf/merge-pdf/'. Omit (or pass '') for the site root.
 * @returns {string} a root-relative href under BASE_PATH.
 */
function url(file = '') {
  return `${BASE_PATH}${file}`;
}

/**
 * @param {string} [file] same as url().
 * @returns {string} an absolute URL under SITE_ORIGIN + BASE_PATH, for
 *   canonical links, og:url, sitemap.xml, and JSON-LD.
 */
function absoluteUrl(file = '') {
  return `${SITE_ORIGIN}${BASE_PATH}${file}`;
}

module.exports = {
  SITE_ORIGIN,
  BASE_PATH,
  SITE_NAME,
  SITE_TAGLINE,
  BUILD_DATE,
  CATEGORIES,
  url,
  absoluteUrl,
};

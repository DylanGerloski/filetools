'use strict';

/**
 * Site-wide constants: one place to change origin/base-path/branding so a
 * future custom-domain move is a one-line edit plus a rebuild, not a
 * grep-and-replace across every page. Pure data, no I/O -- safe to require
 * from anywhere, including from within a page module.
 *
 * The site now lives at the custom domain usefiletools.com (attached
 * 2026-08-16), served at the domain root -- not a GitHub Pages project
 * path. If that ever changes, this file changes SITE_ORIGIN/BASE_PATH and
 * nothing else needs editing: every internal link and every canonical URL
 * goes through url()/absoluteUrl().
 */

const SITE_ORIGIN = 'https://usefiletools.com';
const BASE_PATH = '/';
const SITE_NAME = 'filetools';
const SITE_TAGLINE = 'Free file utilities that run entirely in your browser. No account, no upload, no sign-up.';
const BUILD_DATE = new Date().toISOString().slice(0, 10);

/** Tool categories, in the order they should appear in nav/footer/home. */
const CATEGORIES = [
  { key: 'pdf', label: 'PDF tools' },
  { key: 'data', label: 'CSV & data tools' },
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

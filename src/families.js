'use strict';

/**
 * Family taxonomy for the per-tool icon/color system. One presentational
 * family per tool, used ONLY for icon marks and the tool-page dropzone
 * wash -- never for tool.category, URLs, nav, breadcrumbs, sitemap.xml, or
 * JSON-LD, which stay driven by src/tools/*.js unchanged.
 *
 * Assignment rule (mechanical, re-derivable for any future tool): family =
 * the tool's INPUT format if that format has a family, otherwise its
 * OUTPUT format. filetools' traffic is transactional search where the
 * visitor names what they already have ("i have a pdf and need csv"), so
 * the input is the scanning key. html-table-to-csv and yaml-to-json have
 * no input family (HTML, YAML aren't families of their own), so they
 * resolve by the fallback half of the rule and take their output's family
 * (csv, json respectively).
 *
 * FAMILY_BY_SLUG is deliberately an explicit per-slug map, not derived
 * automatically from each tool's declared accepts/output shape. Eight tool
 * branches are open in this repo as of this file's writing -- a newly
 * merged tool must add its own row here, and test/families.test.mjs
 * asserts every registry slug has one. That test is the regression check
 * that would have caught the pre-existing bug the design review found:
 * 8 of the 17 tools were silently rendering a generic fallback icon
 * because no per-tool color/family axis existed at all before this file.
 */
const FAMILY_BY_SLUG = {
  'merge-pdf': 'pdf',
  'split-pdf': 'pdf',
  'rotate-pdf': 'pdf',
  'pdf-to-csv': 'pdf',
  'bank-statement-to-csv': 'pdf',

  'merge-csv': 'csv',
  'compare-csv': 'csv',
  'split-csv': 'csv',
  'transpose-csv': 'csv',
  'html-table-to-csv': 'csv',

  'json-to-csv': 'json',
  'flatten-json': 'json',
  'yaml-to-json': 'json',
  'xml-to-json': 'json',

  'xlsx-to-csv': 'sheet',
  'xlsx-to-json': 'sheet',

  'remove-duplicate-lines': 'text',
  'sort-lines': 'text',
  'word-frequency-counter': 'text',
  'url-encode-decode': 'text',
  'base64-encode-decode': 'text',
  'html-entity-encode-decode': 'text',
};

const DEFAULT_FAMILY = 'text';

/**
 * @param {string} slug
 * @returns {string} the tool's family, or DEFAULT_FAMILY ('text') for a
 *   slug with no explicit entry -- so a newly merged tool can never break
 *   the build. test/families.test.mjs asserts every slug in the real
 *   TOOLS registry has an explicit entry, so this fallback is never
 *   silently relied on for a shipped tool page; it only protects a brief
 *   window between a tool merging and its family row landing.
 */
function familyOf(slug) {
  return FAMILY_BY_SLUG[slug] || DEFAULT_FAMILY;
}

module.exports = { FAMILY_BY_SLUG, familyOf, DEFAULT_FAMILY };

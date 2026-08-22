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
 * FAMILY_BY_SLUG is an explicit per-slug map, one row per tool -- still
 * true after the 2026-08-22 fragment-pattern refactor, just no longer
 * hand-typed HERE. Each row now lives as the `family` field on that tool's
 * own src/tools/<slug>.js (see pdf-merge.js's comment above its own
 * `family` field), and this file assembles them by re-keying the already-
 * auto-discovered TOOLS registry (src/tools/index.js) from `slug` ->
 * `family` -- mirroring src/tools/index.js's own discovery mechanism
 * rather than adding a second one. A newly merged tool adds its own file
 * with a `family` field; no existing file (this one included) changes, so
 * two tool branches can never conflict on a shared family row. This is
 * still a fully explicit, no-inference assignment -- test/families.test.mjs
 * asserts every registry slug resolves to one, the regression check that
 * would have caught the pre-existing bug the design review found: 8 of the
 * 17 tools were silently rendering a generic fallback icon because no
 * per-tool color/family axis existed at all before this system.
 */
const { TOOLS } = require('./tools/index.js');

const FAMILY_BY_SLUG = Object.fromEntries(TOOLS.map((t) => [t.slug, t.family]));

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

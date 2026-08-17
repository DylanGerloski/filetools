'use strict';

const fs = require('fs');
const path = require('path');

/**
 * The TOOLS registry -- the one plug-in point every tool page derives from.
 * Header nav, footer "all tools", the related-tools grid, sitemap.xml,
 * breadcrumbs, and JSON-LD are all built FROM this array by src/shell.js
 * and src/build.js. Adding a new tool page is purely additive: write
 * src/tools/<slug>.js exporting the same shape the other tool modules do
 * (slug/category/etc, consumed identically by TOOLS.forEach and
 * toolBySlug()/toolsByCategory()) -- it is auto-discovered from this
 * directory below. No other file needs to change, so two tool PRs open at
 * once can never conflict on this file.
 *
 * sort() makes discovery order deterministic (alphabetical by filename)
 * rather than depending on filesystem enumeration order, which is not
 * guaranteed to be stable across platforms.
 */

const TOOLS = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith('.js') && f !== 'index.js')
  .sort()
  .map((f) => require(path.join(__dirname, f)));

const CATEGORY_LABELS = {
  pdf: 'PDF tools',
  data: 'CSV & data tools',
};

function toolBySlug(slug) {
  return TOOLS.find((t) => t.slug === slug);
}

function toolsByCategory(category) {
  return TOOLS.filter((t) => t.category === category);
}

module.exports = { TOOLS, CATEGORY_LABELS, toolBySlug, toolsByCategory };

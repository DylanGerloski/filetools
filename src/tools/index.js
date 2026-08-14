'use strict';

/**
 * The TOOLS registry -- the one plug-in point every tool page derives from.
 * Header nav, footer "all tools", the related-tools grid, sitemap.xml,
 * breadcrumbs, and JSON-LD are all built FROM this array by src/shell.js
 * and src/build.js. Adding a new tool page is: (1) write
 * src/tools/<slug>.js exporting the same shape as these three, (2) add it
 * to this array. No other file needs to change.
 */

const pdfMerge = require('./pdf-merge.js');
const pdfSplit = require('./pdf-split.js');
const pdfRotate = require('./pdf-rotate.js');

const TOOLS = [pdfMerge, pdfSplit, pdfRotate];

const CATEGORY_LABELS = {
  pdf: 'PDF tools',
};

function toolBySlug(slug) {
  return TOOLS.find((t) => t.slug === slug);
}

function toolsByCategory(category) {
  return TOOLS.filter((t) => t.category === category);
}

module.exports = { TOOLS, CATEGORY_LABELS, toolBySlug, toolsByCategory };

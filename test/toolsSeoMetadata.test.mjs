import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS } from '../src/tools/index.js';

/**
 * Regression test for the 2026-08-16 SEO audit (task-mswe5o44-e5e775):
 * every newly-added tool page since the first SEO pass shipped with a
 * title/metaDescription written without checking length against SERP
 * truncation limits, and none of the four most-recently-added tools
 * (compare-csv, transpose-csv, xlsx-to-csv, yaml-to-json) were added to
 * any earlier tool's relatedSlugs -- so they had zero inbound
 * related-tools links even though the sitewide nav/footer still linked
 * them. This test makes both classes of regression fail the build
 * instead of silently accumulating as new tool pages are added.
 */

const TITLE_MAX = 60;
const META_MIN = 70;
const META_MAX = 160;

test('every tool title fits typical SERP width (<=60 chars) and ends with the site suffix', () => {
  const offenders = TOOLS.filter((t) => !t.title || t.title.length > TITLE_MAX || !t.title.endsWith('| filetools'));
  assert.deepEqual(
    offenders.map((t) => `${t.slug} (${t.title ? t.title.length : 0} chars)`),
    [],
    'titles over 60 chars (or missing the "| filetools" suffix) risk truncation in search results',
  );
});

test('every tool metaDescription is a real, non-truncation-risking length (70-160 chars)', () => {
  const offenders = TOOLS.filter(
    (t) => !t.metaDescription || t.metaDescription.length < META_MIN || t.metaDescription.length > META_MAX,
  );
  assert.deepEqual(
    offenders.map((t) => `${t.slug} (${t.metaDescription ? t.metaDescription.length : 0} chars)`),
    [],
    'meta descriptions outside 70-160 chars are either too thin to be useful or risk truncation in search results',
  );
});

test('every tool has at least one inbound related-tools link from some other tool', () => {
  const slugs = new Set(TOOLS.map((t) => t.slug));
  const inbound = new Map(TOOLS.map((t) => [t.slug, 0]));
  for (const t of TOOLS) {
    for (const rs of t.relatedSlugs || []) {
      if (inbound.has(rs)) inbound.set(rs, inbound.get(rs) + 1);
    }
  }
  const orphans = [...inbound.entries()].filter(([, count]) => count === 0).map(([slug]) => slug);
  assert.deepEqual(
    orphans,
    [],
    'these tools have no other tool page linking to them via relatedSlugs (sitewide nav still links them, but they get no topical-relevance internal link)',
  );

  // Also catch a relatedSlugs entry pointing at a slug that does not
  // exist -- a silent broken related-tools link that never 404s in a
  // build check because it's only ever rendered, not crawled, by these
  // tests.
  const dangling = TOOLS.flatMap((t) => (t.relatedSlugs || []).filter((rs) => !slugs.has(rs)).map((rs) => `${t.slug} -> ${rs}`));
  assert.deepEqual(dangling, [], 'relatedSlugs entries pointing at a slug with no matching tool');
});

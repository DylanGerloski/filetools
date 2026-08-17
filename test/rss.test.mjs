import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderRssXml, rfc822 } from '../src/rss.js';

test('rfc822 converts an ISO date to a well-formed RFC 822 date string at noon UTC', () => {
  assert.match(rfc822('2026-08-13'), /^\w{3}, 13 Aug 2026 12:00:00 GMT$/);
});

test('renderRssXml produces a well-formed RSS 2.0 document, one <item> per tool, newest first', () => {
  const tools = [
    { slug: 'merge-pdf', category: 'pdf', navLabel: 'Merge PDF', deck: 'Combine PDFs.', launchDate: '2026-08-01' },
    { slug: 'split-pdf', category: 'pdf', navLabel: 'Split PDF', deck: 'Split PDFs.', launchDate: '2026-08-13' },
  ];
  const xml = renderRssXml(tools);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0">/);
  const itemMatches = xml.match(/<item>/g) || [];
  assert.equal(itemMatches.length, 2);
  // newest (split-pdf, 08-13) first
  const splitIndex = xml.indexOf('Split PDF');
  const mergeIndex = xml.indexOf('Merge PDF');
  assert.ok(splitIndex < mergeIndex, 'newest tool should appear first');
  assert.match(xml, /<link>https:\/\/usefiletools\.com\/pdf\/split-pdf\/<\/link>/);
});

test('renderRssXml escapes special characters so the output stays well-formed XML', () => {
  const xml = renderRssXml([{ slug: 'x', category: 'pdf', navLabel: 'A & B < C', deck: 'Quote " test', launchDate: '2026-08-13' }]);
  assert.match(xml, /<title>A &amp; B &lt; C<\/title>/);
  assert.match(xml, /Quote &quot; test/);
});

test('renderRssXml falls back to metaDescription then BUILD_DATE when deck/launchDate are missing', () => {
  const xml = renderRssXml([{ slug: 'x', category: 'pdf', navLabel: 'X', metaDescription: 'meta desc only' }]);
  assert.match(xml, /<description>meta desc only<\/description>/);
  assert.match(xml, /<pubDate>\w{3}, \d{2} \w{3} \d{4} 12:00:00 GMT<\/pubDate>/);
});

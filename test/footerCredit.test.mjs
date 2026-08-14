import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderFooter } from '../src/shell.js';

test('renderFooter carries the portfolio-wide credit line naming the operator and the other two properties', () => {
  const footer = renderFooter();
  assert.match(footer, /Built by Dylan/);
  assert.match(footer, /also making <a href="https:\/\/repertoire-builder\.com"[^>]*>Repertoire Builder<\/a>/);
  assert.match(footer, /<a href="https:\/\/lol-practice-system\.com"[^>]*>Solo Queue Practice<\/a>/);
});

test('renderFooter links the social handle to the shared X profile with rel="noopener noreferrer"', () => {
  const footer = renderFooter();
  assert.match(footer, /<a class="footer-social" href="https:\/\/x\.com\/builtittheycome" rel="noopener noreferrer">/);
  assert.match(footer, /Follow @builtittheycome/);
});

test('renderFooter carries exactly one social icon/link, not two, for the shared X/Bluesky handle', () => {
  const footer = renderFooter();
  const matches = footer.match(/href="https:\/\/x\.com\/builtittheycome"/g) || [];
  assert.equal(matches.length, 1);
  assert.doesNotMatch(footer, /bsky\.app/);
});

test('the social mark svg is inline markup, not an <img> pointing at the raw PNG', () => {
  const footer = renderFooter();
  assert.match(footer, /<svg[^>]*aria-hidden="true"[^]*<\/svg>/);
  assert.doesNotMatch(footer, /v3_horizon\.png/);
});

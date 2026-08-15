import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderNewsletterSignup } from '../src/shell.js';

test('renderNewsletterSignup points at the real Substack publication, not the "not live yet" placeholder', () => {
  const markup = renderNewsletterSignup();
  assert.doesNotMatch(markup, /isn.t live yet/);
  assert.match(markup, /data-newsletter-src="https:\/\/builtittheycome\.substack\.com\/embed"/);
});

test('renderNewsletterSignup does not render the third-party iframe directly -- it renders a lazy-load slot for js/newsletter.client.js to fill in', () => {
  const markup = renderNewsletterSignup();
  assert.doesNotMatch(markup, /<iframe/);
  assert.match(markup, /data-newsletter-slot/);
});

test('renderNewsletterSignup carries an accessible embed title and no inline event handlers', () => {
  const markup = renderNewsletterSignup();
  assert.match(markup, /data-newsletter-title="[^"]+"/);
  assert.doesNotMatch(markup, /\son[a-z]+=/i);
});

test('renderNewsletterSignup only ever points at the https scheme, in both the slot src and its default visible fallback link', () => {
  const markup = renderNewsletterSignup();
  const srcMatch = markup.match(/data-newsletter-src="([^"]+)"/);
  assert.ok(srcMatch, 'expected a data-newsletter-src attribute');
  assert.match(srcMatch[1], /^https:\/\//);
  // D1 fix: the slot's default content is now a real, visible link (not a
  // <noscript>-only fallback), so a failed/slow iframe load -- or no JS at
  // all -- never renders as an empty styled box. See src/shell.js's
  // renderNewsletterSignup comment.
  const slotLinkMatch = markup.match(/data-newsletter-slot[^>]*>\s*<a href="([^"]+)"/s);
  assert.ok(slotLinkMatch, 'expected a default visible fallback link inside the slot');
  assert.match(slotLinkMatch[1], /^https:\/\//);
});

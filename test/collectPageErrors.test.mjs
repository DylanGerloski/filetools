import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectPageErrors, BENIGN_GOOGLE_CSP_REPORT_ONLY } from './helpers/collectPageErrors.mjs';

// Minimal fake Playwright Page: just enough of the .on(event, handler) API
// for collectPageErrors to wire up against, with a way to fire events from
// the test.
function fakePage() {
  const handlers = {};
  return {
    on(event, handler) {
      (handlers[event] ||= []).push(handler);
    },
    emit(event, arg) {
      for (const h of handlers[event] || []) h(arg);
    },
  };
}

function consoleMsg(type, text) {
  return { type: () => type, text: () => text };
}

test('BENIGN_GOOGLE_CSP_REPORT_ONLY matches the exact message observed in CI (2026-08-16, runs 31919191916 and 31919106576)', () => {
  const observed =
    "Framing 'https://www.google.com/' violates the following report-only Content Security Policy directive: \"frame-ancestors 'self'\". The violation has been logged, but no further action has been taken.\n";
  assert.ok(BENIGN_GOOGLE_CSP_REPORT_ONLY.test(observed));
});

test('collectPageErrors filters out only the known-benign google.com report-only CSP console message', () => {
  const page = fakePage();
  const errors = collectPageErrors(page);

  page.emit(
    'console',
    consoleMsg(
      'error',
      "Framing 'https://www.google.com/' violates the following report-only Content Security Policy directive: \"frame-ancestors 'self'\". The violation has been logged, but no further action has been taken.\n",
    ),
  );
  assert.deepEqual(errors, [], 'the known-benign message must not be collected');

  page.emit('console', consoleMsg('error', 'TypeError: something real broke'));
  assert.deepEqual(errors, ['TypeError: something real broke'], 'a real console error must still be collected');
});

test('collectPageErrors ignores non-error console messages, same as the original inline pattern', () => {
  const page = fakePage();
  const errors = collectPageErrors(page);

  page.emit('console', consoleMsg('warning', 'some warning'));
  page.emit('console', consoleMsg('log', 'some log line'));
  assert.deepEqual(errors, []);
});

test('collectPageErrors still collects uncaught page errors (pageerror), unfiltered', () => {
  const page = fakePage();
  const errors = collectPageErrors(page);

  page.emit('pageerror', new Error('boom'));
  assert.deepEqual(errors, ['boom']);
});

test('BENIGN_GOOGLE_CSP_REPORT_ONLY does not match a similarly-worded but different-origin framing message', () => {
  const different =
    "Framing 'https://example.com/' violates the following report-only Content Security Policy directive: \"frame-ancestors 'self'\".";
  assert.equal(BENIGN_GOOGLE_CSP_REPORT_ONLY.test(different), false);
});

test('BENIGN_GOOGLE_CSP_REPORT_ONLY does not match an enforced (non-report-only) CSP violation for the same URL', () => {
  const enforced =
    "Framing 'https://www.google.com/' violates the following Content Security Policy directive: \"frame-ancestors 'self'\".";
  assert.equal(BENIGN_GOOGLE_CSP_REPORT_ONLY.test(enforced), false);
});

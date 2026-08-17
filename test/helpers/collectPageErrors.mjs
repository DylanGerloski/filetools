'use strict';

// Every e2e test file wires up the same page.on('pageerror')/page.on('console')
// pair to collect page errors and assert the page produced none. One
// specific console message is a confirmed-benign false positive that must
// be filtered out here rather than left for every call site to reinvent:
//
//   Framing 'https://www.google.com/' violates the following report-only
//   Content Security Policy directive: "frame-ancestors 'self'". The
//   violation has been logged, but no further action has been taken.
//
// Root cause (confirmed by direct local reproduction against a real
// network, and cross-checked against two failed CI runs -- 2026-08-16,
// databaseId 31919191916 and 31919106576 -- whose logged assertion failures
// carry byte-identical message text): every tool page unconditionally loads
// Google's AdSense Auto ads loader script (src/shell.js). That script
// starts Google's own ad-fraud detection pipeline (the
// adtrafficquality.google "sodar" mechanism), which asynchronously opens a
// hidden reCAPTCHA validation frame at
// https://www.google.com/recaptcha/api2/aframe, nested several frames deep
// (our page -> a googleads.g.doubleclick.net ad frame -> an
// adtrafficquality.google sodar-runner frame -> the google.com recaptcha
// frame). That frame is served by Google with its own report-only CSP
// (frame-ancestors 'self'), and because it's framed by
// adtrafficquality.google rather than "self" from google.com's point of
// view, Chromium logs this report-only violation warning inside that
// frame's own console -- which Playwright's page.on('console') surfaces on
// the outer Page. It's Google's own ad-infrastructure code, running on
// Google's own server, reporting about itself; it doesn't block anything
// (report-only), isn't caused by any of our own page code, and fires on an
// async multi-second timer unrelated to which tool page or test is running
// -- which is exactly why it landed on a different, unrelated test in each
// of the two CI runs above. There is nothing in this project to fix at the
// source, so it's excluded here by an exact, narrow message match rather
// than by weakening the general console-error check.
const BENIGN_GOOGLE_CSP_REPORT_ONLY =
  /^Framing 'https:\/\/www\.google\.com\/' violates the following report-only Content Security Policy directive: "frame-ancestors 'self'"\./;

/**
 * Wires up pageerror + console-error collection on `page`, the same way
 * every e2e test file previously did inline, filtering out the known-benign
 * message documented above so it can't randomly attach itself to whichever
 * test happens to be running when Google's ad-fraud pipeline reaches that
 * step.
 * @param {import('playwright').Page} page
 * @returns {string[]} the errors array, appended to in place as messages arrive
 */
export function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (BENIGN_GOOGLE_CSP_REPORT_ONLY.test(text)) return;
    errors.push(text);
  });
  return errors;
}

export { BENIGN_GOOGLE_CSP_REPORT_ONLY };

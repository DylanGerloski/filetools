import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * End-to-end test for src/browser/newsletter.client.js: the sitewide
 * newsletter signup slot in the footer must NOT fetch the third-party
 * Substack iframe on initial page load (that regressed this site's whole
 * Lighthouse Performance score, since the footer renders on every page --
 * see docs/CHANGELOG.md), but it must load it once the slot scrolls into
 * view, and it must degrade to a real link with JS disabled.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const BASE_PREFIX = '/filetools/';

function startServer(root, prefix) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (p.startsWith(prefix)) p = p.slice(prefix.length - 1);
      if (p.endsWith('/') || p === '') p += 'index.html';
      const resolved = path.join(root, p);
      fs.readFile(resolved, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found: ' + p); return; }
        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, 'localhost', () => resolve(server));
  });
}

let server;
let browser;
let baseUrl;

before(async () => {
  assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');
  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('newsletter embed: no request to substack.com fires before the footer slot is scrolled into view', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 400 } });
  const substackRequests = [];
  page.on('request', (req) => {
    if (/substack\.com/.test(req.url())) substackRequests.push(req.url());
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  // Confirm the slot exists but has not been replaced with an iframe yet.
  await page.waitForSelector('[data-newsletter-slot]');
  assert.equal(await page.locator('.newsletter-signup iframe').count(), 0);
  assert.deepEqual(substackRequests, []);

  await page.close();
});

test('newsletter embed: scrolling the footer into view replaces the slot with the real Substack iframe', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 400 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await page.locator('.newsletter-signup').scrollIntoViewIfNeeded();
  await page.waitForSelector('.newsletter-signup iframe', { timeout: 5000 });

  const src = await page.locator('.newsletter-signup iframe').getAttribute('src');
  assert.equal(src, 'https://builtittheycome.substack.com/embed');

  await page.close();
});

test('newsletter embed: degrades to a real link when JavaScript is disabled', async () => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseUrl);

  const link = page.locator('.newsletter-signup noscript');
  await assert.doesNotReject(link.waitFor({ state: 'attached' }));

  await page.close();
  await context.close();
});

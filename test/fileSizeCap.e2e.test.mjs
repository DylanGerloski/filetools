import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * End-to-end test for src/browser/dropzone.client.js's per-tool file-size
 * cap: before this cap existed, no file-accepting tool refused an
 * oversized file -- a large enough PDF (or pasted/dropped text file) just
 * hung the tab. Drives the built dist/ output in a real headless browser
 * and confirms a file over the cap is refused with a status message
 * instead of ever reaching its processor, using an in-memory buffer
 * (Playwright's setInputFiles buffer form) rather than writing an actual
 * 20MB+ file to disk.
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

test('file-size cap: a text file over remove-duplicate-lines\' 20MB cap is refused with a clear message, never reaches the processor', async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(`${baseUrl}data/remove-duplicate-lines/`, { waitUntil: 'networkidle' });

  const oversized = Buffer.alloc(21 * 1024 * 1024, 'a\n'.charCodeAt(0));
  await page.locator('#file-input').setInputFiles({
    name: 'huge.txt',
    mimeType: 'text/plain',
    buffer: oversized,
  });

  await page.waitForFunction(() => {
    const el = document.querySelector('.dz-status');
    return el && el.textContent && /too large/i.test(el.textContent);
  }, { timeout: 5000 });

  const statusText = await page.locator('.dz-status').textContent();
  assert.match(statusText, /too large/i);
  assert.match(statusText, /20MB/);
  assert.equal(await page.locator('.result').isVisible().catch(() => false), false, 'the oversized file should never have reached the processor / produced a result block');
  assert.deepEqual(errors, []);

  await page.close();
});

test('file-size cap: a small file under the cap is accepted normally (the cap does not false-positive on ordinary files)', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/remove-duplicate-lines/`, { waitUntil: 'networkidle' });

  const small = Buffer.from('one\ntwo\none\n', 'utf8');
  await page.locator('#file-input').setInputFiles({
    name: 'small.txt',
    mimeType: 'text/plain',
    buffer: small,
  });

  await page.waitForSelector('.result:not([hidden])');
  const statusText = await page.locator('.dz-status').textContent();
  assert.doesNotMatch(statusText, /too large/i);

  await page.close();
});

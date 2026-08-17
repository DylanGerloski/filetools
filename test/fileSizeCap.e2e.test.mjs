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
 * instead of ever reaching its processor. Smaller fixtures (up to ~21MB)
 * use Playwright's in-memory setInputFiles buffer form; the 200MB pdfPages
 * fixture exceeds that form's 50MB limit and is written to tmp_test/ (the
 * same gitignored scratch dir tools.e2e.test.mjs uses) on disk instead,
 * then passed by path.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, 'tmp_test');

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
  // Not rmSync-ing TMP itself here: it's the same shared, gitignored
  // tmp_test/ scratch dir tools.e2e.test.mjs also writes fixtures into, and
  // node:test can run test files concurrently -- deleting the whole
  // directory here could race a sibling file's still-running tests. The
  // oversized-cap test below removes only its own huge.pdf fixture.
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

test('file-size cap: a file over merge-pdf\'s own 200MB cap (pdfPages, the largest per-tool cap of any tool) is refused, never parsed', async () => {
  // pdfPages carries the largest MAX_BYTES_BY_CLIENT entry of any tool
  // (200MB, vs the 20MB default this file's other two tests exercise) and
  // had no cap test of its own before this -- the cap check runs on
  // file.size before the file is ever read as a PDF, so a plain oversized
  // buffer (never real PDF bytes) is sufficient to prove the refusal fires
  // ahead of parsing.
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(`${baseUrl}pdf/merge-pdf/`, { waitUntil: 'networkidle' });

  // Playwright's buffer form of setInputFiles refuses anything over 50MB
  // ("Cannot set buffer larger than 50Mb"), so a 201MB fixture has to be
  // written to disk and passed by path instead -- unlike this file's other
  // two (smaller) cap tests, which stay under that limit using the buffer
  // form directly.
  const hugePath = path.join(TMP, 'huge.pdf');
  fs.mkdirSync(TMP, { recursive: true });
  const chunk = Buffer.alloc(1024 * 1024, 'a'.charCodeAt(0));
  const fd = fs.openSync(hugePath, 'w');
  try {
    for (let written = 0; written < 201 * 1024 * 1024; written += chunk.length) {
      fs.writeSync(fd, chunk);
    }
  } finally {
    fs.closeSync(fd);
  }

  try {
    await page.locator('#file-input').setInputFiles(hugePath);

    await page.waitForFunction(() => {
      const el = document.querySelector('.dz-status');
      return el && el.textContent && /too large/i.test(el.textContent);
    }, { timeout: 10000 });

    const statusText = await page.locator('.dz-status').textContent();
    assert.match(statusText, /too large/i);
    assert.match(statusText, /200MB/);
    assert.equal(await page.locator('.file-list').count(), 0, 'the oversized file should never have reached the merge-order UI');
    assert.deepEqual(errors, []);
  } finally {
    fs.rmSync(hugePath, { force: true });
    await page.close();
  }
});

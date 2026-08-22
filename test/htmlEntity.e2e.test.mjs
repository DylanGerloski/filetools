import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the html-entity-encode-decode tool: drive the built
 * dist/ output in a real headless browser, through both input paths (file
 * upload and pasted text), and verify the actual rendered/downloaded
 * content -- not just that the page renders. Mirrors
 * test/dedupeLines.e2e.test.mjs's approach. Requires `npm run build` to have
 * already produced dist/.
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
  fs.mkdirSync(TMP, { recursive: true });

  fs.writeFileSync(path.join(TMP, 'sample.txt'), 'Tom & Jerry\'s <b>bold</b> "quote"');
  fs.writeFileSync(path.join(TMP, 'entities.txt'), 'Tom &amp; Jerry&#39;s &lt;b&gt;bold&lt;/b&gt;');

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('html-entity-encode-decode: uploading a .txt file encodes the reserved characters by default', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/html-entity-encode-decode/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'sample.txt'));
  await page.waitForSelector('.table-block');

  const badgeText = await page.locator('.page-badge').textContent();
  assert.match(badgeText, /encoded/i);

  const outputText = await page.locator('.entity-output').textContent();
  assert.equal(outputText, 'Tom &amp; Jerry&apos;s &lt;b&gt;bold&lt;/b&gt; &quot;quote&quot;');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'encoded.txt');
  assert.deepEqual(errors, []);
  await page.close();
});

test('html-entity-encode-decode: switching direction to Decode converts entities back to plain text live, without re-uploading', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/html-entity-encode-decode/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'entities.txt'));
  await page.waitForSelector('.table-block');

  await page.locator('label:has-text("Direction") select').selectOption('decode');
  await page.waitForFunction(() => {
    const el = document.querySelector('.entity-output');
    return el && el.textContent.includes('<b>bold</b>');
  });

  const outputText = await page.locator('.entity-output').textContent();
  assert.equal(outputText, 'Tom & Jerry\'s <b>bold</b>');
  const badgeText = await page.locator('.page-badge').textContent();
  assert.match(badgeText, /decoded/i);
  assert.deepEqual(errors, []);
  await page.close();
});

test('html-entity-encode-decode: pasting text and clicking Convert produces the same result as a file upload', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/html-entity-encode-decode/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'a & b < c');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  const outputText = await page.locator('.entity-output').textContent();
  assert.equal(outputText, 'a &amp; b &lt; c');
  assert.deepEqual(errors, []);
  await page.close();
});

test('html-entity-encode-decode: turning on "all-non-ascii" scope encodes accented characters live', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/html-entity-encode-decode/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'café');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  let outputText = await page.locator('.entity-output').textContent();
  assert.equal(outputText, 'café', 'default scope should leave the accented letter untouched');

  await page.locator('label:has-text("Scope") select').selectOption('all-non-ascii');
  await page.waitForFunction(() => {
    const el = document.querySelector('.entity-output');
    return el && el.textContent.includes('&');
  });
  outputText = await page.locator('.entity-output').textContent();
  assert.match(outputText, /^caf&(eacute|#233);$/);
  await page.close();
});

test('html-entity-encode-decode: clicking convert with an empty textarea shows an error instead of silently doing nothing', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/html-entity-encode-decode/`, { waitUntil: 'networkidle' });
  await page.locator('#paste-convert').click();
  await page.waitForFunction(() => {
    const el = document.querySelector('.dz-status');
    return el && el.textContent && el.textContent.trim().length > 0;
  });
  const statusText = await page.locator('.dz-status').textContent();
  assert.match(statusText, /paste some/i);
  await page.close();
});

test('html-entity-encode-decode: an empty file shows an honest "nothing to convert" message', async () => {
  const page = await browser.newPage();
  const emptyPath = path.join(TMP, 'empty.txt');
  fs.writeFileSync(emptyPath, '');
  await page.goto(`${baseUrl}data/html-entity-encode-decode/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(emptyPath);
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /nothing to convert/i);
  await page.close();
});

test('html-entity-encode-decode: the Copy to clipboard button copies the current result', async () => {
  const page = await browser.newPage();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`${baseUrl}data/html-entity-encode-decode/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'a & b');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  await page.locator('button:has-text("Copy to clipboard")').click();
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Copied');
    return !!btn;
  });
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clipboardText, 'a &amp; b');
  await page.close();
});

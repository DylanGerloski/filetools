import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * End-to-end tests for the YAML-to-JSON tool: drive the built dist/ output
 * in a real headless browser, through both input paths (file upload and
 * pasted YAML), and verify the actual downloaded content -- not just that
 * the page renders. Mirrors test/jsonToCsv.e2e.test.mjs's approach.
 * Requires `npm run build` to have already produced dist/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, 'tmp_test');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.csv': 'text/csv; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.yaml': 'application/yaml; charset=utf-8', '.yml': 'application/yaml; charset=utf-8',
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

  fs.writeFileSync(
    path.join(TMP, 'doc.yaml'),
    'name: Coffee\nprice: 4.5\naddress:\n  city: Reno\n'
  );

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('yaml-to-json: uploading a .yaml file converts it and downloads matching JSON', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}data/yaml-to-json/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'doc.yaml'));
  await page.waitForSelector('.json-preview');

  const previewText = await page.locator('.json-preview').textContent();
  assert.deepEqual(JSON.parse(previewText), { name: 'Coffee', price: 4.5, address: { city: 'Reno' } });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'converted.json');
  const outPath = path.join(TMP, 'converted-out.json');
  await download.saveAs(outPath);
  const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.deepEqual(parsed, { name: 'Coffee', price: 4.5, address: { city: 'Reno' } });
  assert.deepEqual(errors, []);
  await page.close();
});

test('yaml-to-json: pasting YAML and clicking convert produces the same result', async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}data/yaml-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'name: Coffee\nprice: 4.5\ntags:\n  - hot\n  - drink\n');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.json-preview');

  const previewText = await page.locator('.json-preview').textContent();
  assert.deepEqual(JSON.parse(previewText), { name: 'Coffee', price: 4.5, tags: ['hot', 'drink'] });
  assert.deepEqual(errors, []);
  await page.close();
});

test('yaml-to-json: pasting invalid YAML shows a friendly, specific error instead of a raw exception', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/yaml-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'a: b\n  c: d');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /valid yaml/i);
  await page.close();
});

test('yaml-to-json: pasting whitespace-only text shows a friendly status, not a blank result', async () => {
  // Blocked by dropzone.client.js's own shared empty-paste guard (every
  // pasteInput-enabled tool gets this before its processor's run() is ever
  // called) -- see that file's paste-convert-btn click handler.
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/yaml-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '   ');
  await page.locator('#paste-convert').click();
  await page.waitForFunction(() => document.querySelector('.dz-status')?.textContent.trim().length > 0);
  const msg = await page.locator('.dz-status').textContent();
  assert.match(msg, /paste some/i);
  await page.close();
});

test('yaml-to-json: uploading a genuinely empty file shows this tool’s own friendly error', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/yaml-to-json/`, { waitUntil: 'networkidle' });
  const emptyPath = path.join(TMP, 'empty.yaml');
  fs.writeFileSync(emptyPath, '');
  await page.locator('#file-input').setInputFiles(emptyPath);
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /empty/i);
  await page.close();
});

test('yaml-to-json: multiple --- separated documents combine into one JSON array', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/yaml-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'a: 1\n---\nb: 2\n');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.json-preview');

  const previewText = await page.locator('.json-preview').textContent();
  assert.deepEqual(JSON.parse(previewText), [{ a: 1 }, { b: 2 }]);
  await page.close();
});

test('yaml-to-json: YAML special numbers (.inf, .nan) become visible JSON strings, not silently null', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/yaml-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'a: .inf\nb: -.inf\nc: .nan\n');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.json-preview');

  const previewText = await page.locator('.json-preview').textContent();
  assert.deepEqual(JSON.parse(previewText), { a: 'Infinity', b: '-Infinity', c: 'NaN' });
  await page.close();
});

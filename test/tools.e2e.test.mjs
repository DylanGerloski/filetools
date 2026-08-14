import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PDFDocument, rgb } from 'pdf-lib';

/**
 * End-to-end tests: drive the built dist/ output in a real headless
 * browser and verify the three merge/split/rotate tools
 * actually work, not just that the page renders. Requires `npm run build`
 * to have already produced dist/ (this test does not build it itself, so a
 * stale dist/ against fresh src/ would be a false pass -- CI/QA should run
 * `npm run build` immediately before `npm test`).
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

  const a = await PDFDocument.create();
  for (let i = 0; i < 2; i += 1) {
    const p = a.addPage([300, 300]);
    p.drawText(`a page ${i + 1}`, { x: 20, y: 150, size: 20, color: rgb(0, 0, 0) });
  }
  fs.writeFileSync(path.join(TMP, 'a.pdf'), await a.save());

  const b = await PDFDocument.create();
  for (let i = 0; i < 3; i += 1) {
    const p = b.addPage([300, 300]);
    p.drawText(`b page ${i + 1}`, { x: 20, y: 150, size: 20, color: rgb(0, 0, 0) });
  }
  fs.writeFileSync(path.join(TMP, 'b.pdf'), await b.save());

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('merge-pdf: combines two files into one, in order, with no console errors', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}pdf/merge-pdf/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([path.join(TMP, 'a.pdf'), path.join(TMP, 'b.pdf')]);
  await page.waitForSelector('.file-list .file-row');
  assert.equal(await page.locator('.file-list .file-row').count(), 2);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Merge PDFs")').click(),
  ]);
  const outPath = path.join(TMP, 'merged-out.pdf');
  await download.saveAs(outPath);
  const doc = await PDFDocument.load(fs.readFileSync(outPath));
  assert.equal(doc.getPageCount(), 5, 'merged file should have 2 + 3 = 5 pages');
  assert.deepEqual(errors, []);
  await page.close();
});

test('split-pdf: a typed page range extracts exactly those pages', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}pdf/split-pdf/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'b.pdf'));
  await page.waitForSelector('.page-grid .page-card');
  assert.equal(await page.locator('.page-grid .page-card').count(), 3);

  await page.fill('#page-range-input', '1-2');
  await page.locator('#page-range-input').dispatchEvent('change');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Split PDF")').click(),
  ]);
  const outPath = path.join(TMP, 'split-out.pdf');
  await download.saveAs(outPath);
  const doc = await PDFDocument.load(fs.readFileSync(outPath));
  assert.equal(doc.getPageCount(), 2);
  assert.deepEqual(errors, []);
  await page.close();
});

test('rotate-pdf: rotating one page writes that rotation into the saved file', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}pdf/rotate-pdf/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'a.pdf'));
  await page.waitForSelector('.page-grid .page-card');

  await page.locator('.page-grid .page-card').first().locator('button[aria-label$="right"]').click();

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Save rotated PDF")').click(),
  ]);
  const outPath = path.join(TMP, 'rotate-out.pdf');
  await download.saveAs(outPath);
  const doc = await PDFDocument.load(fs.readFileSync(outPath));
  assert.equal(doc.getPage(0).getRotation().angle, 90);
  assert.deepEqual(errors, []);
  await page.close();
});

test('the word "upload" never appears inside the dropzone control itself (design-standard language rule)', async () => {
  // The rule scopes to control/status/error copy inside
  // the drop zone widget itself -- "choose", "add", "reading", etc. Plain
  // marketing prose elsewhere on the page ("no file uploads", meta
  // descriptions) legitimately uses the word to describe what does NOT
  // happen, so this check is scoped to the <div class="dropzone"> markup,
  // not the whole document.
  for (const slug of ['merge-pdf', 'split-pdf', 'rotate-pdf']) {
    const html = fs.readFileSync(path.join(DIST, 'pdf', slug, 'index.html'), 'utf8');
    const match = html.match(/<div class="dropzone"[\s\S]*?<\/div>/);
    assert.ok(match, `${slug}/index.html should contain a .dropzone block`);
    assert.doesNotMatch(match[0].toLowerCase(), /upload/, `${slug}/index.html's dropzone control should not use the word "upload"`);
  }
});

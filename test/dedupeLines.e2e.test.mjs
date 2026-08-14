import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * End-to-end tests for the remove-duplicate-lines tool: drive the built
 * dist/ output in a real headless browser, through both input paths (file
 * upload and pasted list), and verify the actual downloaded content -- not
 * just that the page renders. Mirrors test/htmlTableToCsv.e2e.test.mjs's
 * approach. Requires `npm run build` to have already produced dist/.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, 'tmp_test');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.csv': 'text/csv; charset=utf-8',
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

  fs.writeFileSync(path.join(TMP, 'list.txt'), 'apple\nbanana\napple\ncherry\nbanana\n');
  fs.writeFileSync(path.join(TMP, 'rows.csv'), 'Name,Amount\r\nCoffee,4.50\r\nRent,1200\r\nCoffee,4.50\r\n');

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('remove-duplicate-lines: uploading a .txt file removes exact-match duplicates and downloads the result', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}data/remove-duplicate-lines/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'list.txt'));
  await page.waitForSelector('.table-block');

  const badgeText = await page.locator('.page-badge').textContent();
  assert.match(badgeText, /2 duplicates removed/);

  const rowTexts = await page.locator('.extracted-table tbody tr td').allTextContents();
  assert.deepEqual(rowTexts, ['apple', 'banana', 'cherry']);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'deduplicated.txt');
  const outPath = path.join(TMP, 'list-out.txt');
  await download.saveAs(outPath);
  const bytes = fs.readFileSync(outPath);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'output should start with a UTF-8 BOM');
  assert.equal(bytes.subarray(3).toString('utf8'), 'apple\nbanana\ncherry\n');
  assert.deepEqual(errors, []);
  await page.close();
});

test('remove-duplicate-lines: a CSV file dedupes whole rows and downloads with a .csv name', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/remove-duplicate-lines/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'rows.csv'));
  await page.waitForSelector('.table-block');

  const rowTexts = await page.locator('.extracted-table tbody tr td').allTextContents();
  assert.deepEqual(rowTexts, ['Name,Amount', 'Coffee,4.50', 'Rent,1200']);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'deduplicated.csv');
  await page.close();
});

test('remove-duplicate-lines: pasting a list and clicking convert produces the same result as a file upload', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}data/remove-duplicate-lines/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'x\ny\nx\nz');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  const rowTexts = await page.locator('.extracted-table tbody tr td').allTextContents();
  assert.deepEqual(rowTexts, ['x', 'y', 'z']);
  assert.deepEqual(errors, []);
  await page.close();
});

test('remove-duplicate-lines: clicking convert with an empty textarea shows an error instead of silently doing nothing', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/remove-duplicate-lines/`, { waitUntil: 'networkidle' });
  await page.locator('#paste-convert').click();
  await page.waitForFunction(() => {
    const el = document.querySelector('.dz-status');
    return el && el.textContent && el.textContent.trim().length > 0;
  });
  const statusText = await page.locator('.dz-status').textContent();
  assert.match(statusText, /paste some/i);
  await page.close();
});

test('remove-duplicate-lines: turning on "ignore case" merges differently-cased duplicates live, without re-uploading', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/remove-duplicate-lines/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'Apple\napple\nAPPLE\nBanana');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  let rowTexts = await page.locator('.extracted-table tbody tr td').allTextContents();
  assert.deepEqual(rowTexts, ['Apple', 'apple', 'APPLE', 'Banana'], 'case-sensitive by default -- all four lines are distinct');

  await page.locator('label:has-text("Ignore case") input[type="checkbox"]').check();
  await page.waitForFunction(() => document.querySelectorAll('.extracted-table tbody tr').length === 2);
  rowTexts = await page.locator('.extracted-table tbody tr td').allTextContents();
  assert.deepEqual(rowTexts, ['Apple', 'Banana']);
  await page.close();
});

test('remove-duplicate-lines: an empty file shows an honest "nothing to deduplicate" message', async () => {
  const page = await browser.newPage();
  const emptyPath = path.join(TMP, 'empty.txt');
  fs.writeFileSync(emptyPath, '');
  await page.goto(`${baseUrl}data/remove-duplicate-lines/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(emptyPath);
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /nothing to deduplicate/i);
  await page.close();
});

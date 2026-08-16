import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the sort-by-column tool: drive the built dist/
 * output in a real headless browser, through both input paths (file upload
 * and pasted list), and verify the actual downloaded content -- not just
 * that the page renders. Mirrors test/dedupeLines.e2e.test.mjs's approach.
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

  fs.writeFileSync(path.join(TMP, 'sort-list.txt'), 'banana\napple\ncherry\n');
  fs.writeFileSync(path.join(TMP, 'sort-rows.csv'), 'Name,Amount\r\nRent,1200\r\nCoffee,4.50\r\nSnacks,3.25\r\n');

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('sort-lines: uploading a plain-text list sorts it alphabetically and downloads the result', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/sort-lines/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'sort-list.txt'));
  await page.waitForSelector('.table-block');

  const rowTexts = await page.locator('.extracted-table tbody tr td').allTextContents();
  assert.deepEqual(rowTexts, ['apple', 'banana', 'cherry']);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'sorted.txt');
  const outPath = path.join(TMP, 'sort-list-out.txt');
  await download.saveAs(outPath);
  const bytes = fs.readFileSync(outPath);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'output should start with a UTF-8 BOM');
  assert.equal(bytes.subarray(3).toString('utf8'), 'apple\nbanana\ncherry\n');
  assert.deepEqual(errors, []);
  await page.close();
});

test('sort-lines: switching order to descending live-resorts the preview without re-uploading', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/sort-lines/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'sort-list.txt'));
  await page.waitForSelector('.table-block');

  await page.locator('.table-block-head select').first().selectOption('desc');
  await page.waitForFunction(() => {
    const cells = document.querySelectorAll('.extracted-table tbody tr td');
    return cells.length === 3 && cells[0].textContent === 'cherry';
  });
  const rowTexts = await page.locator('.extracted-table tbody tr td').allTextContents();
  assert.deepEqual(rowTexts, ['cherry', 'banana', 'apple']);
  await page.close();
});

test('sort-lines: a CSV file defaults to keeping the header pinned and sorts by the chosen column', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/sort-lines/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'sort-rows.csv'));
  await page.waitForSelector('.table-block');

  // Default column is 0 (Name) ascending, header pinned at top.
  let rowTexts = await page.locator('.extracted-table tbody tr td').allTextContents();
  assert.deepEqual(rowTexts, ['Name,Amount', 'Coffee,4.50', 'Rent,1200', 'Snacks,3.25']);

  // Switch to sorting by the Amount column (index 1) -- numeric ascending.
  const columnSelect = page.locator('.table-block-head select').first();
  await columnSelect.selectOption('1');
  await page.waitForFunction(() => {
    const cells = document.querySelectorAll('.extracted-table tbody tr td');
    return cells.length === 4 && cells[1].textContent === 'Snacks,3.25';
  });
  rowTexts = await page.locator('.extracted-table tbody tr td').allTextContents();
  assert.deepEqual(rowTexts, ['Name,Amount', 'Snacks,3.25', 'Coffee,4.50', 'Rent,1200']);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'sorted.csv');
  await page.close();
});

test('sort-lines: pasting a list and clicking sort produces the same result as a file upload', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/sort-lines/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '30\n4\n100');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  const rowTexts = await page.locator('.extracted-table tbody tr td').allTextContents();
  assert.deepEqual(rowTexts, ['4', '30', '100'], 'numeric auto-detection should sort 4 before 30 before 100');
  assert.deepEqual(errors, []);
  await page.close();
});

test('sort-lines: clicking sort with an empty textarea shows an error instead of silently doing nothing', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/sort-lines/`, { waitUntil: 'networkidle' });
  await page.locator('#paste-convert').click();
  await page.waitForFunction(() => {
    const el = document.querySelector('.dz-status');
    return el && el.textContent && el.textContent.trim().length > 0;
  });
  const statusText = await page.locator('.dz-status').textContent();
  assert.match(statusText, /paste some/i);
  await page.close();
});

test('sort-lines: an empty file shows an honest "nothing to sort" message', async () => {
  const page = await browser.newPage();
  const emptyPath = path.join(TMP, 'sort-empty.txt');
  fs.writeFileSync(emptyPath, '');
  await page.goto(`${baseUrl}data/sort-lines/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(emptyPath);
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /nothing to sort/i);
  await page.close();
});

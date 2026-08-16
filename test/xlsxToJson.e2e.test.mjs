import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';
import ExcelJS from 'exceljs';

/**
 * End-to-end tests for the XLSX-to-JSON tool: drive the built dist/ output
 * in a real headless browser and verify the actual downloaded JSON content
 * -- not just that the page renders. Mirrors
 * test/htmlTableToCsv.e2e.test.mjs's approach. Fixture .xlsx files are
 * generated with exceljs itself (a real dependency of this project, so no
 * extra fixture-only dependency), which is also a light cross-check that
 * this project's own writer and the browser-loaded reader agree on the
 * file format. Requires `npm run build` to have already produced dist/.
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

  const oneSheet = new ExcelJS.Workbook();
  const ws1 = oneSheet.addWorksheet('Orders');
  ws1.addRow(['Name', 'Price', 'InStock']);
  ws1.addRow(['Coffee', 4.5, true]);
  ws1.addRow(['Tea', 3.25, false]);
  await oneSheet.xlsx.writeFile(path.join(TMP, 'one-sheet.xlsx'));

  const twoSheets = new ExcelJS.Workbook();
  const wsA = twoSheets.addWorksheet('A');
  wsA.addRow(['x']);
  wsA.addRow([1]);
  const wsB = twoSheets.addWorksheet('B');
  wsB.addRow(['y']);
  wsB.addRow([2]);
  await twoSheets.xlsx.writeFile(path.join(TMP, 'two-sheets.xlsx'));

  fs.writeFileSync(path.join(TMP, 'not-really.xlsx'), 'this is not a real xlsx file');

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('xlsx-to-json: uploading a single-sheet workbook previews it and downloads matching, typed JSON', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/xlsx-to-json/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'one-sheet.xlsx'));
  await page.waitForSelector('.table-block');

  const headerTexts = await page.locator('.extracted-table thead th').allTextContents();
  assert.deepEqual(headerTexts, ['Name', 'Price', 'InStock']);
  const bodyRowCount = await page.locator('.extracted-table tbody tr').count();
  assert.equal(bodyRowCount, 2);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download JSON")').click(),
  ]);
  const outPath = path.join(TMP, 'orders-out.json');
  await download.saveAs(outPath);
  const records = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.deepEqual(records, [
    { Name: 'Coffee', Price: 4.5, InStock: true },
    { Name: 'Tea', Price: 3.25, InStock: false },
  ]);
  assert.deepEqual(errors, []);
  await page.close();
});

test('xlsx-to-json: turning off "first row is a header" produces column_N keys instead', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/xlsx-to-json/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'one-sheet.xlsx'));
  await page.waitForSelector('.table-block');

  await page.locator('.table-block-head input[type="checkbox"]').uncheck();
  await page.waitForFunction(() => document.querySelectorAll('.extracted-table thead').length === 0);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download JSON")').click(),
  ]);
  const outPath = path.join(TMP, 'orders-noheader-out.json');
  await download.saveAs(outPath);
  const records = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.deepEqual(records, [
    { column_1: 'Name', column_2: 'Price', column_3: 'InStock' },
    { column_1: 'Coffee', column_2: 4.5, column_3: true },
    { column_1: 'Tea', column_2: 3.25, column_3: false },
  ]);
  await page.close();
});

test('xlsx-to-json: a two-sheet workbook renders two blocks with a working "download all sheets" option', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/xlsx-to-json/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'two-sheets.xlsx'));
  await page.waitForSelector('.table-block');

  assert.equal(await page.locator('.table-block').count(), 2);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download all 2 sheets")').click(),
  ]);
  const outPath = path.join(TMP, 'two-sheets-out.json');
  await download.saveAs(outPath);
  const combined = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.deepEqual(combined, {
    A: [{ x: 1 }],
    B: [{ y: 2 }],
  });
  await page.close();
});

test('xlsx-to-json: a file that isn\'t really an .xlsx shows an honest error, not a crash', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(`${baseUrl}data/xlsx-to-json/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'not-really.xlsx'));
  await page.waitForFunction(() => {
    const dz = document.querySelector('.dropzone');
    return dz && dz.dataset.state === 'error';
  }, { timeout: 15000 });

  const statusText = await page.locator('.dz-status').textContent();
  assert.match(statusText, /doesn.t look like a valid \.xlsx file/i);
  assert.equal(await page.locator('.table-block').count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
});

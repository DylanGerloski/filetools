import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/**
 * End-to-end tests for the PDF-tables-to-CSV tool: drive the built dist/
 * output in a real headless browser against a PDF built with real pdf-lib
 * text draws (not synthetic item objects), and verify the actual
 * downloaded CSV content -- not just that the page renders. Mirrors
 * test/tools.e2e.test.mjs's approach for the other tool family. Requires
 * `npm run build` to have already produced dist/.
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

/**
 * Builds a real single-page PDF with a short prose line followed by a
 * genuine 3-column, 4-row table (a header row plus three data rows), drawn
 * with pdf-lib's own text placement -- exercising the real pdf.js
 * getTextContent() output this tool actually reads, not a hand-built item
 * list.
 */
async function buildTablePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 420]);
  const size = 12;
  const draw = (text, x, y) => page.drawText(text, { x, y, size, font });

  draw('Fruit Inventory Report', 20, 390);

  const rows = [
    ['Name', 'Qty', 'Price'],
    ['Apples', '3', '$1.50'],
    ['Bananas', '12', '$0.75'],
    ['Cherries', '5', '$4.20'],
  ];
  const xs = [20, 160, 260];
  let y = 350;
  for (const row of rows) {
    row.forEach((cell, i) => draw(cell, xs[i], y));
    y -= 22;
  }

  return doc.save();
}

let server;
let browser;
let baseUrl;

before(async () => {
  assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');
  fs.mkdirSync(TMP, { recursive: true });

  fs.writeFileSync(path.join(TMP, 'table.pdf'), await buildTablePdf());

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('pdf-to-csv: finds the table, treats the first row as a header, and downloads a correct CSV', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}pdf/pdf-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'table.pdf'));
  await page.waitForSelector('.table-block');

  assert.equal(await page.locator('.table-block').count(), 1, 'should find exactly one table');
  // A trailing sr-only "Row actions" <th> aligns the header with each data
  // row's row-drop button column -- not one of the extracted data columns.
  assert.equal(await page.locator('.extracted-table thead th:not(.sr-only)').count(), 3, 'header row should have 3 columns');
  const headerTexts = await page.locator('.extracted-table thead th:not(.sr-only)').allTextContents();
  assert.deepEqual(headerTexts, ['Name', 'Qty', 'Price']);

  const bodyRows = await page.locator('.extracted-table tbody tr').count();
  assert.equal(bodyRows, 3, 'three data rows (Apples/Bananas/Cherries) should render under the header');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download CSV")').click(),
  ]);
  const outPath = path.join(TMP, 'table-out.csv');
  await download.saveAs(outPath);
  const csvBytes = fs.readFileSync(outPath);
  // First three bytes are the UTF-8 BOM (EF BB BF) -- see
  // src/browser/pdfTables.client.js's csvBlob().
  assert.deepEqual([...csvBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const csvText = csvBytes.subarray(3).toString('utf8');
  assert.equal(
    csvText,
    'Name,Qty,Price\r\nApples,3,$1.50\r\nBananas,12,$0.75\r\nCherries,5,$4.20\r\n'
  );
  assert.deepEqual(errors, []);
  await page.close();
});

test('pdf-to-csv: editing a column boundary recomputes the table cells live', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}pdf/pdf-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'table.pdf'));
  await page.waitForSelector('.table-block');

  // Move the first boundary far to the right (past every column's x
  // position) so columns 1 and 2 merge into one cell -- a directly
  // observable, deterministic effect of a boundary edit.
  const firstBoundaryInput = page.locator('.boundary-item input[type="number"]').first();
  await firstBoundaryInput.fill('900');
  await firstBoundaryInput.dispatchEvent('change');

  await page.waitForFunction(() => {
    const th = document.querySelectorAll('.extracted-table thead th');
    return th.length > 0 && th[0].textContent.includes('Name') && th[0].textContent.includes('Qty');
  });
  const headerTexts = await page.locator('.extracted-table thead th').allTextContents();
  assert.ok(headerTexts[0].includes('Name') && headerTexts[0].includes('Qty'), `expected merged first column, got "${headerTexts[0]}"`);
  await page.close();
});

test('pdf-to-csv: dropping a row removes it from the rendered table', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}pdf/pdf-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'table.pdf'));
  await page.waitForSelector('.table-block');

  assert.equal(await page.locator('.extracted-table tbody tr').count(), 3);
  await page.locator('.extracted-table tbody tr').first().locator('.row-drop').click();
  await page.waitForFunction(() => document.querySelectorAll('.extracted-table tbody tr').length === 2);
  assert.equal(await page.locator('.extracted-table tbody tr').count(), 2);
  await page.close();
});

test('pdf-to-csv: a PDF with no table shows the honest "no tables found" message, never a garbage CSV', async () => {
  const proseDoc = await PDFDocument.create();
  const font = await proseDoc.embedFont(StandardFonts.Helvetica);
  const p = proseDoc.addPage([400, 200]);
  p.drawText('This document is just three lines of plain prose text.', { x: 20, y: 150, size: 12, font });
  p.drawText('It has no tabular structure anywhere on the page at all.', { x: 20, y: 130, size: 12, font });
  p.drawText('So no table should be detected here, and none should render.', { x: 20, y: 110, size: 12, font });
  fs.writeFileSync(path.join(TMP, 'prose.pdf'), await proseDoc.save());

  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}pdf/pdf-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'prose.pdf'));
  await page.waitForSelector('.alert-warn');
  assert.equal(await page.locator('.table-block').count(), 0);
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /No tables were found/);
  await page.close();
});

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/**
 * End-to-end tests for the bank/card-statement PDF-to-CSV tool: drive the
 * built dist/ output in a real headless browser against PDFs built with
 * real pdf-lib text draws (not synthetic item objects), and verify the
 * actual downloaded CSV content -- not just that the page renders. Mirrors
 * test/pdfTables.e2e.test.mjs's approach. Requires `npm run build` to have
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

/**
 * Builds a real two-page "statement" PDF: each page has a short letterhead
 * line, then a 3-column transaction table (Date / Description / Amount)
 * with the SAME header repeated on both pages -- the exact shape a real
 * multi-page bank statement export has, drawn with pdf-lib's own text
 * placement so this exercises the real pdf.js getTextContent() output.
 * Column x-positions are spaced generously and the letterhead kept short
 * and confined to the first column's x-range -- same reasoning
 * test/tableExtract.test.mjs's sampleDocItems() documents: a prose line
 * that spills ink into an inter-column gap defeats the whitespace-gap
 * column detector, the same as it would in a real PDF whose letterhead
 * happens to run the full page width.
 */
async function buildStatementPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = 11;
  const header = ['Date', 'Description', 'Amount'];
  const xs = [20, 180, 380];

  const page1Rows = [
    header,
    ['2026-01-02', 'Coffee Shop', '-4.50'],
    ['2026-01-03', 'Direct Deposit Paycheck', '1500.00'],
    ['2026-01-07', 'Grocery Store', '-62.14'],
  ];
  const page2Rows = [
    header,
    ['2026-01-15', 'Electric Company', '-88.20'],
    ['2026-01-18', 'Streaming Service', '-12.99'],
    ['2026-01-22', 'ATM Withdrawal', '-100.00'],
  ];

  for (const rows of [page1Rows, page2Rows]) {
    const page = doc.addPage([520, 300]);
    const draw = (text, x, y) => page.drawText(text, { x, y, size, font });
    draw('Statement', 20, 270);
    let y = 230;
    for (const row of rows) {
      row.forEach((cell, i) => draw(cell, xs[i], y));
      y -= 22;
    }
  }

  return doc.save();
}

let server;
let browser;
let baseUrl;

before(async () => {
  assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');
  fs.mkdirSync(TMP, { recursive: true });

  fs.writeFileSync(path.join(TMP, 'statement.pdf'), await buildStatementPdf());

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('bank-statement-to-csv: merges a two-page statement into one table, drops the repeated header, downloads one combined CSV', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}pdf/bank-statement-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'statement.pdf'));
  await page.waitForSelector('.table-block');

  // Exactly one merged main table (no "other tables" block, since both
  // pages share the same 3-column shape) with 6 combined data rows.
  assert.equal(await page.locator('.table-block').count(), 1, 'should render exactly one merged table block');
  const headerTexts = await page.locator('.extracted-table thead th').allTextContents();
  assert.deepEqual(headerTexts, ['Date', 'Description', 'Amount']);

  const bodyRowCount = await page.locator('.extracted-table tbody tr').count();
  assert.equal(bodyRowCount, 6, 'six transaction rows across both pages, with the repeated header row removed');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download CSV")').click(),
  ]);
  const outPath = path.join(TMP, 'statement-out.csv');
  await download.saveAs(outPath);
  assert.equal(download.suggestedFilename(), 'statement.csv');

  const csvBytes = fs.readFileSync(outPath);
  // First three bytes are the UTF-8 BOM (EF BB BF).
  assert.deepEqual([...csvBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const csvText = csvBytes.subarray(3).toString('utf8');
  assert.equal(
    csvText,
    'Date,Description,Amount\r\n'
    + '2026-01-02,Coffee Shop,-4.50\r\n'
    + '2026-01-03,Direct Deposit Paycheck,1500.00\r\n'
    + '2026-01-07,Grocery Store,-62.14\r\n'
    + '2026-01-15,Electric Company,-88.20\r\n'
    + '2026-01-18,Streaming Service,-12.99\r\n'
    + '2026-01-22,ATM Withdrawal,-100.00\r\n'
  );
  assert.deepEqual(errors, []);
  await page.close();
});

test('bank-statement-to-csv: dropping a row before download removes it from the exported CSV', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}pdf/bank-statement-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'statement.pdf'));
  await page.waitForSelector('.table-block');

  assert.equal(await page.locator('.extracted-table tbody tr').count(), 6);
  await page.locator('.extracted-table tbody tr').first().locator('.row-drop').click();
  await page.waitForFunction(() => document.querySelectorAll('.extracted-table tbody tr').length === 5);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download CSV")').click(),
  ]);
  const outPath = path.join(TMP, 'statement-dropped.csv');
  await download.saveAs(outPath);
  const csvText = fs.readFileSync(outPath).subarray(3).toString('utf8');
  assert.ok(!csvText.includes('Coffee Shop'), 'dropped row should not appear in the downloaded CSV');
  assert.equal(csvText.split('\r\n').filter(Boolean).length, 6, 'header + 5 remaining rows');
  await page.close();
});

test('bank-statement-to-csv: a PDF with no tabular structure shows the honest "no transaction table" message', async () => {
  const proseDoc = await PDFDocument.create();
  const font = await proseDoc.embedFont(StandardFonts.Helvetica);
  const p = proseDoc.addPage([400, 200]);
  p.drawText('This document is just three lines of plain prose text.', { x: 20, y: 150, size: 12, font });
  p.drawText('It has no tabular structure anywhere on the page at all.', { x: 20, y: 130, size: 12, font });
  p.drawText('So no transaction table should be detected here.', { x: 20, y: 110, size: 12, font });
  fs.writeFileSync(path.join(TMP, 'prose-statement.pdf'), await proseDoc.save());

  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}pdf/bank-statement-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'prose-statement.pdf'));
  await page.waitForSelector('.alert-warn');
  assert.equal(await page.locator('.table-block').count(), 0);
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /No transaction table was found/);
  await page.close();
});

test('bank-statement-to-csv: a single-page statement works without any multi-page merge note', async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = 11;
  const page = doc.addPage([520, 260]);
  const draw = (text, x, y) => page.drawText(text, { x, y, size, font });
  draw('Statement', 20, 220);
  const rows = [
    ['Date', 'Description', 'Amount'],
    ['2026-02-01', 'Gas Station', '-40.00'],
    ['2026-02-04', 'Refund', '15.00'],
    ['2026-02-09', 'Pharmacy', '-22.30'],
  ];
  const xs = [20, 180, 380];
  let y = 180;
  for (const row of rows) {
    row.forEach((cell, i) => draw(cell, xs[i], y));
    y -= 22;
  }
  fs.writeFileSync(path.join(TMP, 'single-page-statement.pdf'), await doc.save());

  const page2 = await browser.newPage({ acceptDownloads: true });
  await page2.goto(`${baseUrl}pdf/bank-statement-to-csv/`, { waitUntil: 'networkidle' });
  await page2.locator('#file-input').setInputFiles(path.join(TMP, 'single-page-statement.pdf'));
  await page2.waitForSelector('.table-block');
  assert.equal(await page2.locator('.extracted-table tbody tr').count(), 3);
  const caption = await page2.locator('.result > p.caption').first().textContent();
  assert.match(caption, /Found 3 rows on page 1/);
  await page2.close();
});

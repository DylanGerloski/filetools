import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the HTML-table-to-CSV/JSON tool: drive the built
 * dist/ output in a real headless browser, through BOTH input paths (file
 * upload and pasted markup), and verify the actual downloaded CSV/JSON
 * content -- not just that the page renders. Mirrors
 * test/statementToCsv.e2e.test.mjs's approach. Requires `npm run build` to
 * have already produced dist/.
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

  fs.writeFileSync(
    path.join(TMP, 'table.html'),
    '<html><body><table>'
    + '<tr><th>Name</th><th>Amount</th></tr>'
    + '<tr><td>Coffee</td><td>4.50</td></tr>'
    + '<tr><td>Rent</td><td>1200</td></tr>'
    + '</table></body></html>'
  );

  fs.writeFileSync(
    path.join(TMP, 'two-tables.html'),
    '<html><body>'
    + '<table><tr><th>A</th></tr><tr><td>1</td></tr></table>'
    + '<table><tr><th>B</th></tr><tr><td>2</td></tr></table>'
    + '</body></html>'
  );

  fs.writeFileSync(path.join(TMP, 'no-table.html'), '<html><body><p>Just a paragraph, no table here.</p></body></html>');

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('html-table-to-csv: uploading an .html file extracts the table and downloads a matching CSV', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/html-table-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'table.html'));
  await page.waitForSelector('.table-block');

  const headerTexts = await page.locator('.extracted-table thead th').allTextContents();
  assert.deepEqual(headerTexts, ['Name', 'Amount']);
  const bodyRowCount = await page.locator('.extracted-table tbody tr').count();
  assert.equal(bodyRowCount, 2);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download CSV")').click(),
  ]);
  const outPath = path.join(TMP, 'table-out.csv');
  await download.saveAs(outPath);
  const csvBytes = fs.readFileSync(outPath);
  assert.deepEqual([...csvBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'CSV should start with a UTF-8 BOM');
  const csvText = csvBytes.subarray(3).toString('utf8');
  assert.equal(csvText, 'Name,Amount\r\nCoffee,4.50\r\nRent,1200\r\n');
  assert.deepEqual(errors, []);
  await page.close();
});

test('html-table-to-csv: the same table downloads as valid, correctly-shaped JSON', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/html-table-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'table.html'));
  await page.waitForSelector('.table-block');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download JSON")').click(),
  ]);
  const outPath = path.join(TMP, 'table-out.json');
  await download.saveAs(outPath);
  const records = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.deepEqual(records, [
    { Name: 'Coffee', Amount: '4.50' },
    { Name: 'Rent', Amount: '1200' },
  ]);
  await page.close();
});

test('html-table-to-csv: pasting markup and clicking convert produces the same result as a file upload', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/html-table-to-csv/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '<table><tr><th>City</th></tr><tr><td>Austin</td></tr></table>');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  const headerTexts = await page.locator('.extracted-table thead th').allTextContents();
  assert.deepEqual(headerTexts, ['City']);
  assert.deepEqual(errors, []);
  await page.close();
});

test('html-table-to-csv: pasting markup with no table shows the honest "no table found" message, not a script execution', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  let dialogFired = false;
  page.on('dialog', async (dialog) => { dialogFired = true; await dialog.dismiss(); });

  await page.goto(`${baseUrl}data/html-table-to-csv/`, { waitUntil: 'networkidle' });
  // A <script> tag in pasted markup must never execute (DOMParser-parsed
  // documents are inert) -- if it somehow did, this alert() would fire and
  // dialogFired would flip true.
  await page.fill('#paste-textarea', '<script>alert("should never run")</script><p>no table, just a script</p>');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.alert-warn');

  assert.equal(await page.locator('.table-block').count(), 0);
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /No <table> element was found/);
  assert.equal(dialogFired, false, 'a <script> tag in pasted markup must never actually execute');
  await page.close();
});

test('html-table-to-csv: clicking convert with an empty textarea shows an error instead of silently doing nothing', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/html-table-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#paste-convert').click();
  await page.waitForFunction(() => {
    const el = document.querySelector('.dz-status');
    return el && el.textContent && el.textContent.trim().length > 0;
  });
  const statusText = await page.locator('.dz-status').textContent();
  assert.match(statusText, /paste some markup/i);
  await page.close();
});

test('html-table-to-csv: two tables in one document render as two blocks with a working "download all" option', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/html-table-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'two-tables.html'));
  await page.waitForSelector('.table-block');

  assert.equal(await page.locator('.table-block').count(), 2);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download all 2 tables (CSV)")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'table-1.csv');
  await page.close();
});

test('html-table-to-csv: dropping a row before download removes it from the exported CSV', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/html-table-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'table.html'));
  await page.waitForSelector('.table-block');

  assert.equal(await page.locator('.extracted-table tbody tr').count(), 2);
  await page.locator('.extracted-table tbody tr').first().locator('.row-drop').click();
  await page.waitForFunction(() => document.querySelectorAll('.extracted-table tbody tr').length === 1);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download CSV")').click(),
  ]);
  const outPath = path.join(TMP, 'table-dropped.csv');
  await download.saveAs(outPath);
  const csvText = fs.readFileSync(outPath).subarray(3).toString('utf8');
  assert.ok(!csvText.includes('Coffee'), 'dropped row should not appear in the downloaded CSV');
  assert.equal(csvText, 'Name,Amount\r\nRent,1200\r\n');
  await page.close();
});

test('html-table-to-csv: a file with no <table> at all shows the honest "no table found" message', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/html-table-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'no-table.html'));
  await page.waitForSelector('.alert-warn');
  assert.equal(await page.locator('.table-block').count(), 0);
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /No <table> element was found/);
  await page.close();
});

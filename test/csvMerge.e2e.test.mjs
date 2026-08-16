import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the merge-CSV-files tool: drive the built dist/
 * output in a real headless browser and verify the actual downloaded
 * content -- not just that the page renders. Mirrors
 * test/sortLines.e2e.test.mjs's approach. Requires `npm run build` to have
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

  fs.writeFileSync(path.join(TMP, 'merge-jan.csv'), 'Name,Amount\r\nRent,1200\r\nCoffee,4.50\r\n');
  fs.writeFileSync(path.join(TMP, 'merge-feb.csv'), 'Name,Amount,Category\r\nSnacks,3.25,Food\r\n');
  fs.writeFileSync(path.join(TMP, 'merge-noheader-a.csv'), 'Rent,1200\r\n');
  fs.writeFileSync(path.join(TMP, 'merge-noheader-b.csv'), 'Snacks,3.25\r\n');

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('merge-csv: two files with the same header merge into one aligned table', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([
    path.join(TMP, 'merge-jan.csv'),
    path.join(TMP, 'merge-feb.csv'),
  ]);
  await page.waitForSelector('.table-block');

  const headerTexts = await page.locator('.extracted-table thead th').allTextContents();
  assert.deepEqual(headerTexts, ['Name', 'Amount', 'Category']);

  const rows = await page.locator('.extracted-table tbody tr').evaluateAll(
    (trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent))
  );
  assert.deepEqual(rows, [
    ['Rent', '1200', ''],
    ['Coffee', '4.50', ''],
    ['Snacks', '3.25', 'Food'],
  ]);

  const badgeText = await page.locator('.page-badge').textContent();
  assert.match(badgeText, /3 rows from 2 files/);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'merged.csv');
  const outPath = path.join(TMP, 'merge-out.csv');
  await download.saveAs(outPath);
  const bytes = fs.readFileSync(outPath);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'output should start with a UTF-8 BOM');
  assert.equal(
    bytes.subarray(3).toString('utf8'),
    'Name,Amount,Category\r\nRent,1200,\r\nCoffee,4.50,\r\nSnacks,3.25,Food\r\n'
  );
  assert.deepEqual(errors, []);
  await page.close();
});

test('merge-csv: the per-file summary reports the new column', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([
    path.join(TMP, 'merge-jan.csv'),
    path.join(TMP, 'merge-feb.csv'),
  ]);
  await page.waitForSelector('.file-list');

  const fileRows = await page.locator('.file-row').allTextContents();
  assert.equal(fileRows.length, 2);
  assert.match(fileRows[1], /adds Category/);
  await page.close();
});

test('merge-csv: turning off "each file has a header row" merges positionally', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([
    path.join(TMP, 'merge-noheader-a.csv'),
    path.join(TMP, 'merge-noheader-b.csv'),
  ]);
  await page.waitForSelector('.table-block');

  await page.locator('.table-block-head input[type="checkbox"]').first().uncheck();
  await page.waitForFunction(() => !document.querySelector('.extracted-table thead'));

  const rows = await page.locator('.extracted-table tbody tr').evaluateAll(
    (trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent))
  );
  assert.deepEqual(rows, [['Rent', '1200'], ['Snacks', '3.25']]);
  await page.close();
});

test('merge-csv: "Add a Source file column" prepends the originating file name', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([
    path.join(TMP, 'merge-jan.csv'),
    path.join(TMP, 'merge-feb.csv'),
  ]);
  await page.waitForSelector('.table-block');

  await page.locator('.table-block-head input[type="checkbox"]').nth(1).check();
  await page.waitForFunction(() => {
    const ths = document.querySelectorAll('.extracted-table thead th');
    return ths.length && ths[0].textContent === 'Source file';
  });

  const firstDataRow = await page.locator('.extracted-table tbody tr').first().locator('td').allTextContents();
  assert.deepEqual(firstDataRow, ['merge-jan.csv', 'Rent', '1200', '']);
  await page.close();
});

test('merge-csv: a single file with no header still merges (a trivial one-file "merge")', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'merge-jan.csv'));
  await page.waitForSelector('.table-block');

  const badgeText = await page.locator('.page-badge').textContent();
  assert.match(badgeText, /2 rows from 1 file/);
  await page.close();
});

test('merge-csv: all-empty files show an honest "nothing to merge" message', async () => {
  const page = await browser.newPage();
  const emptyPath = path.join(TMP, 'merge-empty.csv');
  fs.writeFileSync(emptyPath, '');
  await page.goto(`${baseUrl}data/merge-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(emptyPath);
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /nothing to merge/i);
  await page.close();
});

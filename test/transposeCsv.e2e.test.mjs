import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the transpose-CSV tool: drive the built dist/
 * output in a real headless browser and verify the actual downloaded
 * content -- not just that the page renders. Mirrors
 * test/csvMerge.e2e.test.mjs's approach. Requires `npm run build` to have
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

  fs.writeFileSync(path.join(TMP, 'transpose-in.csv'), 'Name,Age,City\r\nAda,30,London\r\nGrace,34,NYC\r\n');
  fs.writeFileSync(path.join(TMP, 'transpose-ragged.csv'), 'a,b,c\r\n1,2\r\n');
  fs.writeFileSync(path.join(TMP, 'transpose-blank.csv'), 'a,b\r\n\r\n1,2\r\n');

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('transpose-csv: a 3-row 3-column CSV flips into 3 rows of the transposed values', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/transpose-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'transpose-in.csv'));
  await page.waitForSelector('.table-block');

  const rows = await page.locator('.extracted-table tbody tr').evaluateAll(
    (trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent))
  );
  assert.deepEqual(rows, [
    ['Name', 'Ada', 'Grace'],
    ['Age', '30', '34'],
    ['City', 'London', 'NYC'],
  ]);

  const badgeText = await page.locator('.page-badge').textContent();
  assert.match(badgeText, /3 rows × 3 columns/);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'transposed.csv');
  const outPath = path.join(TMP, 'transpose-out.csv');
  await download.saveAs(outPath);
  const bytes = fs.readFileSync(outPath);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'output should start with a UTF-8 BOM');
  assert.equal(
    bytes.subarray(3).toString('utf8'),
    'Name,Ada,Grace\r\nAge,30,34\r\nCity,London,NYC\r\n'
  );
  assert.deepEqual(errors, []);
  await page.close();
});

test('transpose-csv: a ragged row is padded before transposing', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/transpose-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'transpose-ragged.csv'));
  await page.waitForSelector('.table-block');

  const rows = await page.locator('.extracted-table tbody tr').evaluateAll(
    (trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent))
  );
  assert.deepEqual(rows, [['a', '1'], ['b', '2'], ['c', '']]);
  await page.close();
});

test('transpose-csv: unchecking "Skip blank rows" restores a literal 1:1 transpose', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/transpose-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'transpose-blank.csv'));
  await page.waitForSelector('.table-block');

  let rows = await page.locator('.extracted-table tbody tr').evaluateAll(
    (trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent))
  );
  assert.deepEqual(rows, [['a', '1'], ['b', '2']]);

  await page.locator('.table-block-head input[type="checkbox"]').uncheck();
  await page.waitForFunction(() => {
    const trs = document.querySelectorAll('.extracted-table tbody tr');
    return trs.length && trs[0].querySelectorAll('td').length === 3;
  });

  rows = await page.locator('.extracted-table tbody tr').evaluateAll(
    (trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent))
  );
  assert.deepEqual(rows, [['a', '', '1'], ['b', '', '2']]);
  await page.close();
});

test('transpose-csv: pasted CSV text takes the same path as a file', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/transpose-csv/`, { waitUntil: 'networkidle' });
  await page.locator('.paste-textarea').fill('x,y\n1,2\n3,4');
  await page.locator('.paste-convert-btn').click();
  await page.waitForSelector('.table-block');

  const rows = await page.locator('.extracted-table tbody tr').evaluateAll(
    (trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent))
  );
  assert.deepEqual(rows, [['x', '1', '3'], ['y', '2', '4']]);
  await page.close();
});

test('transpose-csv: an empty file shows an honest "nothing to transpose" message', async () => {
  const page = await browser.newPage();
  const emptyPath = path.join(TMP, 'transpose-empty.csv');
  fs.writeFileSync(emptyPath, '');
  await page.goto(`${baseUrl}data/transpose-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(emptyPath);
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /nothing to transpose/i);
  await page.close();
});

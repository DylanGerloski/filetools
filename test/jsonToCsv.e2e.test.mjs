import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the JSON-to-CSV tool: drive the built dist/ output
 * in a real headless browser, through both input paths (file upload and
 * pasted JSON), and verify the actual downloaded content -- not just that
 * the page renders. Mirrors test/sortLines.e2e.test.mjs's approach.
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
    path.join(TMP, 'records.json'),
    JSON.stringify([
      { name: 'Coffee', price: 4.5, address: { city: 'Reno' } },
      { name: 'Tea', price: 3.25, address: { city: 'Provo' } },
    ])
  );

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('json-to-csv: uploading a .json file converts it and downloads a CSV', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/json-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'records.json'));
  await page.waitForSelector('.table-block');

  const headerTexts = await page.locator('.extracted-table thead th').allTextContents();
  assert.deepEqual(headerTexts, ['name', 'price', 'address.city']);

  const rowTexts = await page.locator('.extracted-table tbody tr').first().locator('td').allTextContents();
  assert.deepEqual(rowTexts, ['Coffee', '4.5', 'Reno']);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'converted.csv');
  const outPath = path.join(TMP, 'converted-out.csv');
  await download.saveAs(outPath);
  const bytes = fs.readFileSync(outPath);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'output should start with a UTF-8 BOM');
  const text = bytes.subarray(3).toString('utf8');
  assert.equal(text, 'name,price,address.city\r\nCoffee,4.5,Reno\r\nTea,3.25,Provo\r\n');
  assert.deepEqual(errors, []);
  await page.close();
});

test('json-to-csv: pasting a JSON array and clicking convert produces the same result', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/json-to-csv/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '[{"name":"Coffee","price":4.5},{"name":"Tea","price":3.25}]');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  const headerTexts = await page.locator('.extracted-table thead th').allTextContents();
  assert.deepEqual(headerTexts, ['name', 'price']);
  assert.deepEqual(errors, []);
  await page.close();
});

test('json-to-csv: pasting invalid JSON shows a friendly error instead of a raw exception', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/json-to-csv/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '{not valid json');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /valid json/i);
  await page.close();
});

test('json-to-csv: pasting a JSON object (not array) is rejected with a specific message', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/json-to-csv/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '{"name":"Coffee"}');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /array/i);
  await page.close();
});

test('json-to-csv: a formula-injection payload in a JSON value is neutralized in the downloaded CSV', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/json-to-csv/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '[{"name":"=2+2","note":"+cmd"}]');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  const outPath = path.join(TMP, 'formula-out.csv');
  await download.saveAs(outPath);
  const text = fs.readFileSync(outPath).subarray(3).toString('utf8');
  assert.equal(text, "name,note\r\n'=2+2,'+cmd\r\n");
  await page.close();
});

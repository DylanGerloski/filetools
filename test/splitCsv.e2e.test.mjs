import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';
import { unzipSync } from 'fflate';

/**
 * End-to-end tests for the split-CSV tool: drive the built dist/ output in
 * a real headless browser, through both input paths (file upload and pasted
 * CSV), and verify the actual downloaded zip's entries -- not just that the
 * page renders. Mirrors test/sortLines.e2e.test.mjs's approach. Requires
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

const SEVEN_ROWS = 'Name,Amount\r\n'
  + ['Rent,1200', 'Coffee,4.50', '"Smith, John",10', 'Snacks,3.25', 'Bus,2.75', 'Books,18', 'Fruit,6.10']
    .join('\r\n') + '\r\n';

before(async () => {
  assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');
  fs.mkdirSync(TMP, { recursive: true });

  fs.writeFileSync(path.join(TMP, 'orders.csv'), SEVEN_ROWS);

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

/** Decodes one zip entry, asserting and stripping the UTF-8 BOM. */
function entryText(bytes) {
  assert.ok(bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
    'zip entry must start with a UTF-8 BOM');
  return new TextDecoder().decode(bytes.subarray(3));
}

async function downloadZip(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.download-btn-row button').click(),
  ]);
  const zipPath = await download.path();
  return { entries: unzipSync(new Uint8Array(fs.readFileSync(zipPath))), suggested: download.suggestedFilename() };
}

test('split-csv: uploading a CSV and setting rows-per-file downloads a zip of header-repeated chunks', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/split-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'orders.csv'));
  await page.waitForSelector('.table-block');

  // Default (1000 rows/file) fits everything in one file.
  assert.equal(await page.locator('.file-list .file-row').count(), 1);

  // 3 rows per file -> 7 data rows split 3/3/1.
  const rowsInput = page.locator('.table-block-head input[type="number"]');
  await rowsInput.fill('3');
  await rowsInput.dispatchEvent('change');
  await page.waitForFunction(() => document.querySelectorAll('.file-list .file-row').length === 3);

  const names = await page.locator('.file-list .file-name').allTextContents();
  assert.deepEqual(names, ['orders-part-01.csv', 'orders-part-02.csv', 'orders-part-03.csv']);

  const { entries, suggested } = await downloadZip(page);
  assert.equal(suggested, 'orders-split.zip');
  assert.deepEqual(Object.keys(entries).sort(), ['orders-part-01.csv', 'orders-part-02.csv', 'orders-part-03.csv']);

  const part1 = entryText(entries['orders-part-01.csv']);
  assert.equal(part1, 'Name,Amount\r\nRent,1200\r\nCoffee,4.50\r\n"Smith, John",10\r\n');
  const part3 = entryText(entries['orders-part-03.csv']);
  assert.equal(part3, 'Name,Amount\r\nFruit,6.10\r\n');

  assert.deepEqual(errors, []);
  await page.close();
});

test('split-csv: pasted CSV goes through the same path and the header toggle switches to positional splitting', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/split-csv/`, { waitUntil: 'networkidle' });
  await page.locator('.paste-textarea').fill('a,1\nb,2\nc,3\nd,4');
  await page.locator('.paste-convert-btn').click();
  await page.waitForSelector('.table-block');

  const rowsInput = page.locator('.table-block-head input[type="number"]');
  await rowsInput.fill('2');
  await rowsInput.dispatchEvent('change');
  // With the header option on (default), row 1 is treated as the header:
  // 3 data rows -> 2 files.
  await page.waitForFunction(() => document.querySelectorAll('.file-list .file-row').length === 2);

  // Turn the header option off: 4 positional rows -> still 2 files, but
  // now the first row is data, not a repeated header.
  await page.locator('.table-block-head input[type="checkbox"]').uncheck();
  await page.waitForFunction(() => document.querySelectorAll('.file-list .file-row').length === 2);

  const { entries, suggested } = await downloadZip(page);
  assert.equal(suggested, 'pasted-input-split.zip');
  const part1 = entryText(entries['pasted-input-part-01.csv']);
  assert.equal(part1, 'a,1\r\nb,2\r\n');
  const part2 = entryText(entries['pasted-input-part-02.csv']);
  assert.equal(part2, 'c,3\r\nd,4\r\n');

  assert.deepEqual(errors, []);
  await page.close();
});

test('split-csv: a split that would exceed the output-file ceiling shows the refusal message instead of freezing', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/split-csv/`, { waitUntil: 'networkidle' });

  // 2001+ data rows at 1 row per file exceeds the 2000-file ceiling.
  const bigCsv = 'h\n' + Array.from({ length: 2500 }, (_, i) => `v${i}`).join('\n');
  await page.locator('.paste-textarea').fill(bigCsv);
  await page.locator('.paste-convert-btn').click();
  await page.waitForSelector('.table-block');

  const rowsInput = page.locator('.table-block-head input[type="number"]');
  await rowsInput.fill('1');
  await rowsInput.dispatchEvent('change');
  await page.waitForSelector('.alert.alert-warn');

  const alertText = await page.locator('.alert.alert-warn').textContent();
  assert.match(alertText, /caps a split at 2000/);
  assert.ok(await page.locator('.download-btn-row button').isDisabled(), 'download must be disabled');
  await page.close();
});

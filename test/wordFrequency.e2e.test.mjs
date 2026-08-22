import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the word-frequency-counter tool: drive the built
 * dist/ output in a real headless browser, through both input paths (file
 * upload and pasted text), and verify the actual downloaded CSV content --
 * not just that the page renders. Mirrors test/sortLines.e2e.test.mjs's
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

  fs.writeFileSync(path.join(TMP, 'word-freq.txt'), 'the cat sat on the mat. the cat ran.');

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('word-frequency-counter: uploading a text file produces a ranked table and downloads the CSV', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/word-frequency-counter/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'word-freq.txt'));
  await page.waitForSelector('.table-block');

  // Scoped to .table-block (the live result), not just .extracted-table:
  // this page's own output-example panel further down also renders an
  // .extracted-table (a real, generated sample -- see
  // src/examples/word-frequency-counter.mjs), so an unscoped selector
  // here would double-match rows from both tables.
  const wordCells = await page.locator('.table-block .extracted-table tbody tr td:nth-child(2)').allTextContents();
  assert.equal(wordCells[0], 'the', '"the" appears 3 times, so it should rank first');

  const countCells = await page.locator('.table-block .extracted-table tbody tr td:nth-child(3)').allTextContents();
  assert.equal(countCells[0], '3');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'word-frequency.csv');
  const outPath = path.join(TMP, 'word-freq-out.csv');
  await download.saveAs(outPath);
  const bytes = fs.readFileSync(outPath);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'output should start with a UTF-8 BOM');
  const csvText = bytes.subarray(3).toString('utf8');
  assert.match(csvText, /^word,count,percent\n/);
  assert.match(csvText, /^the,3,/m);
  assert.deepEqual(errors, []);
  await page.close();
});

test('word-frequency-counter: turning on "exclude common words" live-recomputes the table without re-uploading', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/word-frequency-counter/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'word-freq.txt'));
  await page.waitForSelector('.table-block');

  // "Exclude common words" is the second checkbox in the options row
  // (Ignore case, Exclude common words, Exclude numbers).
  const stopWordsCheckbox = page.locator('.table-block-head label:has-text("Exclude common words") input[type="checkbox"]');
  await stopWordsCheckbox.check();

  await page.waitForFunction(() => {
    const cells = document.querySelectorAll('.table-block .extracted-table tbody tr td:nth-child(2)');
    return cells.length > 0 && ![...cells].some((c) => c.textContent === 'the' || c.textContent === 'on');
  });
  const wordCells = await page.locator('.table-block .extracted-table tbody tr td:nth-child(2)').allTextContents();
  assert.deepEqual(wordCells.sort(), ['cat', 'mat', 'ran', 'sat']);
  await page.close();
});

test('word-frequency-counter: pasting text and clicking "Count words" produces the same shape of result as a file upload', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/word-frequency-counter/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'apple apple banana');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  const wordCells = await page.locator('.table-block .extracted-table tbody tr td:nth-child(2)').allTextContents();
  assert.deepEqual(wordCells, ['apple', 'banana']);
  assert.deepEqual(errors, []);
  await page.close();
});

test('word-frequency-counter: clicking "Count words" with an empty textarea shows an error instead of silently doing nothing', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/word-frequency-counter/`, { waitUntil: 'networkidle' });
  await page.locator('#paste-convert').click();
  await page.waitForFunction(() => {
    const el = document.querySelector('.dz-status');
    return el && el.textContent && el.textContent.trim().length > 0;
  });
  // dropzone.client.js's own generic paste-button guard fires here (an
  // empty textarea never reaches this tool's own run(), see
  // src/browser/dropzone.client.js's pasteButton handler) -- shared,
  // tool-agnostic copy, not this tool's own "that's empty" message.
  const statusText = await page.locator('.dz-status').textContent();
  assert.match(statusText, /paste some markup first/i);
  await page.close();
});

test('word-frequency-counter: an empty file shows an honest "empty" message, never crashes', async () => {
  const page = await browser.newPage();
  const emptyPath = path.join(TMP, 'word-freq-empty.txt');
  fs.writeFileSync(emptyPath, '');
  await page.goto(`${baseUrl}data/word-frequency-counter/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(emptyPath);
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /empty/i);
  await page.close();
});

test('word-frequency-counter: setting minimum word length above every word\'s length shows the "nothing matched" state, not an error', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/word-frequency-counter/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'a bb ccc');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  const lenInput = page.locator('.table-block-head input[type="number"]');
  await lenInput.fill('20');
  await lenInput.dispatchEvent('change');

  await page.waitForSelector('.table-block .alert-warn');
  const msg = await page.locator('.table-block .alert-warn').textContent();
  assert.match(msg, /nothing matched/i);
  const downloadBtn = page.locator('.table-block button:has-text("Download")');
  assert.equal(await downloadBtn.isDisabled(), true);
  await page.close();
});

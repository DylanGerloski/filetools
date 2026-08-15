import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * End-to-end tests for the flatten-nested-JSON tool: drive the built dist/
 * output in a real headless browser, through both input paths (file upload
 * and pasted JSON), and verify the actual downloaded content -- not just
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
    path.join(TMP, 'nested.json'),
    JSON.stringify({ user: { name: 'Ada', roles: ['admin', 'editor'] } })
  );
  fs.writeFileSync(
    path.join(TMP, 'flatten-records.json'),
    JSON.stringify([
      { id: 1, name: 'Coffee', tags: { hot: true } },
      { id: 2, name: 'Tea' },
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

test('flatten-json: uploading a nested-object .json file shows a flattened key/value list and downloads JSON', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}data/flatten-json/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'nested.json'));
  await page.waitForSelector('.table-block');

  const rowTexts = await page.locator('.extracted-table tbody tr').allTextContents();
  assert.ok(rowTexts.some((t) => t.includes('user.name') && t.includes('Ada')), `expected a user.name/Ada row, got: ${JSON.stringify(rowTexts)}`);
  assert.ok(rowTexts.some((t) => t.includes('user.roles.0') && t.includes('admin')), `expected a user.roles.0/admin row, got: ${JSON.stringify(rowTexts)}`);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download flattened.json")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'flattened.json');
  const outPath = path.join(TMP, 'nested-out.json');
  await download.saveAs(outPath);
  const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.deepEqual(parsed, { 'user.name': 'Ada', 'user.roles.0': 'admin', 'user.roles.1': 'editor' });
  assert.deepEqual(errors, []);
  await page.close();
});

test('flatten-json: an array of records renders as a table and downloads a matching CSV', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/flatten-json/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'flatten-records.json'));
  await page.waitForSelector('.table-block');

  const badgeText = await page.locator('.page-badge').textContent();
  assert.match(badgeText, /2 records/);

  const headerTexts = await page.locator('.extracted-table thead th').allTextContents();
  assert.deepEqual(headerTexts, ['id', 'name', 'tags.hot']);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download flattened.csv")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'flattened.csv');
  const outPath = path.join(TMP, 'records-out.csv');
  await download.saveAs(outPath);
  const bytes = fs.readFileSync(outPath);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'output should start with a UTF-8 BOM');
  const csvText = bytes.subarray(3).toString('utf8');
  assert.equal(csvText, 'id,name,tags.hot\r\n1,Coffee,true\r\n2,Tea,\r\n');
  await page.close();
});

test('flatten-json: pasting JSON and clicking convert produces the same result as a file upload', async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}data/flatten-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '{"a":{"b":1}}');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  const rowTexts = await page.locator('.extracted-table tbody tr').allTextContents();
  assert.ok(rowTexts.some((t) => t.includes('a.b') && t.includes('1')));
  assert.deepEqual(errors, []);
  await page.close();
});

test('flatten-json: changing the delimiter live re-renders the flattened keys without re-uploading', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/flatten-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '{"a":{"b":1}}');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  await page.locator('.table-block-head select').first().selectOption('_');
  await page.waitForFunction(() => {
    const cells = Array.from(document.querySelectorAll('.extracted-table tbody tr td'));
    return cells.some((c) => c.textContent === 'a_b');
  });
  const rowTexts = await page.locator('.extracted-table tbody tr').allTextContents();
  assert.ok(rowTexts.some((t) => t.includes('a_b') && t.includes('1')));
  await page.close();
});

test('flatten-json: turning off "give array items their own numbered key" keeps the array as one JSON value', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/flatten-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '{"tags":["x","y"]}');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  let rowTexts = await page.locator('.extracted-table tbody tr').allTextContents();
  assert.ok(rowTexts.some((t) => t.includes('tags.0') && t.includes('x')), 'array items get numbered keys by default');

  await page.locator('label:has-text("give array items their own numbered key") input[type="checkbox"]').uncheck();
  await page.waitForFunction(() => {
    const cells = Array.from(document.querySelectorAll('.extracted-table tbody tr td'));
    return cells.some((c) => c.textContent === 'tags');
  });
  rowTexts = await page.locator('.extracted-table tbody tr').allTextContents();
  assert.ok(rowTexts.some((t) => t.includes('tags') && t.includes('["x","y"]')));
  await page.close();
});

test('flatten-json: invalid JSON shows a friendly error instead of a raw parse exception', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/flatten-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '{not valid json');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /doesn.t look like valid JSON/i);
  await page.close();
});

test('flatten-json: a bare top-level JSON primitive is refused with a friendly message', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/flatten-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '"just a string"');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /nothing to flatten/i);
  await page.close();
});

test('flatten-json: an empty array shows an honest "nothing to flatten" message', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/flatten-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '[]');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /empty/i);
  await page.close();
});

test('the word "upload" never appears inside the dropzone control itself (design-standard language rule)', async () => {
  const html = fs.readFileSync(path.join(DIST, 'data', 'flatten-json', 'index.html'), 'utf8');
  const match = html.match(/<div class="dropzone"[\s\S]*?<\/div>/);
  assert.ok(match, 'flatten-json/index.html should contain a .dropzone block');
  assert.doesNotMatch(match[0].toLowerCase(), /upload/, 'flatten-json/index.html\'s dropzone control should not use the word "upload"');
});

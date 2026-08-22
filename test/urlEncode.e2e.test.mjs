import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * End-to-end tests for the URL encode/decode tool: drive the built dist/
 * output in a real headless browser, through both input paths (file upload
 * and pasted text), and verify the actual rendered/downloaded/copied
 * content -- not just that the page renders. Mirrors
 * test/yamlToJson.e2e.test.mjs's approach. Requires `npm run build` to have
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

let server;
let browser;
let baseUrl;

before(async () => {
  assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');
  fs.mkdirSync(TMP, { recursive: true });
  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

// Every '.json-preview' locator below is scoped to '.table-block' (the live
// result wrapper renderResult() appends -- see
// ../src/browser/urlEncode.client.js) rather than bare '.json-preview',
// because this tool's page also renders a second, static '.json-preview'
// inside its build-time output-example panel (see
// ../src/examples/url-encode-decode.mjs) -- same scoping fix
// test/yamlToJson.e2e.test.mjs already applies.

test('url-encode-decode: pasting text shows both the encoded and decoded panels, updated live', async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}data/url-encode-decode/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'a b/c?d=e&f');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  const panels = page.locator('.dual-result-row .table-block .json-preview');
  assert.equal(await panels.count(), 2);
  assert.equal(await panels.nth(0).textContent(), 'a%20b%2Fc%3Fd%3De%26f');
  assert.equal(await panels.nth(1).textContent(), 'a b/c?d=e&f');
  assert.deepEqual(errors, []);
  await page.close();
});

test('url-encode-decode: pasting an already-encoded string decodes it back correctly', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/url-encode-decode/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'caf%C3%A9');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  const panels = page.locator('.dual-result-row .table-block .json-preview');
  assert.equal(await panels.nth(1).textContent(), 'café');
  await page.close();
});

test('url-encode-decode: malformed percent-encoding shows a friendly error in the decoded panel, while the encoded panel still renders', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/url-encode-decode/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '100% sure');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');
  await page.waitForSelector('.dual-result-row .alert-warn');

  const encodedText = await page.locator('.dual-result-row .table-block .json-preview').first().textContent();
  assert.equal(encodedText, encodeURIComponent('100% sure'));
  const errText = await page.locator('.dual-result-row .alert-warn').textContent();
  assert.match(errText, /valid percent-encoding/i);
  await page.close();
});

test('url-encode-decode: the "spaces as +" checkbox re-renders the encoded panel live without re-clicking convert', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/url-encode-decode/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'a b c');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  const encodedPanel = page.locator('.dual-result-row .table-block .json-preview').first();
  assert.equal(await encodedPanel.textContent(), 'a%20b%20c');

  await page.locator('.result .table-block-head input[type="checkbox"]').click();
  await page.waitForFunction(() => {
    const el = document.querySelector('.dual-result-row .table-block .json-preview');
    return el && el.textContent === 'a+b+c';
  });
  assert.equal(await encodedPanel.textContent(), 'a+b+c');
  await page.close();
});

test('url-encode-decode: the copy button copies the encoded text to the clipboard', async () => {
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin });
  const page = await context.newPage();
  await page.goto(`${baseUrl}data/url-encode-decode/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'hello world');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  await page.locator('button:has-text("Copy percent-encoded")').click();
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Copied');
    return !!btn;
  });
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clipboardText, 'hello%20world');
  await context.close();
});

test('url-encode-decode: the download button downloads a .txt file with the exact decoded content', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/url-encode-decode/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', 'a%20b');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download decoded.txt")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'decoded.txt');
  const outPath = path.join(TMP, 'decoded-out.txt');
  await download.saveAs(outPath);
  assert.equal(fs.readFileSync(outPath, 'utf8'), 'a b');
  await page.close();
});

test('url-encode-decode: uploading a .txt file encodes/decodes its contents', async () => {
  const page = await browser.newPage();
  const filePath = path.join(TMP, 'sample.txt');
  fs.writeFileSync(filePath, 'x=1&y=2');

  await page.goto(`${baseUrl}data/url-encode-decode/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(filePath);
  await page.waitForSelector('.dual-result-row .table-block .json-preview');

  const panels = page.locator('.dual-result-row .table-block .json-preview');
  assert.equal(await panels.nth(0).textContent(), 'x%3D1%26y%3D2');
  await page.close();
});

test('url-encode-decode: pasting whitespace-only text shows a friendly status, not a blank result', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/url-encode-decode/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '   ');
  await page.locator('#paste-convert').click();
  await page.waitForFunction(() => document.querySelector('.dz-status')?.textContent.trim().length > 0);
  const msg = await page.locator('.dz-status').textContent();
  assert.match(msg, /paste some/i);
  await page.close();
});

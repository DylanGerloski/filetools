import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * End-to-end tests for the XML-to-JSON tool: drive the built dist/ output
 * in a real headless browser, through both input paths (file upload and
 * pasted XML), and verify the actual downloaded content -- not just that
 * the page renders. Mirrors test/yamlToJson.e2e.test.mjs's approach.
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
  '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8',
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
    path.join(TMP, 'doc.xml'),
    '<order id="1"><item>Coffee</item><price>4.50</price></order>'
  );

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

// Every '.json-preview' locator below is scoped to '.table-block' (the
// live result wrapper renderResult() appends -- see
// ../src/browser/xmlToJson.client.js) rather than bare '.json-preview',
// because this tool's page also renders a second, static '.json-preview'
// inside its build-time output-example panel (see
// ../src/examples/xml-to-json.mjs) -- same scoping fix
// test/yamlToJson.e2e.test.mjs already applies for its own tool.
test('xml-to-json: uploading an .xml file converts it and downloads matching JSON', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}data/xml-to-json/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'doc.xml'));
  await page.waitForSelector('.table-block .json-preview');

  const previewText = await page.locator('.table-block .json-preview').textContent();
  assert.deepEqual(JSON.parse(previewText), { order: { '@id': '1', item: 'Coffee', price: '4.50' } });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'converted.json');
  const outPath = path.join(TMP, 'converted-out.json');
  await download.saveAs(outPath);
  const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.deepEqual(parsed, { order: { '@id': '1', item: 'Coffee', price: '4.50' } });
  assert.deepEqual(errors, []);
  await page.close();
});

test('xml-to-json: pasting XML and clicking convert produces the same result', async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}data/xml-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '<items><item>A</item><item>B</item></items>');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block .json-preview');

  const previewText = await page.locator('.table-block .json-preview').textContent();
  assert.deepEqual(JSON.parse(previewText), { items: { item: ['A', 'B'] } });
  assert.deepEqual(errors, []);
  await page.close();
});

test('xml-to-json: pasting invalid (not well-formed) XML shows a friendly, specific error instead of a raw exception', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/xml-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '<a><b></a>');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /valid xml/i);
  await page.close();
});

test('xml-to-json: pasting XML with a <!DOCTYPE> is refused with a clear reason, not silently parsed', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/xml-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '<!DOCTYPE foo><foo>bar</foo>');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /doctype/i);
  await page.close();
});

test('xml-to-json: pasting whitespace-only text shows a friendly status, not a blank result', async () => {
  // Blocked by dropzone.client.js's own shared empty-paste guard (every
  // pasteInput-enabled tool gets this before its processor's run() is ever
  // called) -- see that file's paste-convert-btn click handler.
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/xml-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '   ');
  await page.locator('#paste-convert').click();
  await page.waitForFunction(() => document.querySelector('.dz-status')?.textContent.trim().length > 0);
  const msg = await page.locator('.dz-status').textContent();
  assert.match(msg, /paste some/i);
  await page.close();
});

test('xml-to-json: uploading a genuinely empty file shows this tool’s own friendly error', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/xml-to-json/`, { waitUntil: 'networkidle' });
  const emptyPath = path.join(TMP, 'empty.xml');
  fs.writeFileSync(emptyPath, '');
  await page.locator('#file-input').setInputFiles(emptyPath);
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /empty/i);
  await page.close();
});

test('xml-to-json: an element with only text (no attributes, no children) becomes a plain JSON string', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/xml-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '<note>hello</note>');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block .json-preview');

  const previewText = await page.locator('.table-block .json-preview').textContent();
  assert.deepEqual(JSON.parse(previewText), { note: 'hello' });
  await page.close();
});

test('xml-to-json: an attribute value like a leading-zero ZIP code stays a string, not auto-converted to a number', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/xml-to-json/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '<address zip="00501"><city>Holtsville</city></address>');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block .json-preview');

  const previewText = await page.locator('.table-block .json-preview').textContent();
  const parsed = JSON.parse(previewText);
  assert.equal(parsed.address['@zip'], '00501');
  await page.close();
});

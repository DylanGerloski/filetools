import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the Base64 encode/decode tool: drive the built
 * dist/ output in a real headless browser and verify the actual rendered
 * result and downloaded content -- not just that the page renders. Mirrors
 * test/transposeCsv.e2e.test.mjs's approach. Requires `npm run build` to
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
  '.svg': 'image/svg+xml', '.png': 'image/png',
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

  fs.writeFileSync(path.join(TMP, 'base64-plain.txt'), 'hello from a file');
  // A real 1x1 transparent PNG -- genuine binary data, not text, so
  // encoding it and then decoding the result must round-trip byte for
  // byte and must NOT be shown as garbled text.
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  fs.writeFileSync(path.join(TMP, 'base64-pixel.png'), onePixelPng);

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('base64-encode-decode: pasting text defaults to Encode and shows the real Base64', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/base64-encode-decode/`, { waitUntil: 'networkidle' });
  await page.locator('.paste-textarea:not(.base64-output)').fill('hello world');
  await page.locator('.paste-convert-btn').click();
  await page.waitForSelector('.table-block');

  const output = await page.locator('.base64-output').inputValue();
  assert.equal(output, 'aGVsbG8gd29ybGQ=');
  assert.deepEqual(errors, []);
  await page.close();
});

test('base64-encode-decode: switching to Decode on the same input reverses the conversion', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/base64-encode-decode/`, { waitUntil: 'networkidle' });
  await page.locator('.paste-textarea:not(.base64-output)').fill('aGVsbG8gd29ybGQ=');
  await page.locator('.paste-convert-btn').click();
  await page.waitForSelector('.table-block');

  // Default mode is Encode, so pasting Base64 text and encoding it again
  // first produces a (longer) re-encoded string.
  let output = await page.locator('.base64-output').inputValue();
  assert.notEqual(output, 'hello world');

  await page.locator('input[name="base64-mode"][value="decode"]').check();
  await page.waitForFunction(() => {
    const el = document.querySelector('.base64-output');
    return el && el.value === 'hello world';
  });
  output = await page.locator('.base64-output').inputValue();
  assert.equal(output, 'hello world');
  await page.close();
});

test('base64-encode-decode: decoding invalid Base64 shows a specific, friendly error', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/base64-encode-decode/`, { waitUntil: 'networkidle' });
  await page.locator('.paste-textarea:not(.base64-output)').fill('not-valid-base64!!!');
  await page.locator('.paste-convert-btn').click();
  await page.waitForSelector('.table-block');
  await page.locator('input[name="base64-mode"][value="decode"]').check();

  await page.waitForSelector('.alert-danger');
  const msg = await page.locator('.alert-danger').textContent();
  assert.match(msg, /isn.t valid Base64/);
  assert.match(msg, /alphabet/);
  await page.close();
});

test('base64-encode-decode: dropping a text file encodes its real content and the download matches', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/base64-encode-decode/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'base64-plain.txt'));
  await page.waitForSelector('.table-block');

  const output = await page.locator('.base64-output').inputValue();
  assert.equal(Buffer.from(output, 'base64').toString('utf8'), 'hello from a file');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download encoded.txt")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'encoded.txt');
  const outPath = path.join(TMP, 'base64-encoded-out.txt');
  await download.saveAs(outPath);
  assert.equal(fs.readFileSync(outPath, 'utf8'), output);
  assert.deepEqual(errors, []);
  await page.close();
});

test('base64-encode-decode: decoding Base64 that is really a PNG offers a binary download that round-trips byte for byte', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/base64-encode-decode/`, { waitUntil: 'networkidle' });

  // Encode the real PNG first (drop the file, mode defaults to Encode),
  // copy that Base64 out, then feed it back in as pasted text and switch
  // to Decode -- exercises the full real round trip through the UI rather
  // than hand-computing the expected Base64 in the test.
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'base64-pixel.png'));
  await page.waitForSelector('.table-block');
  const encoded = await page.locator('.base64-output').inputValue();

  await page.locator('.paste-textarea:not(.base64-output)').fill(encoded);
  await page.locator('.paste-convert-btn').click();
  await page.waitForSelector('.table-block');
  await page.locator('input[name="base64-mode"][value="decode"]').check();

  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /binary data/);
  assert.match(msg, /\.png/);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download decoded.png")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'decoded.png');
  const outPath = path.join(TMP, 'base64-decoded-out.png');
  await download.saveAs(outPath);
  const original = fs.readFileSync(path.join(TMP, 'base64-pixel.png'));
  const roundTripped = fs.readFileSync(outPath);
  assert.deepEqual([...roundTripped], [...original]);
  await page.close();
});

test('base64-encode-decode: the URL-safe toggle swaps + and / for - and _', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/base64-encode-decode/`, { waitUntil: 'networkidle' });
  // Bytes chosen so standard Base64 is guaranteed to need + or /.
  await page.locator('#file-input').setInputFiles({
    name: 'needs-plus-slash.bin',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from([0xfb, 0xff, 0xbf]),
  });
  await page.waitForSelector('.table-block');

  const standard = await page.locator('.base64-output').inputValue();
  assert.match(standard, /[+/]/);

  await page.locator('.table-block-head input[type="checkbox"]').check();
  await page.waitForFunction(() => {
    const el = document.querySelector('.base64-output');
    return el && !/[+/]/.test(el.value);
  });
  const urlSafe = await page.locator('.base64-output').inputValue();
  assert.doesNotMatch(urlSafe, /[+/]/);
  assert.equal(urlSafe, standard.replace(/\+/g, '-').replace(/\//g, '_'));
  await page.close();
});

test('base64-encode-decode: the copy-to-clipboard button copies the exact result text', async () => {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  await page.goto(`${baseUrl}data/base64-encode-decode/`, { waitUntil: 'networkidle' });
  await page.locator('.paste-textarea:not(.base64-output)').fill('copy me');
  await page.locator('.paste-convert-btn').click();
  await page.waitForSelector('.table-block');

  const expected = await page.locator('.base64-output').inputValue();
  await page.locator('button:has-text("Copy to clipboard")').click();
  await page.waitForSelector('button:has-text("Copied!")');
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(clipboardText, expected);
  await page.close();
  await context.close();
});

test('base64-encode-decode: dropping a genuinely empty file shows an honest "nothing to encode" message', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/base64-encode-decode/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles({
    name: 'empty.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(''),
  });
  await page.waitForSelector('.alert-warn');
  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /nothing to encode/);
  await page.close();
});

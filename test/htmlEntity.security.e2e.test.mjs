import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * Security-focused end-to-end coverage for the html-entity-encode-decode
 * tool, per docs/SECURITY_STANDARDS.md's untrusted-input rules and this
 * tool's own task spec ("rendering decoded HTML entities for preview needs
 * XSS-safe handling"). Mirrors test/htmlTableToCsv.security.e2e.test.mjs's
 * empirical, real-browser approach rather than only asserting against the
 * pure module.
 *
 * Decoding is visitor-controlled text that can legitimately turn into
 * something that LOOKS like markup once decoded (decoding
 * "&lt;script&gt;alert(1)&lt;/script&gt;" produces the literal text
 * "<script>alert(1)</script>"). This suite proves that text is never
 * executed, never parsed as HTML, and never causes any outbound request --
 * i.e. that src/browser/htmlEntity.client.js really does write it via
 * `.textContent` only, as its header comment claims, not `innerHTML`.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

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

/** The "attacker" server: logs every request it receives -- same helper
 * shape as test/htmlTableToCsv.security.e2e.test.mjs. */
function startAttackerServer() {
  const requests = [];
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      requests.push(req.url);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('logged');
    });
    server.listen(0, 'localhost', () => resolve({ server, requests, port: server.address().port }));
  });
}

let server;
let attacker;
let browser;
let baseUrl;

before(async () => {
  assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');
  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  attacker = await startAttackerServer();
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => attacker.server.close(resolve));
});

test('html-entity-encode-decode: decoding an entity-encoded <script> tag never executes it', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);
  let alertFired = false;
  page.on('dialog', async (dialog) => { alertFired = true; await dialog.dismiss(); });

  await page.goto(`${baseUrl}data/html-entity-encode-decode/`, { waitUntil: 'networkidle' });
  // The Direction control only exists inside the rendered result, which
  // only exists after a first convert -- so convert once (direction
  // defaults to "encode", the exact text of this throwaway first pass
  // doesn't matter), then switch to Decode, which re-renders from the SAME
  // original pasted text (see htmlEntity.client.js's renderResult -- it
  // closes over the unchanged rawText, not the previous rendered output).
  await page.fill('#paste-textarea', '&lt;script&gt;alert(1)&lt;/script&gt;');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');
  await page.locator('label:has-text("Direction") select').selectOption('decode');
  await page.waitForFunction(() => {
    const el = document.querySelector('.entity-output');
    return el && el.textContent.includes('<script>');
  });

  // Give any script execution or dialog a real chance to fire.
  await page.waitForTimeout(500);

  assert.equal(alertFired, false, 'the decoded <script> text must never actually execute');
  assert.equal(await page.locator('script:has-text("alert(1)")').count(), 0, 'no live <script> element should exist in the DOM');
  assert.deepEqual(errors, []);
  await page.close();
});

test('html-entity-encode-decode: the decoded result is written via textContent, never innerHTML -- verified by the DOM\'s own escaped serialization', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/html-entity-encode-decode/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', '&lt;img src=x onerror=alert(1)&gt;');
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');
  await page.locator('label:has-text("Direction") select').selectOption('decode');
  await page.waitForFunction(() => {
    const el = document.querySelector('.entity-output');
    return el && el.textContent.includes('onerror');
  });

  // If the decoded text had been assigned via innerHTML, the browser would
  // have parsed it into a real <img> element with an onerror handler (and
  // that handler would have fired, since a bad src reliably errors). If it
  // was assigned via textContent instead, the DOM's own serialization of
  // that text node re-escapes the angle brackets when read back out via
  // .innerHTML -- this asserts the safe (textContent) shape.
  const rendered = await page.locator('.entity-output').evaluate((el) => el.innerHTML);
  assert.match(rendered, /&lt;img src=x onerror=alert\(1\)&gt;/, 'the < and > must still be escaped in the live DOM -- proves textContent was used, not innerHTML');
  assert.equal(await page.locator('.entity-output img').count(), 0, 'no real <img> element should have been created from the decoded text');
  await page.close();
});

test('html-entity-encode-decode: decoding text that would reference an external resource never causes any outbound request', async () => {
  const page = await browser.newPage();
  const outboundToAttacker = [];
  page.on('request', (req) => {
    if (req.url().includes(`:${attacker.port}`)) outboundToAttacker.push(req.url());
  });

  const attackerBase = `http://localhost:${attacker.port}`;
  await page.goto(`${baseUrl}data/html-entity-encode-decode/`, { waitUntil: 'networkidle' });
  await page.fill('#paste-textarea', `&lt;img src=&quot;${attackerBase}/tracker.gif&quot;&gt;`);
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');
  await page.locator('label:has-text("Direction") select').selectOption('decode');
  await page.waitForFunction(() => {
    const el = document.querySelector('.entity-output');
    return el && el.textContent.includes('tracker.gif');
  });

  await page.waitForTimeout(1000);

  assert.deepEqual(outboundToAttacker, []);
  assert.deepEqual(attacker.requests, [], 'the attacker server should never receive any request at all');
  await page.close();
});

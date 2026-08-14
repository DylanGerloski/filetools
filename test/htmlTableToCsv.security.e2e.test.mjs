import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * Empirical resource-loading test for the html-table-to-csv tool's
 * DOMParser-based HTML parsing. docs/SECURITY_REFERENCE.md's "Open risks"
 * #1 flags this as the least-certain finding in the security research pass
 * -- MDN documents that a DOMParser-parsed document "can download resources
 * specified in <iframe> and <img> elements", but that wasn't empirically
 * confirmed in a real browser before this test existed, and engine
 * behavior has differed historically.
 *
 * This test runs a second, independent HTTP server (the "attacker" server,
 * on its own port) that just logs every request it receives, then pastes
 * markup containing an <img>, an <iframe>, and every other resource-bearing
 * element this file's fix strips, each pointing at that attacker server.
 * If parsing the pasted markup causes even one of those elements to fetch
 * its resource, the attacker server's request log will be non-empty.
 *
 * This test is written to pass against the FIXED code (resource-bearing
 * elements stripped from the parsed document before any other work) --
 * see htmlTableToCsv.client.js's stripDangerousElements(). Run it against
 * the pre-fix code (git stash the fix, rebuild, re-run) to see the
 * empirical answer to the open question above; the result of that one-time
 * check is recorded in this file's own git history / commit message, not
 * re-run automatically on every CI pass, since the fix is applied
 * regardless of the answer either way (see the file's own comment).
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
 * harmless 1x1 response for anything requested, so a browser that DOES
 * fetch the resource doesn't also throw a console error that would muddy
 * the pageerror/console assertions other tests in this suite rely on. */
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

test('html-table-to-csv: parsing hostile markup never causes the browser to fetch any resource it references', async () => {
  const page = await browser.newPage();
  const outboundToAttacker = [];
  // Belt-and-suspenders: watch every outgoing request at the Playwright
  // network layer too, not just what the attacker server itself logs --
  // catches a request that fires but never completes (DNS/connection
  // refused would still be visible here even if the attacker server never
  // logs it).
  page.on('request', (req) => {
    if (req.url().includes(`:${attacker.port}`)) outboundToAttacker.push(req.url());
  });

  await page.goto(`${baseUrl}data/html-table-to-csv/`, { waitUntil: 'networkidle' });

  const attackerBase = `http://localhost:${attacker.port}`;
  const hostileMarkup = '<table><tr><th>Name</th></tr><tr><td>Test</td></tr></table>'
    + `<img src="${attackerBase}/tracker.gif">`
    + `<iframe src="${attackerBase}/frame.html"></iframe>`
    + `<embed src="${attackerBase}/thing.swf">`
    + `<object data="${attackerBase}/thing.pdf"></object>`
    + `<video src="${attackerBase}/v.mp4"></video>`
    + `<audio src="${attackerBase}/a.mp3"></audio>`
    + `<source src="${attackerBase}/s.mp4">`
    + `<track src="${attackerBase}/t.vtt">`
    + `<link rel="stylesheet" href="${attackerBase}/styles.css">`
    + `<svg><image href="${attackerBase}/s.svg"></image></svg>`;

  await page.fill('#paste-textarea', hostileMarkup);
  await page.locator('#paste-convert').click();
  await page.waitForSelector('.table-block');

  // Give any resource fetch that would have fired a real chance to land --
  // networkidle above only covers the initial page load, not requests
  // triggered by this click.
  await page.waitForTimeout(1500);

  assert.deepEqual(outboundToAttacker, [], 'no request should reach the attacker server\'s port from Playwright\'s own network observation');
  assert.deepEqual(attacker.requests, [], 'the attacker server should never receive any request at all');

  await page.close();
});

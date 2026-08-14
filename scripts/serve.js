'use strict';

/**
 * Local static server for dist/, for manual/local testing (see
 * TESTING.md). Not used by the build itself and not part of any deploy --
 * GitHub Pages serves dist/ directly. Binds to localhost only.
 *
 * Every internal link in the built site is root-relative under
 * BASE_PATH (src/site.js, currently '/filetools/', matching where this
 * site lives as a GitHub Pages project page). This server accepts a
 * request at that prefix (so links resolve exactly as they will once
 * deployed) and, for convenience, also serves the same files at the bare
 * root so `http://localhost:PORT/` works without typing the prefix.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { BASE_PATH } = require('../src/site.js');

const PORT = Number(process.argv[2]) || 8080;
const DIST = path.join(__dirname, '..', 'dist');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

if (!fs.existsSync(DIST)) {
  console.error('dist/ does not exist. Run `npm run build` first.');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (reqPath.startsWith(BASE_PATH)) reqPath = `/${reqPath.slice(BASE_PATH.length)}`;
  if (reqPath.endsWith('/') || reqPath === '') reqPath += 'index.html';

  const resolved = path.normalize(path.join(DIST, reqPath));
  if (!resolved.startsWith(path.normalize(DIST))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      fs.readFile(path.join(DIST, '404.html'), (err2, notFoundData) => {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(err2 ? 'Not found' : notFoundData);
      });
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, 'localhost', () => {
  console.log(`Serving dist/ at:`);
  console.log(`  http://localhost:${PORT}${BASE_PATH}`);
  console.log(`  http://localhost:${PORT}/  (same content, no prefix needed)`);
});

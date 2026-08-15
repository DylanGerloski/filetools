'use strict';

/**
 * Copies the exact browser-ready files this site depends on out of
 * node_modules into vendor/, alongside each library's own LICENSE file.
 * Nothing here is fetched at request time -- this only runs at build time,
 * on this machine, so every tool page can load pdf-lib/pdf.js from the
 * site's own origin instead of a CDN. That is a real build constraint (see
 * src/browser/pdfPages.client.js's header), not a style choice: a
 * CDN-loaded script would break the "turn off your Wi-Fi" claim this site
 * makes on every tool page.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VENDOR = path.join(ROOT, 'vendor');

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyVendor() {
  const nm = path.join(ROOT, 'node_modules');

  // pdf-lib -- MIT (verified: node_modules/pdf-lib/LICENSE.md). ESM build
  // (not the UMD pdf-lib.min.js) so the browser client can `import()` it
  // directly by URL, same mechanism used for pdfjs-dist below.
  copy(
    path.join(nm, 'pdf-lib', 'dist', 'pdf-lib.esm.min.js'),
    path.join(VENDOR, 'pdf-lib', 'pdf-lib.esm.min.js')
  );
  copy(
    path.join(nm, 'pdf-lib', 'LICENSE.md'),
    path.join(VENDOR, 'pdf-lib', 'LICENSE.md')
  );

  // pdfjs-dist -- Apache-2.0 (verified: node_modules/pdfjs-dist/LICENSE)
  copy(
    path.join(nm, 'pdfjs-dist', 'build', 'pdf.min.mjs'),
    path.join(VENDOR, 'pdfjs-dist', 'pdf.min.mjs')
  );
  copy(
    path.join(nm, 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
    path.join(VENDOR, 'pdfjs-dist', 'pdf.worker.min.mjs')
  );
  copy(
    path.join(nm, 'pdfjs-dist', 'LICENSE'),
    path.join(VENDOR, 'pdfjs-dist', 'LICENSE')
  );

  // exceljs -- MIT (verified: node_modules/exceljs/LICENSE). Its own
  // pre-built browser bundle (the "browser" field in its package.json) --
  // a UMD/browserify build, not ESM, hence xlsxToJson.client.js loading it
  // via a classic <script> tag rather than import() like pdf-lib/pdf.js
  // above (see that file's header comment for why).
  copy(
    path.join(nm, 'exceljs', 'dist', 'exceljs.min.js'),
    path.join(VENDOR, 'exceljs', 'exceljs.min.js')
  );
  copy(
    path.join(nm, 'exceljs', 'LICENSE'),
    path.join(VENDOR, 'exceljs', 'LICENSE')
  );

  console.log('vendor/ populated from node_modules (pdf-lib, pdfjs-dist, exceljs).');
}

if (require.main === module) {
  copyVendor();
}

module.exports = { copyVendor, VENDOR };

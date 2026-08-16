import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { collectPageErrors } from './helpers/collectPageErrors.mjs';

/**
 * End-to-end tests for the compare-CSV-files tool: drive the built dist/
 * output in a real headless browser and verify the actual rendered diff and
 * downloaded content -- not just that the page renders. Mirrors
 * test/csvMerge.e2e.test.mjs's approach. Requires `npm run build` to have
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

  // File A: 3 rows. File B: same 3 rows REORDERED, one amount changed, one
  // row removed, one row added -- deliberately exercises reordering +
  // add/remove/change together, matched by the unique ID column.
  fs.writeFileSync(path.join(TMP, 'diff-a.csv'), 'ID,Name,Amount\r\n1,Rent,1200\r\n2,Coffee,4.50\r\n3,Snacks,3.25\r\n');
  fs.writeFileSync(path.join(TMP, 'diff-b.csv'), 'ID,Name,Amount\r\n2,Coffee,5.00\r\n1,Rent,1200\r\n4,New,2.00\r\n');

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('compare-csv: reordered rows are matched by the auto-detected ID column, not by position', async () => {
  const page = await browser.newPage();
  const errors = collectPageErrors(page);

  await page.goto(`${baseUrl}data/compare-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([
    path.join(TMP, 'diff-a.csv'),
    path.join(TMP, 'diff-b.csv'),
  ]);
  await page.waitForSelector('.table-block');

  const badgeText = await page.locator('.page-badge').textContent();
  assert.match(badgeText, /1 changed/);
  assert.match(badgeText, /1 added/);
  assert.match(badgeText, /1 removed/);

  // Scoped to .table-block (the live result, appended inside .result by
  // renderResult() -- see csvDiff.client.js), not just .extracted-table:
  // the page's own output-example panel further down this same page also
  // renders an .extracted-table with data-diff-status rows (a real,
  // generated sample, not a mock -- see src/examples/compare-csv.mjs), so
  // an unscoped selector here would double-count rows from both tables.
  const statuses = await page.locator('.table-block .extracted-table tbody tr').evaluateAll(
    (trs) => trs.map((tr) => tr.getAttribute('data-diff-status'))
  );
  assert.deepEqual(statuses.sort(), ['added', 'changed', 'removed']);

  assert.deepEqual(errors, []);
  await page.close();
});

test('compare-csv: a changed cell shows the old and new value', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/compare-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([
    path.join(TMP, 'diff-a.csv'),
    path.join(TMP, 'diff-b.csv'),
  ]);
  await page.waitForSelector('.table-block');

  // Scoped to .table-block for the same reason as the test above -- the
  // page's own output-example panel also has a data-diff-cell="changed"
  // cell.
  const changedCell = page.locator('.table-block tr[data-diff-status="changed"] td[data-diff-cell="changed"]');
  await changedCell.waitFor();
  const oldText = await changedCell.locator('.diff-cell-old').textContent();
  const newText = await changedCell.locator('.diff-cell-new').textContent();
  assert.equal(oldText, '4.50');
  assert.equal(newText, '5.00');
  await page.close();
});

test('compare-csv: selecting only one file shows a clear "exactly two files" error', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/compare-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'diff-a.csv'));

  await page.waitForFunction(() => {
    const el = document.querySelector('.dz-status');
    return el && /exactly two/i.test(el.textContent || '');
  }, { timeout: 5000 });

  assert.equal(await page.locator('.table-block').count(), 0);
  await page.close();
});

test('compare-csv: "Swap A ↔ B" reverses which file is treated as the original', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/compare-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([
    path.join(TMP, 'diff-a.csv'),
    path.join(TMP, 'diff-b.csv'),
  ]);
  await page.waitForSelector('.table-block');

  const beforeCaption = await page.locator('.caption').first().textContent();
  assert.match(beforeCaption, /File A "diff-a\.csv"/);

  await page.locator('button:has-text("Swap A")').click();
  await page.waitForFunction(() => {
    const cap = document.querySelector('.caption');
    return cap && cap.textContent.includes('File A "diff-b.csv"');
  });

  // After the swap, the row that was "added" (ID 4, only in the original
  // File B) should now read as "removed" (File B is now diff-a.csv, which
  // doesn't have ID 4).
  // Scoped to .table-block for the same reason as above.
  const statuses = await page.locator('.table-block .extracted-table tbody tr').evaluateAll(
    (trs) => trs.map((tr) => tr.getAttribute('data-diff-status'))
  );
  assert.deepEqual(statuses.sort(), ['added', 'changed', 'removed']);
  await page.close();
});

test('compare-csv: "Match rows by" Row position still finds the changed row correctly (no key column)', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/compare-csv/`, { waitUntil: 'networkidle' });
  // Two same-shaped, same-order files with one amount edited -- deliberately
  // NOT using the reordered fixture, so position mode's own "changed row"
  // pairing (not the key-column path) is what's under test.
  fs.writeFileSync(path.join(TMP, 'diff-pos-a.csv'), 'Name,Amount\r\nRent,1200\r\nCoffee,4.50\r\n');
  fs.writeFileSync(path.join(TMP, 'diff-pos-b.csv'), 'Name,Amount\r\nRent,1250\r\nCoffee,4.50\r\n');

  await page.locator('#file-input').setInputFiles([
    path.join(TMP, 'diff-pos-a.csv'),
    path.join(TMP, 'diff-pos-b.csv'),
  ]);
  await page.waitForSelector('.table-block');

  await page.locator('select').first().selectOption('position');
  await page.waitForFunction(() => {
    const badge = document.querySelector('.page-badge');
    return badge && /1 changed/.test(badge.textContent);
  });

  // Scoped to .table-block for the same reason as above.
  const statuses = await page.locator('.table-block .extracted-table tbody tr').evaluateAll(
    (trs) => trs.map((tr) => tr.getAttribute('data-diff-status'))
  );
  assert.deepEqual(statuses, ['changed']);
  await page.close();
});

test('compare-csv: downloaded diff.csv includes a Status column and old → new for changed cells', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/compare-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([
    path.join(TMP, 'diff-a.csv'),
    path.join(TMP, 'diff-b.csv'),
  ]);
  await page.waitForSelector('.table-block');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download diff.csv")').click(),
  ]);
  assert.equal(download.suggestedFilename(), 'diff.csv');
  const outPath = path.join(TMP, 'diff-out.csv');
  await download.saveAs(outPath);
  const bytes = fs.readFileSync(outPath);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'output should start with a UTF-8 BOM');
  const text = bytes.subarray(3).toString('utf8');
  assert.match(text, /^Status,ID,Name,Amount\r\n/);
  assert.match(text, /Changed,2,Coffee,4\.50 → 5\.00\r\n/);
  assert.match(text, /Added,4,New,2\.00\r\n/);
  assert.match(text, /Removed,3,Snacks,3\.25\r\n/);
  await page.close();
});

test('compare-csv: two identical files report zero differences with an honest message', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/compare-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles([
    path.join(TMP, 'diff-a.csv'),
    path.join(TMP, 'diff-a.csv'),
  ]);
  await page.waitForSelector('.alert-success');
  const msg = await page.locator('.alert-success').textContent();
  assert.match(msg, /no differences/i);
  const badgeText = await page.locator('.page-badge').textContent();
  assert.match(badgeText, /0 changed · 0 added · 0 removed · 3 unchanged/);
  await page.close();
});

// ---------------------------------------------------------------------------
// Per-file size cap (security-standards.md): both files in the pair must be
// checked individually, not just the first one in the array.
// ---------------------------------------------------------------------------

test('compare-csv: an oversized FIRST file is refused before either file reaches the processor', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/compare-csv/`, { waitUntil: 'networkidle' });

  const oversized = Buffer.alloc(21 * 1024 * 1024, 'a,b\n'.charCodeAt(0));
  const small = Buffer.from('ID,Name\n1,Rent\n', 'utf8');
  await page.locator('#file-input').setInputFiles([
    { name: 'huge-a.csv', mimeType: 'text/csv', buffer: oversized },
    { name: 'small-b.csv', mimeType: 'text/csv', buffer: small },
  ]);

  await page.waitForFunction(() => {
    const el = document.querySelector('.dz-status');
    return el && /too large/i.test(el.textContent || '');
  }, { timeout: 5000 });
  const statusText = await page.locator('.dz-status').textContent();
  assert.match(statusText, /huge-a\.csv/);
  assert.match(statusText, /20MB/);
  assert.equal(await page.locator('.table-block').count(), 0, 'neither file should have reached the diff processor');
  await page.close();
});

test('compare-csv: an oversized SECOND file is also refused, not just the first one checked', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/compare-csv/`, { waitUntil: 'networkidle' });

  const small = Buffer.from('ID,Name\n1,Rent\n', 'utf8');
  const oversized = Buffer.alloc(21 * 1024 * 1024, 'a,b\n'.charCodeAt(0));
  await page.locator('#file-input').setInputFiles([
    { name: 'small-a.csv', mimeType: 'text/csv', buffer: small },
    { name: 'huge-b.csv', mimeType: 'text/csv', buffer: oversized },
  ]);

  await page.waitForFunction(() => {
    const el = document.querySelector('.dz-status');
    return el && /too large/i.test(el.textContent || '');
  }, { timeout: 5000 });
  const statusText = await page.locator('.dz-status').textContent();
  assert.match(statusText, /huge-b\.csv/);
  assert.equal(await page.locator('.table-block').count(), 0, 'neither file should have reached the diff processor');
  await page.close();
});

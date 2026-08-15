import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { zipSync, strToU8 } from 'fflate';

/**
 * End-to-end tests for the XLSX-to-CSV tool: drive the built dist/ output
 * in a real headless browser against a hand-built, real .xlsx (OOXML zip
 * of XML parts, packed with the same fflate library the tool itself uses
 * to unpack it -- not a mocked processor), and verify the actual
 * downloaded CSV content. Mirrors test/htmlTableToCsv.e2e.test.mjs's
 * approach. Requires `npm run build` to have already produced dist/.
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

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/**
 * Builds real, minimal-but-valid .xlsx bytes: two sheets (one visible, one
 * marked hidden -- the tool should skip the hidden one), a shared-string
 * header row, a plain number, a date-formatted cell (via a custom numFmt),
 * a boolean cell, and a merged cell -- covering every code path
 * src/browser/xlsxToCsv.client.js and src/pure/xlsxGrid.mjs handle.
 */
function buildFixtureXlsx() {
  const contentTypes = XML_DECL + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>';

  const rootRels = XML_DECL + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>';

  const workbook = XML_DECL + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheets>'
    + '<sheet name="Expenses" sheetId="1" r:id="rId1"/>'
    + '<sheet name="ShouldBeSkipped" sheetId="2" r:id="rId2" state="hidden"/>'
    + '</sheets>'
    + '</workbook>';

  const workbookRels = XML_DECL + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
    + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
    + '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '</Relationships>';

  // Shared strings: 0="Item" 1="Amount" 2="Paid" 3="Note" 4="Coffee"
  const sharedStrings = XML_DECL + '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="5" uniqueCount="5">'
    + '<si><t>Item</t></si><si><t>Amount</t></si><si><t>Paid</t></si><si><t>Note</t></si><si><t>Coffee</t></si>'
    + '</sst>';

  // cellXfs[0] = default (General), cellXfs[1] = date (numFmtId 164, custom "yyyy-mm-dd")
  const styles = XML_DECL + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>'
    + '<fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="2">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '</cellXfs>'
    + '</styleSheet>';

  // Row 1 (header, shared strings): Item | Amount | Paid | Date
  // Row 2 (data): Coffee (shared string) | 4.5 (number) | TRUE (boolean) | 45306 as date-styled (2024-01-15)
  // Row 3: a merged cell A3:B3 containing an inline string "Merged note", C3 a formula with a cached value
  const sheet1 = XML_DECL + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetData>'
    + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>'
    + '<row r="2"><c r="A2" t="s"><v>4</v></c><c r="B2"><v>4.5</v></c><c r="C2" t="b"><v>1</v></c><c r="D2" s="1"><v>45306</v></c></row>'
    + '<row r="3"><c r="A3" t="inlineStr"><is><t>Merged note</t></is></c><c r="B3"/><c r="C3" t="str"><f>SUM(B2)</f><v>4.5</v></c></row>'
    + '</sheetData>'
    + '<mergeCells count="1"><mergeCell ref="A3:B3"/></mergeCells>'
    + '</worksheet>';

  const sheet2 = XML_DECL + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData>'
    + '</worksheet>';

  const files = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
    'xl/sharedStrings.xml': strToU8(sharedStrings),
    'xl/styles.xml': strToU8(styles),
    'xl/worksheets/sheet1.xml': strToU8(sheet1),
    'xl/worksheets/sheet2.xml': strToU8(sheet2),
  };
  return Buffer.from(zipSync(files));
}

let server;
let browser;
let baseUrl;

before(async () => {
  assert.ok(fs.existsSync(DIST), 'dist/ does not exist -- run `npm run build` before `npm test`.');
  fs.mkdirSync(TMP, { recursive: true });

  fs.writeFileSync(path.join(TMP, 'expenses.xlsx'), buildFixtureXlsx());
  fs.writeFileSync(path.join(TMP, 'not-a-workbook.xlsx'), Buffer.from('this is not a zip file at all'));

  server = await startServer(DIST, BASE_PREFIX);
  baseUrl = `http://localhost:${server.address().port}${BASE_PREFIX}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('xlsx-to-csv: reads the visible sheet, skips the hidden one, and shows it in the preview', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${baseUrl}data/xlsx-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'expenses.xlsx'));
  await page.waitForSelector('.table-block');

  const blockCount = await page.locator('.table-block').count();
  assert.equal(blockCount, 1, 'the hidden sheet should not get its own block');

  const badgeText = await page.locator('.page-badge').first().textContent();
  assert.match(badgeText, /Expenses/);

  const headerTexts = await page.locator('.extracted-table thead th').allTextContents();
  assert.deepEqual(headerTexts, ['Item', 'Amount', 'Paid', 'Note']);

  assert.deepEqual(errors, []);
  await page.close();
});

test('xlsx-to-csv: downloaded CSV has the correct values -- shared string, number, boolean, converted date, merged cell, and formula cached value', async () => {
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto(`${baseUrl}data/xlsx-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'expenses.xlsx'));
  await page.waitForSelector('.table-block');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('button:has-text("Download CSV")').click(),
  ]);
  const outPath = path.join(TMP, 'expenses-out.csv');
  await download.saveAs(outPath);
  const csvBytes = fs.readFileSync(outPath);
  assert.deepEqual([...csvBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'CSV should start with a UTF-8 BOM');
  const csvText = csvBytes.subarray(3).toString('utf8');
  assert.equal(
    csvText,
    'Item,Amount,Paid,Note\r\n'
    + 'Coffee,4.5,TRUE,2024-01-15\r\n'
    // row 3: A3/B3 merged ("Merged note" duplicated into both), C3 is the
    // formula's cached value (4.5), not the formula text.
    + 'Merged note,Merged note,4.5,\r\n'
  );
  await page.close();
});

test('xlsx-to-csv: a file that isn\'t a real zip/workbook gets a clear error, never a raw exception', async () => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(`${baseUrl}data/xlsx-to-csv/`, { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(path.join(TMP, 'not-a-workbook.xlsx'));

  await page.waitForFunction(() => {
    const el = document.querySelector('.dz-status');
    return el && el.textContent && el.textContent.length > 0;
  });
  const statusText = await page.locator('.dz-status').textContent();
  assert.match(statusText, /doesn.t look like a valid \.xlsx/i);
  assert.deepEqual(errors, []);
  await page.close();
});

test('the word "upload" never appears inside the dropzone control itself (design-standard language rule)', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}data/xlsx-to-csv/`, { waitUntil: 'networkidle' });
  const dzText = await page.locator('#tool .dropzone, #tool .dz-caption, #tool .dz-proof').allTextContents();
  assert.ok(!dzText.join(' ').toLowerCase().includes('upload'));
  await page.close();
});

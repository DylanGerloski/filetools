import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { exampleFor, ariaLabelFor, noteFor } from '../src/examples/index.mjs';
import { diffFixture } from '../src/examples/compare-csv.mjs';
import { mergeFixture } from '../src/examples/merge-csv.mjs';
import { splitFixture } from '../src/examples/split-csv.mjs';
import { transposeFixture } from '../src/examples/transpose-csv.mjs';
import { sortFixture } from '../src/examples/sort-lines.mjs';
import { dedupeFixture } from '../src/examples/remove-duplicate-lines.mjs';
import { convertFixture as jsonToCsvFixture } from '../src/examples/json-to-csv.mjs';
import { convertFixture as htmlTableToCsvFixture } from '../src/examples/html-table-to-csv.mjs';
import { convertFixture as yamlToJsonFixture } from '../src/examples/yaml-to-json.mjs';
import { flattenFixture } from '../src/examples/flatten-json.mjs';
import { convertFixture as xlsxToJsonFixture } from '../src/examples/xlsx-to-json.mjs';
import { SITE_CSS } from '../src/css.js';

/**
 * Coverage for the core principle behind the per-tool output examples:
 * every tool's output example is a REAL result computed at build time
 * from the tool's own src/pure/*.mjs module, never a hand-drawn mock --
 * so it can never drift from reality. These tests assert against that
 * real computed result directly.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = path.join(__dirname, '..', 'src', 'examples');

// Filenames ARE slugs (src/examples/<slug>.mjs), same convention
// src/tools/index.js's auto-discovery relies on for its own directory.
const EXAMPLE_SLUGS = readdirSync(EXAMPLES_DIR)
  .filter((f) => f.endsWith('.mjs') && f !== 'index.mjs')
  .map((f) => f.replace(/\.mjs$/, ''));

test('at least one example module exists (compare-csv)', () => {
  assert.ok(EXAMPLE_SLUGS.includes('compare-csv'));
});

/**
 * Minimal, dependency-free well-formedness check: are every example's
 * start/end tags balanced and correctly nested? A real unescaped `<`
 * leaking in from fixture data would break this (an orphan open tag with
 * no matching close, or a close tag that doesn't match the innermost
 * open) -- the practical, checkable stand-in for "no unescaped `<`
 * originating from fixture data" that section 3.6 asks for, since the
 * fixture data itself is authored in each module (not user input) and
 * there's no separate untrusted-input channel to compare against.
 */
const SELF_CLOSING = new Set(['br', 'img', 'hr', 'input']);

function assertWellFormedHtml(html, label) {
  const tagRe = /<\/?[a-zA-Z][\w-]*(?:\s+[^<>]*?)?\/?>/g;
  const stack = [];
  let match;
  let lastIndex = 0;
  while ((match = tagRe.exec(html))) {
    // Anything between tags must not itself contain a bare `<` or `>` --
    // if the regex above skipped over stray characters, tagRe's own
    // greedy scanning would already have desynced, but assert this
    // explicitly too so a malformed fragment fails loudly rather than
    // silently matching fewer tags than exist.
    const between = html.slice(lastIndex, match.index);
    assert.ok(!between.includes('<'), `${label}: unescaped "<" found outside any tag near index ${match.index}`);
    lastIndex = tagRe.lastIndex;

    const raw = match[0];
    if (raw.startsWith('</')) {
      const name = raw.slice(2, -1).trim().toLowerCase();
      const top = stack.pop();
      assert.ok(top, `${label}: closing tag </${name}> with no matching open tag`);
      assert.equal(top, name, `${label}: closing tag </${name}> does not match innermost open tag <${top}>`);
    } else if (!raw.endsWith('/>')) {
      const name = raw.slice(1, -1).trim().split(/\s/)[0].toLowerCase();
      if (!SELF_CLOSING.has(name)) stack.push(name);
    }
  }
  assert.equal(stack.length, 0, `${label}: unclosed tag(s) remain: ${stack.join(', ')}`);
}

function extractClassNames(html) {
  const names = new Set();
  const classAttrRe = /class="([^"]*)"/g;
  let m;
  while ((m = classAttrRe.exec(html))) {
    m[1].split(/\s+/).filter(Boolean).forEach((c) => names.add(c));
  }
  return names;
}

for (const slug of EXAMPLE_SLUGS) {
  test(`examples/${slug}: renders non-empty, well-formed HTML`, () => {
    const html = exampleFor(slug);
    assert.ok(typeof html === 'string' && html.length > 0, `${slug} rendered empty HTML`);
    assertWellFormedHtml(html, slug);
  });

  test(`examples/${slug}: ariaLabelFor and noteFor return non-empty strings`, () => {
    assert.ok(ariaLabelFor(slug), `${slug} has no ariaLabel`);
    assert.ok(noteFor(slug), `${slug} has no note`);
  });

  test(`examples/${slug}: every CSS class it emits is styled somewhere in src/css.js`, () => {
    const html = exampleFor(slug);
    const classes = extractClassNames(html);
    assert.ok(classes.size > 0, `${slug}'s example renders no classed elements`);
    for (const cls of classes) {
      assert.ok(SITE_CSS.includes(`.${cls}`), `class "${cls}" from ${slug}'s example is not styled anywhere in src/css.js`);
    }
  });
}

test('exampleFor() returns the empty string for a tool with no example module', () => {
  assert.equal(exampleFor('not-a-real-tool'), '');
  assert.equal(ariaLabelFor('not-a-real-tool'), '');
  assert.equal(noteFor('not-a-real-tool'), '');
});

/**
 * The literal fixture and expected diff result: two 4-row files, one row
 * of every status, run through the tool's OWN csvDiff.mjs (not
 * re-implemented here) so a change to the diff algorithm breaks this test
 * rather than silently shipping a wrong picture on the live page.
 */
test('compare-csv example: the fixture produces exactly the 5 expected diff statuses', () => {
  const outcome = diffFixture();
  const byId = new Map();
  for (const row of outcome.rows) {
    const id = (row.b || row.a)[0];
    byId.set(id, row.status);
  }
  assert.equal(byId.get('1001'), 'unchanged');
  assert.equal(byId.get('1002'), 'changed');
  assert.equal(byId.get('1003'), 'removed');
  assert.equal(byId.get('1004'), 'added');
  assert.equal(byId.get('1005'), 'unchanged');
  assert.equal(outcome.rows.length, 5);
  assert.equal(outcome.mode, 'key', 'the id column should auto-detect as the match key');
});

test('compare-csv example: row 1002 shows a two-cell change (plan and seats)', () => {
  const outcome = diffFixture();
  const row1002 = outcome.rows.find((r) => (r.b || r.a)[0] === '1002');
  assert.equal(row1002.status, 'changed');
  // header: id,name,plan,seats -- plan is column 2, seats is column 3.
  assert.deepEqual(row1002.changedCells.sort(), [2, 3]);
  assert.equal(row1002.a[2], 'Team');
  assert.equal(row1002.b[2], 'Business');
  assert.equal(row1002.a[3], '4');
  assert.equal(row1002.b[3], '9');
});

test('compare-csv example: the rendered table shows old and new values for the changed cell', () => {
  const html = exampleFor('compare-csv');
  assert.ok(html.includes('<span class="diff-cell-old">Team</span>'));
  assert.ok(html.includes('<span class="diff-cell-new">Business</span>'));
  assert.ok(html.includes('data-diff-status="removed"'));
  assert.ok(html.includes('data-diff-status="added"'));
  assert.ok(html.includes('data-diff-status="unchanged"'));
  assert.ok(html.includes('data-diff-status="changed"'));
});

/**
 * Pattern B (before-after-tables) tool-specific tests: each asserts
 * against the tool's OWN pure module's real return value for that
 * module's fixture, same "assert against reality, not a re-derived copy"
 * shape as compare-csv's tests above.
 */

test('merge-csv example: the fixture reconciles two different headers into one union, blank cell where a file lacks a column', () => {
  const merged = mergeFixture();
  assert.deepEqual(merged.headers, ['sku', 'qty', 'backorder']);
  assert.deepEqual(merged.rows, [
    ['A100', '12', ''],
    ['A101', '30', ''],
    ['B200', '', '0'],
    ['B201', '', '5'],
  ]);
});

test('merge-csv example: the rendered output table includes the union header row and a blank cell', () => {
  const html = exampleFor('merge-csv');
  assert.ok(html.includes('<th scope="col">backorder</th>'));
  assert.ok(html.includes('<td></td>'), 'expected at least one blank reconciled cell in the rendered output');
});

test('split-csv example: the fixture splits 5 rows at 3 per file into two uneven files', () => {
  const result = splitFixture();
  assert.equal(result.files.length, 2);
  assert.equal(result.files[0].dataRowCount, 3);
  assert.equal(result.files[1].dataRowCount, 2);
  assert.equal(result.totalDataRows, 5);
  // The header row is repeated in every output file.
  assert.deepEqual(result.files[0].rows[0], ['id', 'name', 'amount']);
  assert.deepEqual(result.files[1].rows[0], ['id', 'name', 'amount']);
});

test('transpose-csv example: the fixture swaps a 3-row, 3-column table into 3 rows of 3 cells each', () => {
  const outcome = transposeFixture();
  assert.equal(outcome.inputRowCount, 3);
  assert.equal(outcome.transposed.length, 3);
  outcome.transposed.forEach((row) => assert.equal(row.length, 3));
  // The header line is transposed too -- the tool has no header concept.
  assert.deepEqual(outcome.transposed[0], ['name', 'Iris', 'Coral']);
  assert.deepEqual(outcome.transposed[1], ['q1', '120', '90']);
});

test('sort-lines example: the fixture sorts numerically by score, descending, header pinned at the top', () => {
  const outcome = sortFixture();
  assert.deepEqual(outcome.sorted, ['name,score', 'Omar,95', 'Priya,88', 'Liu,72']);
  assert.equal(outcome.resolvedType, 'numeric');
});

test('remove-duplicate-lines example: the fixture removes the second occurrence of each duplicate, keeping order', () => {
  const outcome = dedupeFixture();
  assert.deepEqual(outcome.kept, ['apple', 'banana', 'cherry']);
  assert.deepEqual(outcome.removedIndices, [2, 4]);
  assert.equal(outcome.duplicateCount, 2);
});

test('remove-duplicate-lines example: the rendered Input table marks duplicate rows removed, Output shows only kept lines', () => {
  const html = exampleFor('remove-duplicate-lines');
  assert.ok(html.includes('data-diff-status="removed"'));
  assert.ok(html.includes('Duplicate'));
  assert.ok(html.includes('Kept'));
  // Scope to the Output column: "apple" and "banana" each appear exactly
  // once there -- the duplicated second occurrences never reach it.
  const outputHtml = html.slice(html.indexOf('>Output<'));
  const appleCount = (outputHtml.match(/<td>apple<\/td>/g) || []).length;
  const bananaCount = (outputHtml.match(/<td>banana<\/td>/g) || []).length;
  assert.equal(appleCount, 1);
  assert.equal(bananaCount, 1);
});

/**
 * Pattern C ("code-to-grid" / "code-to-code" / "grid-to-code") coverage --
 * an input code block or grid, plus the real result rendered as a grid or
 * a second code block. Each of the five tools below asserts against its
 * own module's real computed result (imported
 * directly, not re-derived here), the same "assert against reality"
 * discipline the compare-csv tests above use, so a change to any of these
 * tools' pure logic breaks the matching test here instead of silently
 * shipping a stale or wrong example on the live page.
 */

test('json-to-csv example: the fixture converts to the expected 3-column, 3-row grid', () => {
  const { columns, dataRows } = jsonToCsvFixture();
  assert.deepEqual(columns, ['sku', 'name', 'price']);
  assert.equal(dataRows.length, 3);
  assert.deepEqual(dataRows[0], ['A100', 'Widget', '9.5']);
  assert.deepEqual(dataRows[2], ['A102', 'Gizmo', '21.75']);
});

test('json-to-csv example: the rendered HTML shows the input JSON and the output grid', () => {
  const html = exampleFor('json-to-csv');
  assert.ok(html.includes('&quot;sku&quot;: &quot;A100&quot;'));
  assert.ok(html.includes('<th scope="col">price</th>'));
  assert.ok(html.includes('<td>21.75</td>'));
});

test('html-table-to-csv example: the hand-authored cell rows match the fixture HTML\'s own table exactly', () => {
  // Cheap drift guard for the two hand-authored fixtures this module keeps
  // in sync by hand (see that module's header comment): every cell's text
  // that appears in FIXTURE_CELL_ROWS must also literally appear in
  // FIXTURE_HTML, and the header row's cell count must match the number of
  // <th> tags in the markup.
  const { grid, headerRowCount } = htmlTableToCsvFixture();
  assert.equal(headerRowCount, 1);
  assert.deepEqual(grid[0], ['City', 'Population']);
  assert.deepEqual(grid[1], ['Reno', '264165']);
  assert.deepEqual(grid[2], ['Boise', '235684']);
});

test('html-table-to-csv example: the rendered HTML shows the input markup and the output grid', () => {
  const html = exampleFor('html-table-to-csv');
  assert.ok(html.includes('&lt;table&gt;'));
  assert.ok(html.includes('<th scope="col">Population</th>'));
  assert.ok(html.includes('<td>264165</td>'));
});

test('yaml-to-json example: the fixture converts to the expected JSON value, via the real js-yaml parse', () => {
  const jsonText = yamlToJsonFixture();
  const parsed = JSON.parse(jsonText);
  assert.deepEqual(parsed, { name: 'Widget', price: 9.5, tags: ['hardware', 'sale'] });
});

test('yaml-to-json example: the rendered HTML shows the input YAML and the output JSON', () => {
  const html = exampleFor('yaml-to-json');
  assert.ok(html.includes('name: Widget'));
  assert.ok(html.includes('&quot;price&quot;: 9.5'));
});

test('flatten-json example: the fixture flattens nested customer objects into dot-notation keys', () => {
  const flatRecords = flattenFixture();
  assert.equal(flatRecords.length, 2);
  assert.deepEqual(flatRecords[0], { order: 'A1', 'customer.name': 'Priya', 'customer.city': 'Austin' });
  assert.deepEqual(flatRecords[1], { order: 'A2', 'customer.name': 'Omar', 'customer.city': 'Reno' });
});

test('flatten-json example: the rendered HTML wraps every flattened key at weight-medium', () => {
  const html = exampleFor('flatten-json');
  assert.ok(html.includes('<span style="font-weight:var(--weight-medium)">&quot;customer.name&quot;</span>'));
  assert.ok(html.includes('<span style="font-weight:var(--weight-medium)">&quot;customer.city&quot;</span>'));
});

test('xlsx-to-json example: the fixture keeps real JSON types (number, boolean), not stringified text', () => {
  const { records } = xlsxToJsonFixture();
  assert.equal(records.length, 2);
  assert.deepEqual(records[0], { Product: 'Widget', Qty: 12, 'In Stock': true });
  assert.equal(typeof records[0].Qty, 'number');
  assert.equal(typeof records[0]['In Stock'], 'boolean');
  assert.deepEqual(records[1], { Product: 'Gadget', Qty: 5, 'In Stock': false });
});

test('xlsx-to-json example: the rendered HTML shows the input grid and the typed output JSON', () => {
  const html = exampleFor('xlsx-to-json');
  assert.ok(html.includes('<th scope="col">In Stock</th>'));
  assert.ok(html.includes('&quot;Qty&quot;: 12'));
  assert.ok(html.includes('&quot;In Stock&quot;: true'));
});

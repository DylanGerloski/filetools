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

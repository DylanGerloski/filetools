import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { exampleFor, ariaLabelFor, noteFor } from '../src/examples/index.mjs';
import { diffFixture } from '../src/examples/compare-csv.mjs';
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS } from '../src/tools/index.js';
import { markFor, MARKS } from '../src/icons.js';
import { familyOf } from '../src/families.js';
import { SITE_CSS } from '../src/css.js';
import { DESIGN_TOKENS } from '../src/tokens.js';

/**
 * Regression coverage for the two-part icon mark system: every registry
 * slug must resolve to an explicit mark (never the fallback), every mark
 * must draw its colors from CSS custom properties (never a hardcoded hex/
 * rgb literal), every var(--family-*) token those custom properties chain
 * back to must actually exist, and every mark must be well-formed,
 * accessible-hidden SVG.
 */

const VOID_LIKE_SELF_CLOSE = /\/>$/;

/**
 * Minimal, dependency-free well-formedness check for the code-generated
 * SVG strings this module emits -- these are never user data, so a
 * stack-based tag matcher (are start/end tags balanced and correctly
 * nested?) is the realistic risk surface, not full XML-spec validation.
 * Throws with a descriptive message on the first mismatch; returns
 * silently for well-formed input.
 */
function assertWellFormedXml(svg, label) {
  const tagRe = /<\/?[a-zA-Z][\w-]*(?:\s+[^<>]*?)?\/?>/g;
  const stack = [];
  let m;
  while ((m = tagRe.exec(svg))) {
    const tag = m[0];
    if (tag.startsWith('</')) {
      const name = tag.slice(2, -1).trim();
      const top = stack.pop();
      assert.equal(top, name, `${label}: closing tag </${name}> does not match open tag <${top}> (${svg})`);
    } else if (!VOID_LIKE_SELF_CLOSE.test(tag)) {
      const name = tag.slice(1).replace(/[\s/>].*$/, '');
      stack.push(name);
    }
  }
  assert.equal(stack.length, 0, `${label}: unclosed tag(s) [${stack.join(', ')}] (${svg})`);
  // Every attribute value must be double-quoted -- catches an accidental
  // unquoted or single-quoted interpolation, which would also make this
  // invalid as XML.
  const attrRe = /<[a-zA-Z][\w-]*((?:\s+[\w-]+=(?:"[^"]*"|[^\s>]+))*)\s*\/?>/g;
  let am;
  while ((am = attrRe.exec(svg))) {
    const attrs = am[1];
    if (attrs) {
      const badAttr = attrs.match(/\s([\w-]+)=([^"][^\s>]*)/);
      assert.equal(badAttr, null, `${label}: unquoted/malformed attribute value near "${badAttr && badAttr[0]}" (${svg})`);
    }
  }
}

test('every slug in the TOOLS registry resolves to an explicit MARKS entry (fallback never hit for a real tool)', () => {
  const missing = TOOLS.map((t) => t.slug).filter((slug) => !(slug in MARKS));
  assert.deepEqual(missing, [], `slugs missing an explicit mark: ${missing.join(', ')}`);
});

test('MARKS is exactly the fixed 18-row plate/verb/ink table, no more, no fewer', () => {
  assert.deepEqual(MARKS, {
    'merge-pdf': { plate: 'pdf', verb: 'merge', ink: 'pdf' },
    'split-pdf': { plate: 'pdf', verb: 'split', ink: 'pdf' },
    'rotate-pdf': { plate: 'pdf', verb: 'rotate', ink: 'pdf' },
    'pdf-to-csv': { plate: 'pdf', verb: 'convert', ink: 'csv' },
    'bank-statement-to-csv': { plate: 'pdf', verb: 'convert', ink: 'csv', motif: 'bank' },
    'merge-csv': { plate: 'csv', verb: 'merge', ink: 'csv' },
    'compare-csv': { plate: 'csv', verb: 'compare', ink: 'csv' },
    'split-csv': { plate: 'csv', verb: 'split', ink: 'csv' },
    'transpose-csv': { plate: 'csv', verb: 'transpose', ink: 'csv' },
    'html-table-to-csv': { plate: 'csv', verb: 'convert', ink: 'csv', motif: 'html' },
    'json-to-csv': { plate: 'json', verb: 'convert', ink: 'csv' },
    'flatten-json': { plate: 'json', verb: 'flatten', ink: 'json' },
    'yaml-to-json': { plate: 'json', verb: 'convert', ink: 'json' },
    'xlsx-to-csv': { plate: 'sheet', verb: 'convert', ink: 'csv' },
    'xlsx-to-json': { plate: 'sheet', verb: 'convert', ink: 'json' },
    'remove-duplicate-lines': { plate: 'text', verb: 'dedupe', ink: 'text' },
    'sort-lines': { plate: 'text', verb: 'sort', ink: 'text' },
    'word-frequency-counter': { plate: 'text', verb: 'count', ink: 'text' },
    'url-encode-decode': { plate: 'text', verb: 'convert', ink: 'text' },
  });
});

test('every mark table row\'s plate/ink family agrees with families.js\'s familyOf() (plate == familyOf(slug) except intentional cross-family converters)', () => {
  for (const [slug, def] of Object.entries(MARKS)) {
    assert.equal(def.plate, familyOf(slug), `${slug}: mark plate "${def.plate}" != familyOf() "${familyOf(slug)}"`);
  }
});

test('every emitted mark SVG string contains no hex-color literal and no rgb()/rgba() literal', () => {
  for (const tool of TOOLS) {
    const svg = markFor(tool.slug);
    assert.doesNotMatch(svg, /#[0-9a-fA-F]{3,8}\b/, `${tool.slug}: hex literal found in mark`);
    assert.doesNotMatch(svg, /\brgba?\(/i, `${tool.slug}: rgb()/rgba() literal found in mark`);
  }
});

test('every var(--family-*) referenced anywhere in the stylesheet exists as a design token', () => {
  const refs = [...SITE_CSS.matchAll(/var\((--family-[a-z0-9-]+)\)/g)].map((m) => m[1]);
  assert.ok(refs.length >= 15, `expected at least the 15 emitted family tokens to be referenced, found ${refs.length}`);
  for (const ref of refs) {
    assert.ok(ref in DESIGN_TOKENS, `${ref} is referenced in css.js but missing from DESIGN_TOKENS`);
  }
});

test('every mark--<family> / mark-ink--<family> class in the stylesheet only ever sets --mark-plate/--mark-wash/--mark-ink from a var(--family-*) token, never a literal', () => {
  const markBlockRe = /\.mark(?:-ink)?--[a-z]+\s*\{([^}]*)\}/g;
  let m;
  let blocks = 0;
  while ((m = markBlockRe.exec(SITE_CSS))) {
    blocks += 1;
    const body = m[1];
    assert.doesNotMatch(body, /#[0-9a-fA-F]{3,8}\b/, `hex literal inside ${m[0]}`);
    assert.match(body, /var\(--family-/, `${m[0]} does not set its custom property from a var(--family-*) token`);
  }
  assert.equal(blocks, 10, `expected 5 .mark--<family> + 5 .mark-ink--<family> blocks, found ${blocks}`);
});

test('every mark parses as well-formed XML and carries aria-hidden="true" focusable="false"', () => {
  for (const tool of TOOLS) {
    const svg = markFor(tool.slug);
    assertWellFormedXml(svg, tool.slug);
    assert.match(svg, /aria-hidden="true"/, `${tool.slug}: missing aria-hidden="true"`);
    assert.match(svg, /focusable="false"/, `${tool.slug}: missing focusable="false"`);
  }
});

test('markFor() appends an extra class alongside the two color-context classes without breaking well-formedness', () => {
  const svg = markFor('merge-pdf', 'tool-row-icon');
  assertWellFormedXml(svg, 'merge-pdf+extraClass');
  assert.match(svg, /class="mark mark--pdf mark-ink--pdf tool-row-icon"/);
});

test('an unrecognized slug falls back to a renderable mark rather than throwing (never hit for a real registry tool per the first test above)', () => {
  assert.doesNotThrow(() => markFor('not-a-real-tool'));
  const svg = markFor('not-a-real-tool');
  assertWellFormedXml(svg, 'not-a-real-tool');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findEmDashes, findHtmlFiles } from '../scripts/check-em-dash.js';

// ---------------------------------------------------------------------------
// findEmDashes: rendered prose (pre-existing coverage, kept as a baseline)
// ---------------------------------------------------------------------------

test('findEmDashes: catches an em dash in a <p> element', () => {
  const html = '<p>This is broken—really broken.</p>';
  const hits = findEmDashes(html);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /really broken/);
});

test('findEmDashes: passes clean prose with a plain hyphen', () => {
  const html = '<p>This is fine - really fine.</p>';
  assert.deepEqual(findEmDashes(html), []);
});

// ---------------------------------------------------------------------------
// findEmDashes: head/meta surfaces a plain prose-tag scan cannot see
// ---------------------------------------------------------------------------

test('findEmDashes: catches an em dash in <title> text content', () => {
  const html = '<html><head><title>filetools — free tools</title></head><body></body></html>';
  const hits = findEmDashes(html);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /<title>/);
  assert.match(hits[0], /free tools/);
});

test('findEmDashes: catches an em dash in a meta description content= attribute', () => {
  const html = '<meta name="description" content="Convert files — fast and free.">';
  const hits = findEmDashes(html);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /Convert files/);
});

test('findEmDashes: catches an em dash in an og:title/og:description content= attribute', () => {
  const ogTitle = '<meta property="og:title" content="filetools — no upload needed">';
  const ogDescription = '<meta property="og:description" content="Private, in-browser tools — nothing leaves your device.">';
  assert.equal(findEmDashes(ogTitle).length, 1);
  assert.equal(findEmDashes(ogDescription).length, 1);
});

test('findEmDashes: catches an em dash in an alt= attribute', () => {
  const html = '<img src="/screenshot.png" alt="Before and after — side by side comparison">';
  const hits = findEmDashes(html);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /side by side/);
});

test('findEmDashes: catches an em dash in an aria-label= attribute', () => {
  const html = '<button aria-label="Close — discard changes">X</button>';
  const hits = findEmDashes(html);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /discard changes/);
});

test('findEmDashes: catches an em dash written as an &mdash; entity in an attribute', () => {
  const html = '<meta name="description" content="Fast &mdash; and free.">';
  const hits = findEmDashes(html);
  assert.equal(hits.length, 1);
});

test('findEmDashes: catches an em dash in a single-quoted attribute value', () => {
  const html = "<img src='/x.png' alt='Before — after'>";
  assert.equal(findEmDashes(html).length, 1);
});

test('findEmDashes: passes clean head/meta content with a plain hyphen', () => {
  const html = [
    '<title>filetools - free tools</title>',
    '<meta name="description" content="Convert files - fast and free.">',
    '<meta property="og:title" content="filetools - no upload needed">',
    '<img src="/x.png" alt="Before and after - side by side">',
    '<button aria-label="Close - discard changes">X</button>',
  ].join('\n');
  assert.deepEqual(findEmDashes(html), []);
});

test('findEmDashes: reports one hit per offending location, not per file', () => {
  const html = [
    '<title>Broken — title</title>',
    '<p>Broken — paragraph.</p>',
    '<meta name="description" content="Broken — description.">',
  ].join('\n');
  assert.equal(findEmDashes(html).length, 3);
});

// ---------------------------------------------------------------------------
// findHtmlFiles: scans every *.html file, not just index.html
// ---------------------------------------------------------------------------

test('findHtmlFiles: finds index.html and non-index .html files like 404.html', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'em-dash-fixture-'));
  try {
    fs.writeFileSync(path.join(dir, 'index.html'), '<p>home</p>');
    fs.writeFileSync(path.join(dir, '404.html'), '<p>not found</p>');
    fs.writeFileSync(path.join(dir, 'google123abc.html'), 'google-site-verification: google123abc.html');
    const sub = path.join(dir, 'merge-pdf');
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(sub, 'index.html'), '<p>merge pdf</p>');

    const found = findHtmlFiles(dir).map((f) => path.relative(dir, f)).sort();
    assert.deepEqual(found, [
      '404.html',
      'google123abc.html',
      'index.html',
      path.join('merge-pdf', 'index.html'),
    ].sort());
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('findHtmlFiles + findEmDashes: catches an em dash in a non-index page like 404.html', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'em-dash-fixture-'));
  try {
    fs.writeFileSync(
      path.join(dir, '404.html'),
      '<title>Page not found — filetools</title>'
    );
    const files = findHtmlFiles(dir);
    assert.equal(files.length, 1);
    const html = fs.readFileSync(files[0], 'utf8');
    assert.equal(findEmDashes(html).length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

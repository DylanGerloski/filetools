'use strict';

/**
 * Flat, zero-tolerance check for the literal em dash character (—) in
 * rendered output. Design-standards.md bans em dashes outright -- not a
 * density cap, any single occurrence is a failure. Scans every built
 * dist/**\/*.html page (not just index.html -- 404.html and any other
 * generated page count too) for the literal character in two kinds of
 * places a plain phrase grep over source can't reliably catch (an em dash
 * isn't a fixed tell phrase, and text assembled from shared fragments
 * reused across pages only exists post-build):
 *
 *   1. Rendered prose elements: <p>, <li>, headings, <summary> -- never
 *      tables/data/code.
 *   2. Head/meta surfaces that never render as prose but still ship to
 *      users and search engines: <title> text content, and the value of
 *      any content=/alt=/aria-label= attribute (meta description,
 *      og:title, og:description, image alt text, aria-label).
 *
 * Usage: node scripts/check-em-dash.js (requires dist/ -- run after
 * `npm run build`). Exits 1 and prints every offending page and the
 * offending snippet on failure; exits 0 and prints a pass summary on
 * success. Wired as a `pretest` npm script so `npm test` (and CI, which
 * runs `npm run build` then `npm test`) fails automatically on any hit.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const TAG_NAMES = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'summary'];
// (?![a-zA-Z0-9-]) after the tag name stops "<p...>" from also matching
// unrelated tags that merely start with the same letter, like <path> or
// <pre>.
const PROSE_RE = new RegExp(`<(${TAG_NAMES.join('|')})(?![a-zA-Z0-9-])[^>]*>([\\s\\S]*?)<\\/\\1>`, 'g');

const TITLE_RE = /<title(?![a-zA-Z0-9-])[^>]*>([\s\S]*?)<\/title>/g;

// Matches content=/alt=/aria-label= attribute values with either quote
// style. Non-greedy so a value never spans past its own closing quote.
const ATTR_NAMES = ['content', 'alt', 'aria-label'];
const ATTR_RE = new RegExp(`\\b(?:${ATTR_NAMES.join('|')})\\s*=\\s*("[^"]*"|'[^']*')`, 'g');

function findHtmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findHtmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function decode(text) {
  return text.replace(/&mdash;/g, '—');
}

/** @returns {string[]} snippets containing a literal em dash */
function findEmDashes(html) {
  const hits = [];

  for (const m of html.matchAll(PROSE_RE)) {
    const text = decode(m[2].replace(/<[^>]+>/g, ' '));
    if (text.includes('—')) {
      hits.push(text.trim().slice(0, 160));
    }
  }

  for (const m of html.matchAll(TITLE_RE)) {
    const text = decode(m[1].replace(/<[^>]+>/g, ' '));
    if (text.includes('—')) {
      hits.push(`<title>: ${text.trim().slice(0, 160)}`);
    }
  }

  for (const m of html.matchAll(ATTR_RE)) {
    const value = decode(m[1].slice(1, -1));
    if (value.includes('—')) {
      hits.push(`attribute: ${value.trim().slice(0, 160)}`);
    }
  }

  return hits;
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error('dist/ does not exist -- run `npm run build` first.');
    process.exitCode = 1;
    return;
  }
  const files = findHtmlFiles(DIST);
  let failed = false;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const hits = findEmDashes(html);
    if (hits.length) {
      failed = true;
      const rel = path.relative(DIST, file);
      console.error(`FAIL ${rel}: ${hits.length} em dash occurrence(s)`);
      hits.forEach((h) => console.error(`  - ${h}`));
    }
  }
  if (failed) {
    console.error('\nEm dash check failed. design-standards.md bans em dashes outright -- replace each with a plain hyphen (-), or restructure with a period/comma.');
    process.exitCode = 1;
  } else {
    console.log(`Em dash check passed on ${files.length} pages -- zero occurrences.`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { findEmDashes, findHtmlFiles };

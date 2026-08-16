'use strict';

/**
 * Flat, zero-tolerance check for the literal em dash character (—) in
 * rendered output. Design-standards.md bans em dashes outright -- not a
 * density cap, any single occurrence is a failure. Scans every built
 * dist/**\/index.html page's actual rendered prose elements (<p>, <li>,
 * headings, <summary> -- never tables/data/code) for the literal
 * character, since a plain phrase grep over source can't catch this (an em
 * dash isn't a fixed tell phrase) and counting only source misses text
 * assembled from shared fragments reused across pages.
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

function findHtmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findHtmlFiles(full));
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
}

/** @returns {string[]} snippets containing a literal em dash */
function findEmDashes(html) {
  const hits = [];
  for (const m of html.matchAll(PROSE_RE)) {
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/&mdash;/g, '—');
    if (text.includes('—')) {
      hits.push(text.trim().slice(0, 160));
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

main();

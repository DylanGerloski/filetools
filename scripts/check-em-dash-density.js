'use strict';

/**
 * Automated check for em dash overuse -- a real typographic character
 * (curly, not "--") used correctly is fine, but too many of them in a row
 * reads as a stylistic tic rather than deliberate punctuation. Scans every
 * built dist/**\/index.html page's actual rendered prose elements (<p>,
 * <li>, headings only -- never tables/data/code) and fails if any page's
 * em-dash rate exceeds roughly 1 per 150 words, or if any single element
 * uses 2 or more.
 *
 * Usage: node scripts/check-em-dash-density.js (requires dist/ -- run
 * after `npm run build`). Exits 1 and prints every offending page on
 * failure; exits 0 and prints nothing on success.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const TAG_NAMES = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
// (?![a-zA-Z0-9-]) after the tag name stops "<p...>" from also matching
// unrelated tags that merely start with the same letter, like <path> or
// <pre> -- a real bug hit while writing this check by hand the first time.
const PROSE_RE = new RegExp(`<(${TAG_NAMES.join('|')})(?![a-zA-Z0-9-])[^>]*>([\\s\\S]*?)<\\/\\1>`, 'g');

const RATE_LIMIT_PER_150_WORDS = 1;
const MAX_PER_ELEMENT = 1;

function findHtmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findHtmlFiles(full));
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
}

/** @returns {{words:number, emdashes:number, rate:number, overElements:string[]}} */
function analyzePage(html) {
  const overElements = [];
  const pieces = [];
  for (const m of html.matchAll(PROSE_RE)) {
    const text = m[2].replace(/<[^>]+>/g, ' ');
    pieces.push(text);
    const count = (text.match(/—/g) || []).length;
    if (count > MAX_PER_ELEMENT) overElements.push(`${count}x in: ${text.trim().slice(0, 120)}`);
  }
  const joined = pieces.join(' ');
  const words = joined.split(/\s+/).filter(Boolean).length;
  const emdashes = (joined.match(/—/g) || []).length;
  const rate = words ? (emdashes / words) * 150 : 0;
  return { words, emdashes, rate, overElements };
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
    const { words, emdashes, rate, overElements } = analyzePage(html);
    const rel = path.relative(DIST, file);
    if (rate > RATE_LIMIT_PER_150_WORDS || overElements.length) {
      failed = true;
      console.error(`FAIL ${rel}: ${emdashes} em-dashes / ${words} words (${rate.toFixed(2)} per 150 words, limit ${RATE_LIMIT_PER_150_WORDS})`);
      overElements.forEach((e) => console.error(`  - ${e}`));
    }
  }
  if (failed) {
    console.error('\nEm-dash density check failed. Rewrite the flagged copy with a period, comma, or restructure instead.');
    process.exitCode = 1;
  } else {
    console.log(`Em-dash density check passed on ${files.length} pages.`);
  }
}

main();

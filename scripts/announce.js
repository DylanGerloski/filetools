'use strict';

/**
 * Generates draft announcement text for newly launched tools, one file per
 * outreach channel, ready to be reviewed before anything is posted
 * anywhere. This script only WRITES plain text draft files -- it never
 * sends, posts, publishes, or contacts anything itself, and it never reads
 * or writes any credential.
 *
 * "New" is tracked in a local state file (.announce-state.json, gitignored)
 * listing every tool slug this script has already drafted for, so running
 * it repeatedly doesn't regenerate a draft for a tool that already
 * shipped. Comparing the TOOLS registry against that state file is the
 * entire "new tool" detection mechanism.
 *
 * Usage:
 *   node scripts/announce.js [--out <dir>] [--dry-run]
 *
 * --out defaults to a local, gitignored dist-announcements/ directory so
 * this script never needs to know about, or hardcode a path to, wherever
 * drafts actually get reviewed -- point --out at that real location
 * explicitly when running it for real. --dry-run prints what it would
 * write without writing anything or updating the state file.
 */

const fs = require('fs');
const path = require('path');
const { TOOLS } = require('../src/tools/index.js');
const { absoluteUrl } = require('../src/site.js');

const ROOT = path.join(__dirname, '..');
const STATE_FILE = path.join(ROOT, '.announce-state.json');
const DEFAULT_OUT_DIR = path.join(ROOT, 'dist-announcements');

// The channels this generates a draft for: the announcement-capable owned
// channels sharing one identity across the human's projects (plain text
// posts) -- not the technical search-indexing mechanisms, which have
// nothing to draft. Adding a third channel later is a one-line change here
// plus a new draftFor() branch below.
const ANNOUNCEMENT_CHANNELS = ['X', 'Bluesky'];

function readState() {
  if (!fs.existsSync(STATE_FILE)) return { drafted_slugs: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return { drafted_slugs: Array.isArray(parsed.drafted_slugs) ? parsed.drafted_slugs : [] };
  } catch {
    // A corrupted state file must not crash the build -- treat as "nothing
    // drafted yet" (worst case: a tool gets re-drafted once, which is a
    // no-op cost since nothing auto-posts).
    return { drafted_slugs: [] };
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

/**
 * @param {Array} tools the TOOLS registry.
 * @param {{drafted_slugs: string[]}} state
 * @returns {Array} tools present in `tools` but not yet in state.drafted_slugs.
 */
function findNewTools(tools, state) {
  const known = new Set(state.drafted_slugs);
  return tools.filter((t) => !known.has(t.slug));
}

/**
 * @param {'X'|'Bluesky'} channel
 * @param {object} tool a TOOLS registry entry.
 * @returns {string} draft post text, kept under each platform's practical
 *   character budget (280 graphemes for X, 300 for Bluesky) with a shorter
 *   fallback if the full copy would overflow.
 */
function draftFor(channel, tool) {
  const link = absoluteUrl(`${tool.category}/${tool.slug}/`);
  const desc = tool.deck || tool.metaDescription || '';
  if (channel === 'X') {
    const text = `New: ${tool.navLabel}. ${desc} No account, no upload -- runs entirely in your browser. ${link}`;
    return text.length <= 280 ? text : `New: ${tool.navLabel}. ${link}`;
  }
  if (channel === 'Bluesky') {
    const text = `New tool: ${tool.navLabel}. ${desc} No account, no upload -- runs entirely in your browser.\n\n${link}`;
    return text.length <= 300 ? text : `New tool: ${tool.navLabel}.\n\n${link}`;
  }
  throw new Error(`draftFor: unknown channel "${channel}"`);
}

/**
 * @param {{tools?: Array, state?: object, now?: Date}} [opts]
 * @returns {{newTools: Array, drafts: Array<{tool:string, channel:string, filename:string, text:string}>}}
 */
function generateDrafts({ tools = TOOLS, state = readState(), now = new Date() } = {}) {
  const newTools = findNewTools(tools, state);
  const drafts = [];
  for (const tool of newTools) {
    for (const channel of ANNOUNCEMENT_CHANNELS) {
      drafts.push({
        tool: tool.slug,
        channel,
        filename: `${now.toISOString().slice(0, 10)}-filetools-${tool.slug}-${channel.toLowerCase()}.txt`,
        text: draftFor(channel, tool),
      });
    }
  }
  return { newTools, drafts };
}

function writeDrafts(drafts, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const d of drafts) {
    const target = path.join(outDir, d.filename);
    fs.writeFileSync(target, d.text, 'utf8');
    written.push(target);
  }
  return written;
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outDir = outIdx !== -1 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : DEFAULT_OUT_DIR;
  const dryRun = args.includes('--dry-run');

  const state = readState();
  const { newTools, drafts } = generateDrafts({ state });

  if (newTools.length === 0) {
    console.log('No new tools since the last run -- nothing to draft.');
    return;
  }

  console.log(`${newTools.length} new tool(s) detected: ${newTools.map((t) => t.slug).join(', ')}`);
  if (dryRun) {
    for (const d of drafts) {
      console.log(`\n--- ${d.filename} (${d.channel}) ---\n${d.text}`);
    }
    console.log('\nDry run -- no files written, state not updated.');
    return;
  }

  const written = writeDrafts(drafts, outDir);
  console.log(`Wrote ${written.length} draft file(s) to ${outDir}:`);
  written.forEach((f) => console.log(`  - ${f}`));

  writeState({ drafted_slugs: [...state.drafted_slugs, ...newTools.map((t) => t.slug)] });
  console.log(`Recorded ${newTools.length} tool(s) as drafted in ${path.basename(STATE_FILE)}.`);
  console.log('These are DRAFTS ONLY -- nothing has been posted anywhere. Review each file before it goes any further.');
}

if (require.main === module) {
  main();
}

module.exports = {
  generateDrafts,
  findNewTools,
  draftFor,
  writeDrafts,
  readState,
  writeState,
  ANNOUNCEMENT_CHANNELS,
  STATE_FILE,
  DEFAULT_OUT_DIR,
};

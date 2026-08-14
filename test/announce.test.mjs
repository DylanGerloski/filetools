import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  generateDrafts,
  findNewTools,
  draftFor,
  writeDrafts,
  ANNOUNCEMENT_CHANNELS,
} from '../scripts/announce.js';

const FAKE_TOOL = {
  slug: 'merge-pdf',
  category: 'pdf',
  navLabel: 'Merge PDF',
  deck: 'Combine PDFs into one file.',
};

test('findNewTools returns only tools not yet in state.drafted_slugs', () => {
  const tools = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }];
  const state = { drafted_slugs: ['a'] };
  const result = findNewTools(tools, state);
  assert.deepEqual(result.map((t) => t.slug), ['b', 'c']);
});

test('draftFor produces X and Bluesky copy under each platform\'s character budget, with the tool link included', () => {
  const xText = draftFor('X', FAKE_TOOL);
  const blueskyText = draftFor('Bluesky', FAKE_TOOL);
  assert.ok(xText.length <= 280, `X draft should be <=280 chars, was ${xText.length}`);
  assert.ok(blueskyText.length <= 300, `Bluesky draft should be <=300 chars, was ${blueskyText.length}`);
  assert.match(xText, /merge-pdf/);
  assert.match(blueskyText, /merge-pdf/);
});

test('draftFor throws on an unrecognized channel rather than silently drafting nothing', () => {
  assert.throws(() => draftFor('Discord', FAKE_TOOL), /unknown channel/);
});

test('generateDrafts produces one draft per new tool per announcement channel, and none for already-drafted tools', () => {
  const tools = [FAKE_TOOL, { slug: 'split-pdf', category: 'pdf', navLabel: 'Split PDF', deck: 'Split a PDF.' }];
  const state = { drafted_slugs: ['split-pdf'] }; // split-pdf already drafted
  const { newTools, drafts } = generateDrafts({ tools, state, now: new Date('2026-08-14T00:00:00Z') });
  assert.deepEqual(newTools.map((t) => t.slug), ['merge-pdf']);
  assert.equal(drafts.length, ANNOUNCEMENT_CHANNELS.length);
  assert.deepEqual(drafts.map((d) => d.channel).sort(), [...ANNOUNCEMENT_CHANNELS].sort());
  for (const d of drafts) {
    assert.equal(d.tool, 'merge-pdf');
    assert.match(d.filename, /^2026-08-14-filetools-merge-pdf-(x|bluesky)\.txt$/);
  }
});

test('generateDrafts with no new tools produces zero drafts', () => {
  const tools = [FAKE_TOOL];
  const state = { drafted_slugs: ['merge-pdf'] };
  const { newTools, drafts } = generateDrafts({ tools, state });
  assert.equal(newTools.length, 0);
  assert.equal(drafts.length, 0);
});

test('writeDrafts writes exactly the given files, with their exact text, into the target directory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'announce-test-'));
  const drafts = [
    { filename: 'a.txt', text: 'draft A' },
    { filename: 'b.txt', text: 'draft B' },
  ];
  const written = writeDrafts(drafts, tmpDir);
  assert.equal(written.length, 2);
  assert.equal(fs.readFileSync(path.join(tmpDir, 'a.txt'), 'utf8'), 'draft A');
  assert.equal(fs.readFileSync(path.join(tmpDir, 'b.txt'), 'utf8'), 'draft B');
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

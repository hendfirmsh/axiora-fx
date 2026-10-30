#!/usr/bin/env node
/**
 * AXIORA Intelligence News — static feed validator.
 *
 * Authority: user instruction (AXIORA Intelligence News, 2026-10-30),
 *            IMPLEMENTATION_CONTRACT.md Section 6 (verification evidence).
 *
 * Validates public/data/news/latest.json against the strict feed contract before
 * it is committed or published. Exits non-zero on any defect.
 *
 * Usage:
 *   node scripts/validate-news.mjs
 *   node scripts/validate-news.mjs path/to/latest.json
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { NEWS_CATEGORY_LABELS, validateNewsFeed } from '../src/lib/news.ts';

const feedPath = process.argv[2]
  ? resolve(process.argv[2])
  : join(process.cwd(), 'public', 'data', 'news', 'latest.json');

let raw;
try {
  raw = await readFile(feedPath, 'utf8');
} catch {
  console.error(`\nAXIORA news feed validation FAILED: feed file is missing or unreadable.\n`);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch {
  console.error(`\nAXIORA news feed validation FAILED: feed is not valid JSON.\n`);
  process.exit(1);
}

const result = validateNewsFeed(parsed);
if (!result.ok || !result.feed) {
  console.error('\nAXIORA news feed validation FAILED\n');
  for (const error of result.errors) console.error(`  - ${error}`);
  console.error('');
  process.exit(1);
}

const counts = new Map();
for (const item of result.feed.items) {
  counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
}

console.log('\nAXIORA news feed validation\n');
console.log(`  [PASS] ${result.feed.items.length} item(s) validated.`);
console.log(`         Generated at: ${result.feed.generated_at ?? 'never (empty feed)'}`);
for (const [category, count] of counts) {
  console.log(`         ${NEWS_CATEGORY_LABELS[category]}: ${count}`);
}
if (result.feed.items.length === 0) {
  console.log('         Empty feed is valid; the reader page must state that no news is available.');
}
console.log('\nNews feed validation passed.\n');

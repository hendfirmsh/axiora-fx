/**
 * Build-time loader for the static Intelligence News feed.
 *
 * Authority: user instruction (AXIORA Intelligence News, 2026-10-30),
 *            IMPLEMENTATION_CONTRACT.md Section 5 (static-first).
 *
 * The reader page is pre-rendered. This module reads the JSON that the scheduled
 * GitHub Actions pipeline commits, validates it with the same strict validator
 * the pipeline uses, and returns an explicit empty/error state instead of
 * throwing during a build. A missing file is normal before the first successful
 * fetch; a malformed file is an error the page must state honestly.
 *
 * No network access and no browser runtime are involved.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  makeEmptyFeed,
  validateNewsFeed,
  type NewsFeed,
} from './news.ts';

export type NewsFeedLoadState = 'ok' | 'empty' | 'error';

export interface NewsFeedLoad {
  state: NewsFeedLoadState;
  feed: NewsFeed;
  /** Reader-safe diagnostic. Never contains a filesystem path or credential. */
  error: string | null;
}

const FEED_RELATIVE_PATH = join('public', 'data', 'news', 'latest.json');

export async function loadNewsFeed(root = process.cwd()): Promise<NewsFeedLoad> {
  const feedPath = join(root, FEED_RELATIVE_PATH);

  let raw: string;
  try {
    raw = await readFile(feedPath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return {
        state: 'empty',
        feed: makeEmptyFeed(),
        error: null,
      };
    }
    return {
      state: 'error',
      feed: makeEmptyFeed(),
      error: 'Feed berita tidak dapat dibaca dari penyimpanan statis.',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      state: 'error',
      feed: makeEmptyFeed(),
      error: 'Feed berita tidak valid: JSON tidak dapat dibaca.',
    };
  }

  const validation = validateNewsFeed(parsed);
  if (!validation.ok || !validation.feed) {
    const summary = validation.errors.slice(0, 4).join('; ');
    return {
      state: 'error',
      feed: makeEmptyFeed(),
      error: summary
        ? `Feed berita tidak lolos validasi: ${summary}`
        : 'Feed berita tidak lolos validasi.',
    };
  }

  return {
    state: validation.feed.items.length === 0 ? 'empty' : 'ok',
    feed: validation.feed,
    error: null,
  };
}

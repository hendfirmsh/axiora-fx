#!/usr/bin/env node
/**
 * AXIORA Intelligence News — scheduled Marketaux fetch and merge.
 *
 * Authority: user instruction (AXIORA Intelligence News, 2026-10-30),
 *            IMPLEMENTATION_CONTRACT.md Section 5 (static-first; no backend).
 *
 * Pipeline:
 *   Marketaux /v1/news/all
 *     -> validate HTTP result
 *     -> normalize each provider article (drop invalid records)
 *     -> deduplicate against the last valid feed
 *     -> classify internally
 *     -> retain 7 days / 120 items
 *     -> atomically write public/data/news/latest.json
 *
 * FAILURE POLICY
 *
 *   A missing token, HTTP error, timeout, malformed JSON, or an empty/invalid
 *   provider batch never overwrites the last valid feed. The process exits
 *   non-zero so the workflow reports the failure and makes no commit.
 *
 * SECRET POLICY
 *
 *   The token is read only from MARKETAUX_API_TOKEN. It is never printed, never
 *   written to the feed, and is checked against the serialized output before the
 *   atomic rename. The request URL is never logged.
 *
 * Usage:
 *   MARKETAUX_API_TOKEN=... node scripts/fetch-news.mjs
 *   MARKETAUX_API_TOKEN=... node scripts/fetch-news.mjs --dry-run
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  buildNextFeed,
  classifyHttpFailure,
  makeEmptyFeed,
  normalizeProviderArticle,
  redactSecret,
  resolveMarketauxToken,
  serializeNewsFeed,
  validateNewsFeed,
} from '../src/lib/news.ts';

const ROOT = process.cwd();
const FEED_PATH = join(ROOT, 'public', 'data', 'news', 'latest.json');
const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 100;

class PipelineError extends Error {
  constructor(kind, message, exitCode = 1) {
    super(message);
    this.name = 'PipelineError';
    this.kind = kind;
    this.exitCode = exitCode;
  }
}

function log(message) {
  console.log(`[axiora-news] ${message}`);
}

function readFetchLimit() {
  const raw = process.env.NEWS_FETCH_LIMIT ?? String(DEFAULT_LIMIT);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || String(parsed) !== raw.trim() || parsed < 1 || parsed > MAX_LIMIT) {
    throw new PipelineError(
      'config',
      `NEWS_FETCH_LIMIT must be an integer between 1 and ${MAX_LIMIT}.`,
      2,
    );
  }
  return parsed;
}

async function readExistingFeed() {
  if (!existsSync(FEED_PATH)) {
    log('No existing feed; starting from an empty validated feed.');
    return makeEmptyFeed();
  }

  let raw;
  try {
    raw = await readFile(FEED_PATH, 'utf8');
  } catch {
    throw new PipelineError('data', 'Existing feed could not be read; refusing to overwrite it.', 4);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PipelineError(
      'data',
      'Existing feed is not valid JSON; refusing to overwrite the last valid data.',
      4,
    );
  }

  const validation = validateNewsFeed(parsed);
  if (!validation.ok || !validation.feed) {
    const detail = validation.errors.slice(0, 4).join('; ');
    throw new PipelineError(
      'data',
      `Existing feed failed validation; refusing to overwrite it. ${detail}`,
      4,
    );
  }

  return validation.feed;
}

async function fetchMarketaux(token, limit) {
  const params = new URLSearchParams({
    api_token: token,
    language: 'en',
    limit: String(limit),
    page: '1',
    sort: 'published_at',
    sort_order: 'desc',
    group_similar: 'true',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`https://api.marketaux.com/v1/news/all?${params.toString()}`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': 'AXIORA-Intelligence-News/1.0',
      },
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new PipelineError(
      aborted ? 'timeout' : 'network',
      aborted
        ? `Marketaux request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. The last valid feed was preserved.`
        : 'Marketaux request failed before a response was received. The last valid feed was preserved.',
      3,
    );
  } finally {
    clearTimeout(timer);
  }

  const body = await response.text();

  if (!response.ok) {
    const failure = classifyHttpFailure(response.status, response.headers.get('retry-after'));
    throw new PipelineError(failure.kind, failure.message, 3);
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new PipelineError(
      'invalid-response',
      'Marketaux returned a non-JSON response. The last valid feed was preserved.',
      3,
    );
  }

  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.data)) {
    const providerMessage =
      payload && typeof payload === 'object' && typeof payload.error === 'string'
        ? redactSecret(payload.error, token).slice(0, 200)
        : 'response has no data array';
    throw new PipelineError(
      'invalid-response',
      `Marketaux returned an invalid payload (${providerMessage}). The last valid feed was preserved.`,
      3,
    );
  }

  return payload;
}

async function writeFeedAtomically(serialized) {
  await mkdir(dirname(FEED_PATH), { recursive: true });
  const temporaryPath = `${FEED_PATH}.${process.pid}.tmp`;
  await writeFile(temporaryPath, serialized, { encoding: 'utf8', mode: 0o644 });

  try {
    await rename(temporaryPath, FEED_PATH);
  } catch (error) {
    // Windows can refuse a rename over an existing file. Remove and retry only
    // for that specific class; any other failure leaves the original untouched.
    const code = error && typeof error === 'object' ? error.code : undefined;
    if (code === 'EEXIST' || code === 'EPERM' || code === 'EACCES') {
      await rm(FEED_PATH, { force: true });
      await rename(temporaryPath, FEED_PATH);
      return;
    }
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const tokenResult = resolveMarketauxToken(process.env);
  if (!tokenResult.ok) {
    throw new PipelineError('config', tokenResult.error, 2);
  }

  const limit = readFetchLimit();
  const existing = await readExistingFeed();
  const batch = await fetchMarketaux(tokenResult.token, limit);
  const fetchedAt = new Date().toISOString();

  const normalized = [];
  let rejected = 0;
  for (const raw of batch.data) {
    const article = normalizeProviderArticle(raw, { fetchedAt });
    if (article) normalized.push(article);
    else rejected += 1;
  }

  if (batch.data.length > 0 && normalized.length === 0) {
    throw new PipelineError(
      'data',
      `Marketaux returned ${batch.data.length} article(s) but none passed normalization. The last valid feed was preserved.`,
      3,
    );
  }

  if (normalized.length === 0) {
    log(
      `Marketaux returned no articles (provider returned ${batch.data.length}); ` +
        `last valid feed preserved with ${existing.items.length} item(s).`,
    );
    return;
  }

  const next = buildNextFeed(existing, normalized, { fetchedAt });
  if (next === existing) {
    log(
      `No feed change: ${normalized.length} normalised, ${rejected} rejected, ` +
        `${existing.items.length} item(s) retained.`,
    );
    return;
  }

  const serialized = serializeNewsFeed(next);
  if (
    serialized.includes(tokenResult.token) ||
    /api_token=/i.test(serialized) ||
    /MARKETAUX_API_TOKEN/.test(serialized)
  ) {
    throw new PipelineError(
      'data',
      'Refusing to write the feed: credential material was detected in the output.',
      4,
    );
  }

  const validation = validateNewsFeed(next);
  if (!validation.ok || !validation.feed) {
    throw new PipelineError(
      'data',
      `Refusing to write an invalid feed: ${validation.errors.slice(0, 5).join('; ')}`,
      4,
    );
  }

  if (dryRun) {
    log(
      `Dry run: feed would change from ${existing.items.length} to ${next.count} item(s) ` +
        `(${rejected} rejected); no file written.`,
    );
    return;
  }

  await writeFeedAtomically(serialized);
  log(
    `Feed updated: ${existing.items.length} -> ${next.count} item(s); ` +
      `${rejected} provider article(s) rejected.`,
  );
}

main().catch((error) => {
  const message = redactSecret(
    error instanceof Error ? error.message : String(error),
    process.env.MARKETAUX_API_TOKEN,
  );
  const kind = error && typeof error === 'object' && 'kind' in error ? error.kind : 'unexpected';
  const exitCode =
    error && typeof error === 'object' && Number.isInteger(error.exitCode)
      ? error.exitCode
      : 1;
  console.error(`[axiora-news] FAILED (${kind}): ${message}`);
  process.exitCode = exitCode;
});

/**
 * Intelligence News data-layer tests.
 *
 * Authority: user instruction (AXIORA Intelligence News, 2026-10-30),
 *            IMPLEMENTATION_CONTRACT.md Section 6 (verification evidence).
 *
 * These tests use only synthetic fixtures. No Marketaux credential is required
 * and no network request is made.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  NEWS_CATEGORY_LABELS,
  articleHashId,
  articleSearchText,
  buildNextFeed,
  canonicalArticleUrl,
  classifyArticle,
  classifyHttpFailure,
  dedupeArticles,
  filterArticles,
  formatWib,
  formatWibShort,
  makeEmptyFeed,
  matchesQuery,
  newsFeedFreshness,
  normalizeProviderArticle,
  redactSecret,
  resolveMarketauxToken,
  safeExternalUrl,
  serializeNewsFeed,
  stableArticleId,
  validateNewsFeed,
  wibDateKey,
  type NewsArticle,
  type NewsFeed,
} from '../src/lib/news.ts';

import {
  DUPLICATE_BY_FIELDS,
  DUPLICATE_BY_PROVIDER_ID,
  DUPLICATE_BY_URL,
  INVALID_ARTICLES,
  PROVIDER_ARTICLES,
  TEST_FIXTURE_FETCHED_AT,
  TEST_FIXTURE_NOW,
  UNSAFE_IMAGE_ARTICLE,
} from './fixtures/news-fixture.ts';

function normalizedFixture(): NewsArticle[] {
  return PROVIDER_ARTICLES.map((raw) =>
    normalizeProviderArticle(raw, {
      now: TEST_FIXTURE_NOW,
      fetchedAt: TEST_FIXTURE_FETCHED_AT,
    }),
  ).filter((article): article is NewsArticle => article !== null);
}

function fixtureFeed(items: NewsArticle[] = normalizedFixture()): NewsFeed {
  return buildNextFeed(makeEmptyFeed(), items, {
    now: TEST_FIXTURE_NOW,
    fetchedAt: TEST_FIXTURE_FETCHED_AT,
  });
}

function byKeyword(items: NewsArticle[], keyword: string): NewsArticle {
  const found = items.find((item) => item.title.toLowerCase().includes(keyword.toLowerCase()));
  assert.ok(found, `fixture article containing "${keyword}" not found`);
  return found;
}

// ---------------------------------------------------------------------------
// Provider normalisation
// ---------------------------------------------------------------------------

test('normalises every valid fixture article and drops none', () => {
  const articles = normalizedFixture();
  assert.equal(articles.length, PROVIDER_ARTICLES.length);
  for (const article of articles) {
    assert.match(article.id, /^[a-z]+_[A-Za-z0-9_-]{6,80}$/);
    assert.equal(article.attribution.provider, 'Marketaux');
    assert.equal(article.classification.generated, true);
    assert.equal(article.classification.method, 'axiora-rules-v1');
    assert.equal(article.source_domain, 'example.com');
    assert.equal(article.url.includes('utm_'), false);
    assert.equal(article.url.includes('www.'), false);
  }
});

test('normalises HTML fragments to text and never stores markup', () => {
  const fed = byKeyword(normalizedFixture(), 'Federal Reserve');
  assert.ok(fed.description);
  assert.equal(fed.description.includes('<'), false);
  assert.equal(fed.description.includes('>'), false);
  assert.match(fed.description, /central bank/);
  assert.ok(fed.description.length <= 400);
});

test('truncates long descriptions rather than storing article copies', () => {
  const longDescription = 'word '.repeat(300);
  const article = normalizeProviderArticle(
    {
      uuid: '12121212-1212-4212-8212-121212121212',
      title: 'TEST FIXTURE — long description',
      description: longDescription,
      url: 'https://example.com/long-description',
      published_at: '2026-10-30T01:00:00.000Z',
    },
    { now: TEST_FIXTURE_NOW, fetchedAt: TEST_FIXTURE_FETCHED_AT },
  );
  assert.ok(article);
  assert.ok(article.description);
  assert.ok(article.description.length <= 400, 'description must be capped');
  assert.ok(article.description.endsWith('…'), 'truncation must be visible');
});

test('classifies each article internally and deterministically', () => {
  const articles = normalizedFixture();
  assert.equal(byKeyword(articles, 'Federal Reserve').category, 'central-banks');
  assert.equal(byKeyword(articles, 'Gold climbs').category, 'commodities');
  assert.equal(byKeyword(articles, 'Euro slips').category, 'forex');
  assert.equal(byKeyword(articles, 'Brent crude').category, 'commodities');
  assert.equal(byKeyword(articles, 'Stocks end').category, 'markets');
  assert.equal(byKeyword(articles, 'Inflation slows').category, 'macroeconomics');
  assert.equal(byKeyword(articles, 'Election result').category, 'geopolitics');
  assert.equal(byKeyword(articles, 'Company publishes').category, 'general');

  const first = classifyArticle({ title: 'Gold climbs as the dollar softens' });
  const second = classifyArticle({ title: 'Gold climbs as the dollar softens' });
  assert.deepEqual(first, second);
  assert.equal(first.category, 'commodities');
  assert.equal(NEWS_CATEGORY_LABELS[first.category], 'Commodities');
});

test('normalises provider symbols into careful instrument labels', () => {
  const articles = normalizedFixture();
  const gold = byKeyword(articles, 'Gold climbs');
  assert.deepEqual(
    gold.instruments.map((instrument) => instrument.symbol),
    ['XAUUSD', 'DXY'],
  );
  assert.equal(gold.instruments[0].label, 'Gold (XAU/USD)');

  const brent = byKeyword(articles, 'Brent crude');
  assert.deepEqual(
    brent.instruments.map((instrument) => instrument.symbol),
    ['BRENT', 'WTI'],
  );

  const stocks = byKeyword(articles, 'Stocks end');
  assert.deepEqual(
    stocks.instruments.map((instrument) => instrument.symbol),
    ['SPX', 'NDX'],
  );
});

test('keeps the article when only its image URL is unsafe', () => {
  const article = normalizeProviderArticle(UNSAFE_IMAGE_ARTICLE, {
    now: TEST_FIXTURE_NOW,
    fetchedAt: TEST_FIXTURE_FETCHED_AT,
  });
  assert.ok(article, 'unsafe image must not discard valid article text');
  assert.equal(article.image_url, null);
});

test('rejects unsafe links, private hosts, invalid timestamps, and missing titles', () => {
  for (const raw of INVALID_ARTICLES) {
    assert.equal(
      normalizeProviderArticle(raw, {
        now: TEST_FIXTURE_NOW,
        fetchedAt: TEST_FIXTURE_FETCHED_AT,
      }),
      null,
      `expected rejection for ${JSON.stringify(raw.url)}`,
    );
  }
});

test('normalises provider timestamps to one canonical ISO representation', () => {
  const fed = byKeyword(normalizedFixture(), 'Federal Reserve');
  assert.equal(fed.published_at, '2026-10-30T03:32:50.000Z');
  assert.equal(fed.fetched_at, TEST_FIXTURE_FETCHED_AT);
  assert.equal(fed.attribution.retrieved_at, TEST_FIXTURE_FETCHED_AT);
});

test('generates a stable fallback ID when the provider supplies no UUID', () => {
  const raw = {
    uuid: null,
    title: 'TEST FIXTURE — no provider id',
    url: 'https://example.com/no-provider-id?utm_source=one',
    published_at: '2026-10-30T01:00:00.000Z',
  };
  const first = normalizeProviderArticle(raw, {
    now: TEST_FIXTURE_NOW,
    fetchedAt: TEST_FIXTURE_FETCHED_AT,
  });
  const second = normalizeProviderArticle(
    { ...raw, url: 'https://www.example.com/no-provider-id/?utm_source=two' },
    { now: TEST_FIXTURE_NOW, fetchedAt: TEST_FIXTURE_FETCHED_AT },
  );
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.id, second.id);
  assert.equal(first.id, articleHashId('https://example.com/no-provider-id'));
  assert.equal(stableArticleId(null, first.url), first.id);
});

test('canonicalises tracking links without discarding meaningful query parameters', () => {
  assert.equal(
    canonicalArticleUrl('https://www.Example.com/a/?b=2&utm_source=x&a=1#section'),
    'https://example.com/a?a=1&b=2',
  );
  assert.equal(canonicalArticleUrl('javascript:alert(1)'), null);
  assert.equal(canonicalArticleUrl('http://127.0.0.1/a'), null);
  assert.equal(canonicalArticleUrl('https://user:pass@example.com/a'), null);
  assert.equal(canonicalArticleUrl('https://example.com'), 'https://example.com/');
});

test('safeExternalUrl accepts public http(s) and rejects dangerous schemes and hosts', () => {
  assert.equal(safeExternalUrl('https://example.com/a'), 'https://example.com/a');
  assert.equal(safeExternalUrl('http://example.com/a'), 'http://example.com/a');
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'https://localhost/a',
    'https://intranet/a',
    'https://192.168.1.10/a',
    'https://[::1]/a',
    'https://user:pass@example.com/a',
  ]) {
    assert.equal(safeExternalUrl(value), null, `expected rejection: ${value}`);
  }
});

// ---------------------------------------------------------------------------
// Deduplication, retention, and feed assembly
// ---------------------------------------------------------------------------

test('deduplicates by provider ID, canonical URL, and safe field combination', () => {
  const articles = normalizedFixture();
  const providerDuplicate = normalizeProviderArticle(DUPLICATE_BY_PROVIDER_ID, {
    now: TEST_FIXTURE_NOW,
    fetchedAt: TEST_FIXTURE_FETCHED_AT,
  });
  const urlDuplicate = normalizeProviderArticle(DUPLICATE_BY_URL, {
    now: TEST_FIXTURE_NOW,
    fetchedAt: TEST_FIXTURE_FETCHED_AT,
  });
  const fieldDuplicate = normalizeProviderArticle(DUPLICATE_BY_FIELDS, {
    now: TEST_FIXTURE_NOW,
    fetchedAt: TEST_FIXTURE_FETCHED_AT,
  });
  assert.ok(providerDuplicate);
  assert.ok(urlDuplicate);
  assert.ok(fieldDuplicate);

  const deduped = dedupeArticles([...articles, providerDuplicate, urlDuplicate, fieldDuplicate]);
  assert.equal(deduped.length, articles.length);
  assert.equal(new Set(deduped.map((article) => article.id)).size, deduped.length);
  assert.equal(new Set(deduped.map((article) => article.url)).size, deduped.length);
});

test('merges useful fields from a duplicate instead of dropping them', () => {
  const articles = normalizedFixture();
  const gold = byKeyword(articles, 'Gold climbs');
  const duplicate = normalizeProviderArticle(
    {
      ...DUPLICATE_BY_URL,
      snippet: 'A richer syndicated summary mentioning central bank demand.',
      entities: [{ symbol: 'XAG', name: 'Silver', type: 'commodity' }],
    },
    { now: TEST_FIXTURE_NOW, fetchedAt: TEST_FIXTURE_FETCHED_AT },
  );
  assert.ok(duplicate);
  const deduped = dedupeArticles([gold, duplicate]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].snippet, 'A richer syndicated summary mentioning central bank demand.');
});

test('sorts the feed newest first', () => {
  const feed = fixtureFeed();
  for (let index = 1; index < feed.items.length; index += 1) {
    assert.ok(
      feed.items[index - 1].published_at >= feed.items[index].published_at,
      `feed is not newest-first at index ${index}`,
    );
  }
  assert.match(feed.items[0].title, /Federal Reserve/);
});

test('an empty provider batch preserves the last valid feed object', () => {
  const existing = fixtureFeed();
  const next = buildNextFeed(existing, [], {
    now: TEST_FIXTURE_NOW,
    fetchedAt: '2026-10-30T12:30:00.000Z',
  });
  assert.equal(next, existing, 'no-op merge must return the original object');
  assert.equal(next.generated_at, TEST_FIXTURE_FETCHED_AT);
});

test('a duplicate-only provider batch does not change the feed', () => {
  const existing = fixtureFeed();
  const duplicate = normalizeProviderArticle(DUPLICATE_BY_PROVIDER_ID, {
    now: TEST_FIXTURE_NOW,
    fetchedAt: '2026-10-30T12:30:00.000Z',
  });
  assert.ok(duplicate);
  const next = buildNextFeed(existing, [duplicate], {
    now: TEST_FIXTURE_NOW,
    fetchedAt: '2026-10-30T12:30:00.000Z',
  });
  assert.equal(next, existing);
});

test('retention prunes articles older than the configured window', () => {
  const existing = fixtureFeed();
  const later = new Date('2026-11-20T12:00:00Z');
  const next = buildNextFeed(existing, [], {
    now: later,
    fetchedAt: later.toISOString(),
  });
  assert.equal(next.count, 0);
  assert.equal(next.items.length, 0);
  assert.equal(next.generated_at, later.toISOString());
});

test('retention caps the feed at the configured item count', () => {
  const next = buildNextFeed(makeEmptyFeed(), normalizedFixture(), {
    now: TEST_FIXTURE_NOW,
    fetchedAt: TEST_FIXTURE_FETCHED_AT,
    maxItems: 2,
  });
  assert.equal(next.items.length, 2);
  assert.equal(next.count, 2);
  assert.equal(next.retention.max_items, 2);
});

// ---------------------------------------------------------------------------
// WIB presentation
// ---------------------------------------------------------------------------

test('converts UTC to WIB without relying on the host timezone', () => {
  assert.equal(formatWib('2026-10-30T03:32:50.000Z'), '30 Okt 2026, 10.32 WIB');
  assert.equal(formatWibShort('2026-10-30T03:32:50.000Z'), '30 Okt, 10.32 WIB');
  assert.equal(wibDateKey('2026-10-30T03:32:50.000Z'), '2026-10-30');
  assert.equal(formatWib('2026-10-30T18:00:00.000Z'), '31 Okt 2026, 01.00 WIB');
  assert.equal(wibDateKey('2026-10-30T18:00:00.000Z'), '2026-10-31');
  assert.equal(formatWib('not-a-date'), 'Waktu tidak tersedia');
});

// ---------------------------------------------------------------------------
// Search and combined filters
// ---------------------------------------------------------------------------

test('searches headline, publisher, category, entity, and instrument', () => {
  const articles = normalizedFixture();
  const fed = byKeyword(articles, 'Federal Reserve');
  const gold = byKeyword(articles, 'Gold climbs');

  assert.equal(matchesQuery(fed, 'federal reserve'), true);
  assert.equal(matchesQuery(fed, 'example.com'), true);
  assert.equal(matchesQuery(fed, 'central banks'), true);
  assert.equal(matchesQuery(gold, 'XAUUSD'), true);
  assert.equal(matchesQuery(gold, 'dollar index'), true);
  assert.equal(matchesQuery(gold, 'not-present-anywhere'), false);
  assert.ok(articleSearchText(gold).includes('xauusd'));
});

test('combines category and query filters and resets to all items', () => {
  const articles = normalizedFixture();
  assert.equal(filterArticles(articles, { category: 'all' }).length, articles.length);
  assert.equal(filterArticles(articles, { category: 'all', query: '' }).length, articles.length);
  assert.deepEqual(
    filterArticles(articles, { category: 'commodities', query: 'gold' }).map(
      (article) => article.category,
    ),
    ['commodities'],
  );
  assert.equal(filterArticles(articles, { category: 'forex', query: 'gold' }).length, 0);
  assert.ok(filterArticles(articles, { category: 'central-banks' }).length >= 1);
});

// ---------------------------------------------------------------------------
// Feed validation
// ---------------------------------------------------------------------------

test('accepts a valid generated feed and reports empty feeds as valid', () => {
  const feed = fixtureFeed();
  const result = validateNewsFeed(feed);
  assert.equal(result.ok, true, result.errors.join('; '));
  assert.ok(result.feed);
  assert.equal(validateNewsFeed(makeEmptyFeed()).ok, true);
});

test('rejects count mismatches, duplicate IDs, invalid categories, and unsafe URLs', () => {
  const feed = fixtureFeed();
  const cases: Array<[string, (candidate: NewsFeed) => void]> = [
    ['count mismatch', (candidate) => { candidate.count = candidate.count + 1; }],
    ['duplicate ID', (candidate) => { candidate.items[1].id = candidate.items[0].id; }],
    [
      'invalid category',
      (candidate) => { (candidate.items[0] as unknown as { category: string }).category = 'sports'; },
    ],
    [
      'unsafe URL',
      (candidate) => { candidate.items[0].url = 'javascript:alert(1)'; },
    ],
    [
      'missing generated_at',
      (candidate) => { candidate.generated_at = null; },
    ],
    [
      'credential-like key',
      (candidate) => { (candidate as unknown as Record<string, unknown>).api_token = 'x'; },
    ],
    [
      'credential string',
      (candidate) => { candidate.items[0].description = 'api_token=abc123'; },
    ],
  ];

  for (const [name, mutate] of cases) {
    const candidate = structuredClone(feed);
    mutate(candidate);
    const result = validateNewsFeed(candidate);
    assert.equal(result.ok, false, `${name} must be rejected`);
    assert.ok(result.errors.length > 0, `${name} must explain the rejection`);
  }
});

test('rejects feeds that are not newest-first', () => {
  const feed = fixtureFeed();
  const candidate = structuredClone(feed);
  candidate.items.reverse();
  const result = validateNewsFeed(candidate);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('newest-first')));
});

test('serialised feed never contains a token field or credential marker', () => {
  const serialized = serializeNewsFeed(fixtureFeed());
  assert.equal(serialized.includes('api_token'), false);
  assert.equal(serialized.includes('MARKETAUX_API_TOKEN'), false);
  assert.equal(serialized.includes('Bearer '), false);
  assert.equal(serialized.endsWith('\n'), true);
});

// ---------------------------------------------------------------------------
// Failure classification and token handling
// ---------------------------------------------------------------------------

test('classifies authentication, permission, rate-limit, and server failures', () => {
  assert.equal(classifyHttpFailure(401).kind, 'auth');
  assert.equal(classifyHttpFailure(401).retryable, false);
  assert.equal(classifyHttpFailure(403).kind, 'forbidden');
  assert.equal(classifyHttpFailure(429, '120').kind, 'rate-limited');
  assert.equal(classifyHttpFailure(429, '120').retryAfterSeconds, 120);
  assert.equal(classifyHttpFailure(429, '120').retryable, true);
  assert.equal(classifyHttpFailure(500).kind, 'server');
  assert.equal(classifyHttpFailure(503).retryable, true);
  assert.equal(classifyHttpFailure(418).kind, 'provider');
});

test('redacts token values and api_token query parameters from diagnostics', () => {
  const secret = 'secret-token-value-123';
  assert.equal(
    redactSecret(`failed https://api.marketaux.com?api_token=${secret}`, secret),
    'failed https://api.marketaux.com?api_token=[redacted]',
  );
  assert.equal(redactSecret('api_token=abc&language=en'), 'api_token=[redacted]&language=en');
});

test('requires a non-empty, plausible MARKETAUX_API_TOKEN', () => {
  assert.equal(resolveMarketauxToken({}).ok, false);
  assert.equal(resolveMarketauxToken({ MARKETAUX_API_TOKEN: '   ' }).ok, false);
  assert.equal(resolveMarketauxToken({ MARKETAUX_API_TOKEN: 'short' }).ok, false);
  const result = resolveMarketauxToken({ MARKETAUX_API_TOKEN: 'a'.repeat(32) });
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// Freshness states
// ---------------------------------------------------------------------------

test('reports empty, fresh, and stale feed states', () => {
  assert.equal(newsFeedFreshness(makeEmptyFeed(), TEST_FIXTURE_NOW), 'empty');
  assert.equal(newsFeedFreshness(fixtureFeed(), TEST_FIXTURE_NOW), 'fresh');
  const stale = fixtureFeed();
  assert.equal(
    newsFeedFreshness(stale, new Date('2026-10-31T12:00:00Z')),
    'stale',
  );
});

// ---------------------------------------------------------------------------
// Rendered-source contracts
// ---------------------------------------------------------------------------

test('news cards explicitly suppress author display when hidden', () => {
  // Regression: `.axf-news-card { display: flex }` overrides the UA `[hidden]`
  // rule, so filtering changed `hidden` without actually hiding the card.
  const page = readFileSync(new URL('../src/pages/news/index.astro', import.meta.url), 'utf8');
  assert.match(page, /\.axf-news-grid\[hidden\][\s\S]*?display:\s*none/);
  assert.match(page, /\.axf-news-card\[hidden\][\s\S]*?display:\s*none/);
});

test('news client script does not fetch, inject markup, or carry credentials', () => {
  const source = readFileSync(new URL('../public/scripts/news.js', import.meta.url), 'utf8');
  // Comments explain the prohibition; only executable code is asserted.
  const script = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/\bfetch\s*\(/.test(script), false, 'client must not fetch');
  assert.equal(/XMLHttpRequest/.test(script), false, 'client must not use XHR');
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML/.test(script), false, 'client must not inject markup');
  assert.equal(/MARKETAUX_API_TOKEN|api_token/i.test(script), false, 'client must not know the token');
});

test('news page never renders raw provider HTML', () => {
  const page = readFileSync(new URL('../src/pages/news/index.astro', import.meta.url), 'utf8');
  assert.equal(/dangerouslySetInnerHTML|set:html/.test(page), false);
});

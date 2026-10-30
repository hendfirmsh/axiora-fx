/**
 * TEST FIXTURE — SYNTHETIC NEWS PAYLOADS.
 *
 * Every headline below is deliberately prefixed "TEST FIXTURE" and every URL
 * uses example.com. Nothing in this file is real news, a real publisher, or a
 * real Marketaux response. It exists only to exercise the normalisation,
 * classification, deduplication, and validation rules in automated tests.
 *
 * DO NOT import this file from a page, script, or production data path.
 */

export const TEST_FIXTURE_NOW = new Date('2026-10-30T12:00:00Z');
export const TEST_FIXTURE_FETCHED_AT = '2026-10-30T12:00:00.000Z';

export const PROVIDER_ARTICLES = [
  {
    uuid: '11111111-1111-4111-8111-111111111111',
    title: 'TEST FIXTURE — Federal Reserve holds policy rate steady',
    description:
      '<p>The <strong>central bank</strong> kept its policy rate unchanged and said inflation remains elevated.</p>',
    snippet: 'Policymakers held the benchmark rate and signalled patience.',
    source: 'example.com',
    language: 'en',
    published_at: '2026-10-30T03:32:50.000000Z',
    url: 'https://www.example.com/markets/fed-holds-policy-rate?utm_source=test&utm_medium=feed',
    image_url: 'https://images.example.com/fed.jpg',
    entities: [
      { symbol: 'USD', name: 'US Dollar', type: 'currency' },
      { symbol: 'FOMC', name: 'Federal Open Market Committee', type: 'other' },
    ],
  },
  {
    uuid: '22222222-2222-4222-8222-222222222222',
    title: 'TEST FIXTURE — Gold climbs as the dollar softens',
    description:
      '<p>Bullion advanced as the dollar index retreated and real yields eased.</p>',
    snippet: 'Gold rose while the dollar index moved lower.',
    source: 'example.com',
    language: 'en',
    published_at: '2026-10-30T02:10:00.000Z',
    url: 'https://example.com/commodities/gold-climbs',
    image_url: null,
    entities: [
      { symbol: 'XAUUSD', name: 'Gold Spot', type: 'commodity' },
      { symbol: 'DXY', name: 'US Dollar Index', type: 'currency' },
    ],
  },
  {
    uuid: '33333333-3333-4333-8333-333333333333',
    title: 'TEST FIXTURE — Euro slips as the dollar firms',
    description: '<p>The euro weakened in foreign exchange trading.</p>',
    snippet: 'EUR/USD moved lower.',
    source: 'example.com',
    language: 'en',
    published_at: '2026-10-30T01:15:00.000Z',
    url: 'https://example.com/forex/euro-slips',
    image_url: null,
    entities: [
      { symbol: 'EUR', name: 'Euro', type: 'currency' },
      { symbol: 'USD', name: 'US Dollar', type: 'currency' },
    ],
  },
  {
    uuid: '44444444-4444-4444-8444-444444444444',
    title: 'TEST FIXTURE — Brent crude rises on supply concerns',
    description: '<p>Oil prices advanced after reports of tighter supply.</p>',
    snippet: 'Brent and WTI both moved higher.',
    source: 'example.com',
    language: 'en',
    published_at: '2026-10-29T22:45:00.000Z',
    url: 'https://example.com/energy/brent-rises',
    image_url: null,
    entities: [
      { symbol: 'BRENT', name: 'Brent Crude', type: 'commodity' },
      { symbol: 'WTI', name: 'WTI Crude', type: 'commodity' },
    ],
  },
  {
    uuid: '55555555-5555-4555-8555-555555555555',
    title: 'TEST FIXTURE — Stocks end higher on Wall Street',
    description: '<p>Equities advanced as bond yields stabilised.</p>',
    snippet: 'The S&P 500 and Nasdaq finished in positive territory.',
    source: 'example.com',
    language: 'en',
    published_at: '2026-10-29T21:05:00.000Z',
    url: 'https://example.com/markets/stocks-end-higher',
    image_url: null,
    entities: [
      { symbol: 'SPX', name: 'S&P 500', type: 'index' },
      { symbol: 'NDX', name: 'Nasdaq 100', type: 'index' },
    ],
  },
  {
    uuid: '66666666-6666-4666-8666-666666666666',
    title: 'TEST FIXTURE — Inflation slows as CPI eases',
    description: '<p>Consumer prices rose less than expected, data showed.</p>',
    snippet: 'The CPI report pointed to slower inflation.',
    source: 'example.com',
    language: 'en',
    published_at: '2026-10-29T18:30:00.000Z',
    url: 'https://example.com/economy/inflation-slows',
    image_url: null,
    entities: [],
  },
  {
    uuid: '77777777-7777-4777-8777-777777777777',
    title: 'TEST FIXTURE — Election result raises tariff uncertainty',
    description: '<p>A contested election outcome renewed trade war concerns.</p>',
    snippet: 'Sanctions and tariffs remain in focus.',
    source: 'example.com',
    language: 'en',
    published_at: '2026-10-29T16:20:00.000Z',
    url: 'https://example.com/world/election-tariff',
    image_url: null,
    entities: [],
  },
  {
    uuid: '88888888-8888-4888-8888-888888888888',
    title: 'TEST FIXTURE — Company publishes annual report',
    description: '<p>The company released its annual report.</p>',
    snippet: null,
    source: 'example.com',
    language: 'en',
    published_at: '2026-10-29T14:00:00.000Z',
    url: 'https://example.com/companies/annual-report',
    image_url: null,
    entities: [],
  },
] as const;

/** Same provider UUID as article 1, with a newer title and one added field. */
export const DUPLICATE_BY_PROVIDER_ID = {
  uuid: '11111111-1111-4111-8111-111111111111',
  title: 'TEST FIXTURE — Federal Reserve holds policy rate steady (updated)',
  description: null,
  snippet: 'Updated snippet for the same provider record.',
  source: 'example.com',
  language: 'en',
  published_at: '2026-10-30T03:45:00.000Z',
  url: 'https://example.com/markets/fed-holds-updated',
  image_url: null,
  entities: [],
};

/** Same canonical URL as article 2, reached through a tracking link. */
export const DUPLICATE_BY_URL = {
  uuid: null,
  title: 'TEST FIXTURE — Gold climbs as the dollar softens (syndicated)',
  description: null,
  snippet: null,
  source: 'example.com',
  language: 'en',
  published_at: '2026-10-30T02:12:00.000Z',
  url: 'https://www.example.com/commodities/gold-climbs/?utm_campaign=syndication',
  image_url: null,
  entities: [],
};

/** Same title, publisher, and day as article 3, but a different URL. */
export const DUPLICATE_BY_FIELDS = {
  uuid: null,
  title: 'TEST FIXTURE — Euro slips as the dollar firms',
  description: null,
  snippet: 'A syndicated copy without a shared URL.',
  source: 'example.com',
  language: 'en',
  published_at: '2026-10-30T01:45:00.000Z',
  url: 'https://example.com/forex/euro-slips-copy',
  image_url: null,
  entities: [],
};

export const INVALID_ARTICLES = [
  {
    uuid: '99999999-9999-4999-8999-999999999999',
    title: 'TEST FIXTURE — unsafe link',
    url: 'javascript:alert(1)',
    published_at: '2026-10-30T01:00:00.000Z',
  },
  {
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'TEST FIXTURE — invalid timestamp',
    url: 'https://example.com/invalid-time',
    published_at: 'not-a-date',
  },
  {
    uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    title: '',
    url: 'https://example.com/missing-title',
    published_at: '2026-10-30T01:00:00.000Z',
  },
  {
    uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    title: 'TEST FIXTURE — future timestamp',
    url: 'https://example.com/future-time',
    published_at: '2026-10-31T12:00:00.000Z',
  },
  {
    uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    title: 'TEST FIXTURE — private host',
    url: 'http://127.0.0.1/internal-article',
    published_at: '2026-10-30T01:00:00.000Z',
  },
];

export const UNSAFE_IMAGE_ARTICLE = {
  uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  title: 'TEST FIXTURE — image URL is unsafe',
  description: 'The article itself is valid; only its image is unsafe.',
  snippet: null,
  source: 'example.com',
  language: 'en',
  published_at: '2026-10-30T00:30:00.000Z',
  url: 'https://example.com/image-unsafe',
  image_url: 'javascript:alert(1)',
  entities: [],
};

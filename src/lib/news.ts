/**
 * AXIORA Intelligence News — provider-independent feed contract and pure logic.
 *
 * Authority: user instruction (AXIORA Intelligence News, 2026-10-30),
 *            IMPLEMENTATION_CONTRACT.md Sections 5–7 (static-first, no backend,
 *            no fabricated data, source and attribution discipline),
 *            02.8_Content_Architecture (source and correction standards).
 *
 * WHAT THIS MODULE IS
 *
 * Pure functions only: provider payload validation, normalisation, stable IDs,
 * canonical URLs, deduplication, retention, internal category classification,
 * instrument normalisation, WIB formatting, search, and feed validation.
 *
 * It is deliberately free of Astro, browser, and network APIs so it can be
 * exercised with `node --test` and reused by the GitHub Actions fetcher.
 *
 * DATA DISCIPLINE
 *
 *   - A provider article that cannot be validated is dropped, never repaired
 *     with invented values.
 *   - Titles are never rewritten. Descriptions and snippets are capped because
 *     they are excerpts, not reproductions of the article.
 *   - Every category is generated INTERNALLY by AXIORA rules and is marked
 *     `classification.generated = true`. The publisher did not assign it.
 *   - An image URL is retained only if it is a safe public http(s) URL. The
 *     reader page does not render provider images, so a missing or broken image
 *     can never fabricate a visual.
 */

export const NEWS_SCHEMA_VERSION = 1;
export const NEWS_RETENTION_DAYS = 7;
export const NEWS_MAX_ITEMS = 120;
export const NEWS_STALE_HOURS = 6;
export const NEWS_MAX_TITLE_LENGTH = 500;
export const NEWS_MAX_DESCRIPTION_LENGTH = 400;
export const NEWS_MAX_SNIPPET_LENGTH = 280;
export const NEWS_MAX_ENTITIES = 8;
export const NEWS_MAX_INSTRUMENTS = 6;
export const NEWS_FUTURE_TOLERANCE_MS = 6 * 60 * 60 * 1000;

export const NEWS_PROVIDER = {
  id: 'marketaux',
  name: 'Marketaux',
  url: 'https://www.marketaux.com/',
  endpoint: 'https://api.marketaux.com/v1/news/all',
} as const;

export const NEWS_ATTRIBUTION_NOTICE =
  'Judul, ringkasan, dan tautan disediakan oleh Marketaux dan penerbit aslinya. ' +
  'Hak cipta tetap pada penerbit. AXIORA tidak menyalin artikel penuh dan tidak ' +
  'mengubah judul. Kategori adalah klasifikasi otomatis AXIORA, bukan klasifikasi penerbit.';

export const NEWS_CATEGORIES = [
  { id: 'central-banks', label: 'Central Banks' },
  { id: 'macroeconomics', label: 'Macroeconomics' },
  { id: 'forex', label: 'Forex & Currencies' },
  { id: 'commodities', label: 'Commodities' },
  { id: 'geopolitics', label: 'Geopolitics' },
  { id: 'markets', label: 'Financial Markets' },
  { id: 'general', label: 'General Financial News' },
] as const;

export type NewsCategoryId = (typeof NEWS_CATEGORIES)[number]['id'];

export const NEWS_CATEGORY_IDS: readonly NewsCategoryId[] = NEWS_CATEGORIES.map(
  (category) => category.id,
);

export const NEWS_CATEGORY_LABELS: Record<NewsCategoryId, string> = Object.fromEntries(
  NEWS_CATEGORIES.map((category) => [category.id, category.label]),
) as Record<NewsCategoryId, string>;

export type NewsEntityType =
  | 'currency'
  | 'commodity'
  | 'index'
  | 'equity'
  | 'crypto'
  | 'etf'
  | 'other';

export interface NewsEntity {
  symbol: string | null;
  name: string | null;
  type: NewsEntityType;
}

export interface NewsInstrument {
  symbol: string;
  label: string;
  type: NewsEntityType;
}

export interface NewsClassification {
  method: 'axiora-rules-v1';
  generated: true;
  confidence: number;
  basis: string;
}

export interface NewsAttribution {
  provider: 'Marketaux';
  publisher: string;
  source_url: string;
  retrieved_at: string;
}

export interface NewsArticle {
  id: string;
  provider_id: string | null;
  title: string;
  description: string | null;
  snippet: string | null;
  source: string;
  source_domain: string;
  url: string;
  image_url: string | null;
  published_at: string;
  fetched_at: string;
  category: NewsCategoryId;
  classification: NewsClassification;
  entities: NewsEntity[];
  instruments: NewsInstrument[];
  language: string | null;
  attribution: NewsAttribution;
}

export interface NewsFeed {
  schema_version: 1;
  provider: {
    id: 'marketaux';
    name: 'Marketaux';
    url: string;
    endpoint: string;
  };
  generated_at: string | null;
  retention: {
    days: number;
    max_items: number;
  };
  attribution: {
    provider: 'Marketaux';
    provider_url: string;
    notice: string;
  };
  count: number;
  items: NewsArticle[];
}

export interface NewsFeedValidation {
  ok: boolean;
  errors: string[];
  feed: NewsFeed | null;
}

export interface NormalizeArticleOptions {
  /** One timestamp shared by every article in a fetch batch. */
  fetchedAt?: string;
  /** Injectable clock, used by tests and future validation. */
  now?: Date;
}

export interface ClassifyInput {
  title: string;
  description?: string | null;
  snippet?: string | null;
  entities?: NewsEntity[];
}

export interface ClassificationResult {
  category: NewsCategoryId;
  classification: NewsClassification;
}

export interface BuildFeedOptions {
  fetchedAt?: string;
  now?: Date;
  retentionDays?: number;
  maxItems?: number;
}

export type NewsHttpFailureKind =
  | 'auth'
  | 'forbidden'
  | 'rate-limited'
  | 'server'
  | 'provider'
  | 'network'
  | 'timeout'
  | 'invalid-response'
  | 'config'
  | 'data';

export interface NewsHttpFailure {
  kind: NewsHttpFailureKind;
  retryable: boolean;
  message: string;
  retryAfterSeconds: number | null;
}

// ---------------------------------------------------------------------------
// Basic guards and text hygiene
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  rdquo: '”',
  rsquo: '’',
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    })
    .replace(/&#(\d+);/g, (match, digits: string) => {
      const code = Number.parseInt(digits, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

/**
 * Normalise a provider string for display.
 *
 * Provider payloads occasionally contain inline HTML entities or fragments.
 * AXIORA stores text, never markup. Angle brackets are removed rather than
 * escaped because every consumer renders text through Astro's auto-escaping;
 * keeping a tag here would only preserve an injection attempt as inert data.
 */
export function cleanText(value: unknown, maxLength: number, truncate = true): string | null {
  if (typeof value !== 'string') return null;
  let text = decodeEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return null;
  if (text.length > maxLength) {
    if (!truncate) return null;
    text = `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
  }
  return text;
}

export function parseTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  const millis = Date.parse(text);
  if (!Number.isFinite(millis)) return null;
  return new Date(millis).toISOString();
}

export function normalizeLanguage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(text) ? text : null;
}

// ---------------------------------------------------------------------------
// URL safety and canonicalisation
// ---------------------------------------------------------------------------

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'igshid',
  'ref',
  'ref_src',
  'referrer',
  'source',
  'spm',
  'yclid',
  '_ga',
]);

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower);
}

function isPrivateIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '::' || host === '::1') return true;
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true;
  if (isPrivateIpv4(host)) return true;
  return false;
}

/**
 * Validate a public external URL.
 *
 * `javascript:`, `data:`, credentials-in-URL, private hosts, and single-label
 * intranet hosts are rejected. The reader never receives an unsafe href.
 */
export function safeExternalUrl(value: unknown, allowedProtocols: readonly string[] = ['https:', 'http:']): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > 2048) return null;

  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return null;
  }

  if (!allowedProtocols.includes(parsed.protocol)) return null;
  if (parsed.username || parsed.password) return null;

  const host = parsed.hostname.toLowerCase();
  if (!host || isPrivateHostname(host)) return null;
  // A public article host must be a domain or an IP literal. Reject intranet
  // single-label hosts such as http://wiki/.
  if (!host.includes('.') && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) && !host.startsWith('[')) {
    return null;
  }

  parsed.hash = '';
  parsed.hostname = host;
  return parsed.toString();
}

/**
 * Canonical article URL used for deduplication.
 *
 * Removes fragments, `www.`, tracking parameters, and trailing slashes so the
 * same article reached through a campaign link is one record. Non-tracking query
 * parameters are preserved because many publishers put the article ID there.
 */
export function canonicalArticleUrl(value: unknown): string | null {
  const safe = safeExternalUrl(value);
  if (!safe) return null;

  const parsed = new URL(safe);
  parsed.hostname = parsed.hostname.replace(/^www\./, '');

  const entries = [...parsed.searchParams.entries()]
    .filter(([key]) => !isTrackingParam(key))
    .sort(([aKey, aValue], [bKey, bValue]) => {
      const keyOrder = aKey.localeCompare(bKey);
      return keyOrder !== 0 ? keyOrder : aValue.localeCompare(bValue);
    });

  parsed.search = '';
  for (const [key, entryValue] of entries) parsed.searchParams.append(key, entryValue);

  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  if (!parsed.pathname) parsed.pathname = '/';

  return parsed.toString();
}

export function hostnameOf(value: unknown): string {
  const safe = safeExternalUrl(value);
  if (!safe) return '';
  return new URL(safe).hostname.toLowerCase().replace(/^www\./, '');
}

/** Images are retained only as https URLs and are never rendered by the UI. */
export function safeImageUrl(value: unknown): string | null {
  const safe = safeExternalUrl(value, ['https:']);
  return safe;
}

// ---------------------------------------------------------------------------
// Stable IDs
// ---------------------------------------------------------------------------

function normalizeProviderId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9_-]{5,79}$/.test(text) ? text : null;
}

function hash32(input: string, seed: number): string {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Stable across processes and runs; no database sequence is involved. */
export function articleHashId(canonicalUrl: string): string {
  return `url_${hash32(canonicalUrl, 2166136261)}${hash32(canonicalUrl, 2246822519)}`;
}

export function stableArticleId(providerId: string | null, canonicalUrl: string): string {
  return providerId ? `mtx_${providerId}` : articleHashId(canonicalUrl);
}

// ---------------------------------------------------------------------------
// Entities, instruments, and classification
// ---------------------------------------------------------------------------

const ENTITY_TYPES = new Set<NewsEntityType>([
  'currency',
  'commodity',
  'index',
  'equity',
  'crypto',
  'etf',
  'other',
]);

function normalizeEntityType(value: unknown): NewsEntityType {
  if (typeof value !== 'string') return 'other';
  const text = value.trim().toLowerCase();
  if (text === 'stock' || text === 'stocks') return 'equity';
  if (text === 'cryptocurrency' || text === 'coin') return 'crypto';
  if (text === 'forex' || text === 'fx') return 'currency';
  return ENTITY_TYPES.has(text as NewsEntityType) ? (text as NewsEntityType) : 'other';
}

function normalizeEntities(value: unknown): NewsEntity[] {
  if (!Array.isArray(value)) return [];
  const entities: NewsEntity[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!isRecord(item)) continue;
    const symbol = cleanText(item.symbol, 40, false);
    const name = cleanText(item.name, 120, false);
    if (!symbol && !name) continue;

    const type = normalizeEntityType(item.type);
    const key = `${symbol ?? ''}|${name ?? ''}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    entities.push({ symbol, name, type });
    if (entities.length >= NEWS_MAX_ENTITIES) break;
  }

  return entities;
}

interface InstrumentAlias {
  symbol: string;
  label: string;
  type: NewsEntityType;
}

const INSTRUMENT_ALIASES: Record<string, InstrumentAlias> = {
  XAUUSD: { symbol: 'XAUUSD', label: 'Gold (XAU/USD)', type: 'commodity' },
  XAU: { symbol: 'XAUUSD', label: 'Gold (XAU/USD)', type: 'commodity' },
  GOLD: { symbol: 'XAUUSD', label: 'Gold (XAU/USD)', type: 'commodity' },
  DXY: { symbol: 'DXY', label: 'US Dollar Index', type: 'currency' },
  USDX: { symbol: 'DXY', label: 'US Dollar Index', type: 'currency' },
  USD: { symbol: 'USD', label: 'US Dollar', type: 'currency' },
  USDOLLAR: { symbol: 'USD', label: 'US Dollar', type: 'currency' },
  DOLLAR: { symbol: 'USD', label: 'US Dollar', type: 'currency' },
  EUR: { symbol: 'EUR', label: 'Euro', type: 'currency' },
  EURO: { symbol: 'EUR', label: 'Euro', type: 'currency' },
  EURUSD: { symbol: 'EURUSD', label: 'EUR/USD', type: 'currency' },
  GBP: { symbol: 'GBP', label: 'British Pound', type: 'currency' },
  POUND: { symbol: 'GBP', label: 'British Pound', type: 'currency' },
  POUNDSTERLING: { symbol: 'GBP', label: 'British Pound', type: 'currency' },
  STERLING: { symbol: 'GBP', label: 'British Pound', type: 'currency' },
  GBPUSD: { symbol: 'GBPUSD', label: 'GBP/USD', type: 'currency' },
  JPY: { symbol: 'JPY', label: 'Japanese Yen', type: 'currency' },
  YEN: { symbol: 'JPY', label: 'Japanese Yen', type: 'currency' },
  JAPANESEYEN: { symbol: 'JPY', label: 'Japanese Yen', type: 'currency' },
  USDJPY: { symbol: 'USDJPY', label: 'USD/JPY', type: 'currency' },
  WTI: { symbol: 'WTI', label: 'WTI Crude Oil', type: 'commodity' },
  CRUDE: { symbol: 'WTI', label: 'WTI Crude Oil', type: 'commodity' },
  CRUDEOIL: { symbol: 'WTI', label: 'WTI Crude Oil', type: 'commodity' },
  OIL: { symbol: 'OIL', label: 'Oil', type: 'commodity' },
  BRENT: { symbol: 'BRENT', label: 'Brent Crude Oil', type: 'commodity' },
  BRENTCRUDE: { symbol: 'BRENT', label: 'Brent Crude Oil', type: 'commodity' },
  SPX: { symbol: 'SPX', label: 'S&P 500', type: 'index' },
  SP500: { symbol: 'SPX', label: 'S&P 500', type: 'index' },
  GSPC: { symbol: 'SPX', label: 'S&P 500', type: 'index' },
  NDX: { symbol: 'NDX', label: 'Nasdaq 100', type: 'index' },
  NASDAQ: { symbol: 'NDX', label: 'Nasdaq 100', type: 'index' },
  IXIC: { symbol: 'IXIC', label: 'Nasdaq Composite', type: 'index' },
  DJI: { symbol: 'DJI', label: 'Dow Jones Industrial Average', type: 'index' },
  DJIA: { symbol: 'DJI', label: 'Dow Jones Industrial Average', type: 'index' },
  DOWJONES: { symbol: 'DJI', label: 'Dow Jones Industrial Average', type: 'index' },
  IHSG: { symbol: 'IHSG', label: 'Jakarta Composite (IHSG)', type: 'index' },
  JKSE: { symbol: 'IHSG', label: 'Jakarta Composite (IHSG)', type: 'index' },
  VIX: { symbol: 'VIX', label: 'CBOE Volatility Index', type: 'index' },
  BTC: { symbol: 'BTC', label: 'Bitcoin', type: 'crypto' },
  BITCOIN: { symbol: 'BTC', label: 'Bitcoin', type: 'crypto' },
  BTCUSD: { symbol: 'BTC', label: 'Bitcoin', type: 'crypto' },
  ETH: { symbol: 'ETH', label: 'Ethereum', type: 'crypto' },
  ETHEREUM: { symbol: 'ETH', label: 'Ethereum', type: 'crypto' },
};

/** Normalise one provider symbol or display name. Unrecognised values are ignored. */
export function normalizeInstrument(value: unknown): NewsInstrument | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (!upper) return null;
  const compact = upper.replace(/[^A-Z0-9]/g, '');
  const alias =
    INSTRUMENT_ALIASES[upper] ??
    INSTRUMENT_ALIASES[compact] ??
    // Providers occasionally decorate symbols with exchange suffixes.
    INSTRUMENT_ALIASES[compact.replace(/^(?:\^|.*:)/, '').replace(/(?:US|NASDAQ|NYSE)$/, '')];
  return alias ? { ...alias } : null;
}

function instrumentsFromEntities(entities: NewsEntity[]): NewsInstrument[] {
  const instruments: NewsInstrument[] = [];
  const seen = new Set<string>();

  for (const entity of entities) {
    for (const candidate of [entity.symbol, entity.name]) {
      if (!candidate) continue;
      const instrument = normalizeInstrument(candidate);
      if (!instrument || seen.has(instrument.symbol)) continue;
      seen.add(instrument.symbol);
      instruments.push(instrument);
      if (instruments.length >= NEWS_MAX_INSTRUMENTS) return instruments;
    }
  }

  return instruments;
}

const CATEGORY_KEYWORDS: Record<Exclude<NewsCategoryId, 'general'>, readonly string[]> = {
  'central-banks': [
    'federal reserve',
    'fed',
    'fomc',
    'powell',
    'ecb',
    'lagarde',
    'bank of england',
    'boe',
    'bailey',
    'bank of japan',
    'boj',
    'ueda',
    'pboc',
    'peoples bank of china',
    'rba',
    'reserve bank of australia',
    'rbnz',
    'snb',
    'central bank',
    'central banks',
    'monetary policy',
    'interest rate',
    'rate cut',
    'rate hike',
    'rate decision',
    'policy rate',
    'quantitative easing',
    'tightening',
    'hawkish',
    'dovish',
  ],
  macroeconomics: [
    'inflation',
    'cpi',
    'consumer price',
    'producer price',
    'ppi',
    'gdp',
    'gross domestic product',
    'unemployment',
    'jobless',
    'payroll',
    'nonfarm',
    'nfp',
    'pmi',
    'retail sales',
    'industrial production',
    'trade balance',
    'current account',
    'fiscal',
    'budget deficit',
    'debt ceiling',
    'recession',
    'economic growth',
    'employment',
    'wage growth',
    'consumer confidence',
    'business confidence',
    'housing starts',
    'durable goods',
  ],
  forex: [
    'forex',
    'foreign exchange',
    'currency',
    'currencies',
    'exchange rate',
    'dollar',
    'euro',
    'pound',
    'sterling',
    'yen',
    'yuan',
    'renminbi',
    'aussie dollar',
    'loonie',
    'kiwi dollar',
    'swiss franc',
    'rupiah',
    'dollar index',
    'usd',
    'eur',
    'gbp',
    'jpy',
    'cny',
    'aud',
    'cad',
    'nzd',
    'chf',
    'idr',
  ],
  commodities: [
    'gold',
    'silver',
    'copper',
    'oil',
    'crude',
    'brent',
    'wti',
    'opec',
    'natural gas',
    'commodity',
    'commodities',
    'mining',
    'energy prices',
    'wheat',
    'corn',
    'soybean',
    'palm oil',
    'nickel',
    'aluminium',
    'aluminum',
    'iron ore',
    'coal',
  ],
  geopolitics: [
    'geopolitics',
    'geopolitical',
    'war',
    'conflict',
    'military',
    'missile',
    'sanctions',
    'tariff',
    'tariffs',
    'trade war',
    'election',
    'elections',
    'coup',
    'protest',
    'border dispute',
    'nato',
    'ukraine',
    'russia',
    'taiwan',
    'middle east',
    'israel',
    'iran',
    'hamas',
    'red sea',
    'strait of hormuz',
    'political uncertainty',
  ],
  markets: [
    'stock',
    'stocks',
    'equity',
    'equities',
    'shares',
    'bond',
    'bonds',
    'yield',
    'yields',
    'treasury',
    'treasuries',
    'index',
    'indices',
    'nasdaq',
    's&p',
    'dow',
    'wall street',
    'market',
    'markets',
    'investor',
    'investors',
    'ipo',
    'earnings',
    'merger',
    'acquisition',
    'buyback',
    'dividend',
    'volatility',
    'vix',
    'bitcoin',
    'crypto',
    'etf',
    'fund',
    'portfolio',
    'credit spread',
    'default',
    'banking',
  ],
};

const STRONG_TITLE_KEYWORDS = new Set([
  // Subject nouns that identify the story even when a currency or market word
  // also appears in the headline: "Gold climbs as the dollar softens".
  'gold',
  'silver',
  'copper',
  'oil',
  'crude',
  'brent',
  'wti',
  'opec',
  'natural gas',
  'commodity',
  'commodities',
  'wheat',
  'corn',
  'soybean',
  'palm oil',
  'nickel',
  'aluminium',
  'aluminum',
  'iron ore',
  'coal',
  'federal reserve',
  'fed',
  'fomc',
  'ecb',
  'bank of england',
  'boe',
  'bank of japan',
  'boj',
  'pboc',
  'rba',
  'rbnz',
  'snb',
  'central bank',
  'monetary policy',
  'rate cut',
  'rate hike',
  'policy rate',
  'interest rate',
  'inflation',
  'cpi',
  'gdp',
  'unemployment',
  'payroll',
  'pmi',
  'retail sales',
  'recession',
  'forex',
  'currency',
  'currencies',
  'exchange rate',
  'euro',
  'yen',
  'pound',
  'sterling',
  'yuan',
  'renminbi',
  'rupiah',
  'war',
  'sanctions',
  'tariff',
  'tariffs',
  'election',
  'conflict',
  'military',
  'missile',
  'coup',
  'trade war',
  'stocks',
  'stock',
  'equities',
  'equity',
  'shares',
  'bonds',
  'yields',
  'treasury',
  'nasdaq',
  's&p',
  'dow',
  'wall street',
  'bitcoin',
  'crypto',
]);

function keywordPattern(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'gi');
}

function hasKeyword(haystack: string, keyword: string): boolean {
  // Presence, not frequency: a repeated word must not decide the category, and
  // overlapping phrases such as "dollar" and "dollar index" must not double-count.
  return keywordPattern(keyword).test(haystack);
}

function normalizeKeywordText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Internal category classification.
 *
 * This is a deterministic rule set, not a factual claim by the publisher. The
 * reader page states that the category is AXIORA-generated. Ties are resolved by
 * a fixed priority so the same article always receives the same category.
 */
export function classifyArticle(input: ClassifyInput): ClassificationResult {
  const title = normalizeKeywordText(input.title);
  const body = normalizeKeywordText(
    [input.description ?? '', input.snippet ?? '', ...(input.entities ?? []).flatMap((entity) => [entity.name ?? '', entity.symbol ?? ''])].join(' '),
  );

  const scores: Record<NewsCategoryId, number> = {
    'central-banks': 0,
    macroeconomics: 0,
    forex: 0,
    commodities: 0,
    geopolitics: 0,
    markets: 0,
    general: 0,
  };

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<
    [Exclude<NewsCategoryId, 'general'>, readonly string[]]
  >) {
    for (const keyword of keywords) {
      // A title hit carries three times the weight of a body mention; a strong
      // subject noun in the headline carries five.
      if (hasKeyword(title, keyword)) {
        scores[category] += STRONG_TITLE_KEYWORDS.has(keyword) ? 5 : 3;
      }
      if (hasKeyword(body, keyword)) scores[category] += 1;
    }
  }

  for (const entity of input.entities ?? []) {
    if (entity.type === 'currency') scores.forex += 1;
    if (entity.type === 'commodity') scores.commodities += 1;
    if (entity.type === 'index' || entity.type === 'equity' || entity.type === 'etf') scores.markets += 1;
    if (entity.type === 'crypto') scores.markets += 1;
  }

  const priority: readonly NewsCategoryId[] = [
    'central-banks',
    'geopolitics',
    'commodities',
    'forex',
    'macroeconomics',
    'markets',
  ];

  let category: NewsCategoryId = 'general';
  let bestScore = 0;
  for (const candidate of priority) {
    if (scores[candidate] > bestScore) {
      category = candidate;
      bestScore = scores[candidate];
    }
  }

  const confidence =
    bestScore === 0
      ? 0.2
      : Math.min(0.95, Math.round((0.35 + bestScore * 0.07) * 100) / 100);

  return {
    category,
    classification: {
      method: 'axiora-rules-v1',
      generated: true,
      confidence,
      basis: 'title+summary+entities',
    },
  };
}

// ---------------------------------------------------------------------------
// Provider normalisation
// ---------------------------------------------------------------------------

export function normalizeProviderArticle(
  raw: unknown,
  options: NormalizeArticleOptions = {},
): NewsArticle | null {
  if (!isRecord(raw)) return null;

  const title = cleanText(raw.title, NEWS_MAX_TITLE_LENGTH, false);
  if (!title) return null;

  const url = canonicalArticleUrl(raw.url);
  if (!url) return null;

  const sourceDomain = hostnameOf(url);
  if (!sourceDomain) return null;

  const publishedAt = parseTimestamp(raw.published_at);
  if (!publishedAt) return null;

  const now = options.now ?? new Date();
  if (Date.parse(publishedAt) > now.getTime() + NEWS_FUTURE_TOLERANCE_MS) return null;

  const fetchedAt = parseTimestamp(options.fetchedAt) ?? now.toISOString();
  const providerId = normalizeProviderId(raw.uuid);
  const source = cleanText(raw.source, 120, false) ?? sourceDomain;
  const description = cleanText(raw.description, NEWS_MAX_DESCRIPTION_LENGTH);
  const snippet = cleanText(raw.snippet, NEWS_MAX_SNIPPET_LENGTH);
  const language = normalizeLanguage(raw.language);
  const entities = normalizeEntities(raw.entities);
  const instruments = instrumentsFromEntities(entities);
  const { category, classification } = classifyArticle({
    title,
    description,
    snippet,
    entities,
  });

  return {
    id: stableArticleId(providerId, url),
    provider_id: providerId,
    title,
    description,
    snippet,
    source,
    source_domain: sourceDomain,
    url,
    image_url: safeImageUrl(raw.image_url),
    published_at: publishedAt,
    fetched_at: fetchedAt,
    category,
    classification,
    entities,
    instruments,
    language,
    attribution: {
      provider: 'Marketaux',
      publisher: source,
      source_url: url,
      retrieved_at: fetchedAt,
    },
  };
}

// ---------------------------------------------------------------------------
// Deduplication, retention, and feed assembly
// ---------------------------------------------------------------------------

function dedupeTextKey(article: NewsArticle): string {
  const day = article.published_at.slice(0, 10);
  return `text:${article.title.toLowerCase()}|${article.source_domain}|${day}`;
}

function articleRichness(article: NewsArticle): number {
  return (
    (article.description ? 2 : 0) +
    (article.snippet ? 1 : 0) +
    (article.image_url ? 1 : 0) +
    article.entities.length * 0.1 +
    article.instruments.length * 0.1
  );
}

/**
 * Choose which record supplies the stable snapshot fields.
 *
 * The earliest fetch wins. That makes the feed append-only for an existing
 * provider record: a later poll cannot rewrite the title, URL, timestamp, or
 * `fetched_at` of an article already captured, so a duplicate-only batch is a
 * true no-op. Within one batch (identical `fetched_at`) the newest publication
 * wins, then the richer and lexicographically smaller record for determinism.
 */
function primaryFirst(left: NewsArticle, right: NewsArticle): [NewsArticle, NewsArticle] {
  const leftFetched = Date.parse(left.fetched_at);
  const rightFetched = Date.parse(right.fetched_at);
  if (leftFetched !== rightFetched) {
    return leftFetched < rightFetched ? [left, right] : [right, left];
  }
  if (left.published_at !== right.published_at) {
    return left.published_at > right.published_at ? [left, right] : [right, left];
  }
  const richness = articleRichness(right) - articleRichness(left);
  if (richness !== 0) return richness > 0 ? [right, left] : [left, right];
  return left.id <= right.id ? [left, right] : [right, left];
}

function mergeDuplicate(left: NewsArticle, right: NewsArticle): NewsArticle {
  const [primary, secondary] = primaryFirst(left, right);
  const entities = [...primary.entities];
  const entityKeys = new Set(entities.map((entity) => `${entity.symbol ?? ''}|${entity.name ?? ''}`.toLowerCase()));
  for (const entity of secondary.entities) {
    const key = `${entity.symbol ?? ''}|${entity.name ?? ''}`.toLowerCase();
    if (!entityKeys.has(key) && entities.length < NEWS_MAX_ENTITIES) {
      entityKeys.add(key);
      entities.push(entity);
    }
  }

  const instruments = [...primary.instruments];
  const instrumentKeys = new Set(instruments.map((instrument) => instrument.symbol));
  for (const instrument of secondary.instruments) {
    if (!instrumentKeys.has(instrument.symbol) && instruments.length < NEWS_MAX_INSTRUMENTS) {
      instrumentKeys.add(instrument.symbol);
      instruments.push(instrument);
    }
  }

  return {
    ...primary,
    provider_id: primary.provider_id ?? secondary.provider_id,
    description: primary.description ?? secondary.description,
    snippet: primary.snippet ?? secondary.snippet,
    image_url: primary.image_url ?? secondary.image_url,
    entities,
    instruments,
    language: primary.language ?? secondary.language,
  };
}

/**
 * Deterministic deduplication.
 *
 * Order of evidence:
 *   1. provider UUID
 *   2. canonical article URL
 *   3. safe field combination (title + publisher domain + publication day)
 *
 * The third key catches syndicated copies where the provider supplies neither a
 * stable UUID nor a shared canonical URL. It is deliberately scoped to one day
 * and one publisher so two genuinely different articles are not collapsed.
 */
export function dedupeArticles(articles: readonly NewsArticle[]): NewsArticle[] {
  const sorted = [...articles].sort(
    (left, right) =>
      right.published_at.localeCompare(left.published_at) || left.id.localeCompare(right.id),
  );

  const out: NewsArticle[] = [];
  const index = new Map<string, number>();

  for (const article of sorted) {
    const keys = [
      article.provider_id ? `provider:${article.provider_id}` : null,
      `url:${article.url}`,
      dedupeTextKey(article),
    ].filter((key): key is string => Boolean(key));

    let existingIndex: number | undefined;
    for (const key of keys) {
      const found = index.get(key);
      if (found !== undefined) {
        existingIndex = found;
        break;
      }
    }

    if (existingIndex === undefined) {
      out.push(article);
      const newIndex = out.length - 1;
      for (const key of keys) index.set(key, newIndex);
      continue;
    }

    const merged = mergeDuplicate(out[existingIndex], article);
    out[existingIndex] = merged;
    const mergedKeys = [
      merged.provider_id ? `provider:${merged.provider_id}` : null,
      `url:${merged.url}`,
      dedupeTextKey(merged),
    ].filter((key): key is string => Boolean(key));
    for (const key of mergedKeys) index.set(key, existingIndex);
  }

  return out;
}

function positiveInteger(value: number | undefined, fallback: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  const integer = Math.trunc(value);
  if (integer < 1) return fallback;
  return Math.min(integer, max);
}

export function makeEmptyFeed(): NewsFeed {
  return {
    schema_version: NEWS_SCHEMA_VERSION,
    provider: { ...NEWS_PROVIDER },
    generated_at: null,
    retention: {
      days: NEWS_RETENTION_DAYS,
      max_items: NEWS_MAX_ITEMS,
    },
    attribution: {
      provider: 'Marketaux',
      provider_url: NEWS_PROVIDER.url,
      notice: NEWS_ATTRIBUTION_NOTICE,
    },
    count: 0,
    items: [],
  };
}

/**
 * Merge a fetch batch into the last valid feed.
 *
 * If the batch adds nothing, removes nothing, and prunes nothing, the ORIGINAL
 * object is returned. That identity is what keeps the scheduled workflow from
 * committing and deploying on every empty poll.
 */
export function buildNextFeed(
  existing: NewsFeed,
  incoming: readonly NewsArticle[],
  options: BuildFeedOptions = {},
): NewsFeed {
  const now = options.now ?? new Date();
  const fetchedAt = parseTimestamp(options.fetchedAt) ?? now.toISOString();
  const retentionDays = positiveInteger(options.retentionDays ?? existing.retention.days, NEWS_RETENTION_DAYS, 30);
  const maxItems = positiveInteger(options.maxItems ?? existing.retention.max_items, NEWS_MAX_ITEMS, 500);
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;

  const deduped = dedupeArticles([...existing.items, ...incoming]);
  const retained = deduped
    .filter((article) => Date.parse(article.published_at) >= cutoff)
    .slice(0, maxItems);

  const itemsChanged = JSON.stringify(retained) !== JSON.stringify(existing.items);
  const configChanged =
    existing.schema_version !== NEWS_SCHEMA_VERSION ||
    existing.retention.days !== retentionDays ||
    existing.retention.max_items !== maxItems ||
    existing.provider.id !== NEWS_PROVIDER.id ||
    existing.attribution.notice !== NEWS_ATTRIBUTION_NOTICE;

  if (!itemsChanged && !configChanged) return existing;

  return {
    schema_version: NEWS_SCHEMA_VERSION,
    provider: { ...NEWS_PROVIDER },
    generated_at: itemsChanged ? fetchedAt : existing.generated_at,
    retention: {
      days: retentionDays,
      max_items: maxItems,
    },
    attribution: {
      provider: 'Marketaux',
      provider_url: NEWS_PROVIDER.url,
      notice: NEWS_ATTRIBUTION_NOTICE,
    },
    count: retained.length,
    items: retained,
  };
}

export function serializeNewsFeed(feed: NewsFeed): string {
  return `${JSON.stringify(feed, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SENSITIVE_KEY_PATTERN = /(?:api[_-]?token|access[_-]?token|authorization|secret|password|credential)/i;
const CREDENTIAL_STRING_PATTERN = /(?:api_token=|MARKETAUX_API_TOKEN|Bearer\s+[A-Za-z0-9._~+/=-]{10,})/;

function findSensitiveKeys(value: unknown, path = 'feed'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findSensitiveKeys(entry, `${path}[${index}]`));
  }
  if (!isRecord(value)) return [];

  const hits: string[] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) hits.push(`${path}.${key}`);
    hits.push(...findSensitiveKeys(entry, `${path}.${key}`));
  }
  return hits;
}

function findCredentialStrings(value: unknown, path = 'feed'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findCredentialStrings(entry, `${path}[${index}]`));
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, entry]) =>
      findCredentialStrings(entry, `${path}.${key}`),
    );
  }
  if (typeof value === 'string' && CREDENTIAL_STRING_PATTERN.test(value)) return [path];
  return [];
}

function isNewsCategory(value: unknown): value is NewsCategoryId {
  return typeof value === 'string' && (NEWS_CATEGORY_IDS as readonly string[]).includes(value);
}

function validateArticle(value: unknown, index: number): string[] {
  const path = `items[${index}]`;
  if (!isRecord(value)) return [`${path} is not an object`];

  const errors: string[] = [];
  const id = value.id;
  if (typeof id !== 'string' || !/^[a-z]+_[A-Za-z0-9_-]{6,80}$/.test(id)) {
    errors.push(`${path}.id is not a stable feed ID`);
  }

  const providerId = value.provider_id;
  if (providerId !== null && (typeof providerId !== 'string' || !normalizeProviderId(providerId))) {
    errors.push(`${path}.provider_id is invalid`);
  }

  const title = value.title;
  if (typeof title !== 'string' || !title.trim() || title.length > NEWS_MAX_TITLE_LENGTH) {
    errors.push(`${path}.title is missing or exceeds ${NEWS_MAX_TITLE_LENGTH} characters`);
  }

  for (const field of ['description', 'snippet'] as const) {
    const fieldValue = value[field];
    const max =
      field === 'description' ? NEWS_MAX_DESCRIPTION_LENGTH : NEWS_MAX_SNIPPET_LENGTH;
    if (fieldValue !== null && (typeof fieldValue !== 'string' || fieldValue.length > max)) {
      errors.push(`${path}.${field} is invalid or exceeds ${max} characters`);
    }
  }

  for (const field of ['source', 'source_domain', 'url'] as const) {
    if (typeof value[field] !== 'string' || !value[field].trim()) {
      errors.push(`${path}.${field} is missing`);
    }
  }

  const url = typeof value.url === 'string' ? canonicalArticleUrl(value.url) : null;
  if (!url) errors.push(`${path}.url is not a safe public http(s) URL`);
  const sourceDomain = typeof value.source_domain === 'string' ? value.source_domain : '';
  if (url && sourceDomain && hostnameOf(url) !== sourceDomain) {
    errors.push(`${path}.source_domain does not match the article URL host`);
  }

  const imageUrl = value.image_url;
  if (imageUrl !== null && !safeImageUrl(imageUrl)) {
    errors.push(`${path}.image_url is not a safe https URL`);
  }

  for (const field of ['published_at', 'fetched_at'] as const) {
    const timestamp = value[field];
    if (typeof timestamp !== 'string' || parseTimestamp(timestamp) !== timestamp) {
      errors.push(`${path}.${field} is not a normalised ISO timestamp`);
    }
  }

  if (!isNewsCategory(value.category)) {
    errors.push(`${path}.category is not an approved AXIORA category`);
  }

  const classification = value.classification;
  if (!isRecord(classification)) {
    errors.push(`${path}.classification is missing`);
  } else {
    if (classification.method !== 'axiora-rules-v1') {
      errors.push(`${path}.classification.method is not the approved rule set`);
    }
    if (classification.generated !== true) {
      errors.push(`${path}.classification.generated must be true (internal classification)`);
    }
    if (
      typeof classification.confidence !== 'number' ||
      !Number.isFinite(classification.confidence) ||
      classification.confidence < 0 ||
      classification.confidence > 1
    ) {
      errors.push(`${path}.classification.confidence is invalid`);
    }
    if (typeof classification.basis !== 'string' || !classification.basis.trim()) {
      errors.push(`${path}.classification.basis is missing`);
    }
  }

  const entities = value.entities;
  if (!Array.isArray(entities) || entities.length > NEWS_MAX_ENTITIES) {
    errors.push(`${path}.entities is invalid`);
  } else {
    entities.forEach((entity, entityIndex) => {
      if (!isRecord(entity)) {
        errors.push(`${path}.entities[${entityIndex}] is not an object`);
        return;
      }
      if (entity.symbol !== null && typeof entity.symbol !== 'string') {
        errors.push(`${path}.entities[${entityIndex}].symbol is invalid`);
      }
      if (entity.name !== null && typeof entity.name !== 'string') {
        errors.push(`${path}.entities[${entityIndex}].name is invalid`);
      }
      if (!ENTITY_TYPES.has(entity.type as NewsEntityType)) {
        errors.push(`${path}.entities[${entityIndex}].type is invalid`);
      }
      if (entity.symbol === null && entity.name === null) {
        errors.push(`${path}.entities[${entityIndex}] has no symbol or name`);
      }
    });
  }

  const instruments = value.instruments;
  if (!Array.isArray(instruments) || instruments.length > NEWS_MAX_INSTRUMENTS) {
    errors.push(`${path}.instruments is invalid`);
  } else {
    instruments.forEach((instrument, instrumentIndex) => {
      if (!isRecord(instrument)) {
        errors.push(`${path}.instruments[${instrumentIndex}] is not an object`);
        return;
      }
      for (const field of ['symbol', 'label'] as const) {
        if (typeof instrument[field] !== 'string' || !instrument[field].trim()) {
          errors.push(`${path}.instruments[${instrumentIndex}].${field} is missing`);
        }
      }
      if (!ENTITY_TYPES.has(instrument.type as NewsEntityType)) {
        errors.push(`${path}.instruments[${instrumentIndex}].type is invalid`);
      }
    });
  }

  const language = value.language;
  if (language !== null && (typeof language !== 'string' || !normalizeLanguage(language))) {
    errors.push(`${path}.language is invalid`);
  }

  const attribution = value.attribution;
  if (!isRecord(attribution)) {
    errors.push(`${path}.attribution is missing`);
  } else {
    if (attribution.provider !== 'Marketaux') {
      errors.push(`${path}.attribution.provider must be Marketaux`);
    }
    if (typeof attribution.publisher !== 'string' || !attribution.publisher.trim()) {
      errors.push(`${path}.attribution.publisher is missing`);
    }
    if (typeof attribution.source_url !== 'string' || !canonicalArticleUrl(attribution.source_url)) {
      errors.push(`${path}.attribution.source_url is not safe`);
    }
    if (
      typeof attribution.retrieved_at !== 'string' ||
      parseTimestamp(attribution.retrieved_at) !== attribution.retrieved_at
    ) {
      errors.push(`${path}.attribution.retrieved_at is invalid`);
    }
  }

  if (typeof providerId === 'string' && url && id !== stableArticleId(providerId, url)) {
    errors.push(`${path}.id does not match the stable ID rule`);
  }
  if (providerId === null && url && id !== articleHashId(url)) {
    errors.push(`${path}.id does not match the URL-hash ID rule`);
  }

  for (const field of ['title', 'description', 'snippet'] as const) {
    const fieldValue = value[field];
    if (typeof fieldValue === 'string' && /<(?:script|iframe|object|embed|style)\b|javascript:/i.test(fieldValue)) {
      errors.push(`${path}.${field} contains unsafe markup or a dangerous URL scheme`);
    }
  }

  return errors;
}

/**
 * Strict feed validation used before a feed is committed or published.
 *
 * A malformed item is an error, not something silently dropped at render time:
 * the pipeline must never write a feed that would make the reader page lie about
 * what it is showing.
 */
export function validateNewsFeed(input: unknown): NewsFeedValidation {
  if (!isRecord(input)) {
    return { ok: false, errors: ['feed is not an object'], feed: null };
  }

  const errors: string[] = [];

  if (input.schema_version !== NEWS_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${NEWS_SCHEMA_VERSION}`);
  }

  const provider = input.provider;
  if (
    !isRecord(provider) ||
    provider.id !== NEWS_PROVIDER.id ||
    provider.name !== NEWS_PROVIDER.name ||
    typeof provider.url !== 'string' ||
    typeof provider.endpoint !== 'string'
  ) {
    errors.push('provider metadata is invalid');
  }

  const generatedAt = input.generated_at;
  if (generatedAt !== null) {
    if (typeof generatedAt !== 'string' || parseTimestamp(generatedAt) !== generatedAt) {
      errors.push('generated_at must be null or a normalised ISO timestamp');
    }
  }

  const retention = input.retention;
  if (
    !isRecord(retention) ||
    !Number.isInteger(retention.days) ||
    (retention.days as number) < 1 ||
    (retention.days as number) > 30 ||
    !Number.isInteger(retention.max_items) ||
    (retention.max_items as number) < 1 ||
    (retention.max_items as number) > 500
  ) {
    errors.push('retention is invalid');
  }

  const attribution = input.attribution;
  if (
    !isRecord(attribution) ||
    attribution.provider !== 'Marketaux' ||
    typeof attribution.provider_url !== 'string' ||
    typeof attribution.notice !== 'string' ||
    !attribution.notice.trim()
  ) {
    errors.push('feed attribution is invalid');
  }

  const items = input.items;
  if (!Array.isArray(items)) {
    errors.push('items must be an array');
    return { ok: false, errors, feed: null };
  }

  if (items.length > NEWS_MAX_ITEMS) {
    errors.push(`items exceeds the ${NEWS_MAX_ITEMS} item cap`);
  }

  const maxItems = isRecord(retention) && Number.isInteger(retention.max_items)
    ? (retention.max_items as number)
    : NEWS_MAX_ITEMS;
  if (items.length > maxItems) {
    errors.push(`items exceeds the declared max_items cap (${maxItems})`);
  }

  if (input.count !== items.length) {
    errors.push('count does not match items.length');
  }

  if (items.length > 0 && generatedAt === null) {
    errors.push('generated_at must be set when items are present');
  }

  const ids = new Set<string>();
  const urls = new Set<string>();
  let previousPublished = '';

  items.forEach((item, index) => {
    errors.push(...validateArticle(item, index));
    if (!isRecord(item)) return;

    if (typeof item.id === 'string') {
      if (ids.has(item.id)) errors.push(`items[${index}].id is duplicated`);
      ids.add(item.id);
    }
    if (typeof item.url === 'string') {
      const canonical = canonicalArticleUrl(item.url);
      if (canonical) {
        if (urls.has(canonical)) errors.push(`items[${index}].url is duplicated`);
        urls.add(canonical);
      }
    }
    if (typeof item.published_at === 'string') {
      if (previousPublished && item.published_at > previousPublished) {
        errors.push(`items[${index}] is not in newest-first order`);
      }
      previousPublished = item.published_at;
    }
  });

  const sensitiveKeys = findSensitiveKeys(input);
  for (const key of sensitiveKeys) errors.push(`credential-like key is not allowed: ${key}`);
  const credentialStrings = findCredentialStrings(input);
  for (const path of credentialStrings) {
    errors.push(`credential material is not allowed at ${path}`);
  }

  return { ok: errors.length === 0, errors, feed: errors.length === 0 ? (input as unknown as NewsFeed) : null };
}

// ---------------------------------------------------------------------------
// Freshness, search, and WIB presentation
// ---------------------------------------------------------------------------

export type NewsFeedFreshness = 'empty' | 'stale' | 'fresh';

export function newsFeedFreshness(
  feed: NewsFeed,
  now: Date = new Date(),
  staleHours: number = NEWS_STALE_HOURS,
): NewsFeedFreshness {
  if (feed.items.length === 0) return 'empty';
  if (!feed.generated_at) return 'stale';
  const generated = Date.parse(feed.generated_at);
  if (!Number.isFinite(generated)) return 'stale';
  return now.getTime() - generated > staleHours * 60 * 60 * 1000 ? 'stale' : 'fresh';
}

export function normalizeForSearch(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Everything the reader can search by, in one normalised string. */
export function articleSearchText(article: NewsArticle): string {
  return normalizeForSearch(
    [
      article.title,
      article.description ?? '',
      article.snippet ?? '',
      article.source,
      article.source_domain,
      NEWS_CATEGORY_LABELS[article.category],
      article.language ?? '',
      ...article.entities.flatMap((entity) => [entity.symbol ?? '', entity.name ?? '']),
      ...article.instruments.flatMap((instrument) => [instrument.symbol, instrument.label]),
    ].join(' '),
  );
}

export function matchesQuery(article: NewsArticle, query: string): boolean {
  const normalized = normalizeForSearch(query);
  if (!normalized) return true;
  const haystack = articleSearchText(article);
  return normalized.split(' ').every((token) => haystack.includes(token));
}

export interface NewsFilter {
  category?: NewsCategoryId | 'all';
  query?: string;
}

export function filterArticles(
  articles: readonly NewsArticle[],
  filter: NewsFilter = {},
): NewsArticle[] {
  const category = filter.category ?? 'all';
  return articles.filter(
    (article) =>
      (category === 'all' || article.category === category) &&
      matchesQuery(article, filter.query ?? ''),
  );
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const WIB_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

interface WibParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dateKey: string;
}

export function toWibParts(value: string): WibParts | null {
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return null;
  const date = new Date(millis + WIB_OFFSET_MS);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  return {
    year,
    month,
    day,
    hour,
    minute,
    dateKey: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Reader-facing WIB timestamp, e.g. "30 Okt 2026, 10.32 WIB". */
export function formatWib(value: string): string {
  const parts = toWibParts(value);
  if (!parts) return 'Waktu tidak tersedia';
  return `${parts.day} ${WIB_MONTHS[parts.month - 1]} ${parts.year}, ${pad2(parts.hour)}.${pad2(parts.minute)} WIB`;
}

/** Compact WIB timestamp for cards, e.g. "30 Okt, 10.32 WIB". */
export function formatWibShort(value: string): string {
  const parts = toWibParts(value);
  if (!parts) return 'Waktu tidak tersedia';
  return `${parts.day} ${WIB_MONTHS[parts.month - 1]}, ${pad2(parts.hour)}.${pad2(parts.minute)} WIB`;
}

export function wibDateKey(value: string): string | null {
  return toWibParts(value)?.dateKey ?? null;
}

// ---------------------------------------------------------------------------
// Fetch failure classification and secret hygiene
// ---------------------------------------------------------------------------

function parseRetryAfter(value: string | null | undefined): number | null {
  if (!value) return null;
  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds) && String(seconds) === value.trim() && seconds >= 0) {
    return seconds;
  }
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

export function classifyHttpFailure(
  status: number,
  retryAfter?: string | null,
): NewsHttpFailure {
  if (status === 401) {
    return {
      kind: 'auth',
      retryable: false,
      message:
        'Marketaux rejected the API token (HTTP 401). Check that MARKETAUX_API_TOKEN is valid.',
      retryAfterSeconds: null,
    };
  }
  if (status === 403) {
    return {
      kind: 'forbidden',
      retryable: false,
      message: 'Marketaux denied access to this resource (HTTP 403).',
      retryAfterSeconds: null,
    };
  }
  if (status === 429) {
    return {
      kind: 'rate-limited',
      retryable: true,
      message: 'Marketaux rate limit reached (HTTP 429). The last valid feed was preserved.',
      retryAfterSeconds: parseRetryAfter(retryAfter),
    };
  }
  if (status >= 500) {
    return {
      kind: 'server',
      retryable: true,
      message: `Marketaux server error (HTTP ${status}). The last valid feed was preserved.`,
      retryAfterSeconds: null,
    };
  }
  return {
    kind: 'provider',
    retryable: false,
    message: `Marketaux returned an unexpected HTTP ${status} response.`,
    retryAfterSeconds: null,
  };
}

export function redactSecret(value: string, secret?: string | null): string {
  let output = String(value);
  if (secret && secret.length >= 4) {
    output = output.split(secret).join('[redacted]');
  }
  return output.replace(/(^|[?&])(api_token=)[^&\s]+/gi, '$1$2[redacted]');
}

export function resolveMarketauxToken(
  env: Record<string, string | undefined>,
): { ok: true; token: string } | { ok: false; error: string } {
  const token = env.MARKETAUX_API_TOKEN?.trim();
  if (!token) {
    return {
      ok: false,
      error:
        'MARKETAUX_API_TOKEN is not set. Add it as a GitHub Actions secret; never commit it.',
    };
  }
  if (token.length < 12) {
    return {
      ok: false,
      error: 'MARKETAUX_API_TOKEN is present but too short to be a valid token.',
    };
  }
  return { ok: true, token };
}

# AXIORA Intelligence News

AXIORA Intelligence News is the `/news/` reader page and its static ingestion
pipeline. The browser never calls Marketaux and never receives a credential. A
scheduled GitHub Actions workflow fetches a small Marketaux batch, validates and
normalises it, merges it into `public/data/news/latest.json`, and commits only
when the feed actually changes.

## Architecture

```
Marketaux /v1/news/all
        |
        v  (GitHub Actions, every 30 minutes)
scripts/fetch-news.mjs
  validate HTTP response
  normalise provider articles
  drop invalid records
  deduplicate + classify + retain
  atomic write
        |
        v
public/data/news/latest.json
        |
        v  (Astro build, at commit/deploy time)
src/lib/news-feed.ts  -> strict validation
src/pages/news/index.astro -> pre-rendered HTML
        |
        v
GitHub Pages  https://axiora.my.id/news/
```

There is no backend, database, server runtime, paid service, scraping, or
browser-side Marketaux request. The page is fully pre-rendered; category filters
and search are progressive enhancement over cards already in the HTML.

## Files

| Path | Responsibility |
| --- | --- |
| `src/lib/news.ts` | Pure contract: URL safety, normalisation, IDs, dedupe, classification, retention, WIB formatting, search, validation, HTTP failure classification. |
| `src/lib/news-feed.ts` | Build-time loader. Returns `ok`, `empty`, or `error`; never throws during a build. |
| `src/pages/news/index.astro` | Reader page, states, responsive layout, attribution. |
| `public/scripts/news.js` | Category + search filtering, result count, reset, URL state. No fetch, no `innerHTML`. |
| `scripts/fetch-news.mjs` | Marketaux fetch, merge, atomic write, failure handling. |
| `scripts/validate-news.mjs` | Strict feed validator used locally and in CI. |
| `tests/news.test.ts` | Data-layer and rendered-source tests using synthetic fixtures only. |
| `tests/fixtures/news-fixture.ts` | Clearly marked `TEST FIXTURE` provider payloads. |
| `.github/workflows/news.yml` | 30-minute schedule, manual dispatch, commit and deploy trigger. |
| `public/data/news/latest.json` | Published feed. The committed seed is a valid empty feed. |

## Provider limits and request budget

Marketaux Free plan, as verified on 30 October 2026:

- 100 requests per day.
- 3 articles per request.
- Token passed as the `api_token` query parameter.

The workflow runs every 30 minutes: 48 requests per day, leaving 52 requests for
manual runs and retries. The default fetch is one page, `language=en`,
`limit=3`, `group_similar=true`, sorted newest first. `NEWS_FETCH_LIMIT` may be
raised for a manual backfill, but the daily request cap still applies.

## Secret setup

The token is read only from the GitHub Actions secret `MARKETAUX_API_TOKEN`:

```text
Repository -> Settings -> Secrets and variables -> Actions -> New repository secret
Name: MARKETAUX_API_TOKEN
Value: <Marketaux API token>
```

Or, with the GitHub CLI:

```bash
gh secret set MARKETAUX_API_TOKEN --repo hendfirmsh/axiora-fx
```

The token is never written to the feed, HTML, source, fixtures, or logs. The
fetch script checks the serialised output for the token value, `api_token=`, and
`MARKETAUX_API_TOKEN` before the atomic rename. `scripts/verify-static.mjs` scans
the emitted `dist/` for the same markers and fails the build on a hit.

If the secret is missing, `npm run news:fetch` exits with code 2 and the last
valid feed is untouched. Add the secret and re-run the workflow.

## Local run

```bash
# Validate the committed feed
npm run news:validate

# Fetch and merge (requires the token in the environment)
# PowerShell:
$env:MARKETAUX_API_TOKEN = '...'
npm run news:fetch

# Inspect without writing
node scripts/fetch-news.mjs --dry-run
```

Do not create a `.env` containing a real token for this repository. The workflow
reads the GitHub secret directly.

## Schedule and manual trigger

The workflow runs at minute 0 and 30 of every hour (`*/30 * * * *`) and supports
`workflow_dispatch`.

```bash
gh workflow run news.yml --repo hendfirmsh/axiora-fx --ref main
```

Because a push made with `GITHUB_TOKEN` does not trigger other workflows, the
news workflow explicitly dispatches `deploy-pages.yml` after a feed commit. If the
feed did not change, it commits nothing and dispatches nothing, so an empty poll
cannot cause a deploy loop.

## Failure policy

| Condition | Behaviour |
| --- | --- |
| Missing/short token | Exit 2, no write, workflow fails. |
| HTTP 401 | Report invalid token, no write. |
| HTTP 403 | Report denied access, no write. |
| HTTP 429 | Report rate limit and `Retry-After` when present, no write. |
| HTTP 5xx | Report provider error, preserve last valid feed. |
| Timeout (20s) | Abort and preserve last valid feed. |
| Network failure | Preserve last valid feed. |
| Invalid JSON | Preserve last valid feed. |
| Payload without `data[]` | Preserve last valid feed. |
| Provider returns zero articles | Keep the existing feed; no commit. |
| Articles returned but none valid | Exit non-zero; preserve the existing feed. |
| Existing feed invalid/unreadable | Refuse to overwrite it. |
| Build or `verify:static`/`verify:links` fails after fetch | No commit is made. |

Writes use a temporary file and rename, so a crash cannot leave a half-written
`latest.json`. The process also refuses to publish a feed that fails the strict
validator.

## Normalisation and data discipline

Each published article contains:

`id`, `provider_id`, `title`, `description`, `snippet`, `source`,
`source_domain`, `url`, `image_url`, `published_at`, `fetched_at`, `category`,
`classification`, `entities`, `instruments`, `language`, and `attribution`.

- **IDs** are stable: `mtx_<provider UUID>` when available, otherwise a
  deterministic URL hash (`url_<hash>`).
- **URLs** are canonicalised (no `www.`, fragments, or tracking parameters) and
  must be public `http(s)`. `javascript:`, `data:`, credentials-in-URL, private
  hosts, and intranet hostnames are rejected.
- **Titles** are preserved. Descriptions are capped at 400 characters and
  snippets at 280; no full article content is stored.
- **Timestamps** are normalised to ISO 8601 UTC and displayed in WIB (UTC+7)
  without relying on the host timezone.
- **Categories** are generated by AXIORA rules (`axiora-rules-v1`) and marked
  `classification.generated: true`. They are not publisher categories:
  Central Banks, Macroeconomics, Forex & Currencies, Commodities, Geopolitics,
  Financial Markets, and General Financial News.
- **Instruments** map provider symbols carefully (for example `XAU`/`GOLD` to
  `XAUUSD`, `DXY`, `WTI`, `BRENT`, `SPX`, `NDX`, `DJI`, `IHSG`, `BTC`, `ETH`).
  Unrecognised symbols are ignored rather than guessed.
- **Images** are retained only as safe HTTPS URLs but the reader renders no
  provider images, so a broken or missing image cannot fabricate a visual.

## Deduplication and retention

Deduplication uses, in order:

1. provider UUID;
2. canonical article URL;
3. title + publisher domain + publication day.

The earliest `fetched_at` supplies the stable snapshot fields (`title`, `url`,
`published_at`, `fetched_at`). A later poll can enrich missing descriptions,
snippets, entities, instruments, or images via a duplicate, but cannot rewrite an
article already captured. A duplicate-only batch therefore returns the original
feed object and produces no commit.

Retention is 7 days and at most 120 items. Pruning is applied on every merge, so
an unchanged feed is still a no-op.

## Reader behaviour and states

- **Empty**: the committed feed is valid but has no items. The page states that
  no news is available and does not show example headlines.
- **Error**: the feed is missing, malformed, or fails validation. The page says
  so and renders no cards. Other routes remain usable.
- **Stale**: items exist but `generated_at` is older than 6 hours. Existing items
  remain visible with a delay notice. The condition is evaluated at build time
  and re-checked client-side when the page becomes visible, so a long-lived page
  cannot keep claiming freshness.
- **No results**: category + query match nothing. The result list is hidden and a
  reset control is offered.
- **No-JS**: every card is in the HTML; the filter controls and search are
  enhancements. The page states that filtering requires JavaScript.

There is no loading state because there is no client-side fetch. Skeleton cards
would imply data is arriving when it is not.

## Licensing and indexing caveat

The Marketaux public terms reviewed are personal/non-commercial and do not
explicitly authorise caching or redistribution. The permission email for this
publication has not been located. Therefore:

- `/news/` is deliberately `noindex, follow`.
- The page shows short provider snippets, publisher names, and links to the
  original article only.
- The route is implemented and usable, but this is **not** a claim that
  redistribution rights are cleared. Confirm the provider's permission terms
  before enabling indexing or expanding excerpt length.

## Verification

```bash
npm run check
npm test
npm run build
npm run news:validate
npm run verify:static
npm run verify:links
npm run verify:gate   # all of the above, except news:validate
```

`verify:static` now also fails if `MARKETAUX_API_TOKEN`, `api_token=`, or the
configured token value appears in emitted HTML/JS/JSON/CSS.

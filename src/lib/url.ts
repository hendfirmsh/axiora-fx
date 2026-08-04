/**
 * Base-path-aware URL helper.
 *
 * Authority: 05_Technical_Foundation/01_Technical_Foundation_Decision_Note.md Section 7,
 *            decision K-12, route build-out decision item 4 (canonical URL).
 *
 * Internal links MUST be constructed through this helper, never written as
 * absolute strings. This is what allows the same source to build correctly at the
 * production custom-domain root ('/') and at a preview project path
 * ('/axiora-fx/') without hardcoding either.
 *
 * Decision item 4 requires that sitemap, Open Graph URL, breadcrumb URL, and
 * internal links all use this same helper. Every path-producing function below
 * routes through joinBase(), so there is one base-resolution rule in the codebase.
 *
 * The pure functions take an explicit base so they are testable in plain Node,
 * where `import.meta.env` does not exist. The exported convenience wrappers read
 * the configured base and delegate.
 */

/** The build-time configured base path. '/' when unset. */
export function configuredBase(): string {
  // Vite/Astro replace this at build time. Guarded so the module can also be
  // imported by the Node test harness, where import.meta.env is undefined.
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  return env?.BASE_URL || '/';
}

/** Strip a trailing slash, preserving '' for a root base. */
function normaliseBase(base: string): string {
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

/**
 * PURE. Join a base path with an application-relative path.
 *
 * Idempotent with respect to the base: joinBase(b, joinBase(b, p)) === joinBase(b, p).
 * That property is what prevents a double-prefixed canonical URL, and it is
 * covered by a regression test.
 */
export function joinBase(base: string, path = '/'): string {
  const normalisedBase = normaliseBase(base);
  const relative = stripBaseFrom(base, path.startsWith('/') ? path : `/${path}`);

  // trailingSlash is 'always'; keep directory-style URLs stable.
  const withTrailing = relative === '/' || relative.endsWith('/') ? relative : `${relative}/`;

  return `${normalisedBase}${withTrailing}` || '/';
}

/**
 * PURE. Reduce an already-resolved pathname to an application-relative path.
 *
 * `Astro.url.pathname` is emitted WITH the base prefix applied. Passing it back
 * through joinBase() without this step would prefix it a second time.
 */
export function stripBaseFrom(base: string, pathname: string): string {
  const normalisedBase = normaliseBase(base);
  if (!normalisedBase) return pathname;
  if (pathname === normalisedBase) return '/';
  if (pathname.startsWith(`${normalisedBase}/`)) {
    return pathname.slice(normalisedBase.length);
  }
  return pathname;
}

/**
 * PURE. Absolute canonical URL.
 *
 * Accepts either an application-relative path ('/about/') or an already
 * base-resolved pathname ('/axiora-fx/about/'); the base is normalised away first
 * so the result is identical either way. Double-prefixing a canonical URL would
 * publish a non-existent address as the indexable one.
 */
export function canonicalFrom(base: string, path: string, site: URL | string | undefined): string {
  const relative = joinBase(base, path);
  if (!site) return relative;
  return new URL(relative, site).href;
}

/**
 * PURE. Join a base path with a STATIC FILE path (no trailing slash).
 *
 * joinBase() appends a trailing slash because trailingSlash is 'always' and
 * routes are directory-style. A static asset is a FILE: '/scripts/drawer.js/'
 * is a different, non-existent URL and returns 404 under a base path.
 *
 * That was a real defect, not a hypothetical one: the enhancement scripts were
 * first emitted as src="/axiora-fx/scripts/drawer.js/" and 404'd at the preview
 * base, while every verifier still passed — verify-links.mjs checks routes, and
 * check 8 checks emitted filenames, so neither inspects asset href resolution.
 */
export function assetFrom(base: string, path: string): string {
  const normalisedBase = normaliseBase(base);
  const relative = stripBaseFrom(base, path.startsWith('/') ? path : `/${path}`);
  return `${normalisedBase}${relative}`;
}

/**
 * PURE. Active-state test for navigation.
 * `exact` is used for index routes so a parent does not stay active for children.
 */
export function isActiveFrom(
  base: string,
  currentPath: string,
  targetPath: string,
  exact = false,
): boolean {
  const current = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
  const target = joinBase(base, targetPath);
  return exact ? current === target : current.startsWith(target);
}

// --- Convenience wrappers bound to the configured base ---------------------

/** Join the configured base path with an application-relative path. */
export function url(path = '/'): string {
  return joinBase(configuredBase(), path);
}

/** Reduce a resolved pathname to an application-relative path. */
export function stripBase(pathname: string): string {
  return stripBaseFrom(configuredBase(), pathname);
}

/** Base-aware URL for a static FILE in public/ (no trailing slash). */
export function asset(path: string): string {
  return assetFrom(configuredBase(), path);
}

/** Absolute canonical URL for SEO metadata and Open Graph. */
export function canonical(path: string, site: URL | string | undefined): string {
  return canonicalFrom(configuredBase(), path, site);
}

/** Active-state test for navigation. */
export function isActive(currentPath: string, targetPath: string, exact = false): boolean {
  return isActiveFrom(configuredBase(), currentPath, targetPath, exact);
}

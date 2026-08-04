/**
 * URL helper regression tests.
 *
 * Authority: route build-out decision item 4 (canonical URL).
 *
 * Required by decision: "tambahkan regression test untuk idempotensi canonical()".
 *
 * The defect this locks down: `Astro.url.pathname` already carries the base
 * prefix. Passing it to canonical() when canonical() also applies the base
 * produced `https://host/axiora-fx/axiora-fx/` — a non-existent address published
 * as the indexable canonical URL. On an SEO-first site that is a silent, serious
 * defect: it is invisible at the production root base ('/'), where double-prefixing
 * is a no-op, and only appears at the project-path preview base.
 *
 * These tests exercise the PURE variants with an explicit base, so both bases are
 * covered in one run without a rebuild.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assetFrom,
  canonicalFrom,
  isActiveFrom,
  joinBase,
  stripBaseFrom,
} from '../src/lib/url.ts';

const ROOT_BASE = '/';
const PROJECT_BASE = '/axiora-fx/';
const SITE = 'https://axiora.my.id';
const PREVIEW_SITE = 'https://hendfirmsh.github.io';

// --- canonical() idempotency (the required regression test) ----------------

test('canonicalFrom is idempotent at the project-path base', () => {
  // Feeding canonical() its own resolved pathname must not prefix the base twice.
  const first = canonicalFrom(PROJECT_BASE, '/about/', PREVIEW_SITE);
  const resolvedPath = new URL(first).pathname;
  const second = canonicalFrom(PROJECT_BASE, resolvedPath, PREVIEW_SITE);

  assert.equal(first, 'https://hendfirmsh.github.io/axiora-fx/about/');
  assert.equal(second, first, 'canonical() must be idempotent; it double-prefixed the base');
});

test('canonicalFrom is idempotent at the root base', () => {
  const first = canonicalFrom(ROOT_BASE, '/about/', SITE);
  const second = canonicalFrom(ROOT_BASE, new URL(first).pathname, SITE);

  assert.equal(first, 'https://axiora.my.id/about/');
  assert.equal(second, first);
});

test('canonicalFrom never emits a doubled base segment', () => {
  // Guards the exact published-defect shape: '/axiora-fx/axiora-fx/'.
  for (const path of ['/', '/about/', '/topics/gold/', '/axiora-fx/topics/gold/']) {
    const result = canonicalFrom(PROJECT_BASE, path, PREVIEW_SITE);
    assert.ok(
      !result.includes('/axiora-fx/axiora-fx/'),
      `doubled base segment produced for input "${path}": ${result}`,
    );
  }
});

test('canonicalFrom applied three times is stable', () => {
  let current = canonicalFrom(PROJECT_BASE, '/topics/gold/', PREVIEW_SITE);
  for (let i = 0; i < 3; i += 1) {
    const next = canonicalFrom(PROJECT_BASE, new URL(current).pathname, PREVIEW_SITE);
    assert.equal(next, current, `canonical() drifted on application ${i + 1}`);
    current = next;
  }
});

// --- joinBase ---------------------------------------------------------------

test('joinBase applies the project base once', () => {
  assert.equal(joinBase(PROJECT_BASE, '/about/'), '/axiora-fx/about/');
  assert.equal(joinBase(PROJECT_BASE, '/'), '/axiora-fx/');
});

test('joinBase is idempotent', () => {
  const once = joinBase(PROJECT_BASE, '/education/');
  assert.equal(joinBase(PROJECT_BASE, once), once);
});

test('joinBase leaves paths unchanged at the root base', () => {
  assert.equal(joinBase(ROOT_BASE, '/about/'), '/about/');
  assert.equal(joinBase(ROOT_BASE, '/'), '/');
});

test('joinBase enforces a trailing slash (trailingSlash: always)', () => {
  assert.equal(joinBase(ROOT_BASE, '/about'), '/about/');
  assert.equal(joinBase(PROJECT_BASE, '/about'), '/axiora-fx/about/');
});

test('joinBase normalises a path without a leading slash', () => {
  assert.equal(joinBase(ROOT_BASE, 'about'), '/about/');
  assert.equal(joinBase(PROJECT_BASE, 'about'), '/axiora-fx/about/');
});

// --- stripBaseFrom ----------------------------------------------------------

test('stripBaseFrom removes the base prefix', () => {
  assert.equal(stripBaseFrom(PROJECT_BASE, '/axiora-fx/about/'), '/about/');
  assert.equal(stripBaseFrom(PROJECT_BASE, '/axiora-fx'), '/');
  assert.equal(stripBaseFrom(PROJECT_BASE, '/axiora-fx/'), '/');
});

test('stripBaseFrom is a no-op at the root base', () => {
  assert.equal(stripBaseFrom(ROOT_BASE, '/about/'), '/about/');
});

test('stripBaseFrom does not strip a coincidental prefix match', () => {
  // '/axiora-fx-notes/' starts with the base string but is a different segment.
  assert.equal(
    stripBaseFrom(PROJECT_BASE, '/axiora-fx-notes/'),
    '/axiora-fx-notes/',
    'stripped a partial segment match',
  );
});

// --- isActiveFrom -----------------------------------------------------------

test('isActiveFrom matches the current route at the project base', () => {
  assert.equal(isActiveFrom(PROJECT_BASE, '/axiora-fx/education/', '/education/'), true);
  assert.equal(isActiveFrom(PROJECT_BASE, '/axiora-fx/glossary/', '/education/'), false);
});

test('isActiveFrom exact mode does not keep an index active for children', () => {
  // Non-exact: a parent stays active for its children.
  assert.equal(
    isActiveFrom(ROOT_BASE, '/education/konsep-a/', '/education/', false),
    true,
  );
  // Exact: the index is active only on itself.
  assert.equal(
    isActiveFrom(ROOT_BASE, '/education/konsep-a/', '/education/', true),
    false,
  );
  assert.equal(isActiveFrom(ROOT_BASE, '/education/', '/education/', true), true);
});

test('isActiveFrom home exact does not match every route', () => {
  // '/' is a prefix of everything, so home must be declared exact.
  assert.equal(isActiveFrom(ROOT_BASE, '/about/', '/', true), false);
  assert.equal(isActiveFrom(ROOT_BASE, '/', '/', true), true);
  assert.equal(isActiveFrom(PROJECT_BASE, '/axiora-fx/about/', '/', true), false);
  assert.equal(isActiveFrom(PROJECT_BASE, '/axiora-fx/', '/', true), true);
});

// --- assetFrom --------------------------------------------------------------

/*
 * The defect these lock down: static assets were emitted through joinBase(),
 * which appends a trailing slash because trailingSlash is 'always'. That turned
 * the enhancement script into src="/axiora-fx/scripts/drawer.js/" — a different,
 * non-existent URL that returns 404 at the preview base.
 *
 * It survived the whole verifier suite: verify-links.mjs validates ROUTES, and
 * verify-static.mjs check 8 validates emitted FILENAMES. Neither resolves an
 * asset href. Confirmed by HTTP request against the built output before the fix.
 */

test('assetFrom never appends a trailing slash to a file path', () => {
  assert.equal(assetFrom(ROOT_BASE, '/scripts/drawer.js'), '/scripts/drawer.js');
  assert.equal(
    assetFrom(PROJECT_BASE, '/scripts/drawer.js'),
    '/axiora-fx/scripts/drawer.js',
  );
});

test('assetFrom differs from joinBase exactly by the trailing slash', () => {
  const path = '/scripts/sidebar-group.js';
  assert.equal(joinBase(PROJECT_BASE, path), '/axiora-fx/scripts/sidebar-group.js/');
  assert.equal(assetFrom(PROJECT_BASE, path), '/axiora-fx/scripts/sidebar-group.js');
  assert.notEqual(assetFrom(PROJECT_BASE, path), joinBase(PROJECT_BASE, path));
});

test('assetFrom is idempotent with respect to the base', () => {
  const once = assetFrom(PROJECT_BASE, '/scripts/drawer.js');
  assert.equal(
    assetFrom(PROJECT_BASE, once),
    once,
    'an already-resolved asset path must not be prefixed a second time',
  );
});

test('assetFrom normalises a path given without a leading slash', () => {
  assert.equal(assetFrom(PROJECT_BASE, 'scripts/drawer.js'), '/axiora-fx/scripts/drawer.js');
});

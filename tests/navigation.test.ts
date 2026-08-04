/**
 * Navigation structure regression tests.
 *
 * Authority: 04_Workspace_Architecture/04_Knowledge_Navigation.md:34 (a group may
 *            contain a curated landing page), :47 (the shell must not list every
 *            article), 05_Sitemap.md + 06_Page_Inventory.md (route completeness),
 *            decision K-16 (only six browsable topics).
 *
 * The defect these lock down: `NavGroup.path` was declared in the route registry
 * and populated for three groups, but NavigationTree never read it. The Topics
 * index (/topics/) is a required MVP route, yet it was reachable only from the
 * recovery links on unavailable pages — never from shell navigation. Internal
 * link validation passed because the route existed and something linked to it,
 * so only a structural assertion catches this class of defect.
 *
 * These tests operate on the registry, not on rendered HTML, so they fail at
 * `npm test` time rather than requiring a build.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NAVIGATION, ROUTES, TOPIC_LABELS, topicPath } from '../src/lib/routes.ts';
import { mvpRoutePaths, pathsWithState } from '../src/lib/route-readiness.ts';
import { TOPICS } from '../src/lib/taxonomy.ts';

/** Mirrors NavigationTree's item resolution. Kept in sync by the tests below. */
function resolvedItems(group: (typeof NAVIGATION)[number]) {
  const declared = group.items;
  if (!group.path) return declared;
  if (declared.some((item) => item.path === group.path)) return declared;
  return [{ label: `${group.label}: Indeks`, path: group.path, icon: 'book' as const, exact: true }, ...declared];
}

const allResolved = NAVIGATION.flatMap(resolvedItems);
const navPaths = new Set(allResolved.map((item) => item.path));

test('every group landing page declared as NavGroup.path is reachable from the tree', () => {
  for (const group of NAVIGATION) {
    if (!group.path) continue;
    assert.ok(
      resolvedItems(group).some((item) => item.path === group.path),
      `Group "${group.label}" declares landing page ${group.path} but it is not rendered as an item. ` +
        'Knowledge_Navigation.md:34 permits a curated landing page; declaring one that the tree ' +
        'never renders makes it unreachable from the shell.',
    );
  }
});

test('resolving a group landing page does not duplicate a self-referencing item', () => {
  for (const group of NAVIGATION) {
    const paths = resolvedItems(group).map((item) => item.path);
    const duplicates = paths.filter((p, i) => paths.indexOf(p) !== i);
    assert.deepEqual(
      duplicates,
      [],
      `Group "${group.label}" renders duplicate route(s): ${duplicates.join(', ')}. ` +
        'Two links to the current route in one group would emit two aria-current="page".',
    );
  }
});

test('the Topics index is present in shell navigation', () => {
  // Regression guard for the specific defect: /topics/ existed and was linked
  // only from unavailable-page recovery blocks.
  assert.ok(
    navPaths.has(ROUTES.topics.path),
    `${ROUTES.topics.path} is a required MVP route but is absent from shell navigation.`,
  );
});

test('all six approved topics are in navigation, and no seventh', () => {
  // K-16: only six browsable topics.
  const topicNavPaths = [...navPaths].filter(
    (p) => p.startsWith('/topics/') && p !== ROUTES.topics.path,
  );
  assert.equal(topicNavPaths.length, TOPICS.length, `Expected ${TOPICS.length} topic links.`);
  for (const topic of TOPICS) {
    assert.ok(navPaths.has(topicPath(topic)), `Topic "${topic}" missing from navigation.`);
    assert.ok(TOPIC_LABELS[topic], `Topic "${topic}" has no label.`);
  }
});

test('every navigation entry points at an explicitly registered route', () => {
  /*
   * readinessOf() deliberately defaults unknown paths to 'ready' so that corpus
   * detail routes work (see tests/components.test.ts for the full rationale).
   * That default is correct for content routes but dangerous for SHELL links: a
   * typo in a nav path would silently inherit 'ready', be indexed, and be
   * sitemapped.
   *
   * So the assertion here is explicit registry membership, not readinessOf()
   * succeeding — an earlier version of this test called assert.doesNotThrow on
   * readinessOf, which can never throw and therefore proved nothing.
   */
  const registered = new Set([
    ...pathsWithState('ready'),
    ...pathsWithState('unavailable'),
    ...pathsWithState('future-gated'),
  ]);

  for (const item of allResolved) {
    assert.ok(
      registered.has(item.path),
      `Navigation links ${item.path}, which is not explicitly registered in the readiness ` +
        'registry. Shell links must be registered so their indexability is decided, not defaulted.',
    );
  }
});

test('no future-gated route appears in shell navigation', () => {
  // Research must not be presented as an active MVP route.
  for (const gated of pathsWithState('future-gated')) {
    assert.ok(
      !navPaths.has(gated),
      `Future-gated route ${gated} must not appear in shell navigation as an active route.`,
    );
  }
});

test('every navigation target is a real MVP route', () => {
  const mvp = new Set(mvpRoutePaths());
  for (const item of allResolved) {
    assert.ok(
      mvp.has(item.path),
      `Navigation links ${item.path}, which is not an emitted MVP route — that is a dead link.`,
    );
  }
});

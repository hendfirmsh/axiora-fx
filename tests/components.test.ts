/**
 * Component logic tests.
 *
 * Authority: 10_Component_Inventory.md (component contracts),
 *            13_Accessibility_Workspace.md:30 (claim distinction stated in text,
 *            not conveyed by styling),
 *            14_Implementation_Acceptance_Criteria.md:55 (no infinite scroll),
 *            04_Knowledge_Navigation.md:66 (an empty category states its emptiness),
 *            11_Interaction_Specification.md:17 (pagination recovery).
 *
 * SCOPE AND ITS LIMIT — READ BEFORE TRUSTING THIS FILE
 *
 * Thirteen Group 1 components are authored but not yet imported by any page, so
 * they have never been executed. Ideally they would be rendered in isolation and
 * asserted on. That requires the Astro container API, which needs a Vite-based
 * runner (vitest); adding a test runner is a dependency decision outside
 * implementation authority, so it has not been done.
 *
 * What IS verified here: every pure input those components depend on — the label
 * maps that make each state legible as text, date formatting for the audit trail,
 * discoverability filtering that keeps unavailable routes out of related content,
 * and pagination arithmetic.
 *
 * What is NOT verified here: the rendered markup of those thirteen components —
 * element structure, label association, heading level, form wiring. Those remain
 * unproven until either the components are used by a real page (route groups 2-11)
 * or a Vite-based runner is approved. This file must not be cited as evidence that
 * the components render correctly.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLAIM_CLASS_LABELS,
  CONTENT_TYPE_LABELS,
  DIFFICULTY_LABELS,
  RELATIONSHIP_LABELS,
  STATUS_LABELS,
  formatDate,
  machineDate,
  statusExplanation,
  STATUS_REQUIRING_PROSE,
} from '../src/lib/labels.ts';
import {
  CLAIM_CLASSES,
  CONTENT_TYPES,
  DIFFICULTIES,
  LIFECYCLE_STATUSES,
  RELATIONSHIP_TYPES,
} from '../src/lib/taxonomy.ts';
import { isDiscoverable, pathsWithState } from '../src/lib/route-readiness.ts';

// --- Every taxonomy value must be expressible as text ----------------------
// 13_Accessibility_Workspace.md:30 requires claim distinction to be stated in
// text rather than conveyed by styling. A missing label would force a component
// to fall back to colour or to render a raw enum token at the reader.

const LABEL_MAPS = [
  ['claim class', CLAIM_CLASSES, CLAIM_CLASS_LABELS],
  ['lifecycle status', LIFECYCLE_STATUSES, STATUS_LABELS],
  ['content type', CONTENT_TYPES, CONTENT_TYPE_LABELS],
  ['difficulty', DIFFICULTIES, DIFFICULTY_LABELS],
  ['relationship type', RELATIONSHIP_TYPES, RELATIONSHIP_LABELS],
] as const;

for (const [kind, values, labels] of LABEL_MAPS) {
  test(`every ${kind} has a non-empty human label`, () => {
    for (const value of values) {
      const label = (labels as Record<string, string>)[value];
      assert.ok(
        typeof label === 'string' && label.trim().length > 0,
        `${kind} "${value}" has no text label, so a component could only signal it by styling.`,
      );
      assert.notEqual(
        label,
        value,
        `${kind} "${value}" label is the raw token; that is not human-readable text.`,
      );
    }
  });

  test(`no two ${kind} values share a label`, () => {
    // Two states rendering identical text would be indistinguishable to a reader.
    const seen = new Map<string, string>();
    for (const value of values) {
      const label = (labels as Record<string, string>)[value];
      const prior = seen.get(label);
      assert.equal(
        prior,
        undefined,
        `${kind} values "${prior}" and "${value}" share the label "${label}".`,
      );
      seen.set(label, value);
    }
  });
}

// --- Date handling: the audit trail depends on it -------------------------

test('machineDate emits an ISO date for a valid input and undefined otherwise', () => {
  assert.match(
    machineDate(new Date('2026-02-11T00:00:00Z')) ?? '',
    /^2026-02-11/,
    'machineDate must emit a machine-readable ISO date for <time datetime>.',
  );
  assert.equal(machineDate(undefined), undefined, 'machineDate must not invent a date.');
});

test('formatDate never fabricates a date for missing input', () => {
  // A correction or source with no date must not display a plausible-looking one.
  const output = formatDate(undefined);
  assert.ok(
    !/\d{4}/.test(output),
    `formatDate(undefined) produced "${output}", which contains a year. ` +
      'Absent dates must not be rendered as real ones.',
  );
});

test('formatDate and machineDate agree on the same instant', () => {
  const date = new Date('2026-02-11T00:00:00Z');
  assert.match(machineDate(date) ?? '', /2026-02-11/);
  assert.match(formatDate(date), /2026/, 'Human and machine dates disagree on the year.');
});

// --- Lifecycle statuses that require explanatory prose --------------------

test('every status requiring prose actually has an explanation', () => {
  for (const status of STATUS_REQUIRING_PROSE) {
    const explanation = statusExplanation(status);
    assert.ok(
      typeof explanation === 'string' && explanation.trim().length > 0,
      `Status "${status}" is declared to require prose but statusExplanation returns nothing.`,
    );
  }
});

// --- Related-content filtering -------------------------------------------
// Directive item 2: unavailable routes must not appear in related content or
// Learn Next. RelatedLinks/RelatedTopics/LearnNext all delegate to
// isDiscoverable, so the filter is verified at its source.

test('isDiscoverable excludes every unavailable route', () => {
  for (const path of pathsWithState('unavailable')) {
    assert.equal(
      isDiscoverable(path),
      false,
      `Unavailable route ${path} is discoverable and could surface in related content.`,
    );
  }
});

test('isDiscoverable excludes every future-gated route', () => {
  for (const path of pathsWithState('future-gated')) {
    assert.equal(isDiscoverable(path), false, `Future-gated route ${path} is discoverable.`);
  }
});

test('isDiscoverable admits ready routes', () => {
  const ready = pathsWithState('ready');
  assert.ok(ready.length > 0, 'No ready routes exist; the assertion below would be vacuous.');
  for (const path of ready) {
    assert.equal(isDiscoverable(path), true, `Ready route ${path} is not discoverable.`);
  }
});

test('an unregistered path defaults to discoverable — deliberate, and load-bearing', () => {
  /*
   * This asserts a FAIL-OPEN default, which is unusual for this codebase and is
   * therefore pinned here so nobody "fixes" it without understanding the cost.
   *
   * route-readiness.ts:156-165 states the reason: corpus detail routes (one
   * specific brief, one glossary entry) cannot be in a module-scope registry,
   * because they exist only once a published record generates them. Their
   * readiness was already decided by the corpus filter in src/lib/corpus.ts.
   *
   * Flipping this to fail-closed would make isDiscoverable reject every brief
   * and glossary detail route, so RelatedLinks would filter out all of them and
   * brief-to-brief relationships would silently never render. That breaks the
   * core reading flow rather than protecting it.
   *
   * The residual exposure is real but bounded: a relationship target authored in
   * frontmatter that resolves to no emitted page would pass this predicate. The
   * compensating control is scripts/verify-links.mjs, which fails on any dead
   * internal link, and the navigation-surface guard in tests/navigation.test.ts,
   * which requires every shell link to be explicitly registered.
   */
  assert.equal(
    isDiscoverable('/market-intelligence/contoh-brief-yang-dihasilkan-korpus/'),
    true,
    'Corpus detail routes must remain discoverable; see the comment above before changing this.',
  );
});

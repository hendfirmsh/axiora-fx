/**
 * Content validation harness.
 *
 * Authority: route build-out decision item 3 (test fixture obligations),
 *            05_Technical_Foundation/01_Technical_Foundation_Decision_Note.md Section 8.
 *
 * Decision item 3 requires the fixtures to keep proving:
 *   - schema rejection
 *   - broken relationship rejection
 *   - taxonomy rejection
 *   - duplicate canonical ID rejection
 *   - source validation
 *   - lifecycle validation
 *   - correction/supersession validation
 *
 * These fixtures live in tests/fixtures/, outside every content collection `base`,
 * so they are structurally incapable of entering the production corpus — exclusion
 * is not a filter that could be forgotten. This harness loads them directly and
 * asserts each rejection class still fires.
 *
 * Validation runs against the SAME schema objects the build uses (src/lib/schemas.ts,
 * via `astro/zod`) and the SAME integrity checker (src/lib/content-integrity.ts).
 * Nothing here reimplements a rule, so this harness cannot drift from the build and
 * report a false pass.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { SCHEMAS, type CollectionName } from '../src/lib/schemas.ts';
import {
  validateCorpus,
  type IntegrityFailure,
  type ValidatableRecord,
} from '../src/lib/content-integrity.ts';
import { evaluateCorpus } from '../src/lib/corpus-requirements.ts';
import { PUBLIC_STATUSES } from '../src/lib/taxonomy.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures', 'content');

interface Fixture {
  name: string;
  frontmatter: Record<string, unknown>;
}

/** Split YAML frontmatter from MDX body. Mirrors how Astro reads a record. */
function splitFrontmatter(raw: string): Record<string, unknown> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) throw new Error('fixture has no frontmatter block');
  return (parseYaml(match[1]) ?? {}) as Record<string, unknown>;
}

async function loadFixtures(folder: string): Promise<Fixture[]> {
  const dir = join(FIXTURES, folder);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.mdx'));
  return Promise.all(
    files.map(async (file) => ({
      name: basename(file, '.mdx'),
      frontmatter: splitFrontmatter(await readFile(join(dir, file), 'utf8')),
    })),
  );
}

/** Pick the schema matching a fixture's declared contentType. */
function schemaFor(frontmatter: Record<string, unknown>) {
  const map: Record<string, CollectionName> = {
    'market-brief': 'market-briefs',
    'education-article': 'education',
    'glossary-entry': 'glossary',
    'macro-event': 'macro-events',
  };
  const collection = map[String(frontmatter.contentType)];
  // A fixture may deliberately omit contentType; default to market-briefs so the
  // schema still runs and reports the missing field rather than throwing here.
  return SCHEMAS[collection ?? 'market-briefs'];
}

/** Convert validated frontmatter into the Layer 2 record shape. */
function toValidatable(name: string, frontmatter: Record<string, unknown>): ValidatableRecord {
  return {
    file: `fixtures/${name}`,
    canonicalId: String(frontmatter.canonicalId ?? ''),
    contentType: String(frontmatter.contentType ?? ''),
    navigationCategory: String(frontmatter.navigationCategory ?? ''),
    status: String(frontmatter.status ?? ''),
    publicationState: String(frontmatter.publicationState ?? ''),
    sources: (frontmatter.sources ?? []) as ValidatableRecord['sources'],
    relationships: (frontmatter.relationships ?? []) as ValidatableRecord['relationships'],
    corrections: (frontmatter.corrections ?? []) as ValidatableRecord['corrections'],
    supersededBy: frontmatter.supersededBy as string | undefined,
    topics: (frontmatter.topics ?? []) as string[],
    geographies: (frontmatter.geographies ?? []) as string[],
    assetClasses: (frontmatter.assetClasses ?? []) as string[],
    difficulty: frontmatter.difficulty as string | undefined,
    publicationDate: frontmatter.publicationDate
      ? new Date(String(frontmatter.publicationDate))
      : undefined,
  };
}

/** Which numbered integrity checks fired. */
function checksFired(failures: IntegrityFailure[]): Set<number> {
  return new Set(failures.map((f) => f.check));
}

// ===========================================================================
// Layer 1 - structural schema validation
// ===========================================================================

test('Layer 1: valid fixtures pass the schema', async () => {
  const fixtures = await loadFixtures('valid');
  assert.ok(fixtures.length >= 2, 'expected at least two valid fixtures');

  for (const fixture of fixtures) {
    const result = schemaFor(fixture.frontmatter).safeParse(fixture.frontmatter);
    assert.ok(
      result.success,
      `valid fixture "${fixture.name}" was rejected: ${
        result.success ? '' : JSON.stringify(result.error.issues, null, 2)
      }`,
    );
  }
});

test('Layer 1: every invalid-layer1 fixture is rejected', async () => {
  const fixtures = await loadFixtures('invalid-layer1');
  assert.ok(fixtures.length >= 4, 'expected at least four Layer 1 fixtures');

  for (const fixture of fixtures) {
    const result = schemaFor(fixture.frontmatter).safeParse(fixture.frontmatter);
    assert.equal(
      result.success,
      false,
      `invalid fixture "${fixture.name}" was ACCEPTED by the schema`,
    );
  }
});

test('Layer 1: taxonomy rejection names the offending field', async () => {
  const fixtures = await loadFixtures('invalid-layer1');
  const fixture = fixtures.find((f) => f.name === 'invalid-taxonomy');
  assert.ok(fixture, 'invalid-taxonomy fixture missing');

  const result = schemaFor(fixture.frontmatter).safeParse(fixture.frontmatter);
  assert.equal(result.success, false);
  if (result.success) return;

  const paths = result.error.issues.map((i) => i.path.join('.'));
  assert.ok(
    paths.some((p) => p.startsWith('topics')),
    `expected a "topics" issue, got: ${paths.join(', ')}`,
  );
});

test('Layer 1: publicationState is required with no default', async () => {
  // The central guarantee of decision item 3: a record cannot omit its
  // publication state and drift into the corpus.
  const fixtures = await loadFixtures('invalid-layer1');
  const fixture = fixtures.find((f) => f.name === 'missing-publication-state');
  assert.ok(fixture, 'missing-publication-state fixture missing');

  const result = schemaFor(fixture.frontmatter).safeParse(fixture.frontmatter);
  assert.equal(result.success, false, 'publicationState was treated as optional');
  if (result.success) return;

  const paths = result.error.issues.map((i) => i.path.join('.'));
  assert.ok(
    paths.includes('publicationState'),
    `expected a "publicationState" issue, got: ${paths.join(', ')}`,
  );
});

test('Layer 1: missing required brief fields are all reported', async () => {
  const fixtures = await loadFixtures('invalid-layer1');
  const fixture = fixtures.find((f) => f.name === 'missing-required-field');
  assert.ok(fixture, 'missing-required-field fixture missing');

  const result = schemaFor(fixture.frontmatter).safeParse(fixture.frontmatter);
  assert.equal(result.success, false);
  if (result.success) return;

  const paths = result.error.issues.map((i) => i.path.join('.'));
  for (const expected of ['briefAnswer', 'claimClasses', 'indonesiaRelevance', 'uncertainty']) {
    assert.ok(paths.includes(expected), `missing field "${expected}" was not reported`);
  }
});

test('Layer 1: relationship type outside the eleven controlled types is rejected', async () => {
  const fixtures = await loadFixtures('invalid-layer1');
  const fixture = fixtures.find((f) => f.name === 'invalid-relationship-type');
  assert.ok(fixture, 'invalid-relationship-type fixture missing');

  const result = schemaFor(fixture.frontmatter).safeParse(fixture.frontmatter);
  assert.equal(result.success, false);
  if (result.success) return;

  const paths = result.error.issues.map((i) => i.path.join('.'));
  assert.ok(
    paths.some((p) => p.startsWith('relationships')),
    `expected a "relationships" issue, got: ${paths.join(', ')}`,
  );
});

// ===========================================================================
// Layer 2 - cross-record integrity validation
// ===========================================================================

test('Layer 2: valid fixture corpus passes every check', async () => {
  const fixtures = await loadFixtures('valid');
  const records = fixtures.map((f) => toValidatable(f.name, f.frontmatter));

  const failures = validateCorpus(records, 'development');
  assert.deepEqual(
    failures,
    [],
    `valid corpus produced failures:\n${failures.map((f) => f.message).join('\n')}`,
  );
});

test('Layer 2 check 1: duplicate canonical ID is rejected', async () => {
  const valid = await loadFixtures('valid');
  const invalid = await loadFixtures('invalid-layer2');
  const duplicate = invalid.find((f) => f.name === 'duplicate-canonical-id');
  assert.ok(duplicate, 'duplicate-canonical-id fixture missing');

  // The duplicate collides with a valid fixture's canonicalId.
  const records = [
    ...valid.map((f) => toValidatable(f.name, f.frontmatter)),
    toValidatable(duplicate.name, duplicate.frontmatter),
  ];

  const failures = validateCorpus(records, 'development');
  assert.ok(checksFired(failures).has(1), 'check 1 (duplicate canonical ID) did not fire');
});

test('Layer 2 check 2: relationship to a non-existent record is rejected', async () => {
  const invalid = await loadFixtures('invalid-layer2');
  const broken = invalid.find((f) => f.name === 'broken-relationship');
  assert.ok(broken, 'broken-relationship fixture missing');

  const failures = validateCorpus([toValidatable(broken.name, broken.frontmatter)], 'development');
  assert.ok(checksFired(failures).has(2), 'check 2 (broken relationship) did not fire');
});

test('Layer 2 check 4: public record without a source is rejected', async () => {
  const invalid = await loadFixtures('invalid-layer2');
  const noSource = invalid.find((f) => f.name === 'missing-source');
  assert.ok(noSource, 'missing-source fixture missing');

  const failures = validateCorpus(
    [toValidatable(noSource.name, noSource.frontmatter)],
    'development',
  );
  assert.ok(checksFired(failures).has(4), 'check 4 (missing source) did not fire');
});

test('Layer 2 check 6: incoherent content type / navigation category is rejected', async () => {
  const invalid = await loadFixtures('invalid-layer2');
  const wrongCategory = invalid.find((f) => f.name === 'wrong-navigation-category');
  assert.ok(wrongCategory, 'wrong-navigation-category fixture missing');

  const failures = validateCorpus(
    [toValidatable(wrongCategory.name, wrongCategory.frontmatter)],
    'development',
  );
  assert.ok(checksFired(failures).has(6), 'check 6 (navigation coherence) did not fire');
});

test('Layer 2 check 7: corrected status without a correction record is rejected', async () => {
  const invalid = await loadFixtures('invalid-layer2');
  const corrected = invalid.find((f) => f.name === 'corrected-without-record');
  assert.ok(corrected, 'corrected-without-record fixture missing');

  const failures = validateCorpus(
    [toValidatable(corrected.name, corrected.frontmatter)],
    'development',
  );
  assert.ok(checksFired(failures).has(7), 'check 7 (lifecycle coherence) did not fire');
});

test('Layer 2 check 8: superseded record with an unresolvable target is rejected', async () => {
  const invalid = await loadFixtures('invalid-layer2');
  const superseded = invalid.find((f) => f.name === 'superseded-missing-target');
  assert.ok(superseded, 'superseded-missing-target fixture missing');

  const failures = validateCorpus(
    [toValidatable(superseded.name, superseded.frontmatter)],
    'development',
  );
  assert.ok(checksFired(failures).has(8), 'check 8 (supersession target) did not fire');
});

test('Layer 2 check 9: a test fixture is rejected in a production build', async () => {
  // Defence in depth behind src/lib/corpus.ts. Fixtures are declared
  // publicationState: test-fixture, so a production build must refuse them.
  const valid = await loadFixtures('valid');
  const records = valid.map((f) => toValidatable(f.name, f.frontmatter));

  const devFailures = validateCorpus(records, 'development');
  assert.equal(
    checksFired(devFailures).has(9),
    false,
    'check 9 must not fire during development',
  );

  const prodFailures = validateCorpus(records, 'production');
  assert.ok(
    checksFired(prodFailures).has(9),
    'check 9 did not fire in a production build; a fixture could reach production',
  );
});

test('Layer 2: every rejection class required by decision item 3 is covered', async () => {
  // Guards the fixture set itself. If a fixture is deleted or silently stops
  // failing, this test names the uncovered obligation instead of passing quietly.
  const valid = await loadFixtures('valid');
  const invalid = await loadFixtures('invalid-layer2');

  const all = [
    ...valid.map((f) => toValidatable(f.name, f.frontmatter)),
    ...invalid.map((f) => toValidatable(f.name, f.frontmatter)),
  ];

  const fired = checksFired(validateCorpus(all, 'production'));

  const obligations: Array<[number, string]> = [
    [1, 'duplicate canonical ID rejection'],
    [2, 'broken relationship rejection'],
    [4, 'source validation'],
    [6, 'content type / navigation coherence'],
    [7, 'lifecycle validation'],
    [8, 'correction/supersession validation'],
    [9, 'test fixture excluded from production'],
  ];

  const uncovered = obligations.filter(([check]) => !fired.has(check));
  assert.deepEqual(
    uncovered,
    [],
    `uncovered rejection classes: ${uncovered.map(([c, name]) => `check ${c} (${name})`).join(', ')}`,
  );
});

// ===========================================================================
// Corpus requirements
// ===========================================================================

test('Corpus: test fixtures cannot satisfy the minimum corpus', async () => {
  // Fixtures must never stand in for real editorial work.
  const valid = await loadFixtures('valid');
  const records = valid.map((f) => ({
    collection: 'market-briefs',
    canonicalId: String(f.frontmatter.canonicalId ?? ''),
    contentType: String(f.frontmatter.contentType ?? ''),
    publicationState: String(f.frontmatter.publicationState ?? ''),
    status: String(f.frontmatter.status ?? ''),
    relationships: (f.frontmatter.relationships ?? []) as Array<{ type: string; target: string }>,
  }));

  const shortfalls = evaluateCorpus(records, PUBLIC_STATUSES);
  assert.ok(
    shortfalls.some((s) => s.collection === 'market-briefs'),
    'test fixtures were counted toward the market-briefs minimum',
  );
});

test('Corpus: three publishable briefs satisfy the numeric floor', async () => {
  const records = [1, 2, 3].map((n) => ({
    collection: 'market-briefs',
    canonicalId: `brief-${n}`,
    contentType: 'market-brief',
    publicationState: 'production',
    status: 'published',
    relationships: [],
  }));

  const shortfalls = evaluateCorpus(records, PUBLIC_STATUSES);
  assert.deepEqual(
    shortfalls,
    [],
    `expected the floor to be satisfied, got: ${shortfalls.map((s) => s.message).join('; ')}`,
  );
});

test('Corpus: a brief referencing an absent concept is a shortfall', async () => {
  // Product_Requirements.md:182 - the concept explainers a brief depends on must exist.
  const records = [1, 2, 3].map((n) => ({
    collection: 'market-briefs',
    canonicalId: `brief-${n}`,
    contentType: 'market-brief',
    publicationState: 'production',
    status: 'published',
    relationships:
      n === 1 ? [{ type: 'learn-next', target: 'konsep-yang-belum-ditulis' }] : [],
  }));

  const shortfalls = evaluateCorpus(records, PUBLIC_STATUSES);
  assert.ok(
    shortfalls.some((s) => s.message.includes('konsep-yang-belum-ditulis')),
    'an unresolved concept dependency was not reported',
  );
});

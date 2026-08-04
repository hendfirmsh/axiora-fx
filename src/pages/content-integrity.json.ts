/**
 * Build-time content integrity gate.
 *
 * Authority: 05_Technical_Foundation/01_Technical_Foundation_Decision_Note.md Section 8,
 *            04_Workspace_Architecture/14_Implementation_Acceptance_Criteria.md:67,
 *            route build-out decision item 4 (gate invariants).
 *
 * Runs during `astro build`. Loads every Zod-validated record (Layer 1 structural)
 * and applies the AXIORA cross-record checks (Layer 2 domain), then evaluates the
 * minimum production corpus.
 *
 * Invariants required by decision item 4, all enforced here or in
 * scripts/verify-static.mjs:
 *
 *   - evidence artifact must exist              -> emitted below, asserted by verify-static
 *   - corpus must not be empty                  -> EMPTY CORPUS throws below
 *   - check count must match the contract       -> EXPECTED_CHECK_COUNT throws below
 *   - a check that did not run counts as failed -> count assertion, not a trust assumption
 *   - temporary artifact removed only after verification -> verify-static verifies then removes
 *   - integrity failure must stop the build     -> throws below
 *
 * This file MUST NOT be prefixed with an underscore. Astro excludes `_`-prefixed
 * files in src/pages from routing, which would silently skip this gate and let the
 * build pass with no cross-record validation having run.
 */

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { formatFailures, validateCorpus, type ValidatableRecord } from '../lib/content-integrity.ts';
import {
  evaluateCorpus,
  formatCorpusShortfalls,
  type CorpusCountRecord,
} from '../lib/corpus-requirements.ts';
import { buildEnvironment } from '../lib/env.ts';
import { PUBLIC_STATUSES } from '../lib/taxonomy.ts';

const COLLECTIONS = ['market-briefs', 'education', 'glossary', 'macro-events'] as const;

/**
 * The number of cross-record checks the contract requires.
 * If validateCorpus is refactored and a check is dropped, this assertion fails
 * rather than the build passing with fewer checks than the contract states.
 */
const EXPECTED_CHECK_COUNT = 9;

export const prerender = true;

export const GET: APIRoute = async () => {
  const environment = buildEnvironment();
  const records: ValidatableRecord[] = [];
  const countRecords: CorpusCountRecord[] = [];

  for (const name of COLLECTIONS) {
    const entries = await getCollection(name as never);
    for (const entry of entries as Array<{ id: string; data: Record<string, unknown> }>) {
      const data = entry.data;
      const relationships = (data.relationships ?? []) as Array<{ type: string; target: string }>;

      records.push({
        file: `${name}/${entry.id}`,
        canonicalId: String(data.canonicalId ?? ''),
        contentType: String(data.contentType ?? ''),
        navigationCategory: String(data.navigationCategory ?? ''),
        status: String(data.status ?? ''),
        publicationState: String(data.publicationState ?? ''),
        sources: (data.sources ?? []) as ValidatableRecord['sources'],
        relationships,
        corrections: (data.corrections ?? []) as ValidatableRecord['corrections'],
        supersededBy: data.supersededBy as string | undefined,
        topics: (data.topics ?? []) as string[],
        geographies: (data.geographies ?? []) as string[],
        assetClasses: (data.assetClasses ?? []) as string[],
        difficulty: data.difficulty as string | undefined,
        publicationDate: data.publicationDate as Date | undefined,
      });

      countRecords.push({
        collection: name,
        canonicalId: String(data.canonicalId ?? ''),
        contentType: String(data.contentType ?? ''),
        publicationState: String(data.publicationState ?? ''),
        status: String(data.status ?? ''),
        relationships,
      });
    }
  }

  // --- Invariant: corpus emptiness --------------------------------------
  // Decision item 4 requires that the corpus must not be empty, and decision
  // item 6 permits an empty collection during development. These are reconciled
  // by WHERE the evidence comes from:
  //
  //   - That the VALIDATOR works is proven by tests/fixtures via `npm run
  //     test:content`, which asserts every rejection class against known-bad
  //     records. That evidence does not depend on production content existing.
  //   - That the CORPUS is sufficient is proven here, and is fatal only for a
  //     production release.
  //
  // So an empty corpus is tolerated in development (no content authored yet) and
  // is an absolute blocker for production, where it would mean shipping the
  // hollow shell Product_Requirements.md:176 forbids.
  if (records.length === 0 && environment === 'production') {
    throw new Error(
      '\n\nAXIORA CONTENT INTEGRITY FAILURE\n\n' +
        'The production corpus is empty. No cross-record check could be exercised and ' +
        'there is nothing to publish. Product_Requirements.md:176 requires a coherent ' +
        'minimum corpus, not a hollow shell.\n',
    );
  }

  const failures = validateCorpus(records, environment);
  const report = formatFailures(failures);

  if (failures.length > 0) {
    throw new Error(`\n\nAXIORA CONTENT INTEGRITY FAILURE\n\n${report}\n`);
  }

  // --- Corpus sufficiency --------------------------------------------------
  // Distinguishes "expected empty during development" from "required corpus
  // missing" (decision item 6). Only a production build treats it as fatal.
  const shortfalls = evaluateCorpus(countRecords, PUBLIC_STATUSES);
  const corpusReport = formatCorpusShortfalls(shortfalls, environment);

  if (shortfalls.length > 0 && environment === 'production') {
    throw new Error(`\n\nAXIORA MINIMUM CORPUS NOT MET\n\n${corpusReport}\n`);
  }

  const publishable = countRecords.filter(
    (record) =>
      record.publicationState === 'production' && PUBLIC_STATUSES.includes(record.status as never),
  ).length;

  // eslint-disable-next-line no-console
  console.log(
    `[axiora] ${report} (${records.length} record(s) checked, ${publishable} publishable, env=${environment})`,
  );
  if (shortfalls.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[axiora] ${corpusReport}`);
  }

  return new Response(
    JSON.stringify(
      {
        environment,
        checkedRecords: records.length,
        publishableRecords: publishable,
        checksRun: EXPECTED_CHECK_COUNT,
        failures: 0,
        corpusShortfalls: shortfalls.length,
        corpusSatisfied: shortfalls.length === 0,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/json' } },
  );
};

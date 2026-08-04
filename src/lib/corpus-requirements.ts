/**
 * Minimum production corpus requirements.
 *
 * Authority: 01_Product/Product_Requirements.md:176-182,
 *            route build-out decision item 6.
 *
 * Product_Requirements.md:176 states the MVP "must contain a coherent minimum
 * corpus, not a hollow shell", and :181-182 set the specific floor:
 *
 *   - at least three cornerstone market-context briefs using the same
 *     evidence-to-understanding structure;
 *   - linked concept explainers limited to concepts necessary for those briefs.
 *
 * The second requirement is a RELATIONAL floor, not a count. "Limited to concepts
 * necessary" means the correct number of education articles is exactly those the
 * briefs actually reference. A fixed minimum would be wrong in both directions,
 * so this is validated by resolving each brief's learn-next and prerequisite
 * targets instead.
 *
 * Glossary and Macro Events have no numeric floor. Page_Inventory.md:16 scopes
 * the glossary to "Required as corpus needs" and :10 scopes Today's Brief to
 * "Required when corpus exists". An empty glossary is therefore a legitimate MVP
 * state, and the Astro loader warning for an empty collection is expected rather
 * than a defect. Adding a dummy record to silence that warning is explicitly
 * forbidden by decision item 6.
 */

/** Collections with a hard numeric floor before a production release. */
export const CORPUS_MINIMUMS = {
  'market-briefs': {
    minimum: 3,
    authority: 'Product_Requirements.md:181',
    rationale:
      'At least three cornerstone market-context briefs sharing the evidence-to-understanding structure.',
  },
} as const;

/**
 * Collections with no numeric floor. Emptiness is a valid state; the Astro
 * "collection does not exist or is empty" warning is expected for these during
 * development and must not be silenced with placeholder records.
 */
export const OPTIONAL_COLLECTIONS = {
  glossary: {
    authority: 'Page_Inventory.md:16',
    rationale: 'Required as corpus needs; terminology drives entries, not a quota.',
  },
  'macro-events': {
    authority: 'Page_Inventory.md:10',
    rationale: 'Dated event context is created when a brief needs it.',
  },
  education: {
    authority: 'Product_Requirements.md:182',
    rationale:
      'Limited to concepts necessary for published briefs; validated relationally, not by count.',
  },
} as const;

export interface CorpusShortfall {
  collection: string;
  authority: string;
  found: number;
  required: number;
  message: string;
}

/** Record shape needed to evaluate corpus sufficiency. */
export interface CorpusCountRecord {
  collection: string;
  canonicalId: string;
  contentType: string;
  publicationState: string;
  status: string;
  relationships: Array<{ type: string; target: string }>;
}

/** Relationship types that oblige a supporting education or glossary record. */
const CONCEPT_DEPENDENCY_TYPES = ['learn-next', 'prerequisite', 'defines', 'applies-concept'];

/**
 * Evaluate the publishable corpus against the minimum.
 *
 * Only production-state, publicly readable records count. A test fixture can
 * never satisfy a corpus requirement — that would let fixtures stand in for real
 * editorial work, which is exactly what decision item 3 forbids.
 */
export function evaluateCorpus(
  records: CorpusCountRecord[],
  publicStatuses: readonly string[],
): CorpusShortfall[] {
  const shortfalls: CorpusShortfall[] = [];

  const publishable = records.filter(
    (record) =>
      record.publicationState === 'production' && publicStatuses.includes(record.status),
  );

  // --- Numeric floors ------------------------------------------------------
  for (const [collection, requirement] of Object.entries(CORPUS_MINIMUMS)) {
    const found = publishable.filter((record) => record.collection === collection).length;
    if (found < requirement.minimum) {
      shortfalls.push({
        collection,
        authority: requirement.authority,
        found,
        required: requirement.minimum,
        message:
          `Collection "${collection}" holds ${found} publishable record(s) but ${requirement.minimum} ` +
          `are required by ${requirement.authority}. ${requirement.rationale} ` +
          'Test fixtures and non-public records do not count toward this floor.',
      });
    }
  }

  // --- Relational floor: referenced concepts must exist -------------------
  const knownIds = new Set(publishable.map((record) => record.canonicalId));
  for (const record of publishable) {
    if (record.collection !== 'market-briefs') continue;
    for (const relationship of record.relationships) {
      if (!CONCEPT_DEPENDENCY_TYPES.includes(relationship.type)) continue;
      if (!knownIds.has(relationship.target)) {
        shortfalls.push({
          collection: 'education',
          authority: 'Product_Requirements.md:182',
          found: 0,
          required: 1,
          message:
            `Brief "${record.canonicalId}" declares "${relationship.type}" -> "${relationship.target}", ` +
            'but no publishable record provides it. Product_Requirements.md:182 requires the concept ' +
            'explainers that published briefs depend on to exist.',
        });
      }
    }
  }

  return shortfalls;
}

/** Reviewer-facing report. */
export function formatCorpusShortfalls(shortfalls: CorpusShortfall[], environment: string): string {
  if (shortfalls.length === 0) {
    return 'Corpus requirements: minimum production corpus satisfied.';
  }

  const heading =
    environment === 'production'
      ? `Corpus requirements NOT MET: ${shortfalls.length} shortfall(s). A production release is blocked.`
      : `Corpus requirements not yet met: ${shortfalls.length} shortfall(s). Expected during development; blocks production release.`;

  return [heading, '', ...shortfalls.map((s) => `  - [${s.collection}] ${s.message}`), ''].join('\n');
}

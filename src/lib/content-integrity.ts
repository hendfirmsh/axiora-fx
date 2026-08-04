/**
 * AXIORA cross-record content integrity validation - Layer 2.
 *
 * Authority: 05_Technical_Foundation/01_Technical_Foundation_Decision_Note.md Section 8,
 *            04_Workspace_Architecture/14_Implementation_Acceptance_Criteria.md:66-67
 *
 * Astro/Zod validates the structure of a record. This module validates integrity
 * BETWEEN records: taxonomy, sources, lifecycle, correction state, and canonical
 * relationships. Framework capability is not a substitute for domain validation.
 *
 * All eight checks below abort the build on failure. The report names the
 * offending record and the specific failed check so an editorial reviewer can
 * act without reading build internals.
 */

import {
  CONTENT_TYPE_NAVIGATION,
  CURRENT_STATUSES,
  INTERNAL_RELATIONSHIP_TYPES,
  LIFECYCLE_STATUSES,
  PUBLIC_STATUSES,
  RELATIONSHIP_TYPES,
  SOURCE_REQUIRED_TYPES,
  TOPICS,
  GEOGRAPHIES,
  ASSET_CLASSES,
  DIFFICULTIES,
} from './taxonomy.ts';

/** A validation failure, tied to a record and a numbered check. */
export interface IntegrityFailure {
  check: number;
  checkName: string;
  recordId: string;
  file: string;
  message: string;
}

/** Minimal record shape this validator needs. Collection-agnostic. */
export interface ValidatableRecord {
  file: string;
  canonicalId: string;
  contentType: string;
  navigationCategory: string;
  status: string;
  /** 'production' | 'test-fixture'. Governs check 9. */
  publicationState: string;
  sources: Array<{ title?: string; publisher?: string; url?: string }>;
  relationships: Array<{ type: string; target: string }>;
  corrections: Array<{ affectedSection?: string; currentVersion?: string }>;
  supersededBy?: string;
  topics: string[];
  geographies: string[];
  assetClasses: string[];
  difficulty?: string;
  publicationDate?: Date;
}

const CHECK_NAMES: Record<number, string> = {
  1: 'Duplicate canonical ID',
  2: 'Relationship to a non-existent ID',
  3: 'Invalid relationship type',
  4: 'Missing required source',
  5: 'Unregistered taxonomy value',
  6: 'Inconsistent content type and navigation category',
  7: 'Invalid lifecycle status',
  8: 'Correction or superseded record missing its target',
  9: 'Test fixture present in a production build',
};

function fail(
  failures: IntegrityFailure[],
  check: number,
  record: ValidatableRecord,
  message: string,
): void {
  failures.push({
    check,
    checkName: CHECK_NAMES[check] ?? 'Unknown check',
    recordId: record.canonicalId,
    file: record.file,
    message,
  });
}

/**
 * Run all integrity checks over the full corpus.
 * Returns every failure found; it does not stop at the first.
 *
 * `environment` governs check 9 only. Every other check is environment-independent:
 * a broken knowledge graph is a defect in development too.
 */
export function validateCorpus(
  records: ValidatableRecord[],
  environment: 'development' | 'production' = 'development',
): IntegrityFailure[] {
  const failures: IntegrityFailure[] = [];

  // --- Check 9: no test fixture may survive into a production build --------
  // Defence in depth. src/lib/corpus.ts already excludes fixtures from every
  // route, but that is a rendering-time filter. This is a release-time assertion
  // that the production corpus contains no fixture at all.
  if (environment === 'production') {
    for (const record of records) {
      if (record.publicationState === 'test-fixture') {
        fail(
          failures,
          9,
          record,
          'Record is declared "test-fixture" but this is a production build. ' +
            'Test fixtures must live outside the production corpus and may never be released.',
        );
      }
    }
  }

  // Build the canonical ID index once, and detect check 1 while doing it.
  const idToRecords = new Map<string, ValidatableRecord[]>();
  for (const record of records) {
    const existing = idToRecords.get(record.canonicalId);
    if (existing) {
      existing.push(record);
    } else {
      idToRecords.set(record.canonicalId, [record]);
    }
  }

  // --- Check 1: duplicate canonical ID ------------------------------------
  for (const [id, group] of idToRecords) {
    if (group.length > 1) {
      const files = group.map((r) => r.file).join(', ');
      for (const record of group) {
        fail(
          failures,
          1,
          record,
          `Canonical ID "${id}" is declared by ${group.length} records: ${files}. Canonical IDs must be unique.`,
        );
      }
    }
  }

  const knownIds = new Set(idToRecords.keys());

  for (const record of records) {
    // --- Check 3: invalid relationship type -------------------------------
    for (const rel of record.relationships) {
      if (!RELATIONSHIP_TYPES.includes(rel.type as never)) {
        fail(
          failures,
          3,
          record,
          `Relationship type "${rel.type}" is not one of the eleven controlled types. Allowed: ${RELATIONSHIP_TYPES.join(', ')}.`,
        );
      }
    }

    // --- Check 2: relationship target must resolve ------------------------
    for (const rel of record.relationships) {
      if (!INTERNAL_RELATIONSHIP_TYPES.includes(rel.type as never)) {
        // e.g. evidence-source points outward, not at a canonical record.
        continue;
      }
      if (!knownIds.has(rel.target)) {
        fail(
          failures,
          2,
          record,
          `Relationship "${rel.type}" targets canonical ID "${rel.target}", which does not resolve to any known record.`,
        );
      }
      if (rel.target === record.canonicalId) {
        fail(
          failures,
          2,
          record,
          `Relationship "${rel.type}" targets the record itself ("${rel.target}"). Self-reference is not a valid knowledge relationship.`,
        );
      }
    }

    // --- Check 4: missing required source ---------------------------------
    if (SOURCE_REQUIRED_TYPES.includes(record.contentType as never)) {
      const isPublic = PUBLIC_STATUSES.includes(record.status as never);
      if (isPublic && record.sources.length === 0) {
        fail(
          failures,
          4,
          record,
          `Content type "${record.contentType}" with public status "${record.status}" has no source. Source backing is required before publication.`,
        );
      }
      record.sources.forEach((source, index) => {
        if (!source.title || !source.publisher) {
          fail(
            failures,
            4,
            record,
            `Source at index ${index} is incomplete: both title and publisher are required.`,
          );
        }
      });
    }

    // --- Check 5: unregistered taxonomy value -----------------------------
    for (const topic of record.topics) {
      if (!TOPICS.includes(topic as never)) {
        fail(
          failures,
          5,
          record,
          `Topic "${topic}" is not in the controlled vocabulary. Allowed: ${TOPICS.join(', ')}.`,
        );
      }
    }
    for (const geography of record.geographies) {
      if (!GEOGRAPHIES.includes(geography as never)) {
        fail(failures, 5, record, `Geography "${geography}" is not in the controlled vocabulary.`);
      }
    }
    for (const assetClass of record.assetClasses) {
      if (!ASSET_CLASSES.includes(assetClass as never)) {
        fail(failures, 5, record, `Asset class "${assetClass}" is not in the controlled vocabulary.`);
      }
    }
    if (record.difficulty && !DIFFICULTIES.includes(record.difficulty as never)) {
      fail(failures, 5, record, `Difficulty "${record.difficulty}" is not in the controlled vocabulary.`);
    }

    // --- Check 6: content type / navigation category coherence ------------
    const allowedCategories =
      CONTENT_TYPE_NAVIGATION[record.contentType as keyof typeof CONTENT_TYPE_NAVIGATION];
    if (!allowedCategories) {
      fail(
        failures,
        6,
        record,
        `Content type "${record.contentType}" has no permitted navigation category mapping.`,
      );
    } else if (!allowedCategories.includes(record.navigationCategory as never)) {
      fail(
        failures,
        6,
        record,
        `Content type "${record.contentType}" may not sit under navigation category "${record.navigationCategory}". Allowed: ${allowedCategories.join(', ')}.`,
      );
    }

    // --- Check 7: lifecycle status validity and coherence -----------------
    if (!LIFECYCLE_STATUSES.includes(record.status as never)) {
      fail(
        failures,
        7,
        record,
        `Status "${record.status}" is not a valid lifecycle state. Allowed: ${LIFECYCLE_STATUSES.join(', ')}.`,
      );
    }

    if (record.status === 'corrected' && record.corrections.length === 0) {
      fail(
        failures,
        7,
        record,
        `Status is "corrected" but no correction record is present. A corrected record must carry its correction history.`,
      );
    }

    if (record.status === 'superseded' && !record.supersededBy) {
      fail(
        failures,
        7,
        record,
        `Status is "superseded" but no "supersededBy" target is declared. A superseded record must name its replacement.`,
      );
    }

    if (CURRENT_STATUSES.includes(record.status as never) && !record.publicationDate) {
      fail(
        failures,
        7,
        record,
        `Status "${record.status}" presents the record as current, but no publication date is set.`,
      );
    }

    // --- Check 8: correction / supersede targets --------------------------
    if (record.supersededBy) {
      if (!knownIds.has(record.supersededBy)) {
        fail(
          failures,
          8,
          record,
          `"supersededBy" points to "${record.supersededBy}", which does not resolve to any known record.`,
        );
      }
      if (record.supersededBy === record.canonicalId) {
        fail(failures, 8, record, `A record cannot supersede itself ("${record.canonicalId}").`);
      }
    }

    record.corrections.forEach((correction, index) => {
      if (!correction.affectedSection) {
        fail(
          failures,
          8,
          record,
          `Correction at index ${index} does not name the affected section or claim.`,
        );
      }
    });

    // An "updates" or "supersedes" relationship must resolve; already covered by
    // check 2, but the affected-record requirement is restated for clarity here.
    for (const rel of record.relationships) {
      if ((rel.type === 'updates' || rel.type === 'supersedes') && !knownIds.has(rel.target)) {
        fail(
          failures,
          8,
          record,
          `Relationship "${rel.type}" declares an affected record "${rel.target}" that does not exist.`,
        );
      }
    }
  }

  return failures;
}

/** Format failures as a readable, reviewer-facing report. */
export function formatFailures(failures: IntegrityFailure[]): string {
  if (failures.length === 0) {
    return 'Content integrity: all 9 cross-record checks passed.';
  }

  const byCheck = new Map<number, IntegrityFailure[]>();
  for (const failure of failures) {
    const group = byCheck.get(failure.check);
    if (group) group.push(failure);
    else byCheck.set(failure.check, [failure]);
  }

  const lines: string[] = [
    `Content integrity FAILED: ${failures.length} problem(s) across ${byCheck.size} check(s).`,
    '',
  ];

  for (const check of [...byCheck.keys()].sort((a, b) => a - b)) {
    const group = byCheck.get(check) ?? [];
    lines.push(`Check ${check} - ${CHECK_NAMES[check]} (${group.length}):`);
    for (const failure of group) {
      lines.push(`  - [${failure.recordId}] ${failure.file}`);
      lines.push(`    ${failure.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

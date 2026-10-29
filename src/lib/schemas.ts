/**
 * AXIORA content schemas — Layer 1 structural validation.
 *
 * Authority: 05_Technical_Foundation/01_Technical_Foundation_Decision_Note.md Section 8,
 *            02.8_Content_Architecture/02_Content_Model.md
 *
 * Schemas live here, separate from src/content.config.ts, so they can be imported
 * by the fixture test harness in plain Node. `astro/zod` is the same Zod instance
 * that `astro:content` re-exports, so this is the identical validator Astro applies
 * during a build — not a parallel reimplementation that could drift from it.
 *
 * SCOPE BOUNDARY — read before adding a check here.
 *
 * These schemas validate the SHAPE of a single record: presence, type, and
 * membership in a declared enum. They cannot see other records.
 *
 * They do NOT validate:
 *   - duplicate canonical IDs
 *   - relationship targets resolving to real records
 *   - required sources by content type
 *   - content type / navigation category coherence
 *   - lifecycle coherence
 *   - correction / supersede targets
 *   - test fixtures leaking into a production build
 *
 * Those are cross-record concerns owned by src/lib/content-integrity.ts.
 * Framework capability is not a substitute for domain validation.
 */

import { z } from 'astro/zod';

import {
  ASSET_CLASSES,
  CAPABILITY_LABELS,
  CLAIM_CLASSES,
  DIFFICULTIES,
  GEOGRAPHIES,
  LANGUAGES,
  LIFECYCLE_STATUSES,
  NAVIGATION_CATEGORIES,
  PUBLICATION_STATES,
  RELATIONSHIP_TYPES,
  TOPICS,
} from './taxonomy.ts';

/**
 * A source reference. Made inspectable per 10_Component_Inventory.md (Source Block):
 * title, publisher, date/access context, and external link state.
 */
export const sourceSchema = z.object({
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url().optional(),
  publishedDate: z.coerce.date().optional(),
  accessedDate: z.coerce.date().optional(),
  state: z.enum(['available', 'unavailable', 'archived']).default('available'),
});

/**
 * A typed relationship. Only the eleven controlled types are accepted.
 * Target resolution is a cross-record concern (integrity check 2).
 */
export const relationshipSchema = z.object({
  type: z.enum(RELATIONSHIP_TYPES),
  target: z.string().min(1),
  rationale: z.string().optional(),
});

/** A correction record entry. Fields required by decision K-03. */
export const correctionSchema = z.object({
  date: z.coerce.date(),
  affectedSection: z.string().min(1),
  incorrectClaim: z.string().min(1),
  change: z.string().min(1),
  impact: z.string().min(1),
  reviewer: z.string().min(1),
  previousVersion: z.string().min(1),
  currentVersion: z.string().min(1),
});

/**
 * Shared metadata from 02.8_Content_Architecture/02_Content_Model.md.
 * Every content record carries these fields.
 */
export const sharedMetadata = z.object({
  canonicalId: z.string().min(1),
  /**
   * REQUIRED, no default. Declares whether the record belongs to the production
   * corpus at all. A lifecycle `status` describes editorial progress and is not a
   * substitute: an omitted field cannot be audited, and a permissive default
   * publishes by accident.
   */
  publicationState: z.enum(PUBLICATION_STATES),
  navigationCategory: z.enum(NAVIGATION_CATEGORIES),
  title: z.string().min(1),
  summary: z.string().min(1),
  status: z.enum(LIFECYCLE_STATUSES),
  language: z.enum(LANGUAGES).default('id'),
  owner: z.string().min(1),
  contributors: z.array(z.string()).default([]),
  reviewers: z.array(z.string()).default([]),
  publicationDate: z.coerce.date().optional(),
  lastReviewedDate: z.coerce.date().optional(),
  nextReviewTrigger: z.string().min(1),
  sources: z.array(sourceSchema).default([]),
  disclosure: z.string().min(1),
  relationships: z.array(relationshipSchema).default([]),
  version: z.string().min(1),
  corrections: z.array(correctionSchema).default([]),
  supersededBy: z.string().optional(),
  capabilityLabel: z.enum(CAPABILITY_LABELS).default('current'),
  topics: z.array(z.enum(TOPICS)).default([]),
  geographies: z.array(z.enum(GEOGRAPHIES)).default([]),
  assetClasses: z.array(z.enum(ASSET_CLASSES)).default([]),
  difficulty: z.enum(DIFFICULTIES).optional(),
});

/**
 * Market Brief — primary MVP content type.
 * Reading sequence is enforced by the template, not the schema; the schema
 * guarantees the qualifying metadata exists.
 */
export const marketBriefSchema = sharedMetadata.extend({
  contentType: z.literal('market-brief'),
  briefAnswer: z.string().min(1),
  /** Claim class per assertion keeps evidence and interpretation distinguishable. */
  claimClasses: z.array(z.enum(CLAIM_CLASSES)).min(1),
  indonesiaRelevance: z.string().min(1),
  uncertainty: z.string().min(1),
  topics: z.array(z.enum(TOPICS)).min(1),
});

/** Education Article — explainers required by briefs. */
export const educationArticleSchema = sharedMetadata.extend({
  contentType: z.literal('education-article'),
  learningObjective: z.string().min(1),
  difficulty: z.enum(DIFFICULTIES),
  limits: z.string().min(1),
});

/** Glossary Entry — canonical terminology. */
export const glossaryEntrySchema = sharedMetadata.extend({
  contentType: z.literal('glossary-entry'),
  term: z.string().min(1),
  definition: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  difficulty: z.enum(DIFFICULTIES),
});

/** Macro Event — dated event context for briefs and Calendar. */
export const macroEventSchema = sharedMetadata.extend({
  contentType: z.literal('macro-events'),
  /** ISO calendar date of the release, yyyy-mm-dd. */
  eventDate: z.coerce.date(),
  /** 24-hour release time in the source timezone, HH:MM. */
  releaseTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  /** IANA timezone of the release time (e.g., "America/New_York"). */
  releaseTimezone: z.string().min(1),
  /** Release country/region (ISO 3166-1 alpha-2). */
  country: z.string().length(2),
  /** Currency most affected (ISO 4217). */
  currency: z.string().length(3),
  /** Market-impact tier. */
  impact: z.enum(['high', 'medium', 'low']),
  /** Human-readable indicator name (Indonesian). */
  indicator: z.string().min(1),
  /** Prior print. Optional. */
  previous: z.string().optional(),
  /** Market consensus/forecast. Optional. */
  forecast: z.string().optional(),
  /** Released value. Optional; null/absent means not yet released. */
  actual: z.string().optional(),
  /** Optional expandable note (methodology, caveat). */
  note: z.string().optional(),
});

/** Schema lookup by collection name, for the fixture harness. */
export const SCHEMAS = {
  'market-briefs': marketBriefSchema,
  education: educationArticleSchema,
  glossary: glossaryEntrySchema,
  'macro-events': macroEventSchema,
} as const;

export type CollectionName = keyof typeof SCHEMAS;

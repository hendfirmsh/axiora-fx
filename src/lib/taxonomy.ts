/**
 * AXIORA controlled vocabulary.
 *
 * Authority: 02.8_Content_Architecture/02_Content_Model.md,
 *            02.8_Content_Architecture/07_Taxonomy.md,
 *            02.8_Content_Architecture/08_Internal_Linking_Strategy.md
 *
 * This module is the single source of truth for every controlled value used by
 * the content schema (structural validation) and the integrity checker
 * (cross-record validation). Editorial synonyms are not permitted; a value that
 * is not listed here fails validation.
 *
 * Adding a value here is a content-architecture change and must follow the
 * change process in IMPLEMENTATION_CONTRACT.md Section 10.
 */

/** Content types. A record declares exactly one. */
export const CONTENT_TYPES = [
  'market-brief',
  'education-article',
  'glossary-entry',
  'macro-event',
] as const;

/**
 * Primary navigation categories. A record declares exactly one.
 * Mirrors the approved sidebar knowledge domains in 04_Knowledge_Navigation.md.
 */
export const NAVIGATION_CATEGORIES = [
  'market-intelligence',
  'education',
  'topics',
  'reference',
] as const;

/**
 * Topics. Exactly the six approved browsable topics (decision K-16).
 * No additional browsable facet may be introduced in MVP.
 */
export const TOPICS = [
  'macro',
  'gold',
  'usd',
  'oil',
  'inflation',
  'economy',
] as const;

/** Difficulty levels. */
export const DIFFICULTIES = [
  'foundation',
  'developing',
  'applied',
  'advanced',
] as const;

/**
 * Content lifecycle states.
 * Proposed -> Draft -> Editorial Review -> Specialist/Risk Review -> Approved
 * -> Published -> Reviewed/Updated -> Corrected -> Archived/Deprecated
 */
export const LIFECYCLE_STATUSES = [
  'proposed',
  'draft',
  'editorial-review',
  'specialist-review',
  'approved',
  'published',
  'updated',
  'corrected',
  'archived',
  'deprecated',
  'superseded',
] as const;

/** Statuses that make a record publicly readable. */
export const PUBLIC_STATUSES = [
  'published',
  'updated',
  'corrected',
  'archived',
  'deprecated',
  'superseded',
] as const;

/** Statuses that present a record as current guidance. */
export const CURRENT_STATUSES = ['published', 'updated', 'corrected'] as const;

/** The eleven controlled relationship types. */
export const RELATIONSHIP_TYPES = [
  'prerequisite',
  'learn-next',
  'defines',
  'applies-concept',
  'explains-event',
  'evidence-source',
  'deepens',
  'related-context',
  'contrasts',
  'updates',
  'supersedes',
] as const;

/** Relationship types whose target must resolve to an existing record. */
export const INTERNAL_RELATIONSHIP_TYPES = [
  'prerequisite',
  'learn-next',
  'defines',
  'applies-concept',
  'explains-event',
  'deepens',
  'related-context',
  'contrasts',
  'updates',
  'supersedes',
] as const;

/** Claim classes. Evidence and interpretation must remain distinguishable in text. */
export const CLAIM_CLASSES = [
  'verified-fact',
  'reported-view',
  'axiora-interpretation',
  'scenario',
  'unknown',
] as const;

/** Capability labels. */
export const CAPABILITY_LABELS = [
  'current',
  'in-validation',
  'approved-future-phase',
  'exploratory',
] as const;

/** Geography values. Metadata only; not a browsable route (K-16). */
export const GEOGRAPHIES = ['indonesia', 'united-states', 'china', 'global'] as const;

/** Asset classes. Metadata only; not a browsable route (K-16). */
export const ASSET_CLASSES = [
  'commodity',
  'currency',
  'equity',
  'fixed-income',
  'macro-indicator',
] as const;

/** MVP content language (decision K-05). Structure remains i18n-ready. */
export const LANGUAGES = ['id'] as const;

/**
 * Explicit publication state. REQUIRED on every record; there is deliberately
 * no default.
 *
 * A lifecycle `status` describes editorial progress. It does NOT describe whether
 * a record belongs to the production corpus at all. Relying on `reviewers: []`
 * or on a draft status to keep a record unpublished is a silent guarantee; an
 * absent field cannot be audited and a wrong default publishes by accident.
 *
 *   production   - belongs to the production corpus, subject to full editorial gates
 *   test-fixture - exists only to exercise validation; must never reach production
 *
 * Integrity check 9 fails the build if a test-fixture record is present when
 * AXIORA_ENV=production.
 */
export const PUBLICATION_STATES = ['production', 'test-fixture'] as const;

/**
 * Which content types are permitted under which primary navigation category.
 * Used by integrity check 6 (content type / navigation category coherence).
 */
export const CONTENT_TYPE_NAVIGATION: Record<
  (typeof CONTENT_TYPES)[number],
  ReadonlyArray<(typeof NAVIGATION_CATEGORIES)[number]>
> = {
  'market-brief': ['market-intelligence'],
  'education-article': ['education'],
  'glossary-entry': ['reference'],
  'macro-event': ['market-intelligence'],
};

/** Content types that must carry at least one source. */
export const SOURCE_REQUIRED_TYPES = [
  'market-brief',
  'education-article',
  'glossary-entry',
  'macro-event',
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];
export type NavigationCategory = (typeof NAVIGATION_CATEGORIES)[number];
export type Topic = (typeof TOPICS)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];
export type ClaimClass = (typeof CLAIM_CLASSES)[number];
export type CapabilityLabel = (typeof CAPABILITY_LABELS)[number];

/**
 * Production corpus access layer.
 *
 * Authority: 04_Workspace_Architecture/06_Page_Inventory.md,
 *            01_Product/Product_Requirements.md:176-182,
 *            route build-out decision items 3 and 6.
 *
 * SINGLE CHOKEPOINT. Every route, index, listing, search index, Today's Brief,
 * and related-content block MUST read content through this module. No page may
 * call getCollection() directly.
 *
 * Two filters are applied here, in this order, and they are not optional:
 *
 *   1. publicationState === 'production'
 *      Test fixtures are removed from the corpus entirely. They therefore cannot
 *      reach a route, sitemap, search index, Today's Brief, related content, or
 *      production output, as required by decision item 3.
 *
 *   2. status is a PUBLIC lifecycle status
 *      Drafts and in-review records are not publicly readable.
 *
 * Centralising this is the point: a filter repeated at each call site is a filter
 * that will eventually be forgotten at one of them.
 */

import { getCollection } from 'astro:content';

import { PUBLIC_STATUSES, type Topic } from './taxonomy.ts';

/** Collections that hold editorial records. */
export type CorpusCollection = 'market-briefs' | 'education' | 'glossary' | 'macro-events';

/** A corpus record: the Zod-validated frontmatter plus its rendering handle. */
export interface CorpusEntry {
  id: string;
  collection: CorpusCollection;
  data: Record<string, unknown>;
  render: () => Promise<{ Content: unknown; headings: Array<{ depth: number; slug: string; text: string }> }>;
}

/** True when a record is part of the production corpus AND publicly readable. */
function isPubliclyReadable(data: Record<string, unknown>): boolean {
  if (data.publicationState !== 'production') return false;
  return PUBLIC_STATUSES.includes(data.status as never);
}

/**
 * Read one collection, filtered to the publishable production corpus.
 * An empty result is a legitimate state and is never padded with placeholders.
 */
export async function getCorpus(collection: CorpusCollection): Promise<CorpusEntry[]> {
  const entries = await getCollection(collection as never);
  return (entries as unknown as CorpusEntry[]).filter((entry) => isPubliclyReadable(entry.data));
}

/**
 * Every publishable record across all collections.
 * Used by the search index and by cross-collection lookups.
 */
export async function getFullCorpus(): Promise<CorpusEntry[]> {
  const collections: CorpusCollection[] = [
    'market-briefs',
    'education',
    'glossary',
    'macro-events',
  ];
  const results = await Promise.all(collections.map((name) => getCorpus(name)));
  return results.flat();
}

/** Sort by publication date, newest first. Undated records sort last, stably. */
export function byNewest(a: CorpusEntry, b: CorpusEntry): number {
  const dateA = a.data.publicationDate as Date | undefined;
  const dateB = b.data.publicationDate as Date | undefined;
  if (!dateA && !dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;
  return dateB.getTime() - dateA.getTime();
}

/** Records carrying a given topic. */
export function withTopic(entries: CorpusEntry[], topic: Topic): CorpusEntry[] {
  return entries.filter((entry) => (entry.data.topics as string[] | undefined)?.includes(topic));
}

/**
 * Resolve a canonical ID to a record, for rendering typed relationships.
 * Returns undefined when the target is outside the publishable corpus, which is
 * why relationship rendering must degrade rather than assume resolution.
 */
export function findByCanonicalId(
  entries: CorpusEntry[],
  canonicalId: string,
): CorpusEntry | undefined {
  return entries.find((entry) => entry.data.canonicalId === canonicalId);
}

/** Route path for a record, derived from its collection. */
export function entryPath(entry: CorpusEntry): string {
  switch (entry.collection) {
    case 'market-briefs':
      return `/market-intelligence/${entry.id}/`;
    case 'education':
      return `/education/${entry.id}/`;
    case 'glossary':
      return `/glossary/${entry.id}/`;
    case 'macro-events':
      return `/market-intelligence/${entry.id}/`;
  }
}

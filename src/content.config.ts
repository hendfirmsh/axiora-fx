/**
 * AXIORA content collections.
 *
 * Authority: 05_Technical_Foundation/01_Technical_Foundation_Decision_Note.md Section 8.
 *
 * This file wires loaders to schemas. The schemas themselves live in
 * src/lib/schemas.ts so the fixture test harness can validate against the exact
 * same definitions in plain Node, with no risk of a parallel copy drifting.
 *
 * Layer 1 (here) validates single-record structure.
 * Layer 2 (src/lib/content-integrity.ts) validates integrity between records.
 * See src/lib/schemas.ts for the full scope boundary.
 */

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

import {
  educationArticleSchema,
  glossaryEntrySchema,
  macroEventSchema,
  marketBriefSchema,
} from './lib/schemas';

/**
 * Fixture records live in tests/fixtures/, outside every `base` below, so they
 * are not loaded into the corpus at all. Exclusion is structural, not a filter
 * that could be forgotten.
 */
const CONTENT_PATTERN = '**/[^_]*.{md,mdx}';

const marketBriefs = defineCollection({
  loader: glob({ pattern: CONTENT_PATTERN, base: './src/content/market-briefs' }),
  schema: marketBriefSchema,
});

const educationArticles = defineCollection({
  loader: glob({ pattern: CONTENT_PATTERN, base: './src/content/education' }),
  schema: educationArticleSchema,
});

const glossary = defineCollection({
  loader: glob({ pattern: CONTENT_PATTERN, base: './src/content/glossary' }),
  schema: glossaryEntrySchema,
});

const macroEvents = defineCollection({
  loader: glob({ pattern: CONTENT_PATTERN, base: './src/content/macro-events' }),
  schema: macroEventSchema,
});

export const collections = {
  'market-briefs': marketBriefs,
  education: educationArticles,
  glossary,
  'macro-events': macroEvents,
};

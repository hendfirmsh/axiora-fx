/**
 * AXIORA Market Calendar — editorial data adapter (Astro-dependent).
 *
 * Authority: user instruction (AXIORA Market Calendar feature, 2026-08-29),
 *            final report Phase D.
 *
 * This module loads approved Macro Event records from the Astro content layer
 * and normalises them to the CalendarEvent presentation model using pure
 * functions from calendar-pure.ts.
 *
 * DATA SAFETY: only records with publicationState="production" and a public
 * lifecycle status are included. Draft, fixture, and non-public records are
 * excluded. The adapter never fabricates values; missing fields are represented
 * as unavailable rather than invented.
 */

import { getCollection } from 'astro:content';

import type { CalendarEvent, ImpactLevel } from './calendar.ts';
import {
  convertToWib,
  normaliseMacroEvent,
  TIMEZONE_OFFSETS,
  WIB_OFFSET_MINUTES,
} from './calendar-pure.ts';

/**
 * Load all approved Macro Events and convert to CalendarEvent[].
 * Filters:
 *   - publicationState === 'production'
 *   - status is a public lifecycle status (published, updated, corrected, archived, deprecated, superseded)
 * Sorted by date then time (ascending).
 */
export async function getCalendarEventsFromMacroEvents(): Promise<CalendarEvent[]> {
  const PUBLIC_STATUSES = new Set([
    'published', 'updated', 'corrected', 'archived', 'deprecated', 'superseded'
  ]);

  const entries = await getCollection('macro-events');
  const events: CalendarEvent[] = [];

  for (const entry of entries) {
    const pubState = entry.data.publicationState;
    const status = entry.data.status;

    if (pubState !== 'production') continue;
    if (!PUBLIC_STATUSES.has(String(entry.data.status))) continue;

    try {
      const event = normaliseMacroEvent({
        id: entry.id,
        data: entry.data as any,
      });
      events.push(event);
    } catch (error) {
      // Log but don't throw — a single malformed record shouldn't break the calendar
      console.warn(`[calendar-adapter] Skipping macro-event ${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Sort by date then time
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  // Deduplicate by canonicalId (should not happen if integrity gate passes, but defensive)
  const seen = new Set<string>();
  const deduped = events.filter((e) => {
    if (seen.has(e.id)) {
      console.warn(`[calendar-adapter] Duplicate event id "${e.id}" — keeping first occurrence`);
      return false;
    }
    seen.add(e.id);
    return true;
  });

  return deduped;
}

/** Re-export pure functions for testing and page use. */
export { convertToWib, normaliseMacroEvent, TIMEZONE_OFFSETS, WIB_OFFSET_MINUTES } from './calendar-pure.ts';
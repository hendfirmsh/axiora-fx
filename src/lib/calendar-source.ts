/**
 * AXIORA Market Calendar — development notice.
 *
 * Authority: user instruction (AXIORA Market Calendar feature, 2026-08-29).
 *
 * DATA SAFETY — READ BEFORE TOUCHING ANY VALUE
 *
 *   - This module only exports the development notice. The illustrative
 *     development data has been moved to tests/fixtures/calendar-dev-fixture.ts
 *     and is ONLY used by tests.
 *   - The calendar page renders development data ONLY under a development build
 *     (showDevelopmentMarkers() === true). Under a production build the page
 *     uses the editorial Macro Event pipeline.
 *   - Never promote a value here to "approved" content. Approved economic data
 *     requires a sourced, editorial pipeline.
 *   - The reader-facing banner (CALENDAR_DEV_NOTICE) is the honesty contract.
 */

import type { CalendarEvent } from './calendar.ts';

/**
 * Reader-facing notice. Rendered prominently on the development calendar page
 * and echoed by tests so it cannot be dropped silently.
 */
export const CALENDAR_DEV_NOTICE =
  'Data pengembangan untuk peragaan antarmuka — bukan data pasar sesungguhnya. ' +
  'Sumber data ekonomi belum terhubung; angka sebelumnya dan konsensus di sini hanya contoh.';

/**
 * Development calendar dataset is no longer defined here.
 * It has been moved to tests/fixtures/calendar-dev-fixture.ts for test use only.
 * Import from there if needed for testing:
 *   import { CALENDAR_EVENTS_DEV } from '../../tests/fixtures/calendar-dev-fixture.ts';
 */
export const CALENDAR_EVENTS_DEV: CalendarEvent[] = [];

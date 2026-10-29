/**
 * AXIORA Market Calendar — pure timezone conversion and normalisation functions.
 *
 * Authority: user instruction (AXIORA Market Calendar feature, 2026-08-29),
 *            final report Phase D.
 *
 * This module is PURE and FRAMEWORK-FREE. It can be imported and tested in
 * plain Node (no Astro runtime). No Astro imports here.
 *
 * DATA SAFETY: These functions never fabricate values. Missing fields are
 * represented as unavailable rather than invented.
 */

import type { CalendarEvent, ImpactLevel } from './calendar.ts';

const WIB_OFFSET_MINUTES = 7 * 60; // UTC+7

/** IANA timezone to fixed offset minutes (simplified for common calendar timezones). */
export const TIMEZONE_OFFSETS: Record<string, number> = {
  'America/New_York': -5 * 60,     // EST (standard time)
  'America/Chicago': -6 * 60,      // CST
  'America/Denver': -7 * 60,       // MST
  'America/Los_Angeles': -8 * 60,  // PST
  'Europe/London': 0,              // GMT
  'Europe/Paris': 60,              // CET
  'Europe/Berlin': 60,             // CET
  'Europe/Rome': 60,               // CET
  'Europe/Madrid': 60,             // CET
  'Asia/Tokyo': 9 * 60,            // JST
  'Asia/Shanghai': 8 * 60,         // CST (China)
  'Asia/Singapore': 8 * 60,        // SGT
  'Asia/Hong_Kong': 8 * 60,        // HKT
  'Asia/Jakarta': 7 * 60,          // WIB
  'Asia/Kuala_Lumpur': 8 * 60,     // MYT
  'Australia/Sydney': 10 * 60,     // AEST
  'Pacific/Auckland': 12 * 60,     // NZST
  'UTC': 0,
};

export { WIB_OFFSET_MINUTES };

/**
 * Convert a source time (HH:MM in source timezone) to WIB (UTC+7).
 * Returns { date: ISO yyyy-mm-dd, time: HH:MM } in WIB.
 * Handles date rollover when conversion crosses midnight.
 */
export function convertToWib(
  sourceDate: string,     // ISO yyyy-mm-dd (date of release in source timezone)
  sourceTime: string,     // HH:MM in source timezone
  sourceTimezone: string  // IANA timezone
): { date: string; time: string } {
  const sourceOffset = TIMEZONE_OFFSETS[sourceTimezone] ?? 0;
  const [hours, minutes] = sourceTime.split(':').map(Number);

  // Parse source date components
  const [year, month, day] = sourceDate.split('-').map(Number);

  // Create UTC timestamp for midnight UTC on the source date
  const utcMidnight = Date.UTC(year, month - 1, day);

  // Source local time in milliseconds from midnight
  const sourceLocalTimeMs = (hours * 60 + minutes) * 60 * 1000;

  // Convert source local time to UTC: UTC = local - offset
  // sourceOffset is minutes from UTC (e.g., -300 for EST/UTC-5)
  const sourceOffsetMs = sourceOffset * 60 * 1000;
  const utcTimestamp = utcMidnight + sourceLocalTimeMs - sourceOffsetMs;

  // Convert UTC to WIB (UTC+7)
  const wibTimestamp = utcTimestamp + WIB_OFFSET_MINUTES * 60 * 1000;
  const wibDate = new Date(wibTimestamp);

  const wibYear = wibDate.getUTCFullYear();
  const wibMonth = String(wibDate.getUTCMonth() + 1).padStart(2, '0');
  const wibDay = String(wibDate.getUTCDate()).padStart(2, '0');
  const wibHours = String(wibDate.getUTCHours()).padStart(2, '0');
  const wibMinutes = String(wibDate.getUTCMinutes()).padStart(2, '0');

  return {
    date: `${wibYear}-${wibMonth}-${wibDay}`,
    time: `${wibHours}:${wibMinutes}`,
  };
}

/**
 * Normalise a Macro Event record to CalendarEvent.
 * Only called for records that have passed schema validation and
 * have publicationState="production" with a public lifecycle status.
 */
export function normaliseMacroEvent(entry: {
  id: string;
  data: {
    canonicalId: string;
    eventDate: Date;
    releaseTime: string;
    releaseTimezone: string;
    country: string;
    currency: string;
    impact: ImpactLevel;
    indicator: string;
    previous?: string;
    forecast?: string;
    actual?: string;
    note?: string;
  };
}): CalendarEvent {
  const { id, data } = entry;
  const sourceDate = data.eventDate.toISOString().split('T')[0];

  const { date, time } = convertToWib(
    sourceDate,
    data.releaseTime,
    data.releaseTimezone
  );

  return {
    id: data.canonicalId || id,
    date,
    time,
    timezone: 'WIB',
    country: data.country.toUpperCase(),
    currency: data.currency.toUpperCase(),
    impact: data.impact,
    title: data.indicator,
    previous: data.previous,
    forecast: data.forecast,
    actual: data.actual ?? null,
    note: data.note,
  };
}

export type { CalendarEvent, ImpactLevel } from './calendar.ts';
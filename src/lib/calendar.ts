/**
 * AXIORA Market Calendar — data model and helpers.
 *
 * Authority: user instruction (AXIORA Market Calendar feature, 2026-08-29).
 *
 * This module is pure and framework-free so it can be unit-tested in plain Node
 * (no Astro runtime). It deliberately knows nothing about rendering or about
 * whether a build is production or development — that decision lives in the page,
 * which only calls getCalendarEvents() under a development build.
 *
 * DATA SAFETY: the dataset returned here is development-only illustrative data
 * (see calendar-source.ts). It must never be presented as live or approved
 * economic data.
 */

import { CALENDAR_EVENTS_DEV, CALENDAR_DEV_NOTICE } from './calendar-source.ts';

/** Impact tiers. The three controlled levels reused across AXIORA's UI. */
export type ImpactLevel = 'high' | 'medium' | 'low';

/** A single economic-calendar row. */
export interface CalendarEvent {
  /** Stable identifier, also used to bind the expandable detail row. */
  id: string;
  /** ISO calendar date, yyyy-mm-dd. */
  date: string;
  /** 24-hour local time of release, HH:MM. */
  time: string;
  /** Timezone label for the time column (single column keeps it unambiguous). */
  timezone: string;
  /** Release country / region code (ISO 3166-1 alpha-2 style). */
  country: string;
  /** Currency most affected by the release. */
  currency: string;
  /** Market-impact tier. */
  impact: ImpactLevel;
  /** Human-readable indicator name (Indonesian). */
  title: string;
  /** Prior print. '—' when not applicable. */
  previous?: string;
  /** Market consensus. '—' when not applicable. */
  forecast?: string;
  /** Released value, or null when not yet out. */
  actual?: string | null;
  /** Optional expandable note (e.g. methodology or caveat). */
  note?: string;
}

/** Controlled Indonesian labels for the three impact tiers. */
export const IMPACT_LABELS: Record<ImpactLevel, string> = {
  high: 'Tinggi',
  medium: 'Sedang',
  low: 'Rendah',
};

/** Reader-facing notice that the dataset is development-only. */
export const DEV_NOTICE = CALENDAR_DEV_NOTICE;

/**
 * Development calendar dataset, sorted by date then time.
 *
 * Under a production build the page never calls this; see getCalendarEventsSafe().
 */
export function getCalendarEvents(): CalendarEvent[] {
  return [...CALENDAR_EVENTS_DEV].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });
}

/** Distinct currencies present in a dataset, sorted alphabetically. */
export function currenciesIn(events: CalendarEvent[]): string[] {
  return [...new Set(events.map((e) => e.currency))].sort();
}

/** Distinct dates present in a dataset, ascending. */
export function datesIn(events: CalendarEvent[]): string[] {
  return [...new Set(events.map((e) => e.date))].sort();
}

/**
 * Group events by date, preserving date order. Returns the date plus its rows in
 * time order, so the page can emit one table per day.
 */
export function groupByDate(
  events: CalendarEvent[],
): Array<{ date: string; events: CalendarEvent[] }> {
  const buckets = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = buckets.get(event.date);
    if (list) list.push(event);
    else buckets.set(event.date, [event]);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => ({
      date,
      events: list.sort((a, b) => a.time.localeCompare(b.time)),
    }));
}

/**
 * Format an ISO date as a long Indonesian weekday + date, e.g.
 * "Rabu, 12 Agustus 2026". `weekday`/`month` are injected so the function is
 * pure and testable without depending on the runtime locale being id-ID.
 */
export function formatLongDate(
  weekday: string,
  day: string,
  month: string,
  year: string,
): string {
  return `${weekday}, ${day} ${month} ${year}`;
}

/** Parse an ISO yyyy-mm-dd into its components without timezone drift. */
export function parseIsoDate(iso: string): { year: string; month: string; day: string } {
  const [year, month, day] = iso.split('-');
  return { year, month, day };
}

/** Build the Indonesian long-date label from an ISO string. */
export function longDateLabel(iso: string): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const weekdays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const { year, month, day } = parseIsoDate(iso);
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const weekday = weekdays[date.getDay()];
  return formatLongDate(weekday, String(Number(day)), months[Number(month) - 1], year);
}

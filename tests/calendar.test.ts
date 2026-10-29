/**
 * Calendar data layer — pure-function tests.
 *
 * Runs under `node --test` (Node 22 type stripping). Imports only the framework-free
 * calendar module; no Astro runtime.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCalendarEvents,
  groupByDate,
  currenciesIn,
  datesIn,
  longDateLabel,
  IMPACT_LABELS,
  DEV_NOTICE,
} from '../src/lib/calendar.ts';

import {
  convertToWib,
  normaliseMacroEvent,
  TIMEZONE_OFFSETS,
  WIB_OFFSET_MINUTES,
} from '../src/lib/calendar-pure.ts';

import { CALENDAR_EVENTS_DEV } from './fixtures/calendar-dev-fixture.ts';

test('getCalendarEvents returns sorted, non-empty development data', () => {
  const events = CALENDAR_EVENTS_DEV;
  assert.ok(events.length > 0, 'expected at least one event');

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];
    const dateOrder = prev.date.localeCompare(curr.date);
    assert.ok(
      dateOrder < 0 || (dateOrder === 0 && prev.time.localeCompare(curr.time) <= 0),
      `events not sorted at index ${i}: ${prev.date} ${prev.time} vs ${curr.date} ${curr.time}`,
    );
  }
});

test('every event has a controlled impact tier and a currency', () => {
  const events = CALENDAR_EVENTS_DEV;
  for (const e of events) {
    assert.ok(e.impact in IMPACT_LABELS, `unknown impact "${e.impact}" on ${e.id}`);
    assert.ok(typeof e.currency === 'string' && e.currency.length > 0, `missing currency on ${e.id}`);
    assert.ok(typeof e.title === 'string' && e.title.length > 0, `missing title on ${e.id}`);
  }
});

test('no fabricated actual values are presented as released', () => {
  // Development data marks upcoming releases with actual === null. That keeps the
  // page honest: it never shows a fake released print.
  const events = CALENDAR_EVENTS_DEV;
  for (const e of events) {
    if (e.actual !== null && e.actual !== undefined) {
      assert.fail(`event ${e.id} carries an actual value; dev data must not fake releases`);
    }
  }
});

test('groupByDate preserves date order and within-day time order', () => {
  const groups = groupByDate(CALENDAR_EVENTS_DEV);
  for (let i = 1; i < groups.length; i++) {
    assert.ok(groups[i - 1].date < groups[i].date, 'date groups out of order');
  }
  for (const group of groups) {
    for (let i = 1; i < group.events.length; i++) {
      assert.ok(
        group.events[i - 1].time <= group.events[i].time,
        `time order broken in ${group.date}`,
      );
    }
  }
});

test('currenciesIn and datesIn return distinct sorted values', () => {
  const events = CALENDAR_EVENTS_DEV;
  const currencies = currenciesIn(events);
  const dates = datesIn(events);
  assert.equal(new Set(currencies).size, currencies.length, 'currencies not distinct');
  assert.equal(new Set(dates).size, dates.length, 'dates not distinct');
  assert.ok(currencies.includes('USD'), 'expected USD among currencies');
});

test('longDateLabel formats an ISO date as an Indonesian long date', () => {
  assert.equal(longDateLabel('2026-08-12'), 'Rabu, 12 Agustus 2026');
});

test('DEV_NOTICE clearly states the data is development-only', () => {
  assert.ok(/pengembangan/i.test(DEV_NOTICE), 'dev notice should mention development');
  assert.ok(/bukan data pasar/i.test(DEV_NOTICE), 'dev notice should deny being real market data');
});

test('calendar-adapter: convertToWib handles standard timezone conversions', () => {
  // New York (EST, UTC-5) 08:30 -> WIB (UTC+7) = 20:30 same day
  const r1 = convertToWib('2026-10-16', '08:30', 'America/New_York');
  assert.equal(r1.date, '2026-10-16');
  assert.equal(r1.time, '20:30');

  // London (GMT, UTC+0) 07:00 -> WIB = 14:00 same day
  const r2 = convertToWib('2026-10-30', '07:00', 'Europe/London');
  assert.equal(r2.date, '2026-10-30');
  assert.equal(r2.time, '14:00');

  // Tokyo (JST, UTC+9) 08:00 -> WIB = 06:00 same day
  const r3 = convertToWib('2026-10-15', '08:00', 'Asia/Tokyo');
  assert.equal(r3.date, '2026-10-15');
  assert.equal(r3.time, '06:00');
});

test('calendar-adapter: convertToWib handles date rollover across midnight', () => {
  // New York 20:00 (EST, UTC-5) on 2026-10-15 -> WIB 08:00 on 2026-10-16
  const r1 = convertToWib('2026-10-15', '20:00', 'America/New_York');
  assert.equal(r1.date, '2026-10-16');
  assert.equal(r1.time, '08:00');

  // Los Angeles 22:00 (PST, UTC-8) on 2026-10-15 -> WIB 13:00 on 2026-10-16
  const r2 = convertToWib('2026-10-15', '22:00', 'America/Los_Angeles');
  assert.equal(r2.date, '2026-10-16');
  assert.equal(r2.time, '13:00');
});

test('calendar-adapter: normaliseMacroEvent produces correct CalendarEvent', () => {
  const mockEntry = {
    id: 'test-event-1',
    data: {
      canonicalId: 'bi-rate-2026-10',
      eventDate: new Date('2026-10-15'),
      releaseTime: '15:00',
      releaseTimezone: 'Asia/Jakarta',
      country: 'ID',
      currency: 'IDR',
      impact: 'high' as const,
      indicator: 'Keputusan suku bunga Bank Indonesia (BI Rate)',
      previous: '5,75%',
      forecast: '5,75%',
      actual: '5,75%',
      note: 'Test note',
    },
  };

  const event = normaliseMacroEvent(mockEntry);

  assert.equal(event.id, 'bi-rate-2026-10');
  assert.equal(event.date, '2026-10-15');
  assert.equal(event.time, '15:00');
  assert.equal(event.timezone, 'WIB');
  assert.equal(event.country, 'ID');
  assert.equal(event.currency, 'IDR');
  assert.equal(event.impact, 'high');
  assert.equal(event.title, 'Keputusan suku bunga Bank Indonesia (BI Rate)');
  assert.equal(event.previous, '5,75%');
  assert.equal(event.forecast, '5,75%');
  assert.equal(event.actual, '5,75%');
  assert.equal(event.note, 'Test note');
});

test('calendar-adapter: normaliseMacroEvent handles missing optional fields', () => {
  const mockEntry = {
    id: 'test-event-2',
    data: {
      canonicalId: 'us-fomc-nov-2026',
      eventDate: new Date('2026-11-07'),
      releaseTime: '14:00',
      releaseTimezone: 'America/New_York',
      country: 'US',
      currency: 'USD',
      impact: 'high' as const,
      indicator: 'Keputusan Suku Bunga FOMC',
      // previous, forecast, actual, note are optional
    },
  };

  const event = normaliseMacroEvent(mockEntry);

  assert.equal(event.id, 'us-fomc-nov-2026');
  // 14:00 EST (UTC-5) on 2026-11-07 = 19:00 UTC = 02:00 WIB on 2026-11-08
  assert.equal(event.date, '2026-11-08');
  assert.equal(event.time, '02:00');
  assert.equal(event.timezone, 'WIB');
  assert.equal(event.country, 'US');
  assert.equal(event.currency, 'USD');
  assert.equal(event.impact, 'high');
  assert.equal(event.title, 'Keputusan Suku Bunga FOMC');
  assert.equal(event.previous, undefined);
  assert.equal(event.forecast, undefined);
  assert.equal(event.actual, null);
  assert.equal(event.note, undefined);
});

test('calendar-adapter: normaliseMacroEvent handles timezone rollover correctly for Berlin', () => {
  const mockEntry = {
    id: 'test-event-3',
    data: {
      canonicalId: 'ecb-rate-2026-10',
      eventDate: new Date('2026-10-23'),
      releaseTime: '13:15',
      releaseTimezone: 'Europe/Berlin',
      country: 'EU',
      currency: 'EUR',
      impact: 'high' as const,
      indicator: 'Keputusan Suku Bunga ECB',
      previous: '3,25%',
      forecast: '3,00%',
      actual: '3,00%',
    },
  };

  const event = normaliseMacroEvent(mockEntry);

  // 13:15 CET (UTC+1) = 19:15 WIB same day
  assert.equal(event.date, '2026-10-23');
  assert.equal(event.time, '19:15');
  assert.equal(event.timezone, 'WIB');
  assert.equal(event.country, 'EU');
  assert.equal(event.currency, 'EUR');
});

test('TIMEZONE_OFFSETS contains expected common timezones', () => {
  assert.ok('America/New_York' in TIMEZONE_OFFSETS);
  assert.ok('America/Chicago' in TIMEZONE_OFFSETS);
  assert.ok('America/Los_Angeles' in TIMEZONE_OFFSETS);
  assert.ok('Europe/London' in TIMEZONE_OFFSETS);
  assert.ok('Europe/Berlin' in TIMEZONE_OFFSETS);
  assert.ok('Europe/Paris' in TIMEZONE_OFFSETS);
  assert.ok('Asia/Tokyo' in TIMEZONE_OFFSETS);
  assert.ok('Asia/Shanghai' in TIMEZONE_OFFSETS);
  assert.ok('Asia/Singapore' in TIMEZONE_OFFSETS);
  assert.ok('Asia/Jakarta' in TIMEZONE_OFFSETS);
  assert.ok('Asia/Kuala_Lumpur' in TIMEZONE_OFFSETS);
  assert.ok('Australia/Sydney' in TIMEZONE_OFFSETS);
  assert.ok('UTC' in TIMEZONE_OFFSETS);
});

test('WIB_OFFSET_MINUTES is 7 hours', () => {
  assert.equal(WIB_OFFSET_MINUTES, 7 * 60);
});

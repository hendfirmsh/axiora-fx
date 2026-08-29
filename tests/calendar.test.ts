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

test('getCalendarEvents returns sorted, non-empty development data', () => {
  const events = getCalendarEvents();
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
  const events = getCalendarEvents();
  for (const e of events) {
    assert.ok(e.impact in IMPACT_LABELS, `unknown impact "${e.impact}" on ${e.id}`);
    assert.ok(typeof e.currency === 'string' && e.currency.length > 0, `missing currency on ${e.id}`);
    assert.ok(typeof e.title === 'string' && e.title.length > 0, `missing title on ${e.id}`);
  }
});

test('no fabricated actual values are presented as released', () => {
  // Development data marks upcoming releases with actual === null. That keeps the
  // page honest: it never shows a fake released print.
  const events = getCalendarEvents();
  for (const e of events) {
    if (e.actual !== null && e.actual !== undefined) {
      assert.fail(`event ${e.id} carries an actual value; dev data must not fake releases`);
    }
  }
});

test('groupByDate preserves date order and within-day time order', () => {
  const groups = groupByDate(getCalendarEvents());
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
  const events = getCalendarEvents();
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

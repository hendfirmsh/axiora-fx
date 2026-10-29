/**
 * AXIORA Market Calendar — development data fixture (test copy).
 *
 * This is a copy of the original calendar-source.ts dev data, kept for test
 * compatibility. The production code no longer imports this.
 *
 * DO NOT import this in production code. It is only for test compatibility.
 */

import type { CalendarEvent } from '../../src/lib/calendar.ts';

/**
 * Reader-facing notice. Rendered prominently on the development calendar page
 * and echoed by tests so it cannot be dropped silently.
 */
export const CALENDAR_DEV_NOTICE =
  'Data pengembangan untuk peragaan antarmuka — bukan data pasar sesungguhnya. ' +
  'Sumber data ekonomi belum terhubung; angka sebelumnya dan konsensus di sini hanya contoh.';

/**
 * Sample week of macro releases. Dates are fixed so the build is deterministic
 * and the page is testable. Times are local-to-release converted to WIB for a
 * single consistent timezone column.
 */
export const CALENDAR_EVENTS_DEV: CalendarEvent[] = [
  {
    id: 'id-bi-rate-2026-08-10',
    date: '2026-08-10',
    time: '07:00',
    timezone: 'WIB',
    country: 'ID',
    currency: 'IDR',
    impact: 'high',
    title: 'Keputusan suku bunga Bank Indonesia (BI Rate)',
    previous: '5,75%',
    forecast: '5,50%',
    actual: null,
  },
  {
    id: 'uk-gdp-2026-08-10',
    date: '2026-08-10',
    time: '14:00',
    timezone: 'WIB',
    country: 'GB',
    currency: 'GBP',
    impact: 'medium',
    title: 'Produk Domestik Bruto (PDB) kuartalan awal',
    previous: '0,3%',
    forecast: '0,2%',
    actual: null,
  },
  {
    id: 'us-cpi-2026-08-10',
    date: '2026-08-10',
    time: '19:30',
    timezone: 'WIB',
    country: 'US',
    currency: 'USD',
    impact: 'high',
    title: 'Indeks Harga Konsumen (CPI) bulanan',
    previous: '-0,4%',
    forecast: '0,2%',
    actual: null,
  },
  {
    id: 'jp-boj-rate-2026-08-11',
    date: '2026-08-11',
    time: '07:30',
    timezone: 'WIB',
    country: 'JP',
    currency: 'JPY',
    impact: 'high',
    title: 'Keputusan suku bunga Bank of Japan',
    previous: '0,50%',
    forecast: '0,50%',
    actual: null,
  },
  {
    id: 'us-jobless-claims-2026-08-11',
    date: '2026-08-11',
    time: '19:30',
    timezone: 'WIB',
    country: 'US',
    currency: 'USD',
    impact: 'medium',
    title: 'Klaim pengangguran awal (Initial Jobless Claims)',
    previous: '226 rb',
    forecast: '230 rb',
    actual: null,
  },
  {
    id: 'us-fomc-rate-2026-08-12',
    date: '2026-08-12',
    time: '19:00',
    timezone: 'WIB',
    country: 'US',
    currency: 'USD',
    impact: 'high',
    title: 'Keputusan suku bunga FOMC',
    previous: '4,50%',
    forecast: '4,25%',
    actual: null,
  },
  {
    id: 'us-fomc-minutes-2026-08-12',
    date: '2026-08-12',
    time: '21:00',
    timezone: 'WIB',
    country: 'US',
    currency: 'USD',
    impact: 'low',
    title: 'Notulensi rapat FOMC',
    previous: '—',
    forecast: '—',
    actual: null,
  },
  {
    id: 'de-cpi-2026-08-13',
    date: '2026-08-13',
    time: '13:00',
    timezone: 'WIB',
    country: 'DE',
    currency: 'EUR',
    impact: 'medium',
    title: 'CPI Jerman bulanan (prakiraan awal)',
    previous: '0,1%',
    forecast: '0,2%',
    actual: null,
  },
  {
    id: 'eu-cpi-2026-08-13',
    date: '2026-08-13',
    time: '17:00',
    timezone: 'WIB',
    country: 'EU',
    currency: 'EUR',
    impact: 'high',
    title: 'CPI Zona Euro tahunan',
    previous: '2,1%',
    forecast: '2,2%',
    actual: null,
  },
  {
    id: 'us-ppi-2026-08-13',
    date: '2026-08-13',
    time: '19:30',
    timezone: 'WIB',
    country: 'US',
    currency: 'USD',
    impact: 'medium',
    title: 'Indeks Harga Produsen (PPI) bulanan',
    previous: '-0,3%',
    forecast: '0,2%',
    actual: null,
  },
  {
    id: 'id-gdp-2026-08-14',
    date: '2026-08-14',
    time: '07:00',
    timezone: 'WIB',
    country: 'ID',
    currency: 'IDR',
    impact: 'high',
    title: 'Produk Domestik Bruto (PDB) kuartalan',
    previous: '5,0%',
    forecast: '4,9%',
    actual: null,
  },
  {
    id: 'us-retail-2026-08-14',
    date: '2026-08-14',
    time: '19:30',
    timezone: 'WIB',
    country: 'US',
    currency: 'USD',
    impact: 'medium',
    title: 'Penjualan ritel bulanan',
    previous: '0,6%',
    forecast: '0,4%',
    actual: null,
  },
];

// Re-export types for test convenience
export type { CalendarEvent } from '../../src/lib/calendar.ts';
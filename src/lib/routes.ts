/**
 * AXIORA route registry and knowledge navigation tree.
 *
 * Authority: 04_Workspace_Architecture/05_Sitemap.md,
 *            04_Workspace_Architecture/06_Page_Inventory.md,
 *            04_Workspace_Architecture/04_Knowledge_Navigation.md
 *
 * The sitemap and page inventory are the source of truth. This module is a
 * machine-readable restatement, not a new decision. No route may be added here
 * that is not approved there. Research remains future-gated and is NOT routed.
 */

import { TOPICS } from './taxonomy.ts';

export interface RouteDefinition {
  /** Application-relative path. Pass through url() before rendering. */
  path: string;
  /** Canonical page title. */
  title: string;
  /** Meta description. */
  description: string;
  /** Whether search engines should index the route. */
  indexable: boolean;
}

/** Approved MVP routes. Research is deliberately absent (future-gated). */
export const ROUTES = {
  home: {
    path: '/',
    title: 'AXIORA — Financial Intelligence Workspace',
    description:
      'Ruang kerja pengetahuan finansial: bukti, konteks, mekanisme, dan ketidakpastian. Anda yang memegang keputusan.',
    indexable: true,
  },
  todaysBrief: {
    path: '/brief-hari-ini/',
    title: 'Brief Hari Ini',
    description: 'Kumpulan brief terkurasi bertanggal dari korpus AXIORA yang telah dipublikasikan.',
    indexable: true,
  },
  news: {
    path: '/news/',
    title: 'Intelligence News',
    description:
      'Feed berita pasar dari Marketaux: judul, ringkasan singkat, sumber asli, kategori otomatis AXIORA, dan waktu WIB.',
    // Syndicated provider snippets are not AXIORA editorial content. The route is
    // implemented and usable, but it is deliberately noindex until the provider's
    // redistribution terms are confirmed for this publication.
    indexable: false,
  },
  marketIntelligence: {
    path: '/market-intelligence/',
    title: 'Market Intelligence',
    description: 'Telusuri market brief yang telah dipublikasikan berdasarkan topik, peristiwa, dan kebaruan.',
    indexable: true,
  },
  education: {
    path: '/education/',
    title: 'Education',
    description: 'Penjelasan konsep yang dibutuhkan untuk memahami market brief AXIORA.',
    indexable: true,
  },
  topics: {
    path: '/topics/',
    title: 'Topics',
    description: 'Jalur pengetahuan terkendali: Macro, Gold, USD, Oil, Inflation, dan Economy.',
    indexable: true,
  },
  glossary: {
    path: '/glossary/',
    title: 'Glossary',
    description: 'Definisi kanonik dan hubungan antar konsep.',
    indexable: true,
  },
  methodology: {
    path: '/methodology/',
    title: 'Methodology',
    description: 'Standar bukti, ketidakpastian, tinjauan, koreksi, dan independensi editorial AXIORA.',
    indexable: true,
  },
  corrections: {
    path: '/corrections/',
    title: 'Corrections',
    description: 'Catatan publik atas koreksi material dan halaman yang terdampak.',
    indexable: true,
  },
  legal: {
    path: '/legal/',
    title: 'Legal & Risk',
    description:
      'Privasi, ketentuan, pengungkapan risiko umum, batasan, pengungkapan editorial dan komersial, serta jalur kontak.',
    indexable: true,
  },
  about: {
    path: '/about/',
    title: 'About',
    description: 'Tujuan AXIORA, audiens, batasan, kepemilikan, dan jalur umpan balik.',
    indexable: true,
  },
  search: {
    path: '/search/',
    title: 'Search',
    description: 'Cari pengetahuan AXIORA yang telah dipublikasikan.',
    indexable: true,
  },
  calendar: {
    path: '/calendar/',
    title: 'Calendar',
    description:
      'Kalender rilis ekonomi makro: waktu, wilayah, dampak, dan angka konsensus serta sebelumnya.',
    indexable: false,
  },
  console: {
    path: '/console/',
    title: 'Console',
    description: 'Workspace AXIORA untuk mengelola proyek, penggunaan, dan konfigurasi API.',
    indexable: false,
  },
  settings: {
    path: '/settings/',
    title: 'Settings',
    description: 'Atur tampilan dan preferensi workspace AXIORA.',
    indexable: false,
  },
  notFound: {
    path: '/404/',
    title: 'Halaman tidak ditemukan',
    description: 'Jalur pengetahuan yang diminta tidak tersedia.',
    indexable: false,
  },
} as const satisfies Record<string, RouteDefinition>;

/** Human-readable labels for the six approved topics (K-16). */
export const TOPIC_LABELS: Record<(typeof TOPICS)[number], string> = {
  macro: 'Macro',
  gold: 'Gold',
  usd: 'USD',
  oil: 'Oil',
  inflation: 'Inflation',
  economy: 'Economy',
};

/** Path for a topic authority page. */
export function topicPath(topic: (typeof TOPICS)[number]): string {
  return `/topics/${topic}/`;
}

export interface NavItem {
  label: string;
  path: string;
  icon: 'book' | 'calendar' | 'correction' | 'economy' | 'glossary' | 'inflation' | 'methodology' | 'news' | 'oil';
  /** Match the route exactly rather than by prefix. */
  exact?: boolean;
  /** Visually grouped below the primary scan path without removing the route. */
  secondary?: boolean;
}

export interface NavGroup {
  label: string;
  /** Optional curated landing page for the group itself. */
  path?: string;
  items: NavItem[];
}

/**
 * Sidebar knowledge navigation.
 * Structure fixed by 04_Knowledge_Navigation.md. Groups are stable knowledge
 * domains, never campaigns. No facet beyond the six topics becomes a group (K-16).
 */
export const NAVIGATION: NavGroup[] = [
  {
    label: 'Market',
     items: [
       { label: 'News', path: ROUTES.news.path, icon: 'news' },
       { label: 'Calendar', path: ROUTES.calendar.path, icon: 'calendar' },
       { label: 'Oil', path: topicPath('oil'), icon: 'oil' },
      { label: 'Inflation', path: topicPath('inflation'), icon: 'inflation' },
      { label: 'Economy', path: topicPath('economy'), icon: 'economy' },
      { label: 'Market overview', path: ROUTES.marketIntelligence.path, icon: 'news', exact: true, secondary: true },
      { label: 'Topics', path: ROUTES.topics.path, icon: 'book', exact: true, secondary: true },
      { label: 'Macro', path: topicPath('macro'), icon: 'economy', secondary: true },
      { label: 'Gold', path: topicPath('gold'), icon: 'inflation', secondary: true },
      { label: 'USD', path: topicPath('usd'), icon: 'economy', secondary: true },
      { label: 'Education', path: ROUTES.education.path, icon: 'book', secondary: true },
    ],
  },
  {
    label: 'Reference',
    items: [
      { label: 'Glossary', path: ROUTES.glossary.path, icon: 'glossary' },
      { label: 'Methodology', path: ROUTES.methodology.path, icon: 'methodology' },
      { label: 'Corrections', path: ROUTES.corrections.path, icon: 'correction' },
    ],
  },
];

/** Footer trust links. Closure and trust boundary, no conversion prompts. */
export const FOOTER_LINKS: NavItem[] = [
  { label: 'Methodology', path: ROUTES.methodology.path, icon: 'methodology' },
  { label: 'Corrections', path: ROUTES.corrections.path, icon: 'correction' },
  { label: 'Legal & Risk', path: ROUTES.legal.path, icon: 'book' },
  { label: 'About', path: ROUTES.about.path, icon: 'book' },
];

/** Correction reporting address (decision K-03). */
export const CORRECTIONS_EMAIL = 'corrections@axiora.my.id';

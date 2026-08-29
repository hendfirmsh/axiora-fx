/**
 * Route readiness registry — content-readiness state, NOT a feature.
 *
 * Authority: 04_Workspace_Architecture/05_Sitemap.md (route inventory),
 *            04_Workspace_Architecture/06_Page_Inventory.md,
 *            04_Workspace_Architecture/09_Reading_Flows.md:45 (Unavailable state),
 *            04_Workspace_Architecture/04_Knowledge_Navigation.md:65-66,
 *            route build-out decision item 5 (dead-link policy),
 *            14_Implementation_Acceptance_Criteria.md:44.
 *
 * WHAT THIS MODULE IS FOR
 *
 * An approved MVP route may exist in the architecture before its content is
 * approved for publication. Three responses to that are forbidden:
 *
 *   - removing the sidebar link (hides approved architecture);
 *   - pointing the link at 404 (a known route is not an invalid route);
 *   - shipping a dummy article (fabricates the knowledge product).
 *
 * So the route is built, and it states its own readiness honestly. This is a
 * DEVELOPMENT / CONTENT-READINESS state. It is not a new product capability, it
 * carries no capability label, and it must never read as "coming soon".
 *
 * READINESS IS NOT THE SAME AS FUTURE-GATING
 *
 *   'ready'       - implemented and content-complete. Indexable, in the sitemap,
 *                   in the search index, eligible for related/learn-next.
 *   'unavailable' - approved MVP route, content not yet approved for publication.
 *                   Route EXISTS, is noindex, is excluded from sitemap, search
 *                   index, Today's Brief, related content, and Learn Next.
 *   'future-gated' - NOT an MVP route at all. Reserved in the sitemap as an
 *                   architectural continuity record. Must NOT be routed, must
 *                   NOT appear as an active MVP destination. Research is the only
 *                   member, and it is deliberately absent from ROUTES.
 *
 * The distinction matters because they fail differently. An unavailable route
 * that ships to production is an editorial gap. A future-gated route that ships
 * to production is a false product promise, and Sitemap.md:5 is explicit that a
 * listed future route "is an architectural reservation, not permission to publish
 * or implement it."
 */

import { ROUTES, topicPath } from './routes.ts';
import { TOPICS } from './taxonomy.ts';

export type ReadinessState = 'ready' | 'unavailable' | 'future-gated';

/**
 * Why a route has no publishable content yet.
 *
 * Stated to the reader verbatim, so it must describe a CONTENT state and must not
 * promise a date, imply imminent release, or apologise. It is also the reason a
 * production build fails, so it doubles as the gate's diagnostic message.
 */
export interface ReadinessRecord {
  state: ReadinessState;
  /** Reader-facing explanation. Required for 'unavailable'. */
  reason?: string;
}

/**
 * Current readiness of every approved MVP route.
 *
 * MAINTENANCE RULE: a route moves to 'ready' only when its content is approved
 * for publication, not when its template compiles. Marking a route ready to
 * silence a warning defeats the entire mechanism.
 *
 * Routes are keyed by their application-relative path so the sitemap, the search
 * index, and the production gate can all resolve readiness from a path without
 * knowing which ROUTES key produced it.
 */
const READINESS: Record<string, ReadinessRecord> = {
  // --- Implemented and content-complete ---------------------------------
  // These pages are editorial statements about AXIORA itself, not corpus records,
  // so their content readiness does not depend on the brief corpus.
  [ROUTES.home.path]: { state: 'ready' },
  [ROUTES.console.path]: { state: 'ready' },
  [ROUTES.settings.path]: { state: 'ready' },
  [ROUTES.notFound.path]: { state: 'ready' },

  // --- Approved MVP routes awaiting approved content -------------------
  //
  // Every entry below is an editorial gap, tracked openly. Each becomes fatal in
  // a production build (see scripts/build-production.mjs).
  [ROUTES.todaysBrief.path]: {
    state: 'unavailable',
    reason:
      'Belum ada edisi brief yang disetujui untuk publikasi. Halaman ini akan menampilkan kumpulan brief bertanggal setelah korpus terkurasi tersedia.',
  },
  [ROUTES.marketIntelligence.path]: {
    state: 'unavailable',
    reason:
      'Belum ada market brief yang disetujui untuk publikasi, sehingga indeks ini belum memiliki entri.',
  },
  [ROUTES.education.path]: {
    state: 'unavailable',
    reason:
      'Belum ada penjelasan konsep yang disetujui untuk publikasi. Penjelasan diterbitkan sesuai kebutuhan market brief, bukan sebagai kurikulum terpisah.',
  },
  [ROUTES.topics.path]: {
    state: 'unavailable',
    reason:
      'Enam jalur topik sudah ditetapkan, tetapi belum ada catatan yang disetujui untuk publikasi di dalamnya.',
  },
  [ROUTES.glossary.path]: {
    state: 'unavailable',
    reason:
      'Belum ada definisi kanonik yang disetujui untuk publikasi. Glosarium tumbuh mengikuti terminologi yang dipakai korpus.',
  },
  [ROUTES.methodology.path]: {
    state: 'unavailable',
    reason:
      'Isi metodologi sedang dalam tinjauan editorial dan belum disetujui untuk publikasi. AXIORA tidak menayangkan pernyataan metodologi yang belum ditinjau.',
  },
  [ROUTES.corrections.path]: {
    state: 'unavailable',
    reason:
      'Belum ada koreksi material yang tercatat, dan jalur pelaporan koreksi belum terverifikasi. Catatan koreksi terbuka baru dapat ditayangkan setelah keduanya siap.',
  },
  [ROUTES.legal.path]: {
    state: 'unavailable',
    reason:
      'Materi hukum dan pengungkapan risiko belum disetujui untuk publikasi. AXIORA tidak menayangkan teks hukum generik sebagai dokumen yang telah disetujui.',
  },
  [ROUTES.about.path]: {
    state: 'unavailable',
    reason:
      'Halaman ini sedang dalam tinjauan editorial dan belum disetujui untuk publikasi.',
  },
  [ROUTES.search.path]: {
    state: 'unavailable',
    reason:
      'Pencarian bekerja atas korpus statis yang telah dipublikasikan. Karena belum ada catatan yang dipublikasikan, indeks pencarian masih kosong.',
  },
  [ROUTES.calendar.path]: {
    state: 'unavailable',
    reason:
      'Antarmuka kalender rilis ekonomi sudah dibangun, tetapi sumber data sesungguhnya belum terhubung dan data yang ditampilkan masih contoh pengembangan. Halaman ini hanya menampilkan data contoh dalam build pengembangan, bukan data produksi.',
  },

  // --- Future-gated: reserved, NOT an MVP route ------------------------
  //
  // Recorded here for continuity and so the production gate can assert it never
  // became routable. Deliberately NOT present in ROUTES; no page file exists.
  '/research/': {
    state: 'future-gated',
    reason:
      'Research adalah cadangan arsitektur untuk fase berikutnya dan bukan bagian dari Website MVP.',
  },
};

// Topic authority pages share the readiness of the Topics index: they are
// approved routes whose content depends on the same unpublished corpus. Derived
// rather than repeated so the six topics cannot drift out of sync (K-16).
for (const topic of TOPICS) {
  READINESS[topicPath(topic)] = {
    state: 'unavailable',
    reason:
      'Jalur topik ini sudah disetujui sebagai rute, tetapi belum ada market brief atau penjelasan konsep di dalamnya yang disetujui untuk publikasi.',
  };
}

/**
 * Readiness for a path. Unknown paths are treated as 'ready'.
 *
 * Corpus detail routes (a specific brief, a specific glossary entry) are the
 * unknown case: they only exist when a published record generated them, so their
 * readiness was already decided by the corpus filter in src/lib/corpus.ts.
 */
export function readinessOf(path: string): ReadinessRecord {
  return READINESS[path] ?? { state: 'ready' };
}

/** True when a route may be indexed, sitemapped, and surfaced in discovery. */
export function isRouteReady(path: string): boolean {
  return readinessOf(path).state === 'ready';
}

/**
 * Whether a path may appear in the sitemap, search index, Today's Brief, related
 * content, or Learn Next.
 *
 * Single predicate on purpose. Five separate checks would eventually disagree,
 * and the one that disagreed would leak an unavailable route into discovery.
 */
export function isDiscoverable(path: string): boolean {
  return isRouteReady(path);
}

/** Paths in a given readiness state. Used by the production gate's reporting. */
export function pathsWithState(state: ReadinessState): string[] {
  return Object.entries(READINESS)
    .filter(([, record]) => record.state === state)
    .map(([path]) => path)
    .sort();
}

/** Every approved MVP route, i.e. everything except future-gated reservations. */
export function mvpRoutePaths(): string[] {
  return Object.entries(READINESS)
    .filter(([, record]) => record.state !== 'future-gated')
    .map(([path]) => path)
    .sort();
}

/**
 * Recovery destinations offered by an unavailable route.
 *
 * Fixed to Home, Topics, Glossary, and Methodology as directed. Note that some
 * targets are themselves unavailable right now; that is intentional and not a
 * dead link. Each target is a real emitted route that explains its own state, so
 * the reader always lands somewhere honest instead of a 404. Filtering this list
 * by readiness would leave an unavailable page with no way out.
 */
export const RECOVERY_ROUTES = [
  { label: 'Workspace Home', path: ROUTES.home.path },
  { label: 'Topics', path: ROUTES.topics.path },
  { label: 'Glossary', path: ROUTES.glossary.path },
  { label: 'Methodology', path: ROUTES.methodology.path },
] as const;

/**
 * Display formatting and label vocabulary.
 *
 * Authority: 02.8_Content_Architecture/07_Taxonomy.md,
 *            04_Workspace_Architecture/10_Component_Inventory.md (Badge, Article Metadata),
 *            decision K-05 (Bahasa Indonesia primary)
 *
 * Controlled values are stored as machine identifiers. This module is the single
 * place that turns them into reader-facing Indonesian labels, so a status or a
 * content type is never spelled two different ways across the site.
 *
 * These are presentation labels, not new taxonomy. Adding a VALUE is a content
 * architecture change and belongs in src/lib/taxonomy.ts; adding a LABEL for an
 * existing value belongs here.
 */

import type {
  CapabilityLabel,
  ClaimClass,
  ContentType,
  Difficulty,
  LifecycleStatus,
  RelationshipType,
} from './taxonomy.ts';

/** Lifecycle status, in the reader's terms. */
export const STATUS_LABELS: Record<LifecycleStatus, string> = {
  proposed: 'Diusulkan',
  draft: 'Draf',
  'editorial-review': 'Tinjauan editorial',
  'specialist-review': 'Tinjauan spesialis',
  approved: 'Disetujui',
  published: 'Dipublikasikan',
  updated: 'Diperbarui',
  corrected: 'Dikoreksi',
  archived: 'Diarsipkan',
  deprecated: 'Tidak lagi digunakan',
  superseded: 'Digantikan',
};

/** Content type labels. */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  'market-brief': 'Market Brief',
  'education-article': 'Penjelasan Konsep',
  'glossary-entry': 'Entri Glosarium',
  'macro-events': 'Peristiwa Makro',
};

/** Difficulty labels. */
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  foundation: 'Dasar',
  developing: 'Berkembang',
  applied: 'Terapan',
  advanced: 'Lanjutan',
};

/**
 * Claim class labels.
 *
 * 13_Accessibility_Workspace.md:30 requires that the distinction between a
 * verified fact and an interpretation is never carried by styling alone. These
 * labels are the textual carrier of that distinction.
 */
export const CLAIM_CLASS_LABELS: Record<ClaimClass, string> = {
  'verified-fact': 'Fakta terverifikasi',
  'reported-view': 'Pandangan yang dilaporkan',
  'axiora-interpretation': 'Interpretasi AXIORA',
  scenario: 'Skenario',
  unknown: 'Belum diketahui',
};

/** Capability labels. */
export const CAPABILITY_LABEL_TEXT: Record<CapabilityLabel, string> = {
  current: 'Tersedia sekarang',
  'in-validation': 'Dalam validasi',
  'approved-future-phase': 'Fase berikutnya',
  exploratory: 'Eksploratif',
};

/**
 * Relationship labels, phrased from the reader's point of view.
 * These become link group headings, so they read as an invitation, not a schema term.
 */
export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  prerequisite: 'Pahami lebih dahulu',
  'learn-next': 'Pelajari berikutnya',
  defines: 'Mendefinisikan',
  'applies-concept': 'Menerapkan konsep',
  'explains-event': 'Menjelaskan peristiwa',
  'evidence-source': 'Sumber bukti',
  deepens: 'Memperdalam',
  'related-context': 'Konteks terkait',
  contrasts: 'Bandingkan dengan',
  updates: 'Memperbarui',
  supersedes: 'Menggantikan',
};

/**
 * Format a date for reading, in Indonesian.
 *
 * Uses an explicit UTC timezone so a build machine in a different zone cannot
 * shift a publication date by a day. Editorial dates are calendar facts, not
 * instants, and a date that drifts undermines the provenance record.
 */
export function formatDate(value: Date | string | undefined): string {
  if (!value) return 'Tidak tercatat';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tidak tercatat';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Machine-readable date for a <time datetime> attribute. */
export function machineDate(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

/**
 * Statuses that require a visible prose explanation, not just a badge.
 * Enforces Component_Inventory composition rule: "A status badge cannot be the
 * only expression of correction, archival, or future state."
 */
export const STATUS_REQUIRING_PROSE: LifecycleStatus[] = [
  'corrected',
  'archived',
  'deprecated',
  'superseded',
];

/** Prose explanation for a non-current status. */
export function statusExplanation(status: LifecycleStatus): string | undefined {
  switch (status) {
    case 'corrected':
      return 'Catatan ini telah dikoreksi setelah publikasi. Rincian koreksi tercantum di bagian koreksi pada halaman ini.';
    case 'archived':
      return 'Catatan ini diarsipkan. Isinya dipertahankan sebagai rekaman, tetapi tidak lagi dirawat sebagai rujukan terkini.';
    case 'deprecated':
      return 'Catatan ini tidak lagi digunakan. Jangan jadikan rujukan untuk kondisi saat ini.';
    case 'superseded':
      return 'Catatan ini telah digantikan oleh versi yang lebih baru. Tautan penggantinya tersedia pada halaman ini.';
    default:
      return undefined;
  }
}

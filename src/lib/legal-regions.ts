/**
 * Legal & Risk region registry — approval status only.
 *
 * Authority: 04_Workspace_Architecture/06_Page_Inventory.md:19
 *            ("static; unavailable legal state blocks release rather than
 *            silently disappearing"; "owner, effective date, revision state"),
 *            01_Product/Product_Requirements.md (release acceptance),
 *            route build-out decision item 8,
 *            IMPLEMENTATION_CONTRACT.md (mandatory review correction 5).
 *
 * WHAT THIS FILE IS
 *
 * A status ledger for the eight required Legal & Risk regions. It records whether
 * each region's content has been drafted, reviewed, and approved, and who owns it.
 *
 * WHAT THIS FILE IS NOT
 *
 * It is NOT legal content and contains NO legal statement, no policy wording, and
 * no disclosure text. Mandatory review correction 5 is explicit: legal content is
 * required, must never be invented, and must never be presented as complete when
 * it is not. Writing a plausible-sounding privacy policy here would be inventing
 * legal content, so the registry deliberately carries status only.
 *
 * Region 8 carries both the effective date and the revision state. Page_Inventory
 * combines editorial and commercial disclosure into a single cell (:19); the
 * approved eight-region split keeps them as separate reviewable regions because
 * they have different owners and different failure modes.
 *
 * HOW IT GATES A RELEASE
 *
 * scripts/build-production.mjs fails when any region is not "Approved". A
 * development build reports the same information without failing, so progress is
 * visible without a partial legal surface ever becoming publishable.
 */

/**
 * Region review status.
 *
 * "Blocked" is a distinct state from "Draft" on purpose: a blocked region needs a
 * decision from outside the implementation team (legal advice, ownership, a
 * verified contact route), and must not be mistaken for work merely unfinished.
 */
export type LegalRegionStatus = 'Draft' | 'In Review' | 'Approved' | 'Blocked';

export interface LegalRegion {
  /** Stable identifier used by the release gate. */
  id: string;
  /** Reader-facing Indonesian heading for the region. */
  heading: string;
  /** What obligation the region must satisfy. Not the content itself. */
  obligation: string;
  status: LegalRegionStatus;
  /**
   * Accountable owner. `null` means unassigned, which is itself a Gate C blocker
   * — an approved region with no owner cannot be maintained or corrected.
   */
  owner: string | null;
  /** Why the region is not yet Approved. Required unless status is Approved. */
  blockedReason?: string;
}

/**
 * The eight required regions.
 *
 * Every status below is "Draft" because no legal content has been authored or
 * approved. This is the honest current state. Changing a status here without the
 * corresponding approved content would defeat the entire gate.
 */
export const LEGAL_REGIONS: readonly LegalRegion[] = [
  {
    id: 'privacy',
    heading: 'Privasi',
    obligation:
      'State what data the static site does and does not collect, consistent with decision K-04 (no third-party analytics).',
    status: 'Draft',
    owner: null,
    blockedReason: 'Belum ada konten hukum yang disusun atau disetujui.',
  },
  {
    id: 'terms',
    heading: 'Ketentuan Penggunaan',
    obligation: 'State the terms under which the published knowledge may be used.',
    status: 'Draft',
    owner: null,
    blockedReason: 'Belum ada konten hukum yang disusun atau disetujui.',
  },
  {
    id: 'general-risk-disclosure',
    heading: 'Pengungkapan Risiko Umum',
    obligation:
      'State general market risk. Must not become a personalized suitability notice or a regulatory claim (Page_Inventory.md:19).',
    status: 'Draft',
    owner: null,
    blockedReason: 'Belum ada konten hukum yang disusun atau disetujui.',
  },
  {
    id: 'limitations',
    heading: 'Batasan',
    obligation:
      'State what AXIORA does not do: no signal, no recommendation, no personalized advice, no execution.',
    status: 'Draft',
    owner: null,
    blockedReason: 'Belum ada konten hukum yang disusun atau disetujui.',
  },
  {
    id: 'editorial-disclosure',
    heading: 'Pengungkapan Editorial',
    obligation: 'State who authors and reviews content, and how claims are classified.',
    status: 'Draft',
    owner: null,
    blockedReason: 'Belum ada konten hukum yang disusun atau disetujui.',
  },
  {
    id: 'commercial-disclosure',
    heading: 'Pengungkapan Komersial',
    obligation:
      'State commercial relationships, or state their absence. Silence is not a disclosure.',
    status: 'Draft',
    owner: null,
    blockedReason: 'Belum ada konten hukum yang disusun atau disetujui.',
  },
  {
    id: 'contact-route',
    heading: 'Jalur Kontak',
    obligation:
      'Provide a working contact and correction route (decision K-03). The mailbox must be verified before Gate C.',
    status: 'Draft',
    owner: null,
    blockedReason: 'Kotak surat koreksi belum diverifikasi.',
  },
  {
    id: 'effective-date-and-revision',
    heading: 'Tanggal Berlaku dan Status Revisi',
    obligation:
      'State the effective date and the revision state of the legal surface (Page_Inventory.md:19: owner, effective date, revision state).',
    status: 'Draft',
    owner: null,
    blockedReason: 'Belum ada konten hukum yang disusun atau disetujui.',
  },
];

/** Regions that are not yet Approved. Non-empty means a production release is blocked. */
export function unapprovedLegalRegions(): LegalRegion[] {
  return LEGAL_REGIONS.filter((region) => region.status !== 'Approved');
}

/** Approved regions with no accountable owner. An unmaintainable approval. */
export function ownerlessApprovedRegions(): LegalRegion[] {
  return LEGAL_REGIONS.filter((region) => region.status === 'Approved' && region.owner === null);
}

/** True when the full legal surface may be published. */
export function legalSurfaceApproved(): boolean {
  return unapprovedLegalRegions().length === 0 && ownerlessApprovedRegions().length === 0;
}

/**
 * Correction mailbox verification (decision K-03).
 *
 * K-03 requires the mailbox to be verified as reachable before Gate C. Ownership
 * of axiora.my.id is itself an open Gate C blocker, so this is recorded as false.
 * It is a separate flag rather than a derived value because a mailbox can be
 * verified independently of legal content being approved.
 */
export const CORRECTION_MAILBOX_VERIFIED = false;

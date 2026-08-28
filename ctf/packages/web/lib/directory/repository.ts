import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  DIRECTORY_DEFAULT_PAGE,
  DIRECTORY_DEFAULT_PAGE_SIZE,
  DIRECTORY_MAX_ANNOUNCEMENT_BODY_LENGTH,
  DIRECTORY_MAX_ANNOUNCEMENT_TITLE_LENGTH,
  DIRECTORY_MAX_BIO_LENGTH,
  DIRECTORY_MAX_LOCATION_LENGTH,
  DIRECTORY_MAX_NAME_LENGTH,
  DIRECTORY_MAX_HEADLINE_LENGTH,
  DIRECTORY_MAX_PAGE_SIZE,
  DIRECTORY_MAX_PROPOSED_SKILL_LENGTH,
  DIRECTORY_MAX_PROPOSED_SKILLS,
  DIRECTORY_MAX_TAKEDOWN_REASON_LENGTH,
  DIRECTORY_MAX_URL_LENGTH,
} from './constants';
import { normalizeQuoraProfileUrl } from './quora-url';
import type {
  DirectoryAnnouncement,
  DirectoryAnnouncementInput,
  DirectoryPagination,
  DirectoryProfile,
  DirectoryProfileInput,
  DirectorySuppressedUrl,
} from './types';

type DirectoryProfileRow = {
  id: string;
  claimed_by_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  headline: string | null;
  bio: string | null;
  profile_url: string | null;
  sector_id: string | null;
  sector_name: string | null;
  job_title_id: string | null;
  job_title_name: string | null;
  is_active: boolean;
  // SkillsHunt + Clerk username co-change. Optional on the row type so
  // existing SELECTs that don't yet pull these columns still typecheck;
  // mapProfileRow defaults to safe values.
  source?: 'admin' | 'self' | 'community-generated' | null;
  invited_by_username?: string | null;
  unclaimed_handle?: string | null;
  // Optional on the row type so SELECTs that don't pull the payment columns
  // still typecheck; mapProfileRow defaults each to null.
  venmo_address?: string | null;
  monero_address?: string | null;
  bitcoin_address?: string | null;
  service_credits_address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  created_at: Date;
  updated_at: Date;
};

type DirectorySkillRow = {
  id: string;
  name: string;
  display_order: number;
};

type DirectoryAnnouncementRow = {
  id: string;
  title: string;
  body: string;
  is_active: boolean;
  published_at: Date;
  expires_at: Date | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: Date;
  updated_at: Date;
};

type CountRow = { total: string };

type TaxonomySelectorRow = {
  id: string;
  name: string;
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function toIso(value: Date): string {
  return value.toISOString();
}

function isValidIsoDatetime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function mapAnnouncement(row: DirectoryAnnouncementRow): DirectoryAnnouncement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    isActive: row.is_active,
    publishedAtIso: toIso(row.published_at),
    expiresAtIso: row.expires_at ? toIso(row.expires_at) : null,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
  };
}

async function loadProfileSkills(client: PoolClient, profileId: string): Promise<DirectoryProfile['skills']> {
  const result = await client.query<DirectorySkillRow>(
    `
      SELECT sk.id, sk.name, dps.display_order
      FROM directory_profile_skills dps
      JOIN skills_taxonomy_skills sk ON sk.id = dps.skill_id
      -- Compare ids as text: directory_profiles.id carried over from v2 as varchar,
      -- so a direct uuid (dps.profile_id) = varchar comparison fails to plan. Cast
      -- both to text. Proper id-type reconciliation is tracked in the #520 cleanup.
      WHERE dps.profile_id::text = $1
      ORDER BY dps.display_order ASC, sk.name ASC
    `,
    [profileId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    displayOrder: row.display_order,
  }));
}

// Free-text skills nominated for this profile through SkillsHunt that are not yet in
// the canonical taxonomy. Join chain: the profile links to its originating SkillsHunt
// submission via skills_hunt_directory_profiles.directory_profile_id, and the submission's
// proposed (not-yet-promoted) skills live in skills_hunt_proposed_skill_promotions keyed by
// source_submission_id. Surfaced as muted "pending review" chips so a community-generated
// profile is never empty just because its nominated skill has not been promoted yet.
async function loadProfilePendingSkills(client: PoolClient, profileId: string): Promise<string[]> {
  const result = await client.query<{ skill_label: string }>(
    `
      SELECT DISTINCT prom.skill_label
      FROM skills_hunt_directory_profiles shdp
      JOIN skills_hunt_proposed_skill_promotions prom
        ON prom.source_submission_id = shdp.submission_id
      WHERE shdp.directory_profile_id = $1
        AND prom.status <> 'promoted'
        AND btrim(prom.skill_label) <> ''
      ORDER BY prom.skill_label ASC
    `,
    [profileId],
  );

  return result.rows.map((row) => row.skill_label);
}

// Free-text "skill not listed" labels the member added to their OWN profile through the self-edit
// form. Distinct from loadProfilePendingSkills (which reads SkillsHunt nominations): these live in
// directory_profile_proposed_skills keyed by profile_id, and are the editable subset round-tripped
// into the edit form.
async function loadProfileProposedSkills(client: PoolClient, profileId: string): Promise<string[]> {
  const result = await client.query<{ skill_label: string }>(
    `
      SELECT skill_label
      FROM directory_profile_proposed_skills
      -- profile_id compared as text for the same v2 varchar / uuid reason as loadProfileSkills.
      WHERE profile_id::text = $1
        AND status = 'pending'
        AND btrim(skill_label) <> ''
      ORDER BY skill_label ASC
    `,
    [profileId],
  );

  return result.rows.map((row) => row.skill_label);
}

// Collapse an optional/nullable column to `value ?? null` in one place, so a row mapper can hand off
// each `?? null` field to a call instead of spelling out the operator (which each cost complexity).
function nullable<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

// pendingSkills is the de-duplicated display set: SkillsHunt nominations + the member's own
// free-text additions, minus any that already match a selected taxonomy skill name (so a chip
// never appears twice).
function buildPendingSkills(
  skills: DirectoryProfile['skills'],
  nominatedPending: string[],
  selfProposed: string[],
): string[] {
  const taxonomyNames = new Set(skills.map((s) => s.name.trim().toLowerCase()));
  const seen = new Set<string>();
  const pendingSkills: string[] = [];
  for (const label of [...nominatedPending, ...selfProposed]) {
    const key = label.trim().toLowerCase();
    if (key.length === 0 || taxonomyNames.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    pendingSkills.push(label);
  }
  return pendingSkills;
}

// The pure part of the row mapping: turn one database row plus its already-loaded skill lists into
// the API shape. Split out of mapProfileRow so both the single-row path and the batched page path
// (mapProfileRows) build the exact same object.
function buildProfile(
  row: DirectoryProfileRow,
  skills: DirectoryProfile['skills'],
  nominatedPending: string[],
  selfProposed: string[],
): DirectoryProfile {
  // pendingSkills is the de-duplicated display set (see buildPendingSkills). proposedSkills keeps
  // only the self-added labels for the edit form.
  const pendingSkills = buildPendingSkills(skills, nominatedPending, selfProposed);

  // Each nullable() call is the former `row.x ?? null` — an absent column maps to null.
  return {
    id: row.id,
    claimedByUserId: row.claimed_by_user_id,
    firstName: row.first_name ?? '',
    lastName: nullable(row.last_name),
    headline: row.headline,
    bio: row.bio,
    profileUrl: row.profile_url,
    sectorId: row.sector_id,
    sectorName: row.sector_name,
    jobTitleId: row.job_title_id,
    jobTitleName: row.job_title_name,
    skills,
    pendingSkills,
    proposedSkills: selfProposed,
    isActive: row.is_active,
    source: row.source ?? 'admin',
    invitedByUsername: nullable(row.invited_by_username),
    unclaimedHandle: nullable(row.unclaimed_handle),
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
    venmoAddress: nullable(row.venmo_address),
    moneroAddress: nullable(row.monero_address),
    bitcoinAddress: nullable(row.bitcoin_address),
    serviceCreditsAddress: nullable(row.service_credits_address),
    city: nullable(row.city),
    state: nullable(row.state),
    country: nullable(row.country),
  };
}

async function mapProfileRow(client: PoolClient, row: DirectoryProfileRow): Promise<DirectoryProfile> {
  const skills = await loadProfileSkills(client, row.id);
  const nominatedPending = await loadProfilePendingSkills(client, row.id);
  const selfProposed = await loadProfileProposedSkills(client, row.id);

  return buildProfile(row, skills, nominatedPending, selfProposed);
}

// Group rows returned by a batched skill query into a map keyed by profile id, so each profile can
// pick up its own list in one lookup instead of a per-profile query.
function groupByProfileId<TRow extends { profile_id: string }, TValue>(
  rows: TRow[],
  toValue: (row: TRow) => TValue,
): Map<string, TValue[]> {
  const byId = new Map<string, TValue[]>();
  for (const row of rows) {
    const existing = byId.get(row.profile_id);
    if (existing) {
      existing.push(toValue(row));
    } else {
      byId.set(row.profile_id, [toValue(row)]);
    }
  }
  return byId;
}

// Batched form of loadProfileSkills: the taxonomy skills for a whole page of profiles in one query.
async function loadSkillsForProfiles(
  client: PoolClient,
  profileIds: string[],
): Promise<Map<string, DirectoryProfile['skills']>> {
  const result = await client.query<DirectorySkillRow & { profile_id: string }>(
    `
      SELECT dps.profile_id::text AS profile_id, sk.id, sk.name, dps.display_order
      FROM directory_profile_skills dps
      JOIN skills_taxonomy_skills sk ON sk.id = dps.skill_id
      -- profile_id compared as text for the same v2 varchar / uuid reason as loadProfileSkills.
      WHERE dps.profile_id::text = ANY($1::text[])
      ORDER BY dps.display_order ASC, sk.name ASC
    `,
    [profileIds],
  );

  return groupByProfileId(result.rows, (row) => ({ id: row.id, name: row.name, displayOrder: row.display_order }));
}

// Batched form of loadProfilePendingSkills (SkillsHunt nominations not yet in the taxonomy).
async function loadPendingSkillsForProfiles(client: PoolClient, profileIds: string[]): Promise<Map<string, string[]>> {
  const result = await client.query<{ profile_id: string; skill_label: string }>(
    `
      SELECT DISTINCT shdp.directory_profile_id::text AS profile_id, prom.skill_label
      FROM skills_hunt_directory_profiles shdp
      JOIN skills_hunt_proposed_skill_promotions prom
        ON prom.source_submission_id = shdp.submission_id
      WHERE shdp.directory_profile_id::text = ANY($1::text[])
        AND prom.status <> 'promoted'
        AND btrim(prom.skill_label) <> ''
      ORDER BY prom.skill_label ASC
    `,
    [profileIds],
  );

  return groupByProfileId(result.rows, (row) => row.skill_label);
}

// Batched form of loadProfileProposedSkills (the member's own free-text "skill not listed" labels).
async function loadProposedSkillsForProfiles(client: PoolClient, profileIds: string[]): Promise<Map<string, string[]>> {
  const result = await client.query<{ profile_id: string; skill_label: string }>(
    `
      SELECT profile_id::text AS profile_id, skill_label
      FROM directory_profile_proposed_skills
      -- profile_id compared as text for the same v2 varchar / uuid reason as loadProfileSkills.
      WHERE profile_id::text = ANY($1::text[])
        AND status = 'pending'
        AND btrim(skill_label) <> ''
      ORDER BY skill_label ASC
    `,
    [profileIds],
  );

  return groupByProfileId(result.rows, (row) => row.skill_label);
}

// Map a whole page of rows in three queries total. mapProfileRow costs three queries PER row, and a
// pooled client runs them one after another, so a 100-row page meant ~300 sequential round trips
// before the list could paint — the reason the admin list was slow on first load. Use this for any
// list; keep mapProfileRow for single-row reads.
async function mapProfileRows(client: PoolClient, rows: DirectoryProfileRow[]): Promise<DirectoryProfile[]> {
  if (rows.length === 0) {
    return [];
  }

  const profileIds = rows.map((row) => row.id);
  const skillsById = await loadSkillsForProfiles(client, profileIds);
  const nominatedById = await loadPendingSkillsForProfiles(client, profileIds);
  const proposedById = await loadProposedSkillsForProfiles(client, profileIds);

  return rows.map((row) =>
    buildProfile(row, skillsById.get(row.id) ?? [], nominatedById.get(row.id) ?? [], proposedById.get(row.id) ?? []),
  );
}

// The canonical count of community members is the number of active Directory profiles (claimed or
// community-generated), the same definition the Workforce dashboard uses for "members". Excludes
// soft-deleted profiles. Returns null on a read error so a caller can fall back rather than blank the
// number.
export async function countActiveDirectoryProfiles(): Promise<number | null> {
  const result = await queryDb<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM directory_profiles
     WHERE is_active = TRUE AND deleted_at IS NULL`,
  );
  const total = Number.parseInt(result.rows[0]?.total ?? '', 10);
  return Number.isFinite(total) ? total : null;
}

export function parsePaginationParams(url: string): { page: number; pageSize: number } {
  const params = new URL(url).searchParams;
  const pageRaw = Number.parseInt(params.get('page') ?? '', 10);
  const pageSizeRaw = Number.parseInt(params.get('pageSize') ?? '', 10);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : DIRECTORY_DEFAULT_PAGE;
  const pageSizeBase = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : DIRECTORY_DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(pageSizeBase, DIRECTORY_MAX_PAGE_SIZE);

  return { page, pageSize };
}

// An optional text field is valid when it is absent/empty or within its length cap.
function isWithinOptionalLength(value: string | null, max: number): boolean {
  return !value || value.length <= max;
}

// A required text field must be present (non-empty after normalization) and within its length cap.
function isWithinRequiredLength(value: string, max: number): boolean {
  return value.length > 0 && value.length <= max;
}

// skillIds, when present, must be an array (the ids themselves are validated later against the taxonomy).
function isValidSkillIds(skillIds: DirectoryProfileInput['skillIds']): boolean {
  return !skillIds || Array.isArray(skillIds);
}

// proposedSkills, when present, must be an array within the count cap and each label within
// the per-label length cap (measured after whitespace normalization).
function isValidProposedSkills(proposedSkills: DirectoryProfileInput['proposedSkills']): boolean {
  return (
    !proposedSkills ||
    (Array.isArray(proposedSkills) &&
      proposedSkills.length <= DIRECTORY_MAX_PROPOSED_SKILLS &&
      proposedSkills.every(
        (label) => typeof label === 'string' && normalizeText(label).length <= DIRECTORY_MAX_PROPOSED_SKILL_LENGTH,
      ))
  );
}

export function validateProfileInput(input: DirectoryProfileInput): boolean {
  const firstName = normalizeText(input.firstName ?? '');
  const lastName = normalizeNullableText(input.lastName);
  const headline = normalizeNullableText(input.headline);
  const bio = normalizeNullableText(input.bio);
  const profileUrl = normalizeNullableText(input.profileUrl);
  const city = normalizeNullableText(input.city);
  const state = normalizeNullableText(input.state);
  // Country is REQUIRED (unlike city/state, which stay optional): every directory profile must record
  // a country. Directory feeds nearly every other plugin (and the GDP member-by-country breakdown), so
  // a blank country leaves a member unplaceable. Normalized like firstName (non-nullable) so the
  // length check below is a real "must be present" gate, not an "if provided" one.
  const country = normalizeText(input.country ?? '');

  const checks = [
    isWithinRequiredLength(firstName, DIRECTORY_MAX_NAME_LENGTH),
    isWithinOptionalLength(lastName, DIRECTORY_MAX_NAME_LENGTH),
    isWithinOptionalLength(headline, DIRECTORY_MAX_HEADLINE_LENGTH),
    isWithinOptionalLength(bio, DIRECTORY_MAX_BIO_LENGTH),
    isWithinOptionalLength(profileUrl, DIRECTORY_MAX_URL_LENGTH),
    isWithinOptionalLength(city, DIRECTORY_MAX_LOCATION_LENGTH),
    isWithinOptionalLength(state, DIRECTORY_MAX_LOCATION_LENGTH),
    isWithinRequiredLength(country, DIRECTORY_MAX_LOCATION_LENGTH),
    isValidSkillIds(input.skillIds),
    isValidProposedSkills(input.proposedSkills),
  ];

  return checks.every(Boolean);
}

export function validateAnnouncementInput(input: DirectoryAnnouncementInput): boolean {
  const title = normalizeText(input.title ?? '');
  const body = normalizeText(input.body ?? '');

  const checks = [
    title.length > 0 && title.length <= DIRECTORY_MAX_ANNOUNCEMENT_TITLE_LENGTH,
    body.length > 0 && body.length <= DIRECTORY_MAX_ANNOUNCEMENT_BODY_LENGTH,
    !input.publishedAtIso || isValidIsoDatetime(input.publishedAtIso),
    !input.expiresAtIso || isValidIsoDatetime(input.expiresAtIso),
  ];

  return checks.every(Boolean);
}

async function ensureTaxonomySelectors(
  client: PoolClient,
  sectorId: string | null,
  jobTitleId: string | null,
  skillIds: string[],
): Promise<void> {
  if (sectorId) {
    const sector = await client.query<{ id: string }>(
      'SELECT id FROM skills_taxonomy_sectors WHERE id = $1 AND is_active = true',
      [sectorId],
    );

    if (sector.rows.length === 0) {
      throw new Error('directory_sector_not_found');
    }
  }

  if (jobTitleId) {
    const jobTitle = await client.query<{ id: string }>(
      'SELECT id FROM skills_taxonomy_job_titles WHERE id = $1 AND is_active = true',
      [jobTitleId],
    );

    if (jobTitle.rows.length === 0) {
      throw new Error('directory_job_title_not_found');
    }
  }

  if (skillIds.length > 0) {
    const skills = await client.query<{ id: string }>(
      `SELECT id FROM skills_taxonomy_skills WHERE id = ANY($1::uuid[]) AND is_active = true`,
      [skillIds],
    );

    if (skills.rows.length !== new Set(skillIds).size) {
      throw new Error('directory_skill_not_found');
    }
  }
}

async function replaceProfileSkills(client: PoolClient, profileId: string, skillIds: string[]): Promise<void> {
  await client.query('DELETE FROM directory_profile_skills WHERE profile_id = $1', [profileId]);

  for (let index = 0; index < skillIds.length; index += 1) {
    await client.query(
      `
        INSERT INTO directory_profile_skills (profile_id, skill_id, display_order)
        VALUES ($1, $2::uuid, $3)
      `,
      [profileId, skillIds[index], index + 1],
    );
  }
}

function normalizeSkillIds(value: string[] | undefined): string[] {
  if (!value || value.length === 0) {
    return [];
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return Array.from(new Set(normalized));
}

// Normalize free-text proposed-skill labels: trim/collapse whitespace, drop empties and any over
// the per-label length cap, de-duplicate case-insensitively (keeping first spelling), and cap the
// count. The UI enforces the same limits; this is the defensive server-side copy.
function normalizeProposedSkills(value: string[] | undefined): string[] {
  if (!value || value.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }
    const label = normalizeText(item);
    if (label.length === 0 || label.length > DIRECTORY_MAX_PROPOSED_SKILL_LENGTH) {
      continue;
    }
    const key = label.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(label);
    if (result.length >= DIRECTORY_MAX_PROPOSED_SKILLS) {
      break;
    }
  }

  return result;
}

async function replaceProfileProposedSkills(client: PoolClient, profileId: string, labels: string[]): Promise<void> {
  await client.query('DELETE FROM directory_profile_proposed_skills WHERE profile_id::text = $1', [profileId]);

  for (const label of labels) {
    await client.query(
      `
        INSERT INTO directory_profile_proposed_skills (profile_id, skill_label, status)
        VALUES ($1::uuid, $2, 'pending')
      `,
      [profileId, label],
    );
  }
}

async function loadProfileByUser(client: PoolClient, userId: string): Promise<DirectoryProfile | null> {
  const result = await client.query<DirectoryProfileRow>(
    `
      SELECT
        p.id,
        p.claimed_by_user_id,
        p.first_name,
        p.last_name,
        p.headline,
        p.bio,
        p.profile_url,
        p.sector_id,
        s.name AS sector_name,
        p.job_title_id,
        jt.name AS job_title_name,
        p.is_active,
        p.source,
        p.invited_by_username,
        p.unclaimed_handle,
        p.venmo_address,
        p.monero_address,
        p.bitcoin_address,
        p.service_credits_address,
        p.city,
        p.state,
        p.country,
        p.created_at,
        p.updated_at
      FROM directory_profiles p
      LEFT JOIN skills_taxonomy_sectors s ON s.id = p.sector_id
      LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
      WHERE p.claimed_by_user_id = $1
      LIMIT 1
    `,
    [userId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapProfileRow(client, result.rows[0]);
}

export async function getOwnProfile(userId: string): Promise<DirectoryProfile | null> {
  return withDbTransaction(async (client) => loadProfileByUser(client, userId));
}

export type QuoraUrlChangeSource =
  | 'directory_self'
  | 'directory_admin'
  | 'unlock_onboarding'
  | 'quora_deletion_survey';

export type QuoraUrlHistoryEntry = {
  id: string;
  userId: string;
  previousUrl: string | null;
  newUrl: string;
  changedByUserId: string;
  source: QuoraUrlChangeSource;
  createdAtIso: string;
};

// Append-only record of a Quora profile URL change (directory_quora_url_history). Written inside the
// same transaction as the profile update, so the trail can never drift from the stored URL. Recorded
// only for a real change (a new valid URL replacing the previous one), from any source: the member's
// own Directory edit, an admin edit, or the first capture at Unlock onboarding. Exported so the Unlock
// onboarding path can record the first URL through the same trail.
export async function recordQuoraUrlChange(
  client: PoolClient,
  input: {
    userId: string;
    previousUrl: string | null;
    newUrl: string;
    changedByUserId: string;
    source: QuoraUrlChangeSource;
  },
): Promise<void> {
  await client.query(
    `
      INSERT INTO directory_quora_url_history
        (user_id, previous_url, new_url, previous_url_normalized, new_url_normalized, changed_by_user_id, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      input.userId,
      input.previousUrl,
      input.newUrl,
      normalizeQuoraProfileUrl(input.previousUrl),
      normalizeQuoraProfileUrl(input.newUrl),
      input.changedByUserId,
      input.source,
    ],
  );
}

// queryDb (non-transactional) variant for a caller outside a directory transaction — the Unlock
// onboarding path records the first captured URL through this so the history trail includes the
// baseline. Best-effort at the call site; a failure here must never block onboarding.
export async function recordQuoraUrlChangeStandalone(input: {
  userId: string;
  previousUrl: string | null;
  newUrl: string;
  changedByUserId: string;
  source: QuoraUrlChangeSource;
}): Promise<void> {
  await queryDb(
    `
      INSERT INTO directory_quora_url_history
        (user_id, previous_url, new_url, previous_url_normalized, new_url_normalized, changed_by_user_id, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      input.userId,
      input.previousUrl,
      input.newUrl,
      normalizeQuoraProfileUrl(input.previousUrl),
      normalizeQuoraProfileUrl(input.newUrl),
      input.changedByUserId,
      input.source,
    ],
  );
}

// Record an account the member says was REMOVED from Quora, as part of their own account history.
//
// Separate from recordQuoraUrlChangeStandalone because that one derives the normalized column from
// the URL, and a removed account has no URL to derive it from. Inventing a plausible
// quora.com/profile/... link would put something in the history that looks live and clickable and
// is not; the caller passes a marker instead (see removedQuoraAccountMarker), and the NOT NULL
// normalized column takes the same string lowercased.
//
// `previous_url` is always null: this is not a change from one URL to another, it is the member
// stating that an account of theirs no longer exists.
export async function recordRemovedQuoraAccountStandalone(input: {
  userId: string;
  removedAccountMarker: string;
  changedByUserId: string;
  source: QuoraUrlChangeSource;
}): Promise<void> {
  await queryDb(
    `
      INSERT INTO directory_quora_url_history
        (user_id, previous_url, new_url, previous_url_normalized, new_url_normalized, changed_by_user_id, source)
      VALUES ($1, NULL, $2, NULL, $3, $4, $5)
    `,
    [
      input.userId,
      input.removedAccountMarker,
      input.removedAccountMarker.trim().toLowerCase(),
      input.changedByUserId,
      input.source,
    ],
  );
}

// The number of Quora URL changes recorded for each of the given users — a cheap signal for the
// Unlock queue so an admin can spot at a glance who has changed their social-proof URL and how often.
export async function countQuoraUrlChangesByUser(userIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (userIds.length === 0) {
    return counts;
  }
  const result = await queryDb<{ user_id: string; change_count: string }>(
    `
      SELECT user_id, COUNT(*)::text AS change_count
      FROM directory_quora_url_history
      WHERE user_id = ANY($1::text[])
        -- Closures reported through the account survey are excluded. This count is an abuse
        -- signal about a member changing the URL they verify with; a member reporting six
        -- accounts Quora closed has not changed anything, and counting those rows would make
        -- the most-affected respondents look like the most suspicious accounts.
        AND source <> 'quora_deletion_survey'
      GROUP BY user_id
    `,
    [userIds],
  );
  for (const row of result.rows) {
    counts.set(row.user_id, Number.parseInt(row.change_count, 10) || 0);
  }
  return counts;
}

// Markers already on this member's history for accounts they reported as closed. Used to skip a
// handle that is already recorded, so answering the survey a second time does not write the same
// closure twice into an append-only table.
export async function listRemovedQuoraAccountMarkers(userId: string): Promise<Set<string>> {
  const result = await queryDb<{ new_url_normalized: string }>(
    `
      SELECT new_url_normalized
      FROM directory_quora_url_history
      WHERE user_id = $1 AND source = 'quora_deletion_survey'
    `,
    [userId],
  );
  return new Set(result.rows.map((row) => row.new_url_normalized));
}

// The full Quora URL change history for one member, newest first — read by the Unlock admin queue so
// an admin can review whether someone changed or tried to remove their social-proof URL.
export async function listQuoraUrlHistory(userId: string): Promise<QuoraUrlHistoryEntry[]> {
  const result = await queryDb<{
    id: string;
    user_id: string;
    previous_url: string | null;
    new_url: string;
    changed_by_user_id: string;
    source: QuoraUrlChangeSource;
    created_at: Date;
  }>(
    `
      SELECT id, user_id, previous_url, new_url, changed_by_user_id, source, created_at
      FROM directory_quora_url_history
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    previousUrl: row.previous_url,
    newUrl: row.new_url,
    changedByUserId: row.changed_by_user_id,
    source: row.source,
    createdAtIso: new Date(row.created_at).toISOString(),
  }));
}

export type UpsertOwnProfileResult = {
  profile: DirectoryProfile;
  // True when the member submitted an empty/invalid Quora URL and we KEPT their previous one instead
  // of clearing it — the client shows a note explaining the URL can't be removed.
  quoraUrlKept: boolean;
};

// The Quora profile URL is the only social proof and can never be emptied. A member may replace it
// with a NEW valid Quora URL — common and legitimate (Quora sometimes deletes an account and the
// member has to re-profile) — but an empty or invalid submission KEEPS the previous URL rather than
// clearing it, so an approved member cannot remove it to shed their identity. A first-time profile
// must supply a valid one. Returns the resolved URL and whether the previous one was kept.
function resolveQuoraProfileUrl(
  submittedProfileUrl: string | null,
  previousUrl: string | null,
): { profileUrl: string; quoraUrlKept: boolean } {
  const submittedNormalized = normalizeQuoraProfileUrl(submittedProfileUrl);
  if (submittedNormalized) {
    return { profileUrl: submittedNormalized, quoraUrlKept: false };
  }
  if (previousUrl && previousUrl.trim().length > 0) {
    return { profileUrl: previousUrl, quoraUrlKept: submittedProfileUrl !== previousUrl };
  }
  throw new Error('directory_quora_url_required');
}

export async function upsertOwnProfile(userId: string, input: DirectoryProfileInput): Promise<UpsertOwnProfileResult> {
  return withDbTransaction(async (client) => {
    const firstName = normalizeText(input.firstName);
    const lastName = normalizeNullableText(input.lastName);
    const headline = normalizeNullableText(input.headline);
    const bio = normalizeNullableText(input.bio);
    const submittedProfileUrl = normalizeNullableText(input.profileUrl);
    const sectorId = input.sectorId ?? null;
    const jobTitleId = input.jobTitleId ?? null;
    const skillIds = normalizeSkillIds(input.skillIds);
    const proposedSkills = normalizeProposedSkills(input.proposedSkills);
    const venmoAddress = normalizeNullableText(input.venmoAddress);
    const moneroAddress = normalizeNullableText(input.moneroAddress);
    const bitcoinAddress = normalizeNullableText(input.bitcoinAddress);
    const serviceCreditsAddress = normalizeNullableText(input.serviceCreditsAddress);
    const city = normalizeNullableText(input.city);
    const state = normalizeNullableText(input.state);
    const country = normalizeNullableText(input.country);

    await ensureTaxonomySelectors(client, sectorId, jobTitleId, skillIds);

    const existing = await client.query<{ id: string; profile_url: string | null }>(
      'SELECT id, profile_url FROM directory_profiles WHERE claimed_by_user_id = $1 LIMIT 1',
      [userId],
    );

    let profileId = existing.rows[0]?.id;
    const previousUrl = existing.rows[0]?.profile_url ?? null;

    // Resolve the Quora URL (see resolveQuoraProfileUrl): a valid submission replaces it, an
    // empty/invalid one keeps the previous URL, and a first-time profile with neither throws.
    // Changing the URL is not itself a red flag; the history table records the change for a human to
    // review, it is never auto-penalized.
    const { profileUrl, quoraUrlKept } = resolveQuoraProfileUrl(submittedProfileUrl, previousUrl);

    // A Quora URL taken down at the person's request stays blocked until an admin lifts it — this
    // holds even for a member editing their own profile, so a suppressed URL cannot slip back in.
    await assertQuoraUrlNotSuppressed(client, profileUrl);

    if (profileId) {
      await client.query(
        `
          UPDATE directory_profiles
          SET
            first_name = $2,
            last_name = $3,
            headline = $4,
            bio = $5,
            profile_url = $6,
            sector_id = $7::uuid,
            job_title_id = $8::uuid,
            venmo_address = $9,
            monero_address = $10,
            bitcoin_address = $11,
            service_credits_address = $12,
            city = $13,
            state = $14,
            country = $15,
            is_active = true,
            updated_at = NOW()
          WHERE id = $1
        `,
        [
          profileId,
          firstName,
          lastName,
          headline,
          bio,
          profileUrl,
          sectorId,
          jobTitleId,
          venmoAddress,
          moneroAddress,
          bitcoinAddress,
          serviceCreditsAddress,
          city,
          state,
          country,
        ],
      );
    } else {
      const inserted = await client.query<{ id: string }>(
        `
          INSERT INTO directory_profiles
            (claimed_by_user_id, first_name, last_name, headline, bio, profile_url, sector_id, job_title_id,
             venmo_address, monero_address, bitcoin_address, service_credits_address, city, state, country,
             is_active, source)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7::uuid, $8::uuid, $9, $10, $11, $12, $13, $14, $15, true, 'self')
          RETURNING id
        `,
        [
          userId,
          firstName,
          lastName,
          headline,
          bio,
          profileUrl,
          sectorId,
          jobTitleId,
          venmoAddress,
          moneroAddress,
          bitcoinAddress,
          serviceCreditsAddress,
          city,
          state,
          country,
        ],
      );

      profileId = inserted.rows[0].id;
    }

    await replaceProfileSkills(client, profileId, skillIds);
    await replaceProfileProposedSkills(client, profileId, proposedSkills);

    // Directory is no longer public-facing; every authenticated member sees
    // every profile (subject to soft-delete + claimed_by_user_id). The
    // user_extension visibility row is hard-coded to 'workspace' so legacy
    // 'public' rows stop being created.
    await client.query(
      `
        INSERT INTO directory_user_extension (user_id, profile_visibility, service_deleted_at, updated_at)
        VALUES ($1, 'workspace', NULL, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          profile_visibility = EXCLUDED.profile_visibility,
          service_deleted_at = NULL,
          updated_at = NOW()
      `,
      [userId],
    );

    await client.query(
      `
        INSERT INTO directory_profile_change_events
          (actor_id, command, policy_status, reason, target_type, target_id, metadata)
        VALUES
          ($1, 'directory.profile.upsert', 'allow', 'profile_ownership_or_admin', 'profile', $2, '{}'::jsonb)
      `,
      [userId, profileId],
    );

    // Record a Quora URL change (first set or a replacement) in the append-only history so an admin can
    // review the trail in the Unlock queue. Only a real change is recorded — a kept/unchanged URL is not.
    if (profileUrl !== previousUrl) {
      await recordQuoraUrlChange(client, {
        userId,
        previousUrl,
        newUrl: profileUrl,
        changedByUserId: userId,
        source: 'directory_self',
      });
    }

    const refreshed = await client.query<DirectoryProfileRow>(
      `
        SELECT
          p.id,
          p.claimed_by_user_id,
          p.first_name,
          p.last_name,
          p.headline,
          p.bio,
          p.profile_url,

          p.sector_id,
          s.name AS sector_name,
          p.job_title_id,
          jt.name AS job_title_name,
          p.is_active,
          p.source,
          p.invited_by_username,
          p.unclaimed_handle,
          p.venmo_address,
          p.monero_address,
          p.bitcoin_address,
          p.service_credits_address,
          p.city,
          p.state,
          p.country,
          p.created_at,
          p.updated_at
        FROM directory_profiles p
        LEFT JOIN skills_taxonomy_sectors s ON s.id = p.sector_id
        LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
        WHERE p.id = $1
      `,
      [profileId],
    );

    const profile = await mapProfileRow(client, refreshed.rows[0]);
    return { profile, quoraUrlKept };
  });
}

type ListFilters = {
  sectorId?: string | null;
  jobTitleId?: string | null;
  skillId?: string | null;
  q?: string | null;
};

function buildSearchTerm(q: string | null | undefined): string | null {
  const normalized = normalizeNullableText(q);
  if (!normalized) {
    return null;
  }

  // Make the search punctuation-insensitive: collapse every run of non-alphanumeric characters to a
  // single space, so "first-aid", "first aid", and "First   Aid!" all become the same term. The query
  // applies the identical regexp_replace to the searched columns, so both sides compare the same shape
  // and a hyphenated query matches a space-separated skill (and vice versa). If nothing alphanumeric
  // remains (e.g. the user typed only punctuation), there is nothing to search on.
  const collapsed = normalized.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (collapsed.length === 0) {
    return null;
  }

  return `%${collapsed}%`;
}

function normalizeListFilters(filters: ListFilters): {
  sectorId: string | null;
  jobTitleId: string | null;
  skillId: string | null;
  searchTerm: string | null;
} {
  return {
    sectorId: filters.sectorId ?? null,
    jobTitleId: filters.jobTitleId ?? null,
    skillId: filters.skillId ?? null,
    searchTerm: buildSearchTerm(filters.q),
  };
}

// Fetch one active directory profile by id, in the same full shape the browse list returns, for the
// auth-gated deep-link page (/apps/directory/profile/[id]). Returns null when no active profile
// matches. Behind the same read-access gate as the list — never exposed to unauthenticated visitors.
export async function getDirectoryProfileForMember(profileId: string): Promise<DirectoryProfile | null> {
  const id = typeof profileId === 'string' ? profileId.trim() : '';
  if (id.length === 0) {
    return null;
  }
  return withDbTransaction(async (client) => {
    const rows = await client.query<DirectoryProfileRow>(
      `
        SELECT
          p.id,
          p.claimed_by_user_id,
          p.first_name,
          p.last_name,
          p.headline,
          p.bio,
          p.profile_url,
          p.sector_id,
          s.name AS sector_name,
          p.job_title_id,
          jt.name AS job_title_name,
          p.is_active,
          p.source,
          p.invited_by_username,
          p.unclaimed_handle,
          p.city,
          p.state,
          p.country,
          p.created_at,
          p.updated_at
        FROM directory_profiles p
        LEFT JOIN skills_taxonomy_sectors s ON s.id = p.sector_id
        LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
        WHERE p.id::text = $1 AND p.is_active = true
        LIMIT 1
      `,
      [id],
    );
    const row = rows.rows[0];
    if (!row) {
      return null;
    }
    return mapProfileRow(client, row);
  });
}

export async function listDirectoryForMember(
  pagination: { page: number; pageSize: number },
  filters: ListFilters,
): Promise<{ items: DirectoryProfile[]; pagination: DirectoryPagination }> {
  return withDbTransaction(async (client) => {
    // Directory is auth-gated but not "contribute-to-browse": every authenticated
    // member sees every active profile (including carried-over unclaimed profiles),
    // so there is no requirement that the viewer first create their own profile.
    const offset = (pagination.page - 1) * pagination.pageSize;
    const normalizedFilters = normalizeListFilters(filters);

    // Directory is no longer public-facing; every authenticated member sees
    // every active profile. The viewer's userId is no longer needed for a
    // visibility filter, so the WHERE clause + first param were dropped.
    const countResult = await client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM directory_profiles p
        WHERE p.is_active = true
          AND (
            $1::uuid IS NULL
            OR p.sector_id = $1::uuid
            -- A profile's sector is usually implied by its skills (skill -> job title -> sector)
            -- rather than stored on p.sector_id, which is typically null for carried-over/claimed
            -- profiles. Match either the profile's own sector or any sector its skills map to, so
            -- the left-rail sector filter actually returns the people whose skills belong to it.
            OR EXISTS (
              SELECT 1
              FROM directory_profile_skills dps_sec
              JOIN skills_taxonomy_skills sk_sec ON sk_sec.id = dps_sec.skill_id
              JOIN skills_taxonomy_job_titles jt_sec ON jt_sec.id = sk_sec.job_title_id
              WHERE dps_sec.profile_id::text = p.id::text
                AND jt_sec.sector_id = $1::uuid
            )
          )
          AND ($2::uuid IS NULL OR p.job_title_id = $2::uuid)
          AND (
            $3::uuid IS NULL
            OR EXISTS (
              SELECT 1 FROM directory_profile_skills dps
              WHERE dps.profile_id::text = p.id::text AND dps.skill_id = $3::uuid
            )
          )
          AND (
            $4::text IS NULL
            -- Search is punctuation-insensitive: each searched value has every run of non-alphanumeric
            -- characters collapsed to a single space (matching buildSearchTerm), so a query like
            -- "first-aid" matches a skill stored as "First Aid" and vice versa. The free-text box also
            -- searches a profile's skills — the taxonomy skill name, any of its searchable aliases, and
            -- free-text "proposed" skills still pending taxonomy review — not just name/headline/bio.
            OR regexp_replace(lower(COALESCE(p.first_name, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            OR regexp_replace(lower(COALESCE(p.last_name, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            OR regexp_replace(lower(COALESCE(p.headline, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            OR regexp_replace(lower(COALESCE(p.bio, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            -- Location is searchable too, so typing a city, state/region, or country (e.g. "California",
            -- "United States") returns the members there — matching the "searchable by location" promise.
            OR regexp_replace(lower(COALESCE(p.city, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            OR regexp_replace(lower(COALESCE(p.state, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            OR regexp_replace(lower(COALESCE(p.country, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            OR EXISTS (
              SELECT 1
              FROM directory_profile_skills dps_q
              JOIN skills_taxonomy_skills sk_q ON sk_q.id = dps_q.skill_id
              WHERE dps_q.profile_id::text = p.id::text
                AND (
                  regexp_replace(lower(sk_q.name), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
                  OR EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(sk_q.aliases) alias_q
                    WHERE regexp_replace(lower(alias_q), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
                  )
                )
            )
            OR EXISTS (
              SELECT 1
              FROM directory_profile_proposed_skills dpps_q
              WHERE dpps_q.profile_id::text = p.id::text
                AND regexp_replace(lower(COALESCE(dpps_q.skill_label, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            )
          )
      `,
      [
        normalizedFilters.sectorId,
        normalizedFilters.jobTitleId,
        normalizedFilters.skillId,
        normalizedFilters.searchTerm,
      ],
    );

    const rows = await client.query<DirectoryProfileRow>(
      `
        SELECT
          p.id,
          p.claimed_by_user_id,
          p.first_name,
          p.last_name,
          p.headline,
          p.bio,
          p.profile_url,
          p.sector_id,
          s.name AS sector_name,
          p.job_title_id,
          jt.name AS job_title_name,
          p.is_active,
          p.source,
          p.invited_by_username,
          p.unclaimed_handle,
          p.city,
          p.state,
          p.country,
          p.created_at,
          p.updated_at
        FROM directory_profiles p
        LEFT JOIN skills_taxonomy_sectors s ON s.id = p.sector_id
        LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
        WHERE p.is_active = true
          AND (
            $1::uuid IS NULL
            OR p.sector_id = $1::uuid
            -- A profile's sector is usually implied by its skills (skill -> job title -> sector)
            -- rather than stored on p.sector_id, which is typically null for carried-over/claimed
            -- profiles. Match either the profile's own sector or any sector its skills map to, so
            -- the left-rail sector filter actually returns the people whose skills belong to it.
            OR EXISTS (
              SELECT 1
              FROM directory_profile_skills dps_sec
              JOIN skills_taxonomy_skills sk_sec ON sk_sec.id = dps_sec.skill_id
              JOIN skills_taxonomy_job_titles jt_sec ON jt_sec.id = sk_sec.job_title_id
              WHERE dps_sec.profile_id::text = p.id::text
                AND jt_sec.sector_id = $1::uuid
            )
          )
          AND ($2::uuid IS NULL OR p.job_title_id = $2::uuid)
          AND (
            $3::uuid IS NULL
            OR EXISTS (
              SELECT 1 FROM directory_profile_skills dps
              WHERE dps.profile_id::text = p.id::text AND dps.skill_id = $3::uuid
            )
          )
          AND (
            $4::text IS NULL
            -- Search is punctuation-insensitive: each searched value has every run of non-alphanumeric
            -- characters collapsed to a single space (matching buildSearchTerm), so a query like
            -- "first-aid" matches a skill stored as "First Aid" and vice versa. The free-text box also
            -- searches a profile's skills — the taxonomy skill name, any of its searchable aliases, and
            -- free-text "proposed" skills still pending taxonomy review — not just name/headline/bio.
            OR regexp_replace(lower(COALESCE(p.first_name, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            OR regexp_replace(lower(COALESCE(p.last_name, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            OR regexp_replace(lower(COALESCE(p.headline, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            OR regexp_replace(lower(COALESCE(p.bio, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            -- Location is searchable too, so typing a city, state/region, or country (e.g. "California",
            -- "United States") returns the members there — matching the "searchable by location" promise.
            OR regexp_replace(lower(COALESCE(p.city, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            OR regexp_replace(lower(COALESCE(p.state, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            OR regexp_replace(lower(COALESCE(p.country, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            OR EXISTS (
              SELECT 1
              FROM directory_profile_skills dps_q
              JOIN skills_taxonomy_skills sk_q ON sk_q.id = dps_q.skill_id
              WHERE dps_q.profile_id::text = p.id::text
                AND (
                  regexp_replace(lower(sk_q.name), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
                  OR EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(sk_q.aliases) alias_q
                    WHERE regexp_replace(lower(alias_q), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
                  )
                )
            )
            OR EXISTS (
              SELECT 1
              FROM directory_profile_proposed_skills dpps_q
              WHERE dpps_q.profile_id::text = p.id::text
                AND regexp_replace(lower(COALESCE(dpps_q.skill_label, '')), '[^a-z0-9]+', ' ', 'g') LIKE $4::text
            )
          )
        ORDER BY p.updated_at DESC
        OFFSET $5 LIMIT $6
      `,
      [
        normalizedFilters.sectorId,
        normalizedFilters.jobTitleId,
        normalizedFilters.skillId,
        normalizedFilters.searchTerm,
        offset,
        pagination.pageSize,
      ],
    );

    const items = await mapProfileRows(client, rows.rows);

    return {
      items,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: Number.parseInt(countResult.rows[0]?.total ?? '0', 10),
      },
    };
  });
}

export async function listDirectoryAnnouncements(publicOnly = true): Promise<DirectoryAnnouncement[]> {
  const result = await queryDb<DirectoryAnnouncementRow>(
    `
      SELECT
        id,
        title,
        body,
        is_active,
        published_at,
        expires_at,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
      FROM directory_announcements
      WHERE ($1::boolean = false OR (
        is_active = true
        AND published_at <= NOW()
        AND (expires_at IS NULL OR expires_at > NOW())
      ))
      ORDER BY published_at DESC, created_at DESC
    `,
    [publicOnly],
  );

  return result.rows.map(mapAnnouncement);
}

export async function deleteOwnDirectoryProfile(userId: string): Promise<{ requestedAtIso: string }> {
  return withDbTransaction(async (client) => {
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM directory_profiles WHERE claimed_by_user_id = $1 LIMIT 1',
      [userId],
    );

    if (existing.rows.length > 0) {
      const profileId = existing.rows[0].id;

      await client.query(
        `
          UPDATE directory_profiles
          SET
            claimed_by_user_id = NULL,
            first_name = 'Deleted profile',
            last_name = NULL,
            headline = NULL,
            bio = NULL,
            profile_url = NULL,
            venmo_address = NULL,
            monero_address = NULL,
            bitcoin_address = NULL,
            service_credits_address = NULL,
            city = NULL,
            state = NULL,
            country = NULL,
            is_active = false,
            updated_at = NOW()
          WHERE id = $1
        `,
        [profileId],
      );

      await client.query('DELETE FROM directory_profile_skills WHERE profile_id = $1', [profileId]);
      await client.query('DELETE FROM directory_profile_tags WHERE profile_id = $1', [profileId]);
      await client.query('DELETE FROM directory_profile_proposed_skills WHERE profile_id::text = $1', [profileId]);
    }

    // Tombstone the extension row: keep the user_id-keyed marker (service_deleted_at)
    // so rejoin can recreate clean defaults, but wipe every contact/payment field the
    // deletion contract (section 5) requires cleared on service-scoped deletion.
    await client.query(
      `
        INSERT INTO directory_user_extension (user_id, profile_visibility, service_deleted_at, updated_at)
        VALUES ($1, 'private', NOW(), NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          profile_visibility = 'private',
          service_deleted_at = NOW(),
          venmo_address = NULL,
          monero_address = NULL,
          bitcoin_address = NULL,
          service_credits_address = NULL,
          updated_at = NOW()
      `,
      [userId],
    );

    const deletion = await client.query<{ requested_at: Date }>(
      `
        INSERT INTO directory_deletion_events (user_id, scope, plugin_id, requested_at, processed_at, result)
        VALUES ($1, 'service', 'directory', NOW(), NOW(), 'completed')
        RETURNING requested_at
      `,
      [userId],
    );

    return { requestedAtIso: deletion.rows[0].requested_at.toISOString() };
  });
}

export async function listTaxonomySectors(): Promise<Array<{ id: string; name: string }>> {
  const result = await queryDb<TaxonomySelectorRow>(
    `SELECT id, name FROM skills_taxonomy_sectors WHERE is_active = true ORDER BY display_order ASC, name ASC`,
  );
  return result.rows;
}

export async function listTaxonomyJobTitles(sectorId: string | null = null): Promise<Array<{ id: string; name: string; sectorId: string }>> {
  const result = await queryDb<{ id: string; name: string; sector_id: string }>(
    `
      SELECT id, name, sector_id
      FROM skills_taxonomy_job_titles
      WHERE is_active = true
        AND ($1::uuid IS NULL OR sector_id = $1::uuid)
      ORDER BY display_order ASC, name ASC
    `,
    [sectorId],
  );

  return result.rows.map((row) => ({ id: row.id, name: row.name, sectorId: row.sector_id }));
}

export async function listTaxonomySkills(jobTitleId: string | null = null): Promise<Array<{ id: string; name: string; jobTitleId: string }>> {
  const result = await queryDb<{ id: string; name: string; job_title_id: string }>(
    `
      SELECT id, name, job_title_id
      FROM skills_taxonomy_skills
      WHERE is_active = true
        AND ($1::uuid IS NULL OR job_title_id = $1::uuid)
      ORDER BY display_order ASC, name ASC
    `,
    [jobTitleId],
  );

  return result.rows.map((row) => ({ id: row.id, name: row.name, jobTitleId: row.job_title_id }));
}

// Which claim states the admin list should return. The admin surface's All / Claimed / Unclaimed
// tabs map straight onto this, and it is applied in SQL so a tab covers the whole collection rather
// than only the rows already on screen.
export type AdminProfileClaimFilter = 'all' | 'claimed' | 'unclaimed';

export interface AdminProfileFilters {
  q?: string | null;
  claimed?: AdminProfileClaimFilter;
}

// Shared predicate for the admin list's count and page queries, so the total always describes the
// same set the page is drawn from. Parameters: $1 includeInactive, $2 claim filter, $3 search term
// (already collapsed by buildSearchTerm, or null for "no search").
const ADMIN_PROFILE_WHERE = `
  WHERE ($1::boolean OR p.is_active = true)
    AND (
      $2::text = 'all'
      OR ($2::text = 'claimed' AND p.claimed_by_user_id IS NOT NULL)
      OR ($2::text = 'unclaimed' AND p.claimed_by_user_id IS NULL)
    )
    AND (
      $3::text IS NULL
      -- Search runs here, in SQL, against every profile in the collection — not against the page
      -- currently on screen. Punctuation-insensitive in the same way the member browse search is:
      -- each side has runs of non-alphanumeric characters collapsed to a single space, so "o brien"
      -- matches "O'Brien". Fields match what the admin card shows: name, headline, profession, and
      -- the system-assigned handle of an unclaimed profile.
      OR regexp_replace(lower(COALESCE(p.first_name, '')), '[^a-z0-9]+', ' ', 'g') LIKE $3::text
      OR regexp_replace(lower(COALESCE(p.last_name, '')), '[^a-z0-9]+', ' ', 'g') LIKE $3::text
      OR regexp_replace(lower(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '[^a-z0-9]+', ' ', 'g') LIKE $3::text
      OR regexp_replace(lower(COALESCE(p.headline, '')), '[^a-z0-9]+', ' ', 'g') LIKE $3::text
      OR regexp_replace(lower(COALESCE(jt.name, '')), '[^a-z0-9]+', ' ', 'g') LIKE $3::text
      OR regexp_replace(lower(COALESCE(p.unclaimed_handle, '')), '[^a-z0-9]+', ' ', 'g') LIKE $3::text
    )
`;

// One page of admin profiles, plus the totals the header shows. Filtering and search are applied in
// SQL so both the tabs and the search box cover every profile, while only one page of rows is
// mapped and sent — the list no longer loads the whole collection to paint its first screen.
// `unclaimedTotal` is counted across the whole collection because the header states it there, and a
// page of rows cannot answer it.
export async function listAdminProfiles(
  pagination: { page: number; pageSize: number },
  includeInactive = false,
  filters: AdminProfileFilters = {},
): Promise<{ items: DirectoryProfile[]; pagination: DirectoryPagination; unclaimedTotal: number }> {
  const claimed: AdminProfileClaimFilter = filters.claimed ?? 'all';
  const searchTerm = buildSearchTerm(filters.q);

  return withDbTransaction(async (client) => {
    const offset = (pagination.page - 1) * pagination.pageSize;
    const predicateParams = [includeInactive, claimed, searchTerm];

    const countResult = await client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM directory_profiles p
        LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
        ${ADMIN_PROFILE_WHERE}
      `,
      predicateParams,
    );

    // The header's "N unclaimed" describes the whole collection, so it ignores the claim tab and the
    // search box and only applies the active/inactive scope.
    const unclaimedResult = await client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM directory_profiles p
        WHERE ($1::boolean OR p.is_active = true)
          AND p.claimed_by_user_id IS NULL
      `,
      [includeInactive],
    );

    const rows = await client.query<DirectoryProfileRow>(
      `
        SELECT
          p.id,
          p.claimed_by_user_id,
          p.first_name,
          p.last_name,
          p.headline,
          p.bio,
          p.profile_url,
          p.source,
          p.invited_by_username,
          p.unclaimed_handle,
          p.sector_id,
          s.name AS sector_name,
          p.job_title_id,
          jt.name AS job_title_name,
          p.is_active,
          p.venmo_address,
          p.monero_address,
          p.bitcoin_address,
          p.service_credits_address,
          p.city,
          p.state,
          p.country,
          p.created_at,
          p.updated_at
        FROM directory_profiles p
        LEFT JOIN skills_taxonomy_sectors s ON s.id = p.sector_id
        LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
        ${ADMIN_PROFILE_WHERE}
        ORDER BY p.updated_at DESC
        OFFSET $4 LIMIT $5
      `,
      [...predicateParams, offset, pagination.pageSize],
    );

    const items = await mapProfileRows(client, rows.rows);

    return {
      items,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: Number.parseInt(countResult.rows[0]?.total ?? '0', 10),
      },
      unclaimedTotal: Number.parseInt(unclaimedResult.rows[0]?.total ?? '0', 10),
    };
  });
}

export async function createAdminProfile(actorId: string, input: DirectoryProfileInput): Promise<DirectoryProfile> {
  return withDbTransaction(async (client) => {
    const firstName = normalizeText(input.firstName);
    const lastName = normalizeNullableText(input.lastName);
    const headline = normalizeNullableText(input.headline);
    const bio = normalizeNullableText(input.bio);
    const profileUrl = normalizeNullableText(input.profileUrl);
    const sectorId = input.sectorId ?? null;
    const jobTitleId = input.jobTitleId ?? null;
    const skillIds = normalizeSkillIds(input.skillIds);
    const city = normalizeNullableText(input.city);
    const state = normalizeNullableText(input.state);
    const country = normalizeNullableText(input.country);

    await ensureTaxonomySelectors(client, sectorId, jobTitleId, skillIds);
    // A Quora URL taken down at the person's request cannot be re-added by an admin until the block
    // is lifted (override). Throws 'directory_quora_url_suppressed', which the route maps to a 409.
    await assertQuoraUrlNotSuppressed(client, profileUrl);

    const inserted = await client.query<{ id: string }>(
      `
        INSERT INTO directory_profiles
          (claimed_by_user_id, first_name, last_name, headline, bio, profile_url, sector_id, job_title_id, city, state, country, is_active)
        VALUES
          (NULL, $1, $2, $3, $4, $5, $6::uuid, $7::uuid, $8, $9, $10, true)
        RETURNING id
      `,
      [firstName, lastName, headline, bio, profileUrl, sectorId, jobTitleId, city, state, country],
    );

    const profileId = inserted.rows[0].id;
    await replaceProfileSkills(client, profileId, skillIds);

    await client.query(
      `
        INSERT INTO directory_profile_change_events
          (actor_id, command, policy_status, reason, target_type, target_id, metadata)
        VALUES
          ($1, 'directory.admin.profile.create', 'allow', 'admin_route_guard', 'profile', $2, '{}'::jsonb)
      `,
      [actorId, profileId],
    );

    const result = await client.query<DirectoryProfileRow>(
      `
        SELECT
          p.id,
          p.claimed_by_user_id,
          p.first_name,
          p.last_name,
          p.headline,
          p.bio,
          p.profile_url,

          p.sector_id,
          s.name AS sector_name,
          p.job_title_id,
          jt.name AS job_title_name,
          p.is_active,
          p.venmo_address,
          p.monero_address,
          p.bitcoin_address,
          p.service_credits_address,
          p.city,
          p.state,
          p.country,
          p.created_at,
          p.updated_at
        FROM directory_profiles p
        LEFT JOIN skills_taxonomy_sectors s ON s.id = p.sector_id
        LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
        WHERE p.id = $1
      `,
      [profileId],
    );

    return mapProfileRow(client, result.rows[0]);
  });
}

// A field the caller left out (undefined) is preserved as-is from the current row; a provided value
// (including an explicit null) is normalized. Lets the admin edit form omit member-owned payment
// addresses (and older clients omit location) without nulling them.
function preserveIfUndefined(value: string | null | undefined, current: string | null): string | null {
  return value === undefined ? current : normalizeNullableText(value);
}

export async function updateAdminProfile(
  actorId: string,
  profileId: string,
  input: DirectoryProfileInput,
): Promise<DirectoryProfile | null> {
  return withDbTransaction(async (client) => {
    // Compare ids as text — directory_profiles.id is varchar in the carried-over v2
    // database, so a ::uuid cast fails to plan / throws on non-uuid ids. See #534.
    // The existing row is read so a field the caller left out (undefined) is preserved
    // as-is instead of being nulled — the admin edit form does not send the
    // member-owned payment addresses, and older clients may not send location yet.
    const existing = await client.query<{
      id: string;
      claimed_by_user_id: string | null;
      profile_url: string | null;
      venmo_address: string | null;
      monero_address: string | null;
      bitcoin_address: string | null;
      service_credits_address: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
    }>(
      `SELECT id, claimed_by_user_id, profile_url, venmo_address, monero_address, bitcoin_address, service_credits_address, city, state, country
       FROM directory_profiles WHERE id::text = $1`,
      [profileId],
    );
    if (existing.rows.length === 0) {
      return null;
    }
    const current = existing.rows[0];

    const firstName = normalizeText(input.firstName);
    const lastName = normalizeNullableText(input.lastName);
    const headline = normalizeNullableText(input.headline);
    const bio = normalizeNullableText(input.bio);
    const profileUrl = normalizeNullableText(input.profileUrl);
    const sectorId = input.sectorId ?? null;
    const jobTitleId = input.jobTitleId ?? null;
    const skillIds = normalizeSkillIds(input.skillIds);
    // An admin editing a profile may record a skill the taxonomy does not carry yet, the same way a
    // member can on their own profile. A caller that omits the field entirely (an older client) leaves
    // it undefined and the stored labels are preserved; sending an array replaces them.
    const proposedSkills = input.proposedSkills === undefined ? undefined : normalizeProposedSkills(input.proposedSkills);
    const venmoAddress = preserveIfUndefined(input.venmoAddress, current.venmo_address);
    const moneroAddress = preserveIfUndefined(input.moneroAddress, current.monero_address);
    const bitcoinAddress = preserveIfUndefined(input.bitcoinAddress, current.bitcoin_address);
    const serviceCreditsAddress = preserveIfUndefined(input.serviceCreditsAddress, current.service_credits_address);
    const city = preserveIfUndefined(input.city, current.city);
    const state = preserveIfUndefined(input.state, current.state);
    const country = preserveIfUndefined(input.country, current.country);

    await ensureTaxonomySelectors(client, sectorId, jobTitleId, skillIds);

    await client.query(
      `
        UPDATE directory_profiles
        SET
          first_name = $2,
          last_name = $3,
          headline = $4,
          bio = $5,
          profile_url = $6,
          sector_id = $7::uuid,
          job_title_id = $8::uuid,
          venmo_address = $9,
          monero_address = $10,
          bitcoin_address = $11,
          service_credits_address = $12,
          city = $13,
          state = $14,
          country = $15,
          is_active = true,
          updated_at = NOW()
        WHERE id::text = $1
      `,
      [
        profileId,
        firstName,
        lastName,
        headline,
        bio,
        profileUrl,
        sectorId,
        jobTitleId,
        venmoAddress,
        moneroAddress,
        bitcoinAddress,
        serviceCreditsAddress,
        city,
        state,
        country,
      ],
    );

    await replaceProfileSkills(client, profileId, skillIds);
    if (proposedSkills !== undefined) {
      await replaceProfileProposedSkills(client, profileId, proposedSkills);
    }

    await client.query(
      `
        INSERT INTO directory_profile_change_events
          (actor_id, command, policy_status, reason, target_type, target_id, metadata)
        VALUES
          ($1, 'directory.admin.profile.update', 'allow', 'admin_route_guard', 'profile', $2, '{}'::jsonb)
      `,
      [actorId, profileId],
    );

    // Record an admin-made Quora URL change for a claimed profile (non-empty new URL, actually changed)
    // so the Unlock queue's history trail is complete regardless of who changed it.
    if (current.claimed_by_user_id && profileUrl && profileUrl !== current.profile_url) {
      await recordQuoraUrlChange(client, {
        userId: current.claimed_by_user_id,
        previousUrl: current.profile_url,
        newUrl: profileUrl,
        changedByUserId: actorId,
        source: 'directory_admin',
      });
    }

    const result = await client.query<DirectoryProfileRow>(
      `
        SELECT
          p.id,
          p.claimed_by_user_id,
          p.first_name,
          p.last_name,
          p.headline,
          p.bio,
          p.profile_url,

          p.sector_id,
          s.name AS sector_name,
          p.job_title_id,
          jt.name AS job_title_name,
          p.is_active,
          p.venmo_address,
          p.monero_address,
          p.bitcoin_address,
          p.service_credits_address,
          p.city,
          p.state,
          p.country,
          p.created_at,
          p.updated_at
        FROM directory_profiles p
        LEFT JOIN skills_taxonomy_sectors s ON s.id = p.sector_id
        LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
        WHERE p.id::text = $1
      `,
      [profileId],
    );

    return mapProfileRow(client, result.rows[0]);
  });
}

export async function assignAdminProfile(
  actorId: string,
  profileId: string,
  userId: string,
): Promise<DirectoryProfile | 'already_claimed' | null> {
  return withDbTransaction(async (client) => {
    // Compare ids as text: directory_profiles.id carried over from v2 as varchar,
    // so casting the bind param to ::uuid against a varchar column fails to plan
    // (and throws "invalid input syntax for type uuid" for non-uuid v2 ids). Cast
    // the column to text instead — works for both the v2 varchar column and a
    // fresh-schema uuid column. Same fix as the list query (#534). Proper id-type
    // reconciliation is tracked in the #520 cleanup.
    const existing = await client.query<{ id: string; claimed_by_user_id: string | null }>(
      'SELECT id, claimed_by_user_id FROM directory_profiles WHERE id::text = $1',
      [profileId],
    );

    if (existing.rows.length === 0) {
      return null;
    }

    // Ownership guard: assign only targets *unclaimed* profiles. If another user has already
    // claimed this profile, refuse to silently overwrite their ownership — emit a deny audit
    // event (mirroring the deleteAdminProfile claimed_guard pattern) and return a sentinel the
    // route maps to a 409 conflict. The contract command directory.admin.profile.assign is
    // scoped to "an unclaimed directory profile".
    if (existing.rows[0].claimed_by_user_id) {
      await client.query(
        `
          INSERT INTO directory_profile_change_events
            (actor_id, command, policy_status, reason, target_type, target_id, metadata)
          VALUES
            ($1, 'directory.admin.profile.assign', 'deny', 'invalid_claimed_unclaimed_transition', 'profile', $2,
             jsonb_build_object('assignedUserId', $3::text))
        `,
        [actorId, profileId, userId],
      );

      return 'already_claimed';
    }

    await client.query(
      `
        UPDATE directory_profiles
        SET claimed_by_user_id = $2, updated_at = NOW()
        WHERE id::text = $1
      `,
      [profileId, userId],
    );

    await client.query(
      `
        INSERT INTO directory_user_extension (user_id, profile_visibility, updated_at)
        VALUES ($1, 'workspace', NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          updated_at = NOW()
      `,
      [userId],
    );

    await client.query(
      `
        INSERT INTO directory_profile_change_events
          (actor_id, command, policy_status, reason, target_type, target_id, metadata)
        VALUES
          ($1, 'directory.admin.profile.assign', 'allow', 'admin_route_guard', 'profile', $2,
           jsonb_build_object('assignedUserId', $3::text))
      `,
      [actorId, profileId, userId],
    );

    const result = await client.query<DirectoryProfileRow>(
      `
        SELECT
          p.id,
          p.claimed_by_user_id,
          p.first_name,
          p.last_name,
          p.headline,
          p.bio,
          p.profile_url,

          p.sector_id,
          s.name AS sector_name,
          p.job_title_id,
          jt.name AS job_title_name,
          p.is_active,
          p.venmo_address,
          p.monero_address,
          p.bitcoin_address,
          p.service_credits_address,
          p.city,
          p.state,
          p.country,
          p.created_at,
          p.updated_at
        FROM directory_profiles p
        LEFT JOIN skills_taxonomy_sectors s ON s.id = p.sector_id
        LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
        WHERE p.id::text = $1
      `,
      [profileId],
    );

    return mapProfileRow(client, result.rows[0]);
  });
}

export async function deleteAdminProfile(actorId: string, profileId: string): Promise<'deleted' | 'claimed_guard' | 'not_found'> {
  return withDbTransaction(async (client) => {
    // Compare ids as text — directory_profiles.id is varchar in the carried-over v2
    // database, so a ::uuid cast fails to plan / throws on non-uuid ids. See #534.
    const existing = await client.query<{ claimed_by_user_id: string | null }>(
      'SELECT claimed_by_user_id FROM directory_profiles WHERE id::text = $1',
      [profileId],
    );

    if (existing.rows.length === 0) {
      return 'not_found';
    }

    if (existing.rows[0].claimed_by_user_id) {
      await client.query(
        `
          INSERT INTO directory_profile_change_events
            (actor_id, command, policy_status, reason, target_type, target_id, metadata)
          VALUES
            ($1, 'directory.admin.profile.delete', 'deny', 'invalid_claimed_unclaimed_transition', 'profile', $2, '{}'::jsonb)
        `,
        [actorId, profileId],
      );

      return 'claimed_guard';
    }

    await client.query('DELETE FROM directory_profiles WHERE id::text = $1', [profileId]);

    await client.query(
      `
        INSERT INTO directory_profile_change_events
          (actor_id, command, policy_status, reason, target_type, target_id, metadata)
        VALUES
          ($1, 'directory.admin.profile.delete', 'allow', 'unclaimed_only_delete', 'profile', $2, '{}'::jsonb)
      `,
      [actorId, profileId],
    );

    return 'deleted';
  });
}

// ---------------------------------------------------------------------------------------------------
// Quora-URL takedown / suppression
//
// The "remove at the person's request" takedown is distinct from the ordinary unclaimed-profile
// delete (deleteAdminProfile, for duplicates/accidents). A takedown deletes the community-generated
// profile AND records its normalized Quora URL on directory_suppressed_quora_urls, so the URL cannot
// be listed again — auto-generated from a SkillsHunt accept, or added by an admin/member — until an
// admin lifts the block (override) with a reason. Everything here is audited via
// directory_profile_change_events (the same table the delete/create paths write).
// ---------------------------------------------------------------------------------------------------

// Throw if the given (raw) profile URL normalizes to a Quora URL that is currently, actively
// suppressed. Used inside a transaction by the create/upsert write paths. A URL that isn't a Quora
// URL (normalizes to null) is never suppressed, so those profiles are unaffected.
async function assertQuoraUrlNotSuppressed(client: PoolClient, profileUrl: string | null): Promise<void> {
  const normalized = normalizeQuoraProfileUrl(profileUrl);
  if (!normalized) {
    return;
  }
  const blocked = await client.query<{ id: string }>(
    'SELECT id FROM directory_suppressed_quora_urls WHERE normalized_url = $1 AND is_overridden = false LIMIT 1',
    [normalized],
  );
  if (blocked.rows.length > 0) {
    throw new Error('directory_quora_url_suppressed');
  }
}

// Read-only sibling of the guard above, for callers outside Directory that must not offer or accept
// something for a URL the person has asked to be taken down. SkillsHunt uses it to refuse a
// nomination of a taken-down profile instead of accepting it, paying the scout, and then silently
// generating nothing. Reached through lib/shared/directory-interface.ts — Directory owns the
// takedown and this list; a plugin only asks whether a URL is on it.
export async function isQuoraUrlSuppressed(client: PoolClient, profileUrl: string | null): Promise<boolean> {
  const normalized = normalizeQuoraProfileUrl(profileUrl);
  if (!normalized) {
    return false;
  }
  const blocked = await client.query<{ id: string }>(
    'SELECT id FROM directory_suppressed_quora_urls WHERE normalized_url = $1 AND is_overridden = false LIMIT 1',
    [normalized],
  );
  return blocked.rows.length > 0;
}

// Take down a community-generated (unclaimed) profile at the person's request: delete the row and
// add its Quora URL to the suppression list with a reason. Returns a status the route maps to HTTP.
// Guards: the profile must exist, be unclaimed, and be community-generated (a takedown is only for a
// nominated profile of an accountless person; claimed or admin/self profiles use the normal delete).
export async function takedownAdminProfile(
  actorId: string,
  profileId: string,
  reason: string,
): Promise<'taken_down' | 'not_found' | 'claimed_guard' | 'not_community_generated' | 'missing_quora_url'> {
  const trimmedReason = reason.trim().slice(0, DIRECTORY_MAX_TAKEDOWN_REASON_LENGTH);
  return withDbTransaction(async (client) => {
    const existing = await client.query<{ claimed_by_user_id: string | null; source: string | null; profile_url: string | null }>(
      'SELECT claimed_by_user_id, source, profile_url FROM directory_profiles WHERE id::text = $1',
      [profileId],
    );

    if (existing.rows.length === 0) {
      return 'not_found';
    }

    const row = existing.rows[0];
    if (row.claimed_by_user_id) {
      return 'claimed_guard';
    }
    if (row.source !== 'community-generated') {
      return 'not_community_generated';
    }

    const normalized = normalizeQuoraProfileUrl(row.profile_url);
    if (!normalized) {
      return 'missing_quora_url';
    }

    // Delete the profile and its dependent rows (mirrors the ordinary delete's cascade set).
    await client.query('DELETE FROM directory_profile_skills WHERE profile_id = $1', [profileId]);
    await client.query('DELETE FROM directory_profile_proposed_skills WHERE profile_id::text = $1', [profileId]);
    await client.query('DELETE FROM directory_profiles WHERE id::text = $1', [profileId]);

    // Record the suppression. If this URL already has an ACTIVE block (partial unique index), keep the
    // existing one rather than erroring — the takedown still succeeded in removing the profile.
    await client.query(
      `
        INSERT INTO directory_suppressed_quora_urls
          (normalized_url, original_url, reason, removed_profile_id, created_by_user_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (normalized_url) WHERE (is_overridden = false) DO NOTHING
      `,
      [normalized, row.profile_url, trimmedReason, profileId, actorId],
    );

    await client.query(
      `
        INSERT INTO directory_profile_change_events
          (actor_id, command, policy_status, reason, target_type, target_id, metadata)
        VALUES ($1, 'directory.admin.profile.takedown', 'allow', $2, 'profile', $3, $4::jsonb)
      `,
      [actorId, trimmedReason || 'takedown_request', profileId, JSON.stringify({ normalizedUrl: normalized })],
    );

    return 'taken_down';
  });
}

type SuppressedUrlRow = {
  id: string;
  normalized_url: string;
  original_url: string;
  reason: string;
  removed_profile_id: string | null;
  created_by_user_id: string;
  created_at: Date | string;
  is_overridden: boolean;
  overridden_by_user_id: string | null;
  overridden_at: Date | string | null;
  override_reason: string | null;
};

function mapSuppressedUrlRow(row: SuppressedUrlRow): DirectorySuppressedUrl {
  return {
    id: row.id,
    normalizedUrl: row.normalized_url,
    originalUrl: row.original_url,
    reason: row.reason,
    removedProfileId: row.removed_profile_id,
    createdByUserId: row.created_by_user_id,
    createdAtIso: new Date(row.created_at).toISOString(),
    isOverridden: row.is_overridden,
    overriddenByUserId: row.overridden_by_user_id,
    overriddenAtIso: row.overridden_at ? new Date(row.overridden_at).toISOString() : null,
    overrideReason: row.override_reason,
  };
}

// List the suppression entries for the admin screen, active blocks first, newest first.
export async function listSuppressedQuoraUrls(): Promise<DirectorySuppressedUrl[]> {
  const result = await queryDb<SuppressedUrlRow>(
    `
      SELECT id, normalized_url, original_url, reason, removed_profile_id, created_by_user_id,
             created_at, is_overridden, overridden_by_user_id, overridden_at, override_reason
      FROM directory_suppressed_quora_urls
      ORDER BY is_overridden ASC, created_at DESC
    `,
  );
  return result.rows.map(mapSuppressedUrlRow);
}

// Lift an active suppression (override) with a reason, so the URL can be listed again. Audited.
export async function overrideSuppressedQuoraUrl(
  actorId: string,
  suppressionId: string,
  reason: string,
): Promise<'overridden' | 'not_found' | 'already_overridden'> {
  const trimmedReason = reason.trim().slice(0, DIRECTORY_MAX_TAKEDOWN_REASON_LENGTH);
  return withDbTransaction(async (client) => {
    const existing = await client.query<{ is_overridden: boolean; normalized_url: string }>(
      'SELECT is_overridden, normalized_url FROM directory_suppressed_quora_urls WHERE id = $1::uuid',
      [suppressionId],
    );
    if (existing.rows.length === 0) {
      return 'not_found';
    }
    if (existing.rows[0].is_overridden) {
      return 'already_overridden';
    }

    await client.query(
      `
        UPDATE directory_suppressed_quora_urls
        SET is_overridden = true, overridden_by_user_id = $1, overridden_at = NOW(), override_reason = $2
        WHERE id = $3::uuid
      `,
      [actorId, trimmedReason, suppressionId],
    );

    await client.query(
      `
        INSERT INTO directory_profile_change_events
          (actor_id, command, policy_status, reason, target_type, target_id, metadata)
        VALUES ($1, 'directory.admin.takedown.override', 'allow', $2, 'suppressed_url', $3::uuid, $4::jsonb)
      `,
      [actorId, trimmedReason || 'override', suppressionId, JSON.stringify({ normalizedUrl: existing.rows[0].normalized_url })],
    );

    return 'overridden';
  });
}

export async function createAnnouncement(actorId: string, input: DirectoryAnnouncementInput): Promise<DirectoryAnnouncement> {
  const title = normalizeText(input.title);
  const body = normalizeText(input.body);
  const isActive = typeof input.isActive === 'boolean' ? input.isActive : true;
  const publishedAt = input.publishedAtIso ? new Date(input.publishedAtIso) : new Date();
  const expiresAt = input.expiresAtIso ? new Date(input.expiresAtIso) : null;

  const inserted = await queryDb<DirectoryAnnouncementRow>(
    `
      INSERT INTO directory_announcements
        (title, body, is_active, published_at, expires_at, created_by_user_id, updated_by_user_id)
      VALUES
        ($1, $2, $3, $4, $5, $6, $6)
      RETURNING
        id,
        title,
        body,
        is_active,
        published_at,
        expires_at,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
    `,
    [title, body, isActive, publishedAt.toISOString(), expiresAt ? expiresAt.toISOString() : null, actorId],
  );

  return mapAnnouncement(inserted.rows[0]);
}

export async function updateAnnouncement(
  actorId: string,
  announcementId: string,
  input: DirectoryAnnouncementInput,
): Promise<DirectoryAnnouncement | null> {
  const title = normalizeText(input.title);
  const body = normalizeText(input.body);
  const isActive = typeof input.isActive === 'boolean' ? input.isActive : true;
  const publishedAt = input.publishedAtIso ? new Date(input.publishedAtIso) : new Date();
  const expiresAt = input.expiresAtIso ? new Date(input.expiresAtIso) : null;

  const updated = await queryDb<DirectoryAnnouncementRow>(
    `
      UPDATE directory_announcements
      SET
        title = $2,
        body = $3,
        is_active = $4,
        published_at = $5,
        expires_at = $6,
        updated_by_user_id = $7,
        updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING
        id,
        title,
        body,
        is_active,
        published_at,
        expires_at,
        created_by_user_id,
        updated_by_user_id,
        created_at,
        updated_at
    `,
    [announcementId, title, body, isActive, publishedAt.toISOString(), expiresAt ? expiresAt.toISOString() : null, actorId],
  );

  if (updated.rows.length === 0) {
    return null;
  }

  return mapAnnouncement(updated.rows[0]);
}

export async function deactivateAnnouncement(actorId: string, announcementId: string): Promise<boolean> {
  const result = await queryDb<{ id: string }>(
    `
      UPDATE directory_announcements
      SET is_active = false, updated_by_user_id = $2, updated_at = NOW()
      WHERE id = $1::uuid
      RETURNING id
    `,
    [announcementId, actorId],
  );

  return result.rows.length > 0;
}

import type { PoolClient } from 'pg';
import { queryDb, withDbTransaction } from 'lib/db/postgres';
import {
  DIRECTORY_DEFAULT_PAGE,
  DIRECTORY_DEFAULT_PAGE_SIZE,
  DIRECTORY_MAX_ANNOUNCEMENT_BODY_LENGTH,
  DIRECTORY_MAX_ANNOUNCEMENT_TITLE_LENGTH,
  DIRECTORY_MAX_BIO_LENGTH,
  DIRECTORY_MAX_NAME_LENGTH,
  DIRECTORY_MAX_HEADLINE_LENGTH,
  DIRECTORY_MAX_PAGE_SIZE,
  DIRECTORY_MAX_PROPOSED_SKILL_LENGTH,
  DIRECTORY_MAX_PROPOSED_SKILLS,
  DIRECTORY_MAX_URL_LENGTH,
} from './constants';
import type {
  DirectoryAnnouncement,
  DirectoryAnnouncementInput,
  DirectoryPagination,
  DirectoryProfile,
  DirectoryProfileInput,
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

async function mapProfileRow(client: PoolClient, row: DirectoryProfileRow): Promise<DirectoryProfile> {
  const skills = await loadProfileSkills(client, row.id);
  const nominatedPending = await loadProfilePendingSkills(client, row.id);
  const selfProposed = await loadProfileProposedSkills(client, row.id);

  // pendingSkills is the de-duplicated display set: SkillsHunt nominations + the member's own
  // free-text additions, minus any that already match a selected taxonomy skill name (so a chip
  // never appears twice). proposedSkills keeps only the self-added labels for the edit form.
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

  return {
    id: row.id,
    claimedByUserId: row.claimed_by_user_id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? null,
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
    invitedByUsername: row.invited_by_username ?? null,
    unclaimedHandle: row.unclaimed_handle ?? null,
    createdAtIso: toIso(row.created_at),
    updatedAtIso: toIso(row.updated_at),
    venmoAddress: row.venmo_address ?? null,
    moneroAddress: row.monero_address ?? null,
    bitcoinAddress: row.bitcoin_address ?? null,
    serviceCreditsAddress: row.service_credits_address ?? null,
  };
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

export function validateProfileInput(input: DirectoryProfileInput): boolean {
  const firstName = normalizeText(input.firstName ?? '');
  const lastName = normalizeNullableText(input.lastName);
  const headline = normalizeNullableText(input.headline);
  const bio = normalizeNullableText(input.bio);
  const profileUrl = normalizeNullableText(input.profileUrl);

  const checks = [
    firstName.length > 0 && firstName.length <= DIRECTORY_MAX_NAME_LENGTH,
    !lastName || lastName.length <= DIRECTORY_MAX_NAME_LENGTH,
    !headline || headline.length <= DIRECTORY_MAX_HEADLINE_LENGTH,
    !bio || bio.length <= DIRECTORY_MAX_BIO_LENGTH,
    !profileUrl || profileUrl.length <= DIRECTORY_MAX_URL_LENGTH,
    !input.skillIds || Array.isArray(input.skillIds),
    // proposedSkills, when present, must be an array within the count cap and each label within
    // the per-label length cap (measured after whitespace normalization).
    !input.proposedSkills ||
      (Array.isArray(input.proposedSkills) &&
        input.proposedSkills.length <= DIRECTORY_MAX_PROPOSED_SKILLS &&
        input.proposedSkills.every(
          (label) => typeof label === 'string' && normalizeText(label).length <= DIRECTORY_MAX_PROPOSED_SKILL_LENGTH,
        )),
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

export async function upsertOwnProfile(userId: string, input: DirectoryProfileInput): Promise<DirectoryProfile> {
  return withDbTransaction(async (client) => {
    const firstName = normalizeText(input.firstName);
    const lastName = normalizeNullableText(input.lastName);
    const headline = normalizeNullableText(input.headline);
    const bio = normalizeNullableText(input.bio);
    const profileUrl = normalizeNullableText(input.profileUrl);
    const sectorId = input.sectorId ?? null;
    const jobTitleId = input.jobTitleId ?? null;
    const skillIds = normalizeSkillIds(input.skillIds);
    const proposedSkills = normalizeProposedSkills(input.proposedSkills);
    const venmoAddress = normalizeNullableText(input.venmoAddress);
    const moneroAddress = normalizeNullableText(input.moneroAddress);
    const bitcoinAddress = normalizeNullableText(input.bitcoinAddress);
    const serviceCreditsAddress = normalizeNullableText(input.serviceCreditsAddress);

    await ensureTaxonomySelectors(client, sectorId, jobTitleId, skillIds);

    const existing = await client.query<{ id: string }>(
      'SELECT id FROM directory_profiles WHERE claimed_by_user_id = $1 LIMIT 1',
      [userId],
    );

    let profileId = existing.rows[0]?.id;

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
        ],
      );
    } else {
      const inserted = await client.query<{ id: string }>(
        `
          INSERT INTO directory_profiles
            (claimed_by_user_id, first_name, last_name, headline, bio, profile_url, sector_id, job_title_id,
             venmo_address, monero_address, bitcoin_address, service_credits_address, is_active, source)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7::uuid, $8::uuid, $9, $10, $11, $12, true, 'self')
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
          p.created_at,
          p.updated_at
        FROM directory_profiles p
        LEFT JOIN skills_taxonomy_sectors s ON s.id = p.sector_id
        LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
        WHERE p.id = $1
      `,
      [profileId],
    );

    return mapProfileRow(client, refreshed.rows[0]);
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

  return `%${normalized.toLowerCase()}%`;
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
            OR (lower(COALESCE(p.first_name, '')) LIKE $4::text OR lower(COALESCE(p.last_name, '')) LIKE $4::text)
            OR lower(COALESCE(p.headline, '')) LIKE $4::text
            OR lower(COALESCE(p.bio, '')) LIKE $4::text
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
            OR (lower(COALESCE(p.first_name, '')) LIKE $4::text OR lower(COALESCE(p.last_name, '')) LIKE $4::text)
            OR lower(COALESCE(p.headline, '')) LIKE $4::text
            OR lower(COALESCE(p.bio, '')) LIKE $4::text
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

    const items = await Promise.all(rows.rows.map(async (row) => mapProfileRow(client, row)));

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

export async function listAdminProfiles(
  pagination: { page: number; pageSize: number },
  includeInactive = false,
): Promise<{ items: DirectoryProfile[]; pagination: DirectoryPagination }> {
  return withDbTransaction(async (client) => {
    const offset = (pagination.page - 1) * pagination.pageSize;

    const countResult = await client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM directory_profiles p
        WHERE ($1::boolean OR p.is_active = true)
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

          p.sector_id,
          s.name AS sector_name,
          p.job_title_id,
          jt.name AS job_title_name,
          p.is_active,
          p.venmo_address,
          p.monero_address,
          p.bitcoin_address,
          p.service_credits_address,
          p.created_at,
          p.updated_at
        FROM directory_profiles p
        LEFT JOIN skills_taxonomy_sectors s ON s.id = p.sector_id
        LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
        WHERE ($1::boolean OR p.is_active = true)
        ORDER BY p.updated_at DESC
        OFFSET $2 LIMIT $3
      `,
      [includeInactive, offset, pagination.pageSize],
    );

    const items: DirectoryProfile[] = [];
    for (const row of rows.rows) {
      items.push(await mapProfileRow(client, row));
    }

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

    await ensureTaxonomySelectors(client, sectorId, jobTitleId, skillIds);

    const inserted = await client.query<{ id: string }>(
      `
        INSERT INTO directory_profiles
          (claimed_by_user_id, first_name, last_name, headline, bio, profile_url, sector_id, job_title_id, is_active)
        VALUES
          (NULL, $1, $2, $3, $4, $5, $6::uuid, $7::uuid, true)
        RETURNING id
      `,
      [firstName, lastName, headline, bio, profileUrl, sectorId, jobTitleId],
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

export async function updateAdminProfile(
  actorId: string,
  profileId: string,
  input: DirectoryProfileInput,
): Promise<DirectoryProfile | null> {
  return withDbTransaction(async (client) => {
    // Compare ids as text — directory_profiles.id is varchar in the carried-over v2
    // database, so a ::uuid cast fails to plan / throws on non-uuid ids. See #534.
    const existing = await client.query<{ id: string }>('SELECT id FROM directory_profiles WHERE id::text = $1', [profileId]);
    if (existing.rows.length === 0) {
      return null;
    }

    const firstName = normalizeText(input.firstName);
    const lastName = normalizeNullableText(input.lastName);
    const headline = normalizeNullableText(input.headline);
    const bio = normalizeNullableText(input.bio);
    const profileUrl = normalizeNullableText(input.profileUrl);
    const sectorId = input.sectorId ?? null;
    const jobTitleId = input.jobTitleId ?? null;
    const skillIds = normalizeSkillIds(input.skillIds);
    const venmoAddress = normalizeNullableText(input.venmoAddress);
    const moneroAddress = normalizeNullableText(input.moneroAddress);
    const bitcoinAddress = normalizeNullableText(input.bitcoinAddress);
    const serviceCreditsAddress = normalizeNullableText(input.serviceCreditsAddress);

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
      ],
    );

    await replaceProfileSkills(client, profileId, skillIds);

    await client.query(
      `
        INSERT INTO directory_profile_change_events
          (actor_id, command, policy_status, reason, target_type, target_id, metadata)
        VALUES
          ($1, 'directory.admin.profile.update', 'allow', 'admin_route_guard', 'profile', $2, '{}'::jsonb)
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

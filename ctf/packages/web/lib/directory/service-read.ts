import { NextResponse } from 'next/server';
import { queryDb } from 'lib/db/postgres';
import { resolveServiceConsumer } from 'lib/auth/service-consumer';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';
import { OWNED_PROFILE_ORDER_SQL } from 'lib/directory/profile-claim';

// One Percent reads Directory profiles for the owner's desk (owner decisions, 2026-10-02,
// 2026-10-06 and 2026-10-07; the "One Percent is the paid tier" section of CLAUDE.md). The limits
// those decisions set are enforced here rather than promised:
//
// - Claimed or not, and says which. A community-generated profile nobody has claimed still has a
//   name, skills, a location and usually a profile link, so it's read like any other and comes
//   back with `claimed: false`. A deleted profile stops resolving. The by-account read below is
//   claimed by definition.
// - Not a member Skills Economy blocks from connecting. A claiming account restricted with scope
//   'all' or 'contact' reads as not found, because an introduction is a connection and those two
//   scopes already stop the member from starting one here. 'trading' alone covers credits and
//   rides and does not hide the profile. The answer never says a member is restricted.
// - One profile by id: the owner pastes the link of somebody they already know about, and the
//   route answers for that one person.
// - Or a page of profiles, for the desk's Find matches (owner decision, 2026-10-07). That read is
//   in service-list.ts, with the same fields, the same restriction rule and stricter limits. There
//   is still no search.
// - Or one profile by the account that claimed it (owner decision, 2026-10-02). A One Percent
//   client signs in there with their Skills Economy account, so One Percent already holds that
//   account's id; this answers which claimed profile, if any, belongs to it. Still one person,
//   asked for by an id the caller already has. Never a list, never a search, and never an
//   answer that says whether an account exists.
// - Only what the desk shows. Name, headline, job title, sector, skills by name, profile address
//   and location. Never the bio, payment addresses, the account id or anything about who
//   nominated or invited them.
// - Machine only. No member path: members have their own profile route behind Unlock, and this
//   one answers only for a `DIRECTORY_SERVICE_TOKENS` consumer, separate from the taxonomy one so
//   either can be revoked alone.

export type DirectoryServiceGate =
  | { allowed: true; actorId: string }
  | { allowed: false; response: NextResponse };

export function requireDirectoryServiceRead(request: Request): DirectoryServiceGate {
  const consumer = resolveServiceConsumer(request.headers.get('authorization'), 'DIRECTORY_SERVICE_TOKENS');
  if (!consumer) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          ok: false,
          code: DIRECTORY_ERROR_CODE.serviceUnauthorized,
          message:
            'This route answers only for a consumer listed in DIRECTORY_SERVICE_TOKENS. Send Authorization: Bearer <name>.<secret>.',
        },
        { status: 401 },
      ),
    };
  }
  // The desk opens one record at a time, so this rate is invisible to it and stops a credential
  // from walking the Directory id by id.
  const limited = enforcePublicReadRateLimit(request, `directory-service:${consumer.name}`);
  if (limited) {
    return { allowed: false, response: limited };
  }
  return { allowed: true, actorId: `service:${consumer.name}` };
}

export type DirectoryProfileForService = {
  id: string;
  claimed: boolean;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  jobTitle: string | null;
  sector: string | null;
  skills: string[];
  profileUrl: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

export type ServiceProfileRow = {
  id: string;
  claimed: boolean;
  first_name: string | null;
  last_name: string | null;
  headline: string | null;
  job_title_name: string | null;
  sector_name: string | null;
  skills: string[] | null;
  profile_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

// Directory ids are uuids, plus older text ids carried over from v2. Anything outside that shape
// cannot match a row, so it is answered as not found without reaching the database.
const PROFILE_ID = /^[A-Za-z0-9_-]{1,64}$/;

// The projection both reads share, and the list read in service-list.ts beside it: the fields the
// desk shows and nothing else. Restricted owners are filtered by SERVICE_RESTRICTION_FILTER_SQL.
export const SERVICE_PROFILE_SELECT_SQL = `
        p.id::text AS id,
        (p.claimed_by_user_id IS NOT NULL) AS claimed,
        p.first_name,
        p.last_name,
        p.headline,
        jt.name AS job_title_name,
        s.name AS sector_name,
        ARRAY(
          SELECT sk.name
          FROM directory_profile_skills dps
          JOIN skills_taxonomy_skills sk ON sk.id = dps.skill_id
          WHERE dps.profile_id::text = p.id::text
          ORDER BY dps.display_order ASC, sk.name ASC
        ) AS skills,
        p.profile_url,
        p.city,
        p.state,
        p.country
      FROM directory_profiles p
      LEFT JOIN skills_taxonomy_sectors s ON s.id = p.sector_id
      LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id`;

// A claimed profile whose owner is restricted from connecting never comes back. Unclaimed profiles
// have no owner, so the NOT EXISTS is true for them.
export const SERVICE_RESTRICTION_FILTER_SQL = `NOT EXISTS (
          SELECT 1 FROM account_restrictions r
          WHERE r.user_id = p.claimed_by_user_id
            AND r.is_restricted
            AND r.restriction_scope IN ('all', 'contact')
        )`;

export function toServiceProfile(row: ServiceProfileRow): DirectoryProfileForService {
  return {
    id: row.id,
    claimed: Boolean(row.claimed),
    firstName: row.first_name,
    lastName: row.last_name,
    headline: row.headline,
    jobTitle: row.job_title_name,
    sector: row.sector_name,
    skills: row.skills ?? [],
    profileUrl: row.profile_url,
    city: row.city,
    state: row.state,
    country: row.country,
  };
}

async function readProfile(column: 'id' | 'claimed_by_user_id', value: string): Promise<DirectoryProfileForService | null> {
  const result = await queryDb<ServiceProfileRow>(
    `
      SELECT ${SERVICE_PROFILE_SELECT_SQL}
      WHERE ${column === 'id' ? 'p.id::text' : 'p.claimed_by_user_id'} = $1
        AND ${SERVICE_RESTRICTION_FILTER_SQL}
      ORDER BY ${OWNED_PROFILE_ORDER_SQL}
      LIMIT 1
    `,
    [value],
  );
  const row = result.rows[0];
  return row ? toServiceProfile(row) : null;
}

export async function getProfileForService(profileId: string): Promise<DirectoryProfileForService | null> {
  const id = typeof profileId === 'string' ? profileId.trim() : '';
  if (!PROFILE_ID.test(id)) {
    return null;
  }
  return readProfile('id', id);
}

// Clerk account ids: "user_" and letters and digits. Anything else can't have claimed a profile,
// so it's answered as not found without reaching the database.
const ACCOUNT_ID = /^user_[A-Za-z0-9]{8,64}$/;

export async function getClaimedProfileForAccountService(accountId: string): Promise<DirectoryProfileForService | null> {
  const id = typeof accountId === 'string' ? accountId.trim() : '';
  if (!ACCOUNT_ID.test(id)) {
    return null;
  }
  return readProfile('claimed_by_user_id', id);
}

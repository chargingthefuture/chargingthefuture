import { NextResponse } from 'next/server';
import { queryDb } from 'lib/db/postgres';
import { resolveServiceConsumer } from 'lib/auth/service-consumer';
import { enforcePublicReadRateLimit } from 'lib/security/rate-limit';
import { DIRECTORY_ERROR_CODE } from 'lib/directory/constants';

// One Percent reads claimed Directory profiles, one at a time, for the owner's desk (owner
// decision, 2026-10-02; the "One Percent is the paid tier" section of CLAUDE.md). The limits that
// decision sets are enforced here rather than promised:
//
// - Claimed only. The query itself requires `claimed_by_user_id`, so an unclaimed profile is the
//   same answer as a missing one, and a profile unclaimed or deleted later stops resolving.
// - Not a member Skills Economy blocks from connecting. A claiming account restricted with scope
//   'all' or 'contact' reads as not found, because an introduction is a connection and those two
//   scopes already stop the member from starting one here. 'trading' alone covers credits and
//   rides and does not hide the profile. The answer never says a member is restricted.
// - One profile by id. There is no list and no search: the owner pastes the link of somebody
//   they already know about, and the route answers for that one person.
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

export type ClaimedProfileForService = {
  id: string;
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

type Row = {
  id: string;
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

export async function getClaimedProfileForService(profileId: string): Promise<ClaimedProfileForService | null> {
  const id = typeof profileId === 'string' ? profileId.trim() : '';
  if (!PROFILE_ID.test(id)) {
    return null;
  }
  const result = await queryDb<Row>(
    `
      SELECT
        p.id::text AS id,
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
      LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
      WHERE p.id::text = $1
        AND p.claimed_by_user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM account_restrictions r
          WHERE r.user_id = p.claimed_by_user_id
            AND r.is_restricted
            AND r.restriction_scope IN ('all', 'contact')
        )
      LIMIT 1
    `,
    [id],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
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

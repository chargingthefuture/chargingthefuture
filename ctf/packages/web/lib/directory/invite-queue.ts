import { queryDb } from 'lib/db/postgres';

// The invite queue. One row per listed person, with their Quora address and what they can do.
//
// Invite posts on the blog are written for one person at a time and name the thing that person
// actually does, so this returns the skills themselves rather than a count. It is read-only and
// admin-only: gathered and sorted this way, the Directory is a different object from the public
// sources it was built from, which is why viewing it needs a sign-in at all.
//
// It exists as a screen because the owner works from a phone. A query somebody has to run in a
// terminal is not available to them, so the answer has to be a page they can open and copy.

export type DirectoryInviteKind = 'skill-specific' | 'advocacy-only' | 'no-skill';

export type DirectoryInviteQueueRow = {
  profileId: string;
  name: string | null;
  quoraUrl: string;
  quoraHandle: string;
  location: string | null;
  sector: string | null;
  jobTitle: string | null;
  skills: string[];
  pendingSkills: string[];
  headline: string | null;
  bio: string | null;
  source: string;
  claimed: boolean;
  inviteKind: DirectoryInviteKind;
};

type QueueDbRow = {
  profile_id: string;
  name: string | null;
  quora_url: string;
  location: string | null;
  sector: string | null;
  job_title: string | null;
  skills: string[] | null;
  pending_skills: string[] | null;
  headline: string | null;
  bio: string | null;
  source: string;
  claimed: boolean;
  skill_count: string;
  advocacy_count: string;
  pending_count: string;
};

// Handles that already have a dedicated invite post on the blog, plus the owner's own listing,
// which is not an invitation to anybody. Lower case, no /profile/ prefix.
//
// This list grows every time an invite post ships. The blog repository tracks the queue in
// wiki-site/INVITE_QUEUE.md and its Published table is the companion to this array — change both
// in the same piece of work or the person gets invited twice.
export const DIRECTORY_INVITE_ALREADY_WRITTEN = [
  'farah-brunache',
  'janie-spears-7',
  'j-h-b-7',
  'steph-wo-1',
] as const;

// Advocacy is a placeholder skill. It was applied to people whose public writing showed only that
// they speak up for Targeted Individuals, with no trade stated anywhere, so it stands in for a
// skill that is not known rather than naming one. A post to somebody carrying only that label says
// their writing is about Targeted Individuals, because that is on the record, and does not call
// them an advocate by trade or decide what they advocate for.
const ADVOCACY_MATCH = '%advocacy%';

function inviteKind(row: QueueDbRow): DirectoryInviteKind {
  const skillCount = Number.parseInt(row.skill_count, 10);
  const advocacyCount = Number.parseInt(row.advocacy_count, 10);
  const pendingCount = Number.parseInt(row.pending_count, 10);

  if (skillCount === 0 && pendingCount === 0) {
    return 'no-skill';
  }

  if (pendingCount === 0 && skillCount > 0 && advocacyCount === skillCount) {
    return 'advocacy-only';
  }

  return 'skill-specific';
}

// Strips the query string, the /profile/ prefix and any trailing slash, so a stored address in
// either shape compares against the already-written list.
function handleFromUrl(url: string): string {
  const withoutQuery = url.split('?')[0] ?? url;
  const afterPrefix = withoutQuery.replace(/^.*\/profile\//, '');
  return afterPrefix.replace(/\/+$/, '').toLowerCase();
}

export async function listDirectoryInviteQueue(): Promise<DirectoryInviteQueueRow[]> {
  const result = await queryDb<QueueDbRow>(
    `
      WITH listed_skills AS (
        SELECT
          ps.profile_id,
          array_agg(s.name ORDER BY ps.display_order, s.name) AS skills,
          count(*) AS skill_count,
          count(*) FILTER (WHERE s.name ILIKE $1) AS advocacy_count
        FROM directory_profile_skills ps
        JOIN skills_taxonomy_skills s ON s.id = ps.skill_id
        WHERE s.is_active
        GROUP BY ps.profile_id
      ),
      pending_skills AS (
        SELECT
          profile_id,
          array_agg(skill_label ORDER BY skill_label) AS pending_skills,
          count(*) AS pending_count
        FROM directory_profile_proposed_skills
        GROUP BY profile_id
      )
      SELECT
        p.id::text AS profile_id,
        nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '') AS name,
        p.profile_url AS quora_url,
        nullif(concat_ws(', ', nullif(p.city, ''), nullif(p.state, ''), nullif(p.country, '')), '') AS location,
        sec.name AS sector,
        jt.name AS job_title,
        ls.skills,
        pn.pending_skills,
        p.headline,
        p.bio,
        p.source,
        (p.claimed_by_user_id IS NOT NULL) AS claimed,
        coalesce(ls.skill_count, 0)::text AS skill_count,
        coalesce(ls.advocacy_count, 0)::text AS advocacy_count,
        coalesce(pn.pending_count, 0)::text AS pending_count
      FROM directory_profiles p
      LEFT JOIN listed_skills ls ON ls.profile_id = p.id
      LEFT JOIN pending_skills pn ON pn.profile_id = p.id
      LEFT JOIN skills_taxonomy_sectors sec ON sec.id = p.sector_id
      LEFT JOIN skills_taxonomy_job_titles jt ON jt.id = p.job_title_id
      WHERE p.deleted_at IS NULL
        AND p.is_active
        AND coalesce(p.profile_url, '') <> ''
      ORDER BY sec.name NULLS LAST, name NULLS LAST
    `,
    [ADVOCACY_MATCH],
  );

  const alreadyWritten = new Set<string>(DIRECTORY_INVITE_ALREADY_WRITTEN);
  const kindRank: Record<DirectoryInviteKind, number> = {
    'skill-specific': 1,
    'advocacy-only': 2,
    'no-skill': 3,
  };

  return result.rows
    .map((row) => ({
      profileId: row.profile_id,
      name: row.name,
      quoraUrl: row.quora_url,
      quoraHandle: handleFromUrl(row.quora_url),
      location: row.location,
      sector: row.sector,
      jobTitle: row.job_title,
      skills: row.skills ?? [],
      pendingSkills: row.pending_skills ?? [],
      headline: row.headline,
      bio: row.bio,
      source: row.source,
      claimed: row.claimed,
      inviteKind: inviteKind(row),
    }))
    .filter((row) => !alreadyWritten.has(row.quoraHandle))
    .sort((a, b) => kindRank[a.inviteKind] - kindRank[b.inviteKind]);
}

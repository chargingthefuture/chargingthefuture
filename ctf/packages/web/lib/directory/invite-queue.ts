import { queryDb } from 'lib/db/postgres';
import { quoraHandleFromUrl } from './invite-input';
import { listInvitedQuoraHandles } from './invites';

// The invite queue. One row per listed person, with their Quora address and what they can do.
//
// Invitations are written for one person at a time and name the thing that person
// actually does, so this returns the skills themselves rather than a count. It is read-only and
// admin-only: gathered and sorted this way, the Directory is a different object from the public
// sources it was built from, which is why viewing it needs a sign-in at all.
//
// It exists as a screen because the owner works from a phone. A query somebody has to run in a
// terminal is not available to them, so the answer has to be a page they can open and copy.

export type DirectoryInviteKind = 'skill-specific' | 'advocacy-only' | 'no-skill';

// Where a listed skill sits in the taxonomy. An invite post states how thin that skill's sector is
// ("4 of its 24 skills are held by anybody"), and a person's two skills can sit in two different
// sectors, so the sector is read per skill rather than from the profile's single sector field.
export type DirectoryInviteSkillPlace = {
  skill: string;
  jobTitle: string | null;
  sector: string | null;
};

export type DirectoryInviteQueueRow = {
  profileId: string;
  name: string | null;
  quoraUrl: string;
  quoraHandle: string;
  // The Directory profile address. The post prints it beside the listing's screenshot.
  directoryUrl: string;
  location: string | null;
  sector: string | null;
  jobTitle: string | null;
  skills: string[];
  skillPlaces: DirectoryInviteSkillPlace[];
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
  skill_places: DirectoryInviteSkillPlace[] | null;
  pending_skills: string[] | null;
  headline: string | null;
  bio: string | null;
  source: string;
  claimed: boolean;
  skill_count: string;
  advocacy_count: string;
  pending_count: string;
};

// Who already has an invitation is read from directory_invites (owner decision, 2026-10-15), where
// the private invite repository's job writes each one. It used to be a list of Quora handles typed
// into this file, which was itself a public list of the people invited.
//
// The owner queues like everybody else: their listing gets one invitation in the same format and
// leaves the queue when it is written, on the same footing as every other listing.

const DIRECTORY_PROFILE_BASE = 'https://app.lagatos.com/apps/directory/profile/';

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

export async function listDirectoryInviteQueue(): Promise<DirectoryInviteQueueRow[]> {
  const result = await queryDb<QueueDbRow>(
    `
      -- profile_id is compared as text on both joins below. On the cloned production database it is
      -- a v2 varchar column while directory_profiles.id is a uuid, so an untyped comparison fails
      -- with "operator does not exist: uuid = character varying". Every other query in
      -- lib/directory/repository.ts casts for the same reason.
      WITH listed_skills AS (
        SELECT
          ps.profile_id::text AS profile_id,
          array_agg(s.name ORDER BY ps.display_order, s.name) AS skills,
          json_agg(
            json_build_object('skill', s.name, 'jobTitle', sjt.name, 'sector', ssec.name)
            ORDER BY ps.display_order, s.name
          ) AS skill_places,
          count(*) AS skill_count,
          count(*) FILTER (WHERE s.name ILIKE $1) AS advocacy_count
        FROM directory_profile_skills ps
        JOIN skills_taxonomy_skills s ON s.id::text = ps.skill_id::text
        LEFT JOIN skills_taxonomy_job_titles sjt ON sjt.id::text = s.job_title_id::text
        LEFT JOIN skills_taxonomy_sectors ssec ON ssec.id::text = sjt.sector_id::text
        WHERE s.is_active
        GROUP BY ps.profile_id::text
      ),
      pending_skills AS (
        SELECT
          profile_id::text AS profile_id,
          array_agg(skill_label ORDER BY skill_label) AS pending_skills,
          count(*) AS pending_count
        FROM directory_profile_proposed_skills
        -- Only labels still awaiting review: the taxonomy apply run marks a promoted label
        -- status = 'promoted' and keeps the row, and every other reader filters on 'pending'.
        WHERE status = 'pending' AND btrim(skill_label) <> ''
        GROUP BY profile_id::text
      )
      SELECT
        p.id::text AS profile_id,
        nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '') AS name,
        p.profile_url AS quora_url,
        nullif(concat_ws(', ', nullif(p.city, ''), nullif(p.state, ''), nullif(p.country, '')), '') AS location,
        sec.name AS sector,
        jt.name AS job_title,
        ls.skills,
        ls.skill_places,
        pn.pending_skills,
        p.headline,
        p.bio,
        p.source,
        (p.claimed_by_user_id IS NOT NULL) AS claimed,
        coalesce(ls.skill_count, 0)::text AS skill_count,
        coalesce(ls.advocacy_count, 0)::text AS advocacy_count,
        coalesce(pn.pending_count, 0)::text AS pending_count
      FROM directory_profiles p
      LEFT JOIN listed_skills ls ON ls.profile_id = p.id::text
      LEFT JOIN pending_skills pn ON pn.profile_id = p.id::text
      LEFT JOIN skills_taxonomy_sectors sec ON sec.id::text = p.sector_id::text
      LEFT JOIN skills_taxonomy_job_titles jt ON jt.id::text = p.job_title_id::text
      WHERE coalesce(p.profile_url, '') <> ''
      ORDER BY sec.name NULLS LAST, name NULLS LAST
    `,
    [ADVOCACY_MATCH],
  );

  const alreadyWritten = await listInvitedQuoraHandles();
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
      quoraHandle: quoraHandleFromUrl(row.quora_url),
      directoryUrl: `${DIRECTORY_PROFILE_BASE}${row.profile_id}`,
      location: row.location,
      sector: row.sector,
      jobTitle: row.job_title,
      skills: row.skills ?? [],
      skillPlaces: row.skill_places ?? [],
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

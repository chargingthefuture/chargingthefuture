import { queryDb } from 'lib/db/postgres';

// Every profile still carrying a free-text skill as a "pending review" chip, and the admin's way
// to drop one after deciding not to promote it.
//
// A chip has two possible origins, and they live in different tables:
//   - 'directory'   the member typed it into the "skill not listed" box on their own profile;
//                   one row per profile and label in directory_profile_proposed_skills.
//   - 'skills-hunt' a scout proposed it on the nomination that generated the profile; the label
//                   lives once per distinct skill in skills_hunt_proposed_skill_promotions and
//                   reaches the profile through skills_hunt_directory_profiles.
// Promotion clears both through the taxonomy apply run. Non-promotion cleared neither, so a closed
// skill-proposal issue left the chip on the profile for good and the only way off was a statement
// against the database. This is the screen-shaped answer: read-only list, one write per chip.

export type DirectoryPendingSkillSource = 'skills-hunt' | 'directory';

export function isDirectoryPendingSkillSource(value: unknown): value is DirectoryPendingSkillSource {
  return value === 'skills-hunt' || value === 'directory';
}

export type DirectoryPendingSkillProposalRow = {
  profileId: string;
  name: string | null;
  handle: string | null;
  claimed: boolean;
  // false when the profile has been removed (deleted_at set). Listed and marked rather than hidden:
  // an admin list hides nothing (rule 131).
  active: boolean;
  skillLabel: string;
  source: DirectoryPendingSkillSource;
  issueNumber: number | null;
  issueUrl: string | null;
  trackerStatus: string | null;
  // An active taxonomy skill already carries exactly this name, so the chip duplicates a skill
  // the member could pick instead. The profile detail already hides such a chip; the admin sees it.
  inTaxonomy: boolean;
  heldSkills: string[];
  addedAt: string;
};

type DbRow = {
  profile_id: string;
  name: string | null;
  handle: string | null;
  claimed: boolean;
  active: boolean;
  skill_label: string;
  source: DirectoryPendingSkillSource;
  issue_number: number | null;
  issue_url: string | null;
  tracker_status: string | null;
  in_taxonomy: boolean;
  held_skills: string[] | null;
  added_at: string;
};

export async function listDirectoryPendingSkillProposals(): Promise<DirectoryPendingSkillProposalRow[]> {
  const result = await queryDb<DbRow>(
    `
      -- Ids are compared as text throughout: on the cloned production database
      -- skills_hunt_directory_profiles.directory_profile_id is text and several profile-keyed
      -- columns are v2 varchar against a uuid directory_profiles.id (see lib/directory/repository.ts).
      WITH pending AS (
        SELECT
          d.profile_id::text AS profile_id,
          btrim(d.skill_label) AS skill_label,
          'directory'::text AS source,
          d.created_at AS added_at
        FROM directory_profile_proposed_skills d
        WHERE d.status = 'pending'
          AND btrim(d.skill_label) <> ''
        UNION ALL
        SELECT
          shdp.directory_profile_id::text AS profile_id,
          btrim(prom.skill_label) AS skill_label,
          'skills-hunt'::text AS source,
          prom.created_at AS added_at
        FROM skills_hunt_directory_profiles shdp
        JOIN skills_hunt_proposed_skill_promotions prom
          ON prom.source_submission_id = shdp.submission_id
        WHERE prom.status NOT IN ('promoted', 'dropped')
          AND btrim(prom.skill_label) <> ''
      ),
      held AS (
        SELECT
          ps.profile_id::text AS profile_id,
          array_agg(s.name ORDER BY ps.display_order, s.name) AS skills
        FROM directory_profile_skills ps
        JOIN skills_taxonomy_skills s ON s.id::text = ps.skill_id::text
        WHERE s.is_active
        GROUP BY ps.profile_id::text
      )
      SELECT
        pn.profile_id,
        nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '') AS name,
        p.unclaimed_handle AS handle,
        (p.claimed_by_user_id IS NOT NULL) AS claimed,
        (p.id IS NOT NULL AND p.deleted_at IS NULL) AS active,
        pn.skill_label,
        pn.source,
        prom.issue_number,
        prom.issue_url,
        prom.status AS tracker_status,
        EXISTS (
          SELECT 1 FROM skills_taxonomy_skills s
          WHERE s.is_active AND lower(btrim(s.name)) = lower(pn.skill_label)
        ) AS in_taxonomy,
        h.skills AS held_skills,
        pn.added_at
      FROM pending pn
      LEFT JOIN directory_profiles p ON p.id::text = pn.profile_id
      LEFT JOIN held h ON h.profile_id = pn.profile_id
      LEFT JOIN skills_hunt_proposed_skill_promotions prom
        ON prom.normalized_skill = lower(pn.skill_label)
      ORDER BY name NULLS LAST, pn.profile_id, pn.skill_label
    `,
  );

  return result.rows.map((row) => ({
    profileId: row.profile_id,
    name: row.name,
    handle: row.handle,
    claimed: row.claimed,
    active: row.active,
    skillLabel: row.skill_label,
    source: row.source,
    issueNumber: row.issue_number,
    issueUrl: row.issue_url,
    trackerStatus: row.tracker_status,
    inTaxonomy: row.in_taxonomy,
    heldSkills: row.held_skills ?? [],
    addedAt: row.added_at,
  }));
}

export type DropPendingSkillProposalInput = {
  profileId: string;
  skillLabel: string;
  source: DirectoryPendingSkillSource;
};

export type DropPendingSkillProposalResult =
  | { outcome: 'dropped'; before: string; after: 'deleted' | 'dropped' }
  | { outcome: 'not_found' };

// A member-added row is deleted outright: the member's edit form reads only pending rows, so the
// label leaves the form too and a later save does not put it back. A nominated proposal is marked
// 'dropped' rather than deleted, because that row is also the intake's dedupe record — deleting it
// would let the next scheduled run file a fresh issue for a skill the owner already decided against.
export async function dropDirectoryPendingSkillProposal(
  input: DropPendingSkillProposalInput,
): Promise<DropPendingSkillProposalResult> {
  if (input.source === 'directory') {
    const result = await queryDb(
      `
        DELETE FROM directory_profile_proposed_skills
        WHERE profile_id::text = $1
          AND lower(btrim(skill_label)) = lower(btrim($2))
          AND status = 'pending'
      `,
      [input.profileId, input.skillLabel],
    );
    return (result.rowCount ?? 0) > 0
      ? { outcome: 'dropped', before: 'pending', after: 'deleted' }
      : { outcome: 'not_found' };
  }

  const result = await queryDb<{ previous_status: string }>(
    `
      UPDATE skills_hunt_proposed_skill_promotions prom
         SET status = 'dropped',
             updated_at = NOW()
        FROM skills_hunt_directory_profiles shdp
       WHERE shdp.submission_id = prom.source_submission_id
         AND shdp.directory_profile_id::text = $1
         AND lower(btrim(prom.skill_label)) = lower(btrim($2))
         AND prom.status NOT IN ('promoted', 'dropped')
      RETURNING (
        SELECT status FROM skills_hunt_proposed_skill_promotions old WHERE old.id = prom.id
      ) AS previous_status
    `,
    [input.profileId, input.skillLabel],
  );
  if ((result.rowCount ?? 0) === 0) {
    return { outcome: 'not_found' };
  }
  return { outcome: 'dropped', before: result.rows[0]?.previous_status ?? 'unknown', after: 'dropped' };
}

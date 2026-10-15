-- Directory invite queue: one row per listed person, with their Quora address and what they can do.
--
-- Feeds the invitations shown on the Directory's invite wall. Each one is written for one person
-- and names the thing they actually do, so the query returns the skills rather than a count.
--
-- Anybody who already has an invitation is left out, read from directory_invites. The owner's own
-- listing is queued like everybody else's, the same rule as the screen.
--
-- invite_kind is the one judgment the query makes, and it exists because Advocacy is a placeholder.
-- It was put on people whose public writing showed only that they speak up for Targeted Individuals,
-- with no trade stated. A post to one of those cannot name a trade and must not claim they are an
-- advocate by profession. A post to somebody listed for plumbing names plumbing.
--
--   skill-specific  — has at least one skill that is not Advocacy. Write about that skill.
--   advocacy-only   — every listed skill is Advocacy. Write the general invitation.
--   no-skill        — listed with nothing recorded. Not ready for a post; find out what they do first.
--
-- How to run it: paste the statement below into the Neon dashboard's SQL editor. The owner works
-- from a phone and has no terminal, so a shell command is not a way to deliver this (see CLAUDE.md,
-- "The Owner Has No Terminal"). The same list is also a screen in the app at
-- /admin/directory/invite-queue, which is the better route when it is wanted more than once.
--
-- Read-only. No writes, no temporary tables.
--
-- Every id comparison is cast to text. On the cloned production database
-- directory_profile_skills.profile_id is a v2 varchar column while directory_profiles.id is a
-- uuid, and an untyped comparison fails with "operator does not exist: uuid = character
-- varying". The app's own queries cast for the same reason.

WITH already_written AS (
  -- Everybody who already has an invitation. The private invite repository's job writes each one
  -- into directory_invites; the handle there is lower case, with no /profile/ prefix.
  SELECT quora_handle AS handle FROM directory_invites
),
listed_skills AS (
  SELECT
    ps.profile_id::text AS profile_id,
    string_agg(s.name, '; ' ORDER BY ps.display_order, s.name) AS skills,
    -- Each skill with the job title and sector it sits under. An invite post states how thin the
    -- skill's own sector is, and two skills on one listing can sit in two sectors.
    string_agg(
      s.name || ' — ' || coalesce(sjt.name, 'no job title') || ' (' || coalesce(ssec.name, 'no sector') || ')',
      '; ' ORDER BY ps.display_order, s.name
    ) AS skill_places,
    count(*) AS skill_count,
    count(*) FILTER (WHERE s.name ILIKE '%advocacy%') AS advocacy_count
  FROM directory_profile_skills ps
  JOIN skills_taxonomy_skills s ON s.id::text = ps.skill_id::text
  LEFT JOIN skills_taxonomy_job_titles sjt ON sjt.id::text = s.job_title_id::text
  LEFT JOIN skills_taxonomy_sectors ssec ON ssec.id::text = sjt.sector_id::text
  WHERE s.is_active
  GROUP BY ps.profile_id::text
),
pending_skills AS (
  -- Free-text skills a member added that an admin has not promoted into the taxonomy yet. They
  -- still say what somebody does, so a post can use them.
  SELECT
    profile_id::text AS profile_id,
    string_agg(skill_label, '; ' ORDER BY skill_label) AS proposed_skills,
    count(*) AS proposed_count
  FROM directory_profile_proposed_skills
  -- Every row is written with status 'pending' and the set is replaced wholesale on each edit,
  -- so there is no rejected state to filter out.
  GROUP BY profile_id::text
)
SELECT
  p.id AS profile_id,
  nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '') AS name,
  p.profile_url AS quora_url,
  'https://app.chargingthefuture.com/apps/directory/profile/' || p.id::text AS directory_url,
  nullif(concat_ws(', ', nullif(p.city, ''), nullif(p.state, ''), nullif(p.country, '')), '') AS location,
  sec.name AS sector,
  jt.name AS job_title,
  coalesce(ls.skills, '') AS skills,
  coalesce(ls.skill_places, '') AS skill_places,
  coalesce(pn.proposed_skills, '') AS pending_skills,
  p.headline,
  p.bio,
  p.source,
  (p.claimed_by_user_id IS NOT NULL) AS claimed,
  CASE
    WHEN coalesce(ls.skill_count, 0) = 0 AND coalesce(pn.proposed_count, 0) = 0 THEN 'no-skill'
    WHEN coalesce(pn.proposed_count, 0) = 0
     AND coalesce(ls.skill_count, 0) > 0
     AND ls.advocacy_count = ls.skill_count THEN 'advocacy-only'
    ELSE 'skill-specific'
  END AS invite_kind
FROM directory_profiles p
LEFT JOIN listed_skills ls ON ls.profile_id = p.id::text
LEFT JOIN pending_skills pn ON pn.profile_id = p.id::text
LEFT JOIN skills_taxonomy_sectors sec ON sec.id::text = p.sector_id::text
LEFT JOIN skills_taxonomy_job_titles jt ON jt.id::text = p.job_title_id::text
WHERE coalesce(p.profile_url, '') <> ''
  -- Strip any query string, the /profile/ prefix and a trailing slash before comparing.
  AND lower(trim(BOTH '/' FROM regexp_replace(split_part(p.profile_url, '?', 1), '^.*/profile/', '')))
      NOT IN (SELECT handle FROM already_written)
ORDER BY
  CASE
    WHEN coalesce(ls.skill_count, 0) = 0 AND coalesce(pn.proposed_count, 0) = 0 THEN 3
    WHEN coalesce(pn.proposed_count, 0) = 0
     AND coalesce(ls.skill_count, 0) > 0
     AND ls.advocacy_count = ls.skill_count THEN 2
    ELSE 1
  END,
  sec.name NULLS LAST,
  2 NULLS LAST;  -- output column 2 is name; the ordinal avoids any clash with sec.name / jt.name

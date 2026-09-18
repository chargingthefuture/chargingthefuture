-- Directory invite queue: one row per listed person, with their Quora address and what they can do.
--
-- Feeds the invite posts on the blog (wiki-site/INVITE_QUEUE.md). Each post is written for one
-- person and names the thing they actually do, so the query returns the skills rather than a count.
--
-- Two kinds of exclusion, and they are different:
--   * The owner's own listing. It is not an invitation to anybody.
--   * Anybody who already has a dedicated invite post. Those handles are listed below and the
--     list grows every time a post ships — update it in the same commit as the post.
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
  -- Quora handles, lower case, no /profile/ prefix. Add a handle here when its post merges.
  SELECT unnest(ARRAY[
    'farah-brunache',   -- the owner
    'janie-spears-7',   -- an-invitation-to-janie.md
    'j-h-b-7',          -- an-invitation-to-jhb.md
    'steph-wo-1',       -- an-invitation-to-steph-wo.md
    'none-ya-970'       -- an-invitation-to-christy.md
  ]) AS handle
),
listed_skills AS (
  SELECT
    ps.profile_id::text AS profile_id,
    string_agg(s.name, '; ' ORDER BY ps.display_order, s.name) AS skills,
    count(*) AS skill_count,
    count(*) FILTER (WHERE s.name ILIKE '%advocacy%') AS advocacy_count
  FROM directory_profile_skills ps
  JOIN skills_taxonomy_skills s ON s.id::text = ps.skill_id::text
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
  nullif(concat_ws(', ', nullif(p.city, ''), nullif(p.state, ''), nullif(p.country, '')), '') AS location,
  sec.name AS sector,
  jt.name AS job_title,
  coalesce(ls.skills, '') AS skills,
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
WHERE p.deleted_at IS NULL
  AND p.is_active
  AND coalesce(p.profile_url, '') <> ''
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

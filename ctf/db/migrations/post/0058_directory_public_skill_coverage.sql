-- post/0058: Skills coverage for the landing page.
--
-- Why (owner decision, 2026-10-14): the landing page states what share of the skills a small country
-- runs on the people in the Directory already cover. It was typed into the page; this lets the page
-- read it live, so it moves when the owner adds people.
--
-- What it does: creates directory_public_skill_coverage, one row with the number of different active
-- skills at least one Directory profile lists and the number of active skills. The same query as the
-- Workforce Skills Coverage tile. Grants the landing page login SELECT on it when that login exists.
--
-- Safe to re-run: CREATE OR REPLACE VIEW, and the grant is skipped when the role is missing.
BEGIN;
CREATE OR REPLACE VIEW directory_public_skill_coverage AS
  SELECT
    (SELECT COUNT(DISTINCT dps.skill_id)::integer
       FROM directory_profile_skills dps
       JOIN directory_profiles p ON dps.profile_id::text = p.id::text
       JOIN skills_taxonomy_skills s ON s.id = dps.skill_id
      WHERE s.is_active = TRUE) AS covered,
    (SELECT COUNT(*)::integer FROM skills_taxonomy_skills WHERE is_active = TRUE) AS catalog;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'landing_page') THEN
    GRANT SELECT ON directory_public_skill_coverage TO landing_page;
  END IF;
END $$;
COMMIT;

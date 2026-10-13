-- post/0055: Saved matches and public skill counts for the landing page.
--
-- Why (owner decision, 2026-10-13): the public match page (landing-page-v4, on Vercel) is where a
-- blog reader lands from Peace Battle 2. It shows how many people in the Directory list each job
-- title, and lets the reader save a match as a code and come back to see who has been added, because
-- the owner adds people most days. The page reads live counts instead of numbers pasted into it.
--
-- What it does: creates directory_landing_match_codes (code, job title, the count when saved, when
-- it was saved, when it was last looked at; no name, contact detail or IP address) and two views,
-- directory_public_skill_counts and directory_public_totals. Both give counts only, never a row
-- about a person. The page's own login, landing_page, is created and
-- granted in the Neon dashboard (ctf/scripts/sql/landing_page_login_grants.sql), not here.
--
-- Safe to re-run: IF NOT EXISTS on the table, columns and index, CREATE OR REPLACE on the views.
BEGIN;
CREATE TABLE IF NOT EXISTS directory_landing_match_codes (
  code TEXT PRIMARY KEY,
  job_title_id TEXT NOT NULL,
  job_title_ids TEXT[],
  people_at_save INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);
ALTER TABLE IF EXISTS directory_landing_match_codes ADD COLUMN IF NOT EXISTS job_title_id TEXT;
ALTER TABLE IF EXISTS directory_landing_match_codes ADD COLUMN IF NOT EXISTS people_at_save INTEGER;
ALTER TABLE IF EXISTS directory_landing_match_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS directory_landing_match_codes ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
-- The job titles behind the needs a visitor picked (job_title_id keeps the first, for older rows).
ALTER TABLE IF EXISTS directory_landing_match_codes ADD COLUMN IF NOT EXISTS job_title_ids TEXT[];
CREATE INDEX IF NOT EXISTS idx_directory_landing_match_codes_job_title ON directory_landing_match_codes (job_title_id);

-- Who lists which job title, by their job title or any of their skills, claimed or unclaimed,
-- leaving out owners restricted with scope all or contact. Not granted to the landing page: it
-- holds profile ids. The two public views and directory_public_match_count read it. Ids are
-- compared as text because some production id columns are VARCHAR.
CREATE OR REPLACE VIEW directory_person_job_titles AS
  WITH people AS (
    SELECT p.id::text AS id, p.job_title_id::text AS job_title_id
    FROM directory_profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM account_restrictions r
      WHERE r.user_id::text = p.claimed_by_user_id::text
        AND r.is_restricted
        AND r.restriction_scope IN ('all', 'contact')
    )
  )
  SELECT id AS person_id, job_title_id FROM people WHERE job_title_id IS NOT NULL
  UNION
  SELECT pp.id, sk.job_title_id::text
  FROM people pp
  JOIN directory_profile_skills ps ON ps.profile_id::text = pp.id
  JOIN skills_taxonomy_skills sk ON sk.id::text = ps.skill_id::text;

-- One row per active job title and how many people list it (0 when nobody does).
CREATE OR REPLACE VIEW directory_public_skill_counts AS
  WITH per_title AS (
    SELECT job_title_id, COUNT(*)::integer AS n FROM directory_person_job_titles GROUP BY job_title_id
  )
  SELECT jt.id::text AS job_title_id,
         s.name AS sector,
         s.display_order AS sector_order,
         jt.name AS title,
         jt.display_order AS title_order,
         COALESCE(pt.n, 0) AS people
  FROM skills_taxonomy_job_titles jt
  JOIN skills_taxonomy_sectors s ON s.id = jt.sector_id AND s.is_active
  LEFT JOIN per_title pt ON pt.job_title_id = jt.id::text
  WHERE jt.is_active;

-- One row: everybody in the Directory, restriction rule as above.
CREATE OR REPLACE VIEW directory_public_totals AS
  WITH people AS (
    SELECT p.id::text AS id
    FROM directory_profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM account_restrictions r
      WHERE r.user_id::text = p.claimed_by_user_id::text
        AND r.is_restricted
        AND r.restriction_scope IN ('all', 'contact')
    )
  )
  SELECT (SELECT COUNT(*)::integer FROM people) AS total;

-- How many people match a visitor: everyone who lists any of the given job titles, each counted
-- once, as an exact number. Runs with its owner's rights so the landing page can call it
-- without reading directory_person_job_titles itself; at most 60 titles per call.
CREATE OR REPLACE FUNCTION directory_public_match_count(title_ids TEXT[])
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n
  FROM (
    SELECT COUNT(DISTINCT person_id)::integer AS n
    FROM directory_person_job_titles
    WHERE job_title_id = ANY (title_ids[1:60])
  ) x
$$;
REVOKE ALL ON FUNCTION directory_public_match_count(TEXT[]) FROM PUBLIC;
COMMIT;

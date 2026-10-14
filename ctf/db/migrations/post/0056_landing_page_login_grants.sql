-- post/0056: Keep the landing page's login able to read what it needs.
--
-- Why (2026-10-13): pre/0005 drops and schema.sql recreates directory_public_totals, and a dropped
-- view takes its grants with it, so the landing page's counts would stop loading. This puts the
-- access back after every run.
--
-- What it does: when the landing_page login exists, grants exactly what
-- ctf/scripts/sql/landing_page_login_grants.sql grants: read the three count views, call the match count, read and add
-- saved matches, set last_seen_at, add in-demand needs. Nothing more. When the login does not exist yet (it is created by hand
-- in the Neon dashboard), it does nothing.
--
-- Safe to re-run: granting what is already granted changes nothing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'landing_page') THEN
    GRANT USAGE ON SCHEMA public TO landing_page;
    GRANT SELECT ON directory_public_skill_counts, directory_public_totals TO landing_page;
    GRANT SELECT, INSERT ON directory_landing_match_codes TO landing_page;
    GRANT UPDATE (last_seen_at) ON directory_landing_match_codes TO landing_page;
    GRANT EXECUTE ON FUNCTION directory_public_match_count(TEXT[]) TO landing_page;
    -- directory_unmet_needs comes from schema.sql (and post/0057); the guard keeps this file safe on a database without it.
    IF to_regclass('public.directory_public_skill_coverage') IS NOT NULL THEN
      GRANT SELECT ON directory_public_skill_coverage TO landing_page;
    END IF;
    IF to_regclass('public.directory_unmet_needs') IS NOT NULL THEN
      GRANT INSERT ON directory_unmet_needs TO landing_page;
      GRANT USAGE ON SEQUENCE directory_unmet_needs_id_seq TO landing_page;
    END IF;
  END IF;
END $$;

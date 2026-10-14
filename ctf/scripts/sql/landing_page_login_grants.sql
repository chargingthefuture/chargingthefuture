-- The landing page's own database login (owner decision, 2026-10-13).
--
-- Paste into the Neon SQL editor on the Charging The Future project, after post/0055 has run.
-- Create the login here with SQL, not on Neon's Roles screen: a role made on that screen is given
-- neon_superuser, which can read every table. Replace the password with a long random one first,
-- and never commit it.
--
-- What it allows: read the two count views, ask how many people match a set of job titles, read
-- and add saved matches, record when a saved match was last looked at, and add in-demand needs. Nothing else: no member profile, no other table.
CREATE ROLE landing_page WITH LOGIN PASSWORD 'REPLACE-WITH-A-LONG-RANDOM-PASSWORD';
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM landing_page;
GRANT USAGE ON SCHEMA public TO landing_page;
GRANT SELECT ON directory_public_skill_counts, directory_public_totals TO landing_page;
GRANT SELECT, INSERT ON directory_landing_match_codes TO landing_page;
GRANT UPDATE (last_seen_at) ON directory_landing_match_codes TO landing_page;
GRANT EXECUTE ON FUNCTION directory_public_match_count(TEXT[]) TO landing_page;
GRANT INSERT ON directory_unmet_needs TO landing_page;
GRANT USAGE ON SEQUENCE directory_unmet_needs_id_seq TO landing_page;

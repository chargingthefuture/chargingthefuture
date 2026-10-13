-- pre/0005: Drop the landing page's public views while they still have a column nothing reads.
--
-- Why (owner directive and owner report, 2026-10-13): the landing page no longer shows how many
-- people list a job title (directory_public_totals.with_a_title) or how many visitors are looking
-- for one (directory_public_skill_counts.seekers), so neither column has a reader. schema.sql now
-- defines both views without them, and Postgres refuses a CREATE OR REPLACE VIEW that removes a
-- column, so the old views have to go first.
--
-- What it does: drops each view only when it exists and still has that column. schema.sql recreates
-- it straight after, and post/0056 gives the landing page's login its read access back, which a
-- drop removes.
--
-- Safe to re-run: once the columns are gone this matches nothing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'directory_public_totals' AND column_name = 'with_a_title'
  ) THEN
    DROP VIEW directory_public_totals;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'directory_public_skill_counts' AND column_name = 'seekers'
  ) THEN
    DROP VIEW directory_public_skill_counts;
  END IF;
END $$;

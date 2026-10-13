-- pre/0005: Drop directory_public_totals while it still has the with_a_title column.
--
-- Why (owner directive, 2026-10-13): the landing page no longer shows how many people list a job
-- title, so with_a_title has no reader. schema.sql now defines the view without it, and Postgres
-- refuses a CREATE OR REPLACE VIEW that removes a column, so the old view has to go first.
--
-- What it does: drops the view only when it exists and still has the column. schema.sql recreates
-- it straight after, and post/0056 gives the landing page's login its read access back, which a
-- drop removes.
--
-- Safe to re-run: once the view has no with_a_title column this matches nothing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'directory_public_totals' AND column_name = 'with_a_title'
  ) THEN
    DROP VIEW directory_public_totals;
  END IF;
END $$;

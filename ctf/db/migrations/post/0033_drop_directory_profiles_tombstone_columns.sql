-- Drop both of directory_profiles' tombstone columns: is_active and deleted_at.
--
-- Neither decides anything any more. Every way a listing goes away is a hard delete, so there is no
-- soft-deleted state for a column to record.
--
-- is_active first.
--
-- The column was one of two tombstones the table carried, and they never agreed: a member deleting
-- their own listing cleared this flag while account deletion stamped deleted_at, so a query testing
-- one of them kept showing rows the other had removed. post/0032 backfilled deleted_at from every
-- row this flag alone had retired, and the code stopped reading or writing it in the same release.
--
-- Safe to drop now for the reason 0032 said it was not safe then: nothing in the deployed app
-- selects or sets it. Migrations run on the push to main alongside the deploy rather than after it,
-- so 0032 deliberately left the column in place for one release while the previous revision was
-- still serving. That revision is gone.
--
-- Idempotent: IF EXISTS, so a second run finds nothing to drop.

ALTER TABLE IF EXISTS directory_profiles DROP COLUMN IF EXISTS is_active;

-- Drop directory_profiles.deleted_at too.
--
-- It outlived its purpose in the same release. Every way a Directory listing goes away is now a hard
-- delete: a member deleting their Directory data or their account, an admin deleting a profile they
-- created, and an admin takedown all remove the row outright, and a member's removal additionally
-- blocks the Quora address from being re-listed. Nothing ever set this column to a value again — the
-- only writes left were setting it back to NULL — so every read filtering on it was asking a question
-- with one possible answer.
--
-- The filters are removed in the same change, along with the admin list's "include deleted" scope,
-- which had nothing left to include.
--
-- Idempotent: IF EXISTS, so a second run finds nothing to drop.

ALTER TABLE IF EXISTS directory_profiles DROP COLUMN IF EXISTS deleted_at;

-- Put back the two indexes the DROP COLUMN above takes with it.
--
-- Both were defined on deleted_at, so Postgres drops them along with the column. schema.sql runs
-- BEFORE these post migrations, so its own CREATE INDEX IF NOT EXISTS has already run for this
-- deploy by the time the column goes — without this block the table would sit with no index on
-- source and none on the unclaimed lookup until some later deploy happened to recreate them.
--
-- Definitions match schema.sql exactly, minus the dropped column.

CREATE INDEX IF NOT EXISTS idx_directory_profiles_source ON directory_profiles (source);
CREATE INDEX IF NOT EXISTS idx_directory_profiles_unclaimed
  ON directory_profiles (claimed_by_user_id) WHERE claimed_by_user_id IS NULL;

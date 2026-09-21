-- Drop directory_profiles.is_active.
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

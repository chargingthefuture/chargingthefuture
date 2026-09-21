-- Directory listings: one column decides whether a listing is live.
--
-- directory_profiles carried two tombstones that never agreed. A member deleting their own listing
-- cleared is_active; account deletion stamped deleted_at and left is_active alone. Every query
-- picked one of the two, so a row could be live on one screen and gone from another at the same
-- time — which is exactly what happened, and why a listing kept rendering in the Directory after
-- the account holding it was removed.
--
-- deleted_at is the survivor: it answers the same question and records when. This backfill stamps
-- every row that only the old flag had retired, so nothing that was meant to be gone comes back
-- when the reads switch over.
--
-- The is_active column itself is NOT dropped here. Migrations run on the push to main, alongside
-- the deploy rather than after it, so a drop could land while the previous revision is still
-- serving and still selecting the column. Dropping it is a one-line follow-up once this is live.
--
-- Idempotent: a second run finds no rows left to stamp.

DO $directory_profiles_single_liveness_flag$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'directory_profiles'
      AND column_name = 'is_active'
  ) THEN
    -- updated_at is the closest record of when the row was retired; NOW() would claim every one of
    -- these was deleted at migration time, which is not true of any of them.
    UPDATE directory_profiles
       SET deleted_at = COALESCE(updated_at, NOW())
     WHERE is_active = FALSE
       AND deleted_at IS NULL;
  END IF;
END
$directory_profiles_single_liveness_flag$;

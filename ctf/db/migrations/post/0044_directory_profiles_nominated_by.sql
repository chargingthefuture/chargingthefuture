-- post/0044: Record who nominated each Directory profile, and backfill it.
--
-- `nominated_by_user_id` is the member who brought the person into the Directory: the Skills Hunt
-- nominator, or the admin who added the profile. It stays when the profile is claimed, so a
-- nomination keeps counting after its "Community-generated" line drops. The Skills Hunt
-- "Your totals, all rounds" card counts profiles by this column.
--
-- Backfill, only where the column is still NULL, from records the database already holds:
--   1. Skills Hunt profiles: the nomination's submitter.
--   2. Admin-added profiles: the admin on the `directory.admin.profile.create` change event.
-- Rows with neither record (older than both, or made by hand) are left NULL here; assigning them
-- is the owner's decision and is done with a separate statement, not by this file.
-- Idempotent: every step is guarded and re-running it changes nothing.
-- 2026-10-01: the admin-event join compares as text. Production holds `directory_profiles.id` and
-- `directory_profile_change_events.target_id` as different types, so the bare `=` failed with
-- "operator does not exist: uuid = character varying" and stopped every migration after this one.
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS nominated_by_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_directory_profiles_nominated_by
  ON directory_profiles (nominated_by_user_id) WHERE nominated_by_user_id IS NOT NULL;

UPDATE directory_profiles dp
SET nominated_by_user_id = s.submitter_user_id
FROM skills_hunt_directory_profiles link
JOIN skills_hunt_submissions s ON s.id = link.submission_id
WHERE link.directory_profile_id = dp.id::text
  AND dp.nominated_by_user_id IS NULL;

UPDATE directory_profiles dp
SET nominated_by_user_id = ev.actor_id
FROM (
  SELECT DISTINCT ON (target_id) target_id, actor_id
  FROM directory_profile_change_events
  WHERE command = 'directory.admin.profile.create'
    AND policy_status = 'allow'
    AND actor_id <> ''
  ORDER BY target_id, created_at ASC
) ev
WHERE ev.target_id::text = dp.id::text
  AND dp.nominated_by_user_id IS NULL;

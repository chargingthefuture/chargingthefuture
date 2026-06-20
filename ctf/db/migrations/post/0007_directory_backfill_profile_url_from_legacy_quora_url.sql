-- post/0007: Backfill directory_profiles.profile_url from the legacy quora_url.
--
-- The original platform stored each profile's Quora link in directory_profiles.quora_url.
-- v3 renders the Quora link from profile_url — the directory profile detail shows
-- "View Quora profile" when it is set and "Quora profile not linked yet" when it is
-- empty. profile_url was never populated for cloned / manually-created profiles, so a
-- carried-over profile showed "not linked yet" even though it had a Quora link in the
-- legacy column. This copies quora_url -> profile_url, but ONLY where profile_url is
-- currently empty, so an in-app edit is never overwritten. Guarded (no-ops on a DB that
-- never had the legacy column) and idempotent (re-running changes nothing once
-- profile_url is set).
--
-- Companion to post/0006, which deliberately left the legacy contact columns alone.
-- The Quora link is now surfaced directly on the profile, so it is backfilled here;
-- signal_url is still left in place for the Foundation/SocketRelay contact flow.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'directory_profiles'
      AND column_name = 'quora_url'
  ) THEN
    UPDATE directory_profiles
    SET profile_url = btrim(quora_url),
        updated_at = NOW()
    WHERE (profile_url IS NULL OR btrim(profile_url) = '')
      AND quora_url IS NOT NULL
      AND btrim(quora_url) <> '';
  END IF;
END $$;

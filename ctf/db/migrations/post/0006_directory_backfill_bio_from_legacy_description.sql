-- post/0006: Backfill directory_profiles.bio from the legacy free-text description.
--
-- The original platform stored the profile blurb in directory_profiles.description
-- (VARCHAR(140) NOT NULL). v3 renders the blurb from `bio`, which was never
-- populated for cloned profiles — so a carried-over profile showed only a name.
-- This copies description -> bio, but ONLY where bio is currently empty, so an
-- in-app edit is never overwritten. Guarded (no-ops on a fresh v3 DB that never
-- had the legacy column) and idempotent (re-running changes nothing once bio is set).
--
-- The legacy contact columns (directory_profiles.signal_url, directory_profiles.quora_url)
-- are intentionally NOT touched here: they stay on the profile row (tied to the
-- Clerk member via claimed_by_user_id once claimed) and will be surfaced by the
-- Foundation/SocketRelay contact flow when that is built. They are not copied into
-- the core `users` table, which is the cloned legacy table keyed by a legacy uuid
-- and is disconnected from v3's Clerk identity.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'directory_profiles'
      AND column_name = 'description'
  ) THEN
    UPDATE directory_profiles
    SET bio = btrim(description)
    WHERE (bio IS NULL OR btrim(bio) = '')
      AND description IS NOT NULL
      AND btrim(description) <> '';
  END IF;
END $$;

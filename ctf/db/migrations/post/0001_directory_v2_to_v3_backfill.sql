-- 0001_directory_v2_to_v3_backfill.sql  (post-schema)
--
-- Why this exists
--   The live v2 Directory stores a profile's data under different column names
--   than the v3 schema. When schema.sql runs against a v2 clone it ADDs the v3
--   columns (display_name, bio, profile_url, ...) but leaves them empty, so the
--   66 carried-over profiles end up unclaimed (good) but nameless (bad). This
--   backfill copies the v2 values into the v3 columns so the profiles render.
--
-- v2 -> v3 mapping applied here
--   display_name <- first_name   (the only name column the v2 table persists)
--   bio          <- description
--   profile_url  <- quora_url
--   claimed_by_user_id is left as-is (NULL): every carried-over profile stays
--   UNCLAIMED, per the owner decision. Skills / sectors / job_titles (v2 arrays)
--   are intentionally deferred to a later migration because they need the
--   normalized skills_* tables.
--
-- Why it is safe to re-run
--   * It only writes a v3 column when that column is still blank, so a second
--     run is a no-op and it never clobbers a value a member later edited.
--   * Each copy is guarded on the v2 source column actually existing, so on a
--     truly fresh v3 database (which has no first_name/description/quora_url
--     columns) the guarded blocks simply do nothing.
DO $directory_v2_to_v3_backfill$
DECLARE
  has_first_name  BOOLEAN;
  has_description BOOLEAN;
  has_quora_url   BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'directory_profiles'
      AND column_name = 'first_name'
  ) INTO has_first_name;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'directory_profiles'
      AND column_name = 'description'
  ) INTO has_description;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'directory_profiles'
      AND column_name = 'quora_url'
  ) INTO has_quora_url;

  IF has_first_name THEN
    EXECUTE $sql$
      UPDATE directory_profiles
      SET display_name = btrim(first_name),
          updated_at   = NOW()
      WHERE (display_name IS NULL OR btrim(display_name) = '')
        AND first_name IS NOT NULL
        AND btrim(first_name) <> ''
    $sql$;
  END IF;

  IF has_description THEN
    EXECUTE $sql$
      UPDATE directory_profiles
      SET bio        = description,
          updated_at = NOW()
      WHERE (bio IS NULL OR btrim(bio) = '')
        AND description IS NOT NULL
        AND btrim(description::text) <> ''
    $sql$;
  END IF;

  IF has_quora_url THEN
    EXECUTE $sql$
      UPDATE directory_profiles
      SET profile_url = quora_url,
          updated_at  = NOW()
      WHERE (profile_url IS NULL OR btrim(profile_url) = '')
        AND quora_url IS NOT NULL
        AND btrim(quora_url) <> ''
    $sql$;
  END IF;
END
$directory_v2_to_v3_backfill$;

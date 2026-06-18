-- post/0005: Backfill directory_profile_skills from the legacy directory_profiles.skills text[].
--
-- The original platform stored up to three skills as a free-text array column
-- (directory_profiles.skills TEXT[]). v3 normalized skills into the
-- directory_profile_skills junction (profile_id -> skill_id -> skills_taxonomy_skills)
-- and reads skills ONLY from that junction. The v2->v3 clone carried the profile rows
-- (and the legacy skills array column) forward but no migration ever populated the
-- junction, so every cloned profile showed zero skills.
--
-- This copies each legacy skill name into the junction by matching it
-- (case-insensitively) against skills_taxonomy_skills. It is:
--   * guarded   — no-ops on a fresh v3 DB that never had the legacy skills column.
--   * idempotent — ON CONFLICT (profile_id, skill_id) DO NOTHING; safe to re-run
--     and safe to run after the same backfill was applied by hand.
--   * deterministic — when a legacy name matches more than one taxonomy skill (the
--     same skill name under different job titles), DISTINCT ON picks exactly one
--     (active first, then lowest display_order, then lowest id), so a profile never
--     gets the same name twice.
-- Legacy names with no taxonomy match are skipped (no junction row); those are
-- reported separately so a name-mapping can be decided if needed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'directory_profiles'
      AND column_name = 'skills'
  ) THEN
    INSERT INTO directory_profile_skills (profile_id, skill_id, display_order)
    SELECT picked.profile_id, picked.skill_id, picked.display_order
    FROM (
      SELECT DISTINCT ON (dp.id, lower(trim(s.skill_name)))
             dp.id::uuid AS profile_id,
             tax.id      AS skill_id,
             s.ord       AS display_order
      FROM directory_profiles dp
      CROSS JOIN LATERAL unnest(dp.skills) WITH ORDINALITY AS s(skill_name, ord)
      JOIN LATERAL (
        SELECT sts.id
        FROM skills_taxonomy_skills AS sts
        WHERE lower(sts.name) = lower(trim(s.skill_name))
        -- skills_taxonomy_skills is unique only per job_title_id, so the same name
        -- can exist under several job titles. Prefer the one under the profile's own
        -- job title when known. Legacy profiles usually have a NULL job_title_id, in
        -- which case this term is NULL for every candidate and the active/display_order/id
        -- tie-break below decides.
        ORDER BY (sts.job_title_id::text = dp.job_title_id::text) DESC NULLS LAST,
                 sts.is_active DESC, sts.display_order ASC, sts.id ASC
        LIMIT 1
      ) AS tax ON true
      WHERE dp.skills IS NOT NULL
        AND array_length(dp.skills, 1) > 0
        -- directory_profiles.id is varchar on cloned data; only cast values that are
        -- actually UUID-shaped so one malformed id can never abort the migration.
        AND dp.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        -- Only seed profiles that have NO normalized skills yet. Once a member or
        -- admin edits skills through the app (writing directory_profile_skills), that
        -- junction is authoritative; re-running this backfill must not re-add a skill
        -- they removed, by copying a stale value from the legacy array.
        AND NOT EXISTS (
          SELECT 1 FROM directory_profile_skills existing
          WHERE existing.profile_id::text = lower(dp.id::text)
        )
      ORDER BY dp.id, lower(trim(s.skill_name)), s.ord
    ) AS picked
    ON CONFLICT (profile_id, skill_id) DO NOTHING;
  END IF;
END $$;

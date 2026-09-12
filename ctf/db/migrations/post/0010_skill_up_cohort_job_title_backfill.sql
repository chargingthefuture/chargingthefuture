-- post/0010: Give every existing SkillUp cohort the occupation it trains.
--
-- A cohort now carries job_title_id — the Skills Taxonomy occupation it trains — because that is
-- what the trainer claim gate matches a person's Directory skills against (owner decision
-- 2026-08-29). New cohorts are required to supply it. The rows written before it existed need it
-- filled in, or nobody can claim them.
--
-- Two passes, most reliable first:
--   1. Cohorts the retired auto-cohort run opened already know their occupation exactly — it is in
--      source_job_title_id. Copy it across.
--   2. Hand-built cohorts have only the free-text `track`. Where that text matches an active job
--      title name exactly (case- and whitespace-insensitive), use it. Anything that does not match
--      is left NULL on purpose rather than guessed at: an unclaimable cohort is a visible problem,
--      a wrongly-matched one silently lets the wrong person train.
--
-- Guarded on job_title_id still being NULL, so re-running changes nothing.
UPDATE skill_up_cohorts
SET job_title_id = source_job_title_id,
    updated_at = NOW()
WHERE job_title_id IS NULL
  AND source_job_title_id IS NOT NULL;

UPDATE skill_up_cohorts c
SET job_title_id = j.id,
    updated_at = NOW()
FROM skills_taxonomy_job_titles j
WHERE c.job_title_id IS NULL
  AND j.is_active = TRUE
  AND lower(btrim(c.track)) = lower(btrim(j.name))
  -- Only when the name is unambiguous across the taxonomy.
  AND (
    SELECT count(*) FROM skills_taxonomy_job_titles k
    WHERE k.is_active = TRUE AND lower(btrim(k.name)) = lower(btrim(c.track))
  ) = 1;

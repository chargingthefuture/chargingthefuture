-- Skills Taxonomy: a per-occupation demand weight, so a sector's headcount stops being split
-- evenly across the jobs inside it.
--
-- Sectors have carried `workforce_share` since the model was built. Occupations never have, so
-- `buildJobTitleDemand` divided a sector's demand by the number of job titles in it and gave every
-- one the same number. That says a settlement needs as many Surveyors as Electricians because both
-- sit under Housing & Construction, which is not true of any real population and was never claimed
-- to be — it was the only split available with no weight to read.
--
-- Everything that reads per-occupation demand inherited the flatness: the training-gap report that
-- tells SkillUp which cohorts to stand up, the occupations browse ordering, and the per-trade figure
-- on the Workforce screens.
--
-- NULL is the deliberate default and means "ordinary", weighted 1 against its siblings. So this
-- migration changes no number anywhere: with every occupation NULL the normalized split is the even
-- split it already performed. Weights arrive one at a time through the append-only taxonomy change
-- list (op `setOccupationWorkforceShare`), each reviewed in a pull request with a written rationale,
-- because a number nobody can source is worse than an even split that is honest about being one.
--
-- Weights are relative within a sector, not percentages: 3 against 1 means three times as many
-- people. A sector whose weights are all zero falls back to the even split rather than dividing by
-- zero and blanking the sector.

ALTER TABLE IF EXISTS skills_taxonomy_job_titles
  ADD COLUMN IF NOT EXISTS workforce_share NUMERIC;

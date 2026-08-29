-- post/0009: Drop the plugin-name prefix from SkillUp cohort titles.
--
-- Cohorts opened from the Workforce talent-gap proposal queue were titled
-- "<plugin name>: <occupation>" — "LevelUp: Journalists / Reporters" before the
-- 2026-08-29 rename, "SkillUp: …" after it. Every one of those cards is already
-- inside the SkillUp plugin, so the prefix repeated the plugin's own name on each
-- row and ate width that a phone does not have (owner report, 2026-08-29). The
-- title template now writes the occupation on its own; this brings the rows that
-- were written under the old template into line.
--
-- Guarded on the prefix still being present, so a title that never carried one is
-- untouched and a second run changes nothing. TRIM handles a stray space after the
-- colon; a row that is nothing but the prefix is left alone rather than emptied.
UPDATE skill_up_cohorts
SET title = TRIM(SUBSTRING(title FROM 10)),
    updated_at = NOW()
WHERE title LIKE 'LevelUp: %'
  AND TRIM(SUBSTRING(title FROM 10)) <> '';

UPDATE skill_up_cohorts
SET title = TRIM(SUBSTRING(title FROM 10)),
    updated_at = NOW()
WHERE title LIKE 'SkillUp: %'
  AND TRIM(SUBSTRING(title FROM 10)) <> '';

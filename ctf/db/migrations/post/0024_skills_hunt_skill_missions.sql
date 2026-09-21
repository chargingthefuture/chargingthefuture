-- SkillsHunt: a mission can ask for one named skill, not only an entire sector.
--
-- Owner report, 2026-09-17: the Missions tab showed "Find a mechanic — 82/1 complete" and "Find a
-- plumber — 82/3 complete" for a scout who had nominated no mechanic at all. Both read the same 82
-- because both were stored as count_total_accepted, which counts every accepted nomination the
-- scout has whatever the skill. That was not a mistake in the data so much as the only option the
-- product offered: the three goal types were "everything", "a sector", and "rare skills", and the
-- create form defaults to the first, so a mission named for a single trade silently counted the
-- lot.
--
-- 'count_skill_matches' fills the gap. goal_metadata carries { skillName, skillId? } and the name is
-- matched case-insensitively against the taxonomy skills picked on each accepted nomination.
-- Free-text proposed skills are deliberately not counted, so a mission cannot be completed by
-- wording.
--
-- No backfill. Re-pointing an existing mission means naming which skill it is about, and this
-- migration cannot know that a row titled "Find a mechanic" means the taxonomy's "Mechanic" rather
-- than something near it — guessing would quietly rewrite what a mission asks for. The admin
-- Missions panel now has an Edit control for exactly this, and a "Recompute progress" button that
-- settles every scout's counts in the round afterwards, so the correction is a job for whoever
-- knows what the mission meant, from the app rather than from a shell.

ALTER TABLE IF EXISTS skills_hunt_missions
  DROP CONSTRAINT IF EXISTS skills_hunt_missions_goal_type_check;

ALTER TABLE IF EXISTS skills_hunt_missions
  ADD CONSTRAINT skills_hunt_missions_goal_type_check
  CHECK (goal_type IN ('count_total_accepted', 'count_skills_in_sector', 'count_rare_skill_finds', 'count_skill_matches'));

-- post/0009: Drop the three SkillUp auto-cohort generation tables.
--
-- SkillUp used to read the Workforce talent gaps on a cadence and write a ranked
-- proposal queue for an admin to approve into a cohort. That generation half was
-- removed on 2026-08-29 (owner decision: redundant — admins open cohorts directly
-- in the SkillUp shell), so its three tables have no reader and no writer left:
-- the proposal queue, the singleton knobs the run read, and the per-occupation
-- term overrides that the proposal model had already stopped consulting.
--
-- The cohorts the run already opened are NOT touched: they live in
-- skill_up_cohorts with auto_created = TRUE, members are enrolled in them, and a
-- trainer can still claim one. Only the generation machinery goes.
--
-- Guarded with IF EXISTS so it no-ops on a fresh database that never had the
-- tables, and idempotent (re-running changes nothing once they are gone).
DROP TABLE IF EXISTS skill_up_cohort_proposals;
DROP TABLE IF EXISTS skill_up_auto_cohort_config;
DROP TABLE IF EXISTS skill_up_auto_cohort_term_overrides;
-- Databases predating the 2026-08-29 SkillUp rename may still carry the
-- `level_up_` names; schema.sql no longer renames them, so drop those too.
DROP TABLE IF EXISTS level_up_cohort_proposals;
DROP TABLE IF EXISTS level_up_auto_cohort_config;
DROP TABLE IF EXISTS level_up_auto_cohort_term_overrides;

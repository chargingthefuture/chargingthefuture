-- post/0012: Drop the SkillUp stipend columns.
--
-- SkillUp carried stipend_mode, stipend_amount_per_payout, stipend_interval_days and
-- stipend_currency on every cohort. createCohort wrote all four; nothing ever read them. There was
-- no payout flow, no schedule table (the inventory listed skill_up_stipend_schedules, which was
-- never in schema.sql), no route, and no owner-approved spec describing what a stipend was meant to
-- do. Meanwhile the plugin catalog told members they would "earn stipends as you reach each
-- milestone" — the app advertising a payout it had no code to make.
--
-- Owner decision 2026-09-12: stipends are not a feature; the fields and the copy come out. Every
-- credit SkillUp moves is a milestone release, a trainer grant, or a completion bonus.
--
-- Safe to drop: the columns only ever held their defaults ('none', 0, NULL, 'SC'), because nothing
-- ever set them to anything else. Guarded with IF EXISTS so a fresh database that never had them
-- no-ops, and idempotent on re-run.
ALTER TABLE IF EXISTS skill_up_cohorts DROP COLUMN IF EXISTS stipend_mode;
ALTER TABLE IF EXISTS skill_up_cohorts DROP COLUMN IF EXISTS stipend_amount_per_payout;
ALTER TABLE IF EXISTS skill_up_cohorts DROP COLUMN IF EXISTS stipend_interval_days;
ALTER TABLE IF EXISTS skill_up_cohorts DROP COLUMN IF EXISTS stipend_currency;

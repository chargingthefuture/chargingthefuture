-- post/0013: Drop the SkillUp microgrant columns.
--
-- The same removal as post/0012 did for stipends, for the same reason. SkillUp carried
-- microgrant_mode, microgrant_amount and microgrant_currency on every cohort; createCohort wrote
-- them and nothing ever read them. No payout flow, no route, no spec, and the wallet history
-- carried a "Microgrant" label for a disbursement type nothing can write.
--
-- Owner decision 2026-09-13: microgrants are not a feature either. Every credit SkillUp moves is a
-- milestone release, a trainer grant, or a completion bonus.
--
-- Safe to drop: the columns only ever held their defaults ('none', 0, 'SC'). Guarded with IF EXISTS
-- so a fresh database that never had them no-ops, and idempotent on re-run.
ALTER TABLE IF EXISTS skill_up_cohorts DROP COLUMN IF EXISTS microgrant_mode;
ALTER TABLE IF EXISTS skill_up_cohorts DROP COLUMN IF EXISTS microgrant_amount;
ALTER TABLE IF EXISTS skill_up_cohorts DROP COLUMN IF EXISTS microgrant_currency;

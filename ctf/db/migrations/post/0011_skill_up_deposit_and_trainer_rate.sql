-- post/0011: Put every cohort on the flat deposit and give it a trainer rate.
--
-- Owner decision 2026-08-29. Two things change together:
--
--   1. Every cohort takes the same deposit from every member, and it is never zero. Cohorts written
--      before this carry required_credits = 0, which meant their trainer earned nothing, because the
--      trainer's amount used to be derived from the escrow. Those cohorts are moved to the flat 50.
--      This applies to people enrolling from now on; it does not retroactively charge anyone who
--      already joined, and it does not touch escrow that is already held.
--   2. The trainer's rate is no longer derived from the deposit at all. It is stamped on the cohort
--      (trainer_credits_per_milestone, column default 10) and scaled by the Workforce gap at
--      creation. Rows written before the column existed take the default, which is the correct flat
--      rate for a cohort with no gap recorded.
--
-- allow_no_deposit is cleared on the same rows: a free cohort is no longer a thing, so leaving the
-- flag set would let an enrollment skip the deposit the cohort now requires.
--
-- Guarded on the values still being the pre-change ones, so re-running changes nothing.
UPDATE skill_up_cohorts
SET required_credits = 50,
    allow_no_deposit = FALSE,
    updated_at = NOW()
WHERE required_credits = 0
  AND status IN ('draft', 'open', 'active');

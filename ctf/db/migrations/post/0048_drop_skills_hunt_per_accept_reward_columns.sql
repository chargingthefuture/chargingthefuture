-- post/0048: Drop the Skills Hunt per-accept reward columns.
--
-- Since 2026-10-01 (post/0046) a round is points only: accepting a nomination sends no
-- ServiceCredits, and credits are shared out when the round ends. reward_credits_per_accept and
-- reward_per_user_round_cap have not been read or written since then; they were kept one release
-- so the revision still running during that deploy could read them. That release has shipped, so
-- they go now. Credits already sent stay sent; their record is on skills_hunt_submissions
-- (credit_granted, credit_amount), which this does not touch. Guarded and idempotent.
ALTER TABLE IF EXISTS skills_hunt_rounds DROP COLUMN IF EXISTS reward_credits_per_accept;
ALTER TABLE IF EXISTS skills_hunt_rounds DROP COLUMN IF EXISTS reward_per_user_round_cap;

-- Safe to re-run.
-- The Quora deletion survey now stores the handle or username of the account a member still holds,
-- beside the yes/no it answers. Before this the handle stayed in the browser and only reached the
-- Unlock queue. Production and the demo schema both get the column.
ALTER TABLE IF EXISTS quora_deletion_survey_responses ADD COLUMN IF NOT EXISTS current_profile_handle TEXT NULL;
ALTER TABLE IF EXISTS demo.quora_deletion_survey_responses ADD COLUMN IF NOT EXISTS current_profile_handle TEXT NULL;

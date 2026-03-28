BEGIN;

ALTER TABLE IF EXISTS socketrelay_fulfillments
  ADD COLUMN IF NOT EXISTS requester_user_id TEXT;

COMMIT;

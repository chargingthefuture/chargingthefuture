BEGIN;

ALTER TABLE socketrelay_fulfillments
  ADD COLUMN IF NOT EXISTS requester_user_id TEXT;

COMMIT;

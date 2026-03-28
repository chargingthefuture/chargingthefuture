BEGIN;

ALTER TABLE IF EXISTS socketrelay_requests
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT;

COMMIT;

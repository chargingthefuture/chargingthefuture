BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS socketrelay_user_extension (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NULL,
  bio TEXT NULL,
  relay_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  presence_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  service_deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS socketrelay_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_user_id TEXT,
  title TEXT,
  details TEXT,
  category TEXT,
  city TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'closed', 'cancelled')),
  idempotency_key TEXT,
  reopened_count INTEGER DEFAULT 0,
  claimed_fulfillment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_user_id, idempotency_key)
);

ALTER TABLE IF EXISTS socketrelay_requests
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS reopened_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claimed_fulfillment_id TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $socketrelay_requests$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'socketrelay_requests'
      AND column_name = 'user_id'
  ) THEN
    UPDATE socketrelay_requests
    SET owner_user_id = COALESCE(owner_user_id, user_id)
    WHERE owner_user_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'socketrelay_requests'
      AND column_name = 'description'
  ) THEN
    UPDATE socketrelay_requests
    SET details = COALESCE(details, description)
    WHERE details IS NULL;
  END IF;

  UPDATE socketrelay_requests
  SET title = COALESCE(title, LEFT(COALESCE(details, 'Request'), 80))
  WHERE title IS NULL;

  UPDATE socketrelay_requests
  SET category = COALESCE(category, 'general')
  WHERE category IS NULL;

  UPDATE socketrelay_requests
  SET idempotency_key = COALESCE(idempotency_key, 'legacy-' || id)
  WHERE idempotency_key IS NULL;

  UPDATE socketrelay_requests
  SET reopened_count = COALESCE(reopened_count, 0)
  WHERE reopened_count IS NULL;

  UPDATE socketrelay_requests
  SET updated_at = COALESCE(updated_at, created_at)
  WHERE updated_at IS NULL;
END
$socketrelay_requests$;

CREATE TABLE IF NOT EXISTS socketrelay_request_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  request_id TEXT NOT NULL REFERENCES socketrelay_requests(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS socketrelay_fulfillments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  request_id TEXT REFERENCES socketrelay_requests(id) ON DELETE CASCADE,
  requester_user_id TEXT,
  fulfiller_user_id TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  close_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (request_id, fulfiller_user_id)
  
ALTER TABLE IF EXISTS socketrelay_fulfillments
  ADD COLUMN IF NOT EXISTS id TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS requester_user_id TEXT,
  ADD COLUMN IF NOT EXISTS fulfiller_user_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS close_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
);

CREATE TABLE IF NOT EXISTS socketrelay_fulfillment_participants (
  fulfillment_id TEXT NOT NULL REFERENCES socketrelay_fulfillments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  participant_role TEXT NOT NULL CHECK (participant_role IN ('requester', 'fulfiller')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (fulfillment_id, user_id)
);

CREATE TABLE IF NOT EXISTS socketrelay_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  fulfillment_id TEXT NOT NULL REFERENCES socketrelay_fulfillments(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  client_message_id TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'accepted' CHECK (moderation_status IN ('accepted', 'flagged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fulfillment_id, sender_user_id, client_message_id)
);

CREATE TABLE IF NOT EXISTS socketrelay_admin_audit_trail (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL CHECK (policy_status IN ('allow', 'deny')),
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_socketrelay_requests_owner ON socketrelay_requests (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_socketrelay_requests_public ON socketrelay_requests (is_public, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_socketrelay_fulfillments_request ON socketrelay_fulfillments (request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_socketrelay_fulfillments_user ON socketrelay_fulfillments (fulfiller_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_socketrelay_messages_fulfillment ON socketrelay_messages (fulfillment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_socketrelay_audit_created ON socketrelay_admin_audit_trail (created_at DESC, actor_id, command);

COMMIT;

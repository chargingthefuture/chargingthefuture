BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS trusttransport_user_extension (
  user_id TEXT PRIMARY KEY,
  mode_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  safety_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  payout_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  account_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  restriction_reason TEXT NULL,
  restricted_at TIMESTAMPTZ NULL,
  restricted_by_user_id TEXT NULL,
  service_deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('ride', 'package', 'food')),
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  pickup_city TEXT NULL,
  dropoff_city TEXT NULL,
  pickup_geo_redacted TEXT NULL,
  dropoff_geo_redacted TEXT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'in_progress', 'completed', 'cancelled', 'disputed', 'emergency_frozen')),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (requester_user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS trusttransport_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES trusttransport_requests(id) ON DELETE CASCADE,
  provider_user_id TEXT NOT NULL,
  note TEXT NULL,
  proposed_amount NUMERIC(12, 2) NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, provider_user_id)
);

CREATE TABLE IF NOT EXISTS trusttransport_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES trusttransport_requests(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL UNIQUE REFERENCES trusttransport_offers(id) ON DELETE CASCADE,
  requester_user_id TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('ride', 'package', 'food')),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'en_route', 'picked_up', 'delivered', 'completed', 'cancelled', 'disputed', 'emergency_frozen')),
  stream_channel_id TEXT NULL,
  cancelled_reason TEXT NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL UNIQUE REFERENCES trusttransport_trips(id) ON DELETE CASCADE,
  package_type TEXT NULL,
  fragile BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_food_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL UNIQUE REFERENCES trusttransport_trips(id) ON DELETE CASCADE,
  vendor_name TEXT NULL,
  dietary_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NULL REFERENCES trusttransport_requests(id) ON DELETE CASCADE,
  trip_id UUID NULL REFERENCES trusttransport_trips(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  from_status TEXT NULL,
  to_status TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_proof_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trusttransport_trips(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('photo', 'code', 'note')),
  artifact_redacted TEXT NOT NULL,
  captured_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trusttransport_trips(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES trusttransport_requests(id) ON DELETE CASCADE,
  opened_by_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolution_notes TEXT NULL,
  resolved_by_user_id TEXT NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL UNIQUE REFERENCES trusttransport_trips(id) ON DELETE CASCADE,
  requester_user_id TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  feedback TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_earnings_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id TEXT NOT NULL,
  trip_id UUID NULL REFERENCES trusttransport_trips(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit', 'debit', 'hold', 'release')),
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'held', 'settled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected', 'paid')),
  idempotency_key TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ NULL,
  decided_by_user_id TEXT NULL,
  decision_reason TEXT NULL,
  UNIQUE (provider_user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS trusttransport_risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NULL REFERENCES trusttransport_requests(id) ON DELETE SET NULL,
  trip_id UUID NULL REFERENCES trusttransport_trips(id) ON DELETE SET NULL,
  actor_user_id TEXT NOT NULL,
  target_user_id TEXT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('emergency_stop', 'account_restricted', 'mutual_block', 'policy_flag')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  notes TEXT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by_user_id TEXT NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_market_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trusttransport_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL CHECK (policy_status IN ('allow', 'deny')),
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO trusttransport_market_config (id, config, updated_by_user_id)
VALUES (1, '{"maxConcurrentTrips": 3, "requireProofOnDelivery": true}'::jsonb, 'system')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_tt_requests_requester_created ON trusttransport_requests (requester_user_id, created_at DESC);
ALTER TABLE IF EXISTS trusttransport_requests
  ADD COLUMN IF NOT EXISTS mode TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trusttransport_requests'
      AND column_name = 'mode'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tt_requests_mode_status ON trusttransport_requests (mode, status, created_at DESC)';
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS idx_tt_offers_request_status ON trusttransport_offers (request_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_trips_participants ON trusttransport_trips (requester_user_id, provider_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_trips_status ON trusttransport_trips (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_status_events_trip ON trusttransport_status_events (trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_disputes_status_created ON trusttransport_disputes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_ledger_provider_created ON trusttransport_earnings_ledger (provider_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_payout_provider_requested ON trusttransport_payout_requests (provider_user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_risk_signal_resolved ON trusttransport_risk_signals (is_resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tt_audit_created_actor ON trusttransport_admin_audit_trail (created_at DESC, actor_id, command);

COMMIT;
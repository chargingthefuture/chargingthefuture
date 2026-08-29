-- schema.demo.sql — AUTO-GENERATED from schema.sql
-- DO NOT EDIT MANUALLY. Regenerate with: node scripts/generateDemoSchema.mjs
--
-- How to use (Neon console):
--   1. Open your Neon project → SQL Editor
--   2. Paste this entire file and click Run
--   3. All tables are created inside the `demo` schema
--
-- Re-running is safe: every statement uses IF NOT EXISTS / IF EXISTS guards.
-- The demo schema is isolated — unqualified table names resolve to `demo`,
-- not `public`, so demo writes never touch production rows.

CREATE SCHEMA IF NOT EXISTS demo;
SET search_path = demo, public;

-- Combined schema.sql for CTF (rewrite, no /platform)
--
-- Maintenance note (2026-05-31): seed scripts seedClickLog/seedGdp/seedMood/seedPeerProgramming
-- were refactored to open their own `pg` Pool instead of importing the TypeScript
-- `packages/web/lib/db/postgres.ts` (which plain Node cannot load on the Node 20 seed/provision
-- workflows). This is a connection-boilerplate change only: no table, column, constraint, index,
-- or seeded-row change. Recorded here to satisfy the seed/schema drift gate, which requires a
-- schema.sql touch alongside any seed-script change.

BEGIN;
-- Hyphenation/cleanup rename (2026-06-26): slug/folder/route became `click-log`; the table moves to the
-- matching snake_case prefix `click_log_`. Renames run first so an existing DB keeps its data; on a
-- fresh DB the IF EXISTS renames are no-ops and the CREATE statement below builds the new name.
ALTER TABLE IF EXISTS clicklog_incidents RENAME TO click_log_incidents;
ALTER INDEX IF EXISTS idx_clicklog_incidents_user_id RENAME TO idx_click_log_incidents_user_id;
ALTER INDEX IF EXISTS idx_clicklog_incidents_created_at RENAME TO idx_click_log_incidents_created_at;
CREATE TABLE IF NOT EXISTS click_log_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  metadata_hash TEXT GENERATED ALWAYS AS (md5(metadata::text)) STORED,
  -- Owner-share opt-in (2026-08-01): a member may mark an incident as shared with the owner for
  -- aggregate trend tracking. Defaults FALSE — nothing is shared unless the member opts in. A real
  -- column (not metadata) so it is excluded from the metadata_hash dedupe and toggling share state
  -- never collides with the UNIQUE (user_id, metadata_hash) constraint.
  shared_with_owner BOOLEAN NOT NULL DEFAULT FALSE,
  -- Optional incident tags (2026-08-02; arrays since 2026-08-13): a member may say which of the
  -- 50+ known problems happened (problem_tags — slugs mirror the landing-page problems list)
  -- and/or which named schemes were used (scheme_tags — slugs from the owner's "A post for each
  -- gang stalker game" Discourse thread). Arrays because a real incident routinely chains
  -- several schemes at once (owner decision, 2026-08-13); the API caps each list at 10.
  -- Canonical slug lists live in packages/web/lib/click-log/tags.ts; the API validates against
  -- them. Real columns (not metadata) so they are excluded from the metadata_hash dedupe —
  -- mirroring shared_with_owner — and so the shared-trends aggregate can unnest them as coarse
  -- categorical values without touching the metadata JSON. The singular problem_tag/scheme_tag
  -- columns are superseded: backfilled into the arrays below, kept for history, no longer
  -- read or written by the app.
  problem_tag TEXT,
  scheme_tag TEXT,
  problem_tags TEXT[] NOT NULL DEFAULT '{}',
  scheme_tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, metadata_hash)
);
ALTER TABLE IF EXISTS click_log_incidents ADD COLUMN IF NOT EXISTS shared_with_owner BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS click_log_incidents ADD COLUMN IF NOT EXISTS problem_tag TEXT;
ALTER TABLE IF EXISTS click_log_incidents ADD COLUMN IF NOT EXISTS scheme_tag TEXT;
ALTER TABLE IF EXISTS click_log_incidents ADD COLUMN IF NOT EXISTS problem_tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE IF EXISTS click_log_incidents ADD COLUMN IF NOT EXISTS scheme_tags TEXT[] NOT NULL DEFAULT '{}';
-- One-time backfill of the superseded singular tag columns into the arrays. Idempotent: only
-- touches rows whose array is still empty while the singular column has a value, so re-running
-- schema.sql never overwrites a member's later multi-tag edits.
UPDATE click_log_incidents SET problem_tags = ARRAY[problem_tag]
  WHERE problem_tag IS NOT NULL AND problem_tags = '{}';
UPDATE click_log_incidents SET scheme_tags = ARRAY[scheme_tag]
  WHERE scheme_tag IS NOT NULL AND scheme_tags = '{}';
-- Backfill for the tags-require-sharing rule (owner decision, 2026-08-18: a tagged incident
-- always shares its trend data, so tagged rows logged private under the earlier rule become
-- shared). Idempotent: the WHERE clause matches nothing once every tagged row is shared, and
-- untagged rows are never touched — their share flag stays the member's own choice.
UPDATE click_log_incidents SET shared_with_owner = TRUE
  WHERE NOT shared_with_owner
    AND (cardinality(problem_tags) > 0 OR cardinality(scheme_tags) > 0);
CREATE INDEX IF NOT EXISTS idx_click_log_incidents_user_id ON click_log_incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_click_log_incidents_created_at ON click_log_incidents(created_at DESC);
-- Partial index for the admin trends aggregate, which only ever reads shared rows.
CREATE INDEX IF NOT EXISTS idx_click_log_incidents_shared ON click_log_incidents(created_at DESC) WHERE shared_with_owner;
-- Per-member ClickLog preferences. share_with_owner is the member's global default for whether a
-- newly logged incident is shared with the owner (per-incident override always wins). Opt-in:
-- defaults FALSE. Mirrors the notification_preferences / user_ui_preferences upsert-on-user_id shape.
CREATE TABLE IF NOT EXISTS click_log_preferences (
  user_id TEXT PRIMARY KEY,
  share_with_owner BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS click_log_preferences ADD COLUMN IF NOT EXISTS share_with_owner BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS click_log_preferences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- "Not listed" scheme suggestions (2026-08-02): when a member picks the catch-all scheme tag they
-- must describe the scheme, and that text is EXPLICITLY shared with the owner (the form says so —
-- unlike incident notes, which are never shared). Weavers of the Commons badge holders only (spam
-- control, enforced in the create route). quora_url is an optional self-provided link to the
-- member's own Quora post about a similar incident (a spam signal for the owner). The scheduled
-- proposeSchemeSuggestions script drains status='new' rows into PRIVATE triage-repo issues (the
-- text may carry personal detail; the public repo never sees it, and issues never carry user_id or
-- incident_id), then stamps status='issue_created' plus the issue reference — mirroring bug_reports.
CREATE TABLE IF NOT EXISTS click_log_scheme_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID,
  user_id TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  quora_url TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  triage_repo TEXT,
  issue_number INTEGER,
  issue_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS click_log_scheme_suggestions ADD COLUMN IF NOT EXISTS incident_id UUID;
ALTER TABLE IF EXISTS click_log_scheme_suggestions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS click_log_scheme_suggestions ADD COLUMN IF NOT EXISTS suggestion TEXT;
ALTER TABLE IF EXISTS click_log_scheme_suggestions ADD COLUMN IF NOT EXISTS quora_url TEXT;
ALTER TABLE IF EXISTS click_log_scheme_suggestions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE IF EXISTS click_log_scheme_suggestions ADD COLUMN IF NOT EXISTS triage_repo TEXT;
ALTER TABLE IF EXISTS click_log_scheme_suggestions ADD COLUMN IF NOT EXISTS issue_number INTEGER;
ALTER TABLE IF EXISTS click_log_scheme_suggestions ADD COLUMN IF NOT EXISTS issue_url TEXT;
ALTER TABLE IF EXISTS click_log_scheme_suggestions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS click_log_scheme_suggestions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_click_log_scheme_suggestions_status ON click_log_scheme_suggestions(status, created_at);
-- Dedupe marker for the unnamed-scheme threshold alert: one row per filed alert issue, so the
-- scheduled script files at most one alert per cooldown window. Holds counts only — no member data.
CREATE TABLE IF NOT EXISTS click_log_unnamed_scheme_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  window_days INTEGER NOT NULL,
  shared_count INTEGER NOT NULL,
  issue_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS click_log_unnamed_scheme_alerts ADD COLUMN IF NOT EXISTS window_days INTEGER;
ALTER TABLE IF EXISTS click_log_unnamed_scheme_alerts ADD COLUMN IF NOT EXISTS shared_count INTEGER;
ALTER TABLE IF EXISTS click_log_unnamed_scheme_alerts ADD COLUMN IF NOT EXISTS issue_url TEXT;
ALTER TABLE IF EXISTS click_log_unnamed_scheme_alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- === WHAT WORKS (survivor-verified shared tool list, organized by problem) ===
-- One shared, community-wide list. Problems are admin-curated categories; products are
-- survivor-suggested tools reviewed (pending -> approved) before they appear. Endorsements
-- are the "this helped me" signal whose count renders as "N survivors verified". The
-- suggester's identity is stored for moderation/abuse control only and is never exposed in
-- any reader or admin projection (the anonymity promise on the suggest flow).
-- Hyphenation/cleanup rename (2026-06-26): slug/folder/route became `what-works`; tables move to the
-- matching snake_case prefix `what_works_`. Renames run first so an existing DB keeps its data; on a
-- fresh DB the IF EXISTS renames are no-ops and the CREATE statements below build the new names.
ALTER TABLE IF EXISTS whatworks_problems RENAME TO what_works_problems;
ALTER TABLE IF EXISTS whatworks_products RENAME TO what_works_products;
ALTER TABLE IF EXISTS whatworks_endorsements RENAME TO what_works_endorsements;
ALTER INDEX IF EXISTS idx_whatworks_problems_slug RENAME TO idx_what_works_problems_slug;
ALTER INDEX IF EXISTS idx_whatworks_problems_active_sort RENAME TO idx_what_works_problems_active_sort;
ALTER INDEX IF EXISTS idx_whatworks_products_problem RENAME TO idx_what_works_products_problem;
ALTER INDEX IF EXISTS idx_whatworks_products_status RENAME TO idx_what_works_products_status;
ALTER INDEX IF EXISTS idx_whatworks_endorsements_product RENAME TO idx_what_works_endorsements_product;
ALTER INDEX IF EXISTS idx_whatworks_endorsements_unique RENAME TO idx_what_works_endorsements_unique;
CREATE TABLE IF NOT EXISTS what_works_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS what_works_problems ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS what_works_problems ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE IF EXISTS what_works_problems ADD COLUMN IF NOT EXISTS emoji TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS what_works_problems ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS what_works_problems ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS what_works_problems ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS what_works_problems ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS what_works_problems ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE IF EXISTS what_works_problems ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS what_works_problems ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_what_works_problems_slug ON what_works_problems(slug);
CREATE INDEX IF NOT EXISTS idx_what_works_problems_active_sort ON what_works_problems(is_active, sort_order);

CREATE TABLE IF NOT EXISTS what_works_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES what_works_problems(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  purchase_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  suggested_by TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS what_works_products ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS what_works_products ADD COLUMN IF NOT EXISTS problem_id UUID;
ALTER TABLE IF EXISTS what_works_products ADD COLUMN IF NOT EXISTS emoji TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS what_works_products ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS what_works_products ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS what_works_products ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS what_works_products ADD COLUMN IF NOT EXISTS purchase_url TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS what_works_products ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE IF EXISTS what_works_products ADD COLUMN IF NOT EXISTS suggested_by TEXT;
ALTER TABLE IF EXISTS what_works_products ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE IF EXISTS what_works_products ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS what_works_products ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE IF EXISTS what_works_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS what_works_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_what_works_products_problem ON what_works_products(problem_id);
CREATE INDEX IF NOT EXISTS idx_what_works_products_status ON what_works_products(status);

CREATE TABLE IF NOT EXISTS what_works_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES what_works_products(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS what_works_endorsements ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS what_works_endorsements ADD COLUMN IF NOT EXISTS product_id UUID;
ALTER TABLE IF EXISTS what_works_endorsements ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS what_works_endorsements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_what_works_endorsements_product ON what_works_endorsements(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_what_works_endorsements_unique ON what_works_endorsements(product_id, user_id);

-- === currencies (app-wide reference table; see issue #120) ===
-- Curated catalog of currencies usable across value-bearing plugins. Defined early so any table
-- that FK-references currencies(code) (LightHouse rent, Foundation provider rate, TrustTransport,
-- SocketRelay, SkillUp, Unlock) can be created/altered after it. ServiceCredits is the platform
-- utility token: code 'SC' is internal-only — UI always renders the label 'ServiceCredits', and a
-- ServiceCredits amount is NEVER shown at a fiat equivalent. GDP USD-normalization lives only in the
-- aggregate GDP layer (issue #121), never per-wallet.
CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('token','fiat','crypto','barter','free')),
  is_service_credits BOOLEAN NOT NULL DEFAULT FALSE,
  symbol TEXT,
  decimal_places INTEGER NOT NULL DEFAULT 2,
  requires_amount BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS currencies ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE IF EXISTS currencies ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS currencies ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'fiat';
ALTER TABLE IF EXISTS currencies ADD COLUMN IF NOT EXISTS is_service_credits BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS currencies ADD COLUMN IF NOT EXISTS symbol TEXT;
ALTER TABLE IF EXISTS currencies ADD COLUMN IF NOT EXISTS decimal_places INTEGER NOT NULL DEFAULT 2;
ALTER TABLE IF EXISTS currencies ADD COLUMN IF NOT EXISTS requires_amount BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS currencies ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS currencies ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100;
ALTER TABLE IF EXISTS currencies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS currencies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Widen the kind check to allow 'free' (one-way, no-charge mutual aid) and 'activity' (the internal
-- Recurring Activity counting unit — see the RACT row below) on legacy DBs whose constraint predates
-- them. Drop + re-add is idempotent and keeps fresh and legacy schemas identical.
ALTER TABLE IF EXISTS currencies DROP CONSTRAINT IF EXISTS currencies_kind_check;
ALTER TABLE IF EXISTS currencies ADD CONSTRAINT currencies_kind_check CHECK (kind IN ('token','fiat','crypto','barter','free','activity'));
CREATE INDEX IF NOT EXISTS idx_currencies_active_sort ON currencies(is_active, sort_order);

-- Seed the owner-curated launch set (inline + idempotent, like ctf_plugin_registry). Owner updates
-- this catalog over time. ServiceCredits sorts first (preferred wherever multiple options appear).
INSERT INTO currencies (code, label, kind, is_service_credits, symbol, decimal_places, requires_amount, sort_order) VALUES
  ('SC',  'ServiceCredits',        'token',  TRUE,  NULL,  0, TRUE, 0),
  ('USD', 'United States Dollar',  'fiat',   FALSE, '$',   2, TRUE, 10),
  ('EUR', 'Euro',                  'fiat',   FALSE, '€',   2, TRUE, 20),
  ('JPY', 'Japanese Yen',          'fiat',   FALSE, '¥',   0, TRUE, 30),
  ('GBP', 'British Pound Sterling','fiat',   FALSE, '£',   2, TRUE, 40),
  ('CHF', 'Swiss Franc',           'fiat',   FALSE, 'CHF', 2, TRUE, 50),
  ('CAD', 'Canadian Dollar',       'fiat',   FALSE, 'CA$', 2, TRUE, 60),
  ('AUD', 'Australian Dollar',     'fiat',   FALSE, 'A$',  2, TRUE, 70),
  ('CNY', 'Chinese Yuan',          'fiat',   FALSE, 'CN¥', 2, TRUE, 80),
  ('INR', 'Indian Rupee',          'fiat',   FALSE, '₹',   2, TRUE, 90),
  ('BRL', 'Brazilian Real',        'fiat',   FALSE, 'R$',  2, TRUE, 100),
  ('BTC', 'Bitcoin',               'crypto', FALSE, '₿',   8, TRUE, 110),
  -- Barter: a no-money exchange (goods/services traded directly). requires_amount = FALSE because a
  -- barter trade has no monetary amount; it is selectable as a payment type and each completed barter
  -- trade contributes to the Community Value Index by count, never by a fiat amount.
  ('BARTER', 'Barter (no money)',  'barter', FALSE, NULL,  0, FALSE, 120),
  -- Free: one-way mutual aid given at no charge (a meal, a ride, help). requires_amount = FALSE — there
  -- is no price. Selectable as a payment type; each completed free exchange contributes to the Community
  -- Value Index by count, never by a fiat amount, so mutual aid still counts toward the community economy.
  ('FREE', 'Free (no charge)',     'free',   FALSE, NULL,  0, FALSE, 130)
ON CONFLICT (code) DO UPDATE SET
  label              = EXCLUDED.label,
  kind               = EXCLUDED.kind,
  is_service_credits = EXCLUDED.is_service_credits,
  symbol             = EXCLUDED.symbol,
  decimal_places     = EXCLUDED.decimal_places,
  requires_amount    = EXCLUDED.requires_amount,
  sort_order         = EXCLUDED.sort_order,
  updated_at         = NOW();

-- RACT ("recurring activity" count unit) is NOT a member-selectable currency. It is the internal
-- counting unit for the Recurring Activity plugin's GDP contribution: each confirmed, active,
-- fiat-denominated recurring activity contributes ONE RACT to the Community Value Index (owner-tunable
-- weight in currency_usd_rates, default 1) — a COUNT, never a fiat amount. This is the liability
-- firewall: the platform never stores or sums a recurring-fiat-payment total (a fiat recurring activity
-- carries no amount at all), so it never becomes a record that could look like money transmission. SC
-- recurring activities are counted by their declared value under 'SC' instead, since ServiceCredits is
-- an internal utility token with no third-party reporting duty. is_active = FALSE keeps RACT out of
-- every payment/currency dropdown (listActiveCurrencies filters is_active = TRUE); it exists only as an
-- FK-valid anchor for its contribution weight and is never stored on a recurring_activities row.
INSERT INTO currencies (code, label, kind, is_service_credits, symbol, decimal_places, requires_amount, is_active, sort_order)
VALUES ('RACT', 'Recurring activity', 'activity', FALSE, NULL, 0, FALSE, FALSE, 900)
ON CONFLICT (code) DO UPDATE SET
  label           = EXCLUDED.label,
  kind            = EXCLUDED.kind,
  requires_amount = EXCLUDED.requires_amount,
  is_active       = EXCLUDED.is_active,
  sort_order      = EXCLUDED.sort_order,
  updated_at      = NOW();

-- === weekly_performance_weeks ===
CREATE TABLE IF NOT EXISTS weekly_performance_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS weekly_performance_weeks ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS weekly_performance_weeks ADD COLUMN IF NOT EXISTS week_start_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS weekly_performance_weeks ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE IF EXISTS weekly_performance_weeks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS weekly_performance_weeks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === weekly_performance_goal_snapshots ===
-- Weekly memory for the dashboard's two goal rows (GDP Community Value Index toward 300B,
-- Workforce recruited toward 2,000,000). Those are STATE metrics — a current total, not a windowed
-- event — so week-over-week needs a stored reading per week: reading the current week upserts the
-- live value (last read of the week wins), and past weeks report their stored row. See
-- ctf/packages/web/lib/weekly-performance/live-metrics.ts and
-- ctf/docs/developer/PLUGIN_VALUE_METRICS.md.
CREATE TABLE IF NOT EXISTS weekly_performance_goal_snapshots (
  metric_key TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  metric_value NUMERIC NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (metric_key, week_start_date)
);
ALTER TABLE IF EXISTS weekly_performance_goal_snapshots ADD COLUMN IF NOT EXISTS metric_key TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS weekly_performance_goal_snapshots ADD COLUMN IF NOT EXISTS week_start_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS weekly_performance_goal_snapshots ADD COLUMN IF NOT EXISTS metric_value NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS weekly_performance_goal_snapshots ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === foundation_connection_threads ===
CREATE TABLE IF NOT EXISTS foundation_connection_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- thread_key is a legacy column: the current connection-thread create path keys a thread by
  -- (survivor_user_id, provider_user_id) and never writes thread_key. It must be NULLABLE so a fresh
  -- database (e.g. the demo schema) matches production, where thread_key was added later via ALTER as a
  -- nullable column. Leaving it NOT NULL made every Request Quote fail on a fresh DB (the insert omits
  -- it). UNIQUE still holds; Postgres allows multiple NULLs under a UNIQUE constraint.
  thread_key TEXT UNIQUE,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS foundation_connection_threads ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS foundation_connection_threads ADD COLUMN IF NOT EXISTS thread_key TEXT;
ALTER TABLE IF EXISTS foundation_connection_threads ADD COLUMN IF NOT EXISTS created_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_connection_threads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS foundation_connection_threads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Fix an existing fresh/demo DB where thread_key was created NOT NULL: the create path never writes it.
-- On production (thread_key already nullable) this is a no-op.
ALTER TABLE IF EXISTS foundation_connection_threads ALTER COLUMN thread_key DROP NOT NULL;
-- Ensure chyme_rooms exists before dependent indexes/foreign keys below.
CREATE TABLE IF NOT EXISTS chyme_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_key TEXT NOT NULL UNIQUE,
  room_name TEXT NOT NULL,
  call_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_chyme_rooms_room_key ON chyme_rooms(room_key);
CREATE TABLE IF NOT EXISTS chyme_service_profiles (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('active', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE TABLE IF NOT EXISTS chyme_room_members (
  room_id UUID NOT NULL REFERENCES chyme_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT NULL,
  avatar_url TEXT NULL,
  role TEXT NOT NULL CHECK (role IN ('speaker', 'listener')),
  hand_raised BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);
-- Persistent raise-hand state: a raised hand must stay up for everyone until the member
-- lowers it or leaves. Guarded for legacy DBs that pre-date the column.
ALTER TABLE IF EXISTS chyme_room_members ADD COLUMN IF NOT EXISTS hand_raised BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_chyme_room_members_room_id ON chyme_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_chyme_room_members_user_id ON chyme_room_members(user_id);
CREATE TABLE IF NOT EXISTS chyme_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chyme_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT NULL,
  avatar_url TEXT NULL,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 1000),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Column reconciliation so older databases converge on the current shape
-- (added nullable / with safe defaults so they never fail on populated tables).
ALTER TABLE IF EXISTS chyme_messages ADD COLUMN IF NOT EXISTS room_id UUID;
ALTER TABLE IF EXISTS chyme_messages ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS chyme_messages ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE IF EXISTS chyme_messages ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE IF EXISTS chyme_messages ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE IF EXISTS chyme_messages ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_chyme_messages_room_sent_at ON chyme_messages(room_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_chyme_messages_user_id ON chyme_messages(user_id);
CREATE TABLE IF NOT EXISTS chyme_deletion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('service', 'account')),
  service_name TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('requested', 'processing', 'completed', 'failed')),
  metadata JSONB NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_chyme_deletion_events_user_scope ON chyme_deletion_events(user_id, scope, requested_at DESC);
-- Back Channel: a free, casual 1:1 audio call between two members who are both currently in the same
-- live Chyme room (spec #1746). A single row models the whole lifecycle via `status`:
--   inviting -> active (recipient accepts)      -> ended (either party hangs up)
--   inviting -> declined (recipient declines, terminal)
--   inviting -> lapsed  (a party left the room before it was accepted, terminal)
--   active   -> ended   (terminal)
-- There is deliberately no history surfaced anywhere and no credits attached; rows exist only to run
-- one call and are private (never in Trust evidence / feeds, per rule 132). A member's rows are removed
-- on Chyme service deletion and account deletion.
CREATE TABLE IF NOT EXISTS chyme_back_channel_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chyme_rooms(id) ON DELETE CASCADE,
  initiator_user_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  initiator_username TEXT NULL,
  recipient_username TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('inviting', 'active', 'declined', 'ended', 'lapsed')),
  stream_call_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,
  ended_by_user_id TEXT NULL,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chyme_back_channel_no_self CHECK (initiator_user_id <> recipient_user_id)
);
-- Column reconciliation so legacy databases converge on the current shape (all added nullable / with
-- safe defaults so they never fail on a populated table).
ALTER TABLE IF EXISTS chyme_back_channel_calls ADD COLUMN IF NOT EXISTS initiator_username TEXT;
ALTER TABLE IF EXISTS chyme_back_channel_calls ADD COLUMN IF NOT EXISTS recipient_username TEXT;
ALTER TABLE IF EXISTS chyme_back_channel_calls ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS chyme_back_channel_calls ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS chyme_back_channel_calls ADD COLUMN IF NOT EXISTS ended_by_user_id TEXT;
ALTER TABLE IF EXISTS chyme_back_channel_calls ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_chyme_bc_recipient_status ON chyme_back_channel_calls(recipient_user_id, status);
CREATE INDEX IF NOT EXISTS idx_chyme_bc_initiator_status ON chyme_back_channel_calls(initiator_user_id, status);
CREATE INDEX IF NOT EXISTS idx_chyme_bc_room ON chyme_back_channel_calls(room_id);
-- At most one live (inviting or active) call from a given initiator to a given recipient at a time.
-- Terminal rows (declined/ended/lapsed) are excluded so the pair can start a fresh call later.
CREATE UNIQUE INDEX IF NOT EXISTS uq_chyme_bc_live_pair
  ON chyme_back_channel_calls(initiator_user_id, recipient_user_id)
  WHERE status IN ('inviting', 'active');
-- Chyme does not maintain its own service_credits_transactions table.
-- Service credit accounting for Chyme is managed through the service-credits plugin if needed.
COMMIT;

-- === peer-programming placeholder ===
-- === skill_up_enrollments ===
-- The canonical definition lives further below (the cohort-based table).
-- An earlier level_id-based table used to be defined here; it was legacy
-- cruft that left a level_id NOT NULL column with no default and blocked
-- cohort-based inserts. It has been removed, and any database that still
-- carries the legacy column has it dropped next to the canonical block.
CREATE TABLE IF NOT EXISTS peer_programming_weekly_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  title TEXT NOT NULL,
  guidance TEXT NOT NULL,
  revision_note TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_by_user_id TEXT NOT NULL,
  published_by_user_id TEXT,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (week_start_date)
);

-- Add columns with guarded DDL for legacy DBs
ALTER TABLE IF EXISTS peer_programming_weekly_topics ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS peer_programming_weekly_topics ADD COLUMN IF NOT EXISTS week_start_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS peer_programming_weekly_topics ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_weekly_topics ADD COLUMN IF NOT EXISTS guidance TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_weekly_topics ADD COLUMN IF NOT EXISTS revision_note TEXT;
ALTER TABLE IF EXISTS peer_programming_weekly_topics ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE IF EXISTS peer_programming_weekly_topics ADD COLUMN IF NOT EXISTS created_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_weekly_topics ADD COLUMN IF NOT EXISTS published_by_user_id TEXT;
ALTER TABLE IF EXISTS peer_programming_weekly_topics ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS peer_programming_weekly_topics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS peer_programming_weekly_topics ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- One topic row per week. The admin topic upsert relies on this for ON CONFLICT (week_start_date);
-- without it, every "set the weekly topic" call fails. Guarded so legacy DBs gain the constraint too.
CREATE UNIQUE INDEX IF NOT EXISTS peer_programming_weekly_topics_week_start_date_key
  ON peer_programming_weekly_topics(week_start_date);

-- === canonical-username-handle-baseline ===
-- === users table: ensure prod compatibility ===
-- Add missing columns for unlock compatibility
-- [demo-skip: public.users alter suppressed]
-- [demo-skip: public.users alter suppressed]
-- [demo-skip: public.users alter suppressed]
ALTER TABLE IF EXISTS chyme_room_members ADD COLUMN IF NOT EXISTS username VARCHAR(64);
ALTER TABLE IF EXISTS chyme_messages ADD COLUMN IF NOT EXISTS author_username VARCHAR(64);
-- Username uniqueness (defense-in-depth — Clerk owns canonical assignment).
-- Case-insensitive UNIQUE on LOWER(username) so @Farah and @farah cannot
-- coexist. NULLs allowed for legacy users. Reserved prefix `community-`
-- enforced at API layer (lib/auth/username-policy.ts). If duplicates exist
-- the index creation is skipped with NOTICE; resolve manually and rerun.
-- [demo-skip: public.users username unique index suppressed]

-- === skills-hunt-core-phase1 ===
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS skills_hunt_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'archived')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  scoring_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- ServiceCredits reward config (owner-set per round; defaults make a round pay nothing).
  -- A whole-credit reward minted to the scout when a nomination is accepted, capped per scout.
  reward_credits_per_accept INTEGER NOT NULL DEFAULT 0 CHECK (reward_credits_per_accept >= 0),
  reward_per_user_round_cap INTEGER NULL CHECK (reward_per_user_round_cap IS NULL OR reward_per_user_round_cap >= 0),
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS skills_hunt_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES skills_hunt_rounds(id) ON DELETE CASCADE,
  submitter_user_id TEXT NOT NULL,
  submitter_username TEXT NULL,
  full_name TEXT NOT NULL,
  bio TEXT NOT NULL,
  quora_profile_url TEXT NOT NULL,
  quora_profile_url_normalized TEXT NOT NULL,
  -- Nominee location. `country` is required at submit time (enforced in validateSubmissionInput);
  -- `state`/`city` are optional. Columns are nullable so legacy rows and the guarded ALTER are safe;
  -- on accept these carry into the generated directory_profiles row (the shared member profile).
  -- Plain names per the shared location standard (packages/web/lib/geo/locations.ts).
  country TEXT NULL,
  state TEXT NULL,
  city TEXT NULL,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposed_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  signature_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'flagged')),
  review_action TEXT NULL CHECK (review_action IN ('accept', 'reject', 'edit', 'flag', 'unflag')),
  reviewed_by_user_id TEXT NULL,
  review_notes TEXT NULL,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  participation_points INTEGER NOT NULL DEFAULT 0,
  credit_granted BOOLEAN NOT NULL DEFAULT FALSE,
  -- ServiceCredits reward bookkeeping: amount minted to the scout on accept and when.
  -- credit_granted is the idempotency marker; it is never unset once a reward is paid.
  credit_amount INTEGER NOT NULL DEFAULT 0,
  credit_granted_at TIMESTAMPTZ NULL,
  url_validation_result TEXT NULL CHECK (url_validation_result IN ('valid', 'invalid', 'dead')),
  url_validation_checked_at TIMESTAMPTZ NULL,
  edit_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  edited_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,
  reviewed_at TIMESTAMPTZ NULL,
  directory_profile_generated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS skills_hunt_leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES skills_hunt_rounds(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('individual')),
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  first_match_count INTEGER NOT NULL DEFAULT 0,
  pending_points INTEGER NOT NULL DEFAULT 0,
  rare_skill_bonus INTEGER NOT NULL DEFAULT 0,
  user_id TEXT NULL,
  username_snapshot TEXT NULL,
  last_submission_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, mode, rank)
);
CREATE TABLE IF NOT EXISTS skills_hunt_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  round_id UUID NULL REFERENCES skills_hunt_rounds(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived_at TIMESTAMPTZ NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, code)
);
-- NOTE: Wave 2 will refactor UNIQUE(user_id, code) to support per-round badges
-- (e.g., Leaderboard Champion earned across multiple rounds). For now the
-- existing constraint is preserved so the in-tree generic badge inserts
-- (accepted-first / accepted-five / accepted-ten) continue to work with their
-- ON CONFLICT (user_id, code) DO NOTHING clause.
CREATE TABLE IF NOT EXISTS skills_hunt_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS skills_hunt_feature_reward_card (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cta_label TEXT NOT NULL,
  cta_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by_user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS skills_hunt_rare_skills_lookup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES skills_hunt_rounds(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  bonus_points INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, skill_name)
);
CREATE TABLE IF NOT EXISTS skills_hunt_directory_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES skills_hunt_submissions(id) ON DELETE CASCADE,
  directory_profile_id TEXT NOT NULL,
  invited_by_username TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id),
  UNIQUE (directory_profile_id)
);
CREATE TABLE IF NOT EXISTS skills_hunt_audit_log (
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
-- Missions: themed sub-goals within a round (post-design lock 2026-05-11,
-- continuity 2.9). One mission belongs to one round; per-user progress is
-- tracked in skills_hunt_mission_progress and recomputed on accept by the
-- same review hook that rebuilds the leaderboard. goal_type drives the
-- recompute strategy in lib/skills-hunt/missions.ts.
CREATE TABLE IF NOT EXISTS skills_hunt_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES skills_hunt_rounds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('count_total_accepted', 'count_skills_in_sector', 'count_rare_skill_finds')),
  goal_target INTEGER NOT NULL CHECK (goal_target > 0),
  goal_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  bonus_points INTEGER NOT NULL DEFAULT 0 CHECK (bonus_points >= 0),
  color_hex TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked', 'archived')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS skills_hunt_mission_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES skills_hunt_missions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  progress_count INTEGER NOT NULL DEFAULT 0 CHECK (progress_count >= 0),
  completed_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mission_id, user_id)
);
-- Proposed-skill promotion tracker: one row per distinct free-text "proposed" skill
-- harvested from accepted SkillsHunt nominations that is NOT yet in the canonical
-- taxonomy. A scheduled pipeline (ctf/scripts/proposeSkillPromotions.mjs) files one
-- GitHub issue per row proposing the skill be added to the taxonomy, with an
-- AI-suggested sector + occupation. The pipeline only files issues; it never writes
-- the taxonomy. normalized_skill is the trim+lowercase dedupe key (UNIQUE) so each
-- distinct skill becomes at most one issue, even across overlapping scheduled runs.
CREATE TABLE IF NOT EXISTS skills_hunt_proposed_skill_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_skill TEXT NOT NULL,
  skill_label TEXT NOT NULL,
  source_submission_id UUID,
  -- Which app surfaced this proposal, for provenance in the filed GitHub issue. This is the
  -- single cross-app intake for "skill not in the taxonomy yet": SkillsHunt nominations and the
  -- Directory "skill not listed" box both write here. 'skills-hunt' is the default so existing
  -- rows (all from SkillsHunt) are labeled correctly without a backfill.
  source TEXT NOT NULL DEFAULT 'skills-hunt',
  suggested_sector TEXT,
  suggested_occupation TEXT,
  issue_number INTEGER,
  issue_url TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skills_hunt_proposed_skill_promotions ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'skills-hunt';
CREATE UNIQUE INDEX IF NOT EXISTS uq_skills_hunt_proposed_skill_promotions_normalized ON skills_hunt_proposed_skill_promotions (normalized_skill);
CREATE INDEX IF NOT EXISTS idx_skills_hunt_rounds_status_window ON skills_hunt_rounds (status, starts_at DESC, ends_at DESC);
-- Re-nominating the same person (owner bug report 2026-08-27). The blanket
-- UNIQUE (round_id, signature_hash) on this table contradicted the rule the insert path already
-- enforces in code, which reads: block a nomination when a row for the same normalized Quora URL is
-- still live, where a rejected or removed row is NOT live. The constraint ignored both conditions,
-- so a submission an admin had removed went on occupying its signature for the rest of the round
-- and the same person could never be nominated again — Remove looked like it voided a submission
-- and did not. Replaced by a partial unique index carrying the same predicate the code uses, so the
-- database and the code now say one thing. A pending, accepted or flagged row still holds the slot.
ALTER TABLE IF EXISTS skills_hunt_submissions DROP CONSTRAINT IF EXISTS skills_hunt_submissions_round_id_signature_hash_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_skills_hunt_submissions_round_signature_live
  ON skills_hunt_submissions (round_id, signature_hash)
  WHERE deleted_at IS NULL AND status <> 'rejected';
-- Un-flagging a submission (owner bug report 2026-08-28). Flag parks a nomination for a second
-- look; until now the only ways out were a verdict (accept/reject) or Remove, so a moderator who
-- flagged something to come back to it could not simply put it back in the queue. 'unflag' returns
-- the row to pending and is recorded as the last review action, so the CHECK has to allow it.
ALTER TABLE IF EXISTS skills_hunt_submissions DROP CONSTRAINT IF EXISTS skills_hunt_submissions_review_action_check;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD CONSTRAINT skills_hunt_submissions_review_action_check
  CHECK (review_action IS NULL OR review_action IN ('accept', 'reject', 'edit', 'flag', 'unflag'));
CREATE INDEX IF NOT EXISTS idx_skills_hunt_submissions_round_status_created ON skills_hunt_submissions (round_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skills_hunt_submissions_submitter_created ON skills_hunt_submissions (submitter_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skills_hunt_submissions_active ON skills_hunt_submissions (deleted_at) WHERE deleted_at IS NULL;
-- claimed_professions is dropped (owner directive 2026-08-27: no unused code). The nomination form
-- stopped collecting professions when the taxonomy skills picker replaced that field, and every
-- reader has now been removed: the team leaderboard, the stack bonus and the count_distinct_sectors
-- goal type were deleted, the diversity-champion badge counts taxonomy sectors from the submitted
-- skills instead (which is what its description always promised), and the generated Directory
-- profile's headline had been null for as long as the column had been empty. Nothing reads it, so
-- it goes rather than sitting as a column no code touches.
ALTER TABLE IF EXISTS skills_hunt_submissions DROP COLUMN IF EXISTS claimed_professions;
-- Team leaderboard removed (owner directive 2026-08-27). Teams was meant to be members teaming up
-- on submissions; it was never that — it regrouped the same accepted nominations by the nominee's
-- claimed profession, and since the nomination form stopped collecting professions every row landed
-- in a single "Unspecified" bucket. The mode toggle, the team rows and the team queries are gone.
-- Existing team rows are deleted here rather than left to age out on the next rebuild. `mode` is
-- kept because it carries the UNIQUE (round_id, mode, rank) key and is now always 'individual';
-- the CHECK is narrowed so a team row cannot come back. `team_key` is dropped below with the rest
-- of the unused code — nothing reads or writes it.
DELETE FROM skills_hunt_leaderboard WHERE mode <> 'individual';
ALTER TABLE IF EXISTS skills_hunt_leaderboard DROP CONSTRAINT IF EXISTS skills_hunt_leaderboard_mode_check;
ALTER TABLE IF EXISTS skills_hunt_leaderboard ADD CONSTRAINT skills_hunt_leaderboard_mode_check CHECK (mode IN ('individual'));
-- Unused-code sweep (owner directive 2026-08-27). Two columns nothing reads or writes:
-- `skills_hunt_leaderboard.team_key` (only ever set by the team aggregation removed above) and
-- `skills_hunt_mission_progress.bonus_credited_at` (the marker for a ServiceCredits payout that is
-- not being built — mission points are a leaderboard ranking figure, not credits).
-- Community moderation reports removed (owner directive 2026-08-27). A member could never file one:
-- the route had no button anywhere in the app, so the admin queue could only ever be empty. And
-- resolving a report as 'removed' only flipped this table's status column — it never deleted the
-- profile or blocked anything, so an admin marking one resolved would believe a profile had come
-- down when nothing had. Its first reason, 'no_permission', described every community-generated
-- profile by definition rather than singling one out. Directory owns this properly: an admin takes
-- down a community-generated profile from the Directory admin screen, which deletes it and blocks
-- its Quora URL from being listed again until the block is lifted.
DROP TABLE IF EXISTS skills_hunt_submission_reports;
ALTER TABLE IF EXISTS skills_hunt_leaderboard DROP COLUMN IF EXISTS team_key;
ALTER TABLE IF EXISTS skills_hunt_mission_progress DROP COLUMN IF EXISTS bonus_credited_at;
CREATE INDEX IF NOT EXISTS idx_skills_hunt_leaderboard_lookup ON skills_hunt_leaderboard (round_id, mode, rank ASC, score DESC);
CREATE INDEX IF NOT EXISTS idx_skills_hunt_leaderboard_tiebreak ON skills_hunt_leaderboard (round_id, mode, score DESC, first_match_count DESC, last_submission_at ASC);
CREATE INDEX IF NOT EXISTS idx_skills_hunt_achievements_user ON skills_hunt_achievements (user_id, archived_at, awarded_at DESC);
CREATE INDEX IF NOT EXISTS idx_skills_hunt_achievements_round ON skills_hunt_achievements (round_id) WHERE round_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_skills_hunt_notifications_user_unread ON skills_hunt_notifications (user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skills_hunt_audit_log_lookup ON skills_hunt_audit_log (created_at DESC, actor_id, command);
CREATE INDEX IF NOT EXISTS idx_skills_hunt_missions_round_status ON skills_hunt_missions (round_id, status, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_skills_hunt_mission_progress_user ON skills_hunt_mission_progress (user_id, completed_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_skills_hunt_mission_progress_mission ON skills_hunt_mission_progress (mission_id, completed_at);
-- The count_distinct_sectors mission goal type is removed (owner directive 2026-08-27). It counted
-- distinct claimed professions on a scout's accepted nominations, and the nomination form stopped
-- collecting professions, so it always counted zero — the goal could never be completed. Any mission
-- using it is deleted (progress rows cascade; every one of them is zero by construction), then the
-- allowed set is narrowed so it cannot be chosen again. The stack bonus, which had the same cause,
-- needed no migration: it was a computed figure, never a column.
DELETE FROM skills_hunt_missions WHERE goal_type = 'count_distinct_sectors';
ALTER TABLE IF EXISTS skills_hunt_missions DROP CONSTRAINT IF EXISTS skills_hunt_missions_goal_type_check;
ALTER TABLE IF EXISTS skills_hunt_missions ADD CONSTRAINT skills_hunt_missions_goal_type_check CHECK (goal_type IN ('count_total_accepted', 'count_skills_in_sector', 'count_rare_skill_finds'));
-- Missions have no draft state (owner directive 2026-08-27: "no drafts are needed"). A mission lives
-- inside a round that already carries its own draft/active lifecycle, so a second gate inside it
-- gated nothing — and because the admin surface has no mission edit control, a mission created as
-- draft could only ever be archived, never shown to members. The status picker is gone from the
-- create form (missions are created active; Archive remains the only lifecycle action), any mission
-- left in draft is moved to active here, and the allowed set is tightened so it cannot come back.
UPDATE skills_hunt_missions SET status = 'active', updated_at = NOW() WHERE status = 'draft';
ALTER TABLE IF EXISTS skills_hunt_missions DROP CONSTRAINT IF EXISTS skills_hunt_missions_status_check;
ALTER TABLE IF EXISTS skills_hunt_missions ADD CONSTRAINT skills_hunt_missions_status_check CHECK (status IN ('active', 'locked', 'archived'));
-- Auto-opened missions from Workforce sector gaps (owner decision 2026-08-27). Round creation and a
-- weekly scheduled run read the live Workforce occupation gap report (through
-- lib/shared/workforce-interface.ts), sum the gaps per sector, and open a capped number of
-- 'count_skills_in_sector' missions per active round for the sectors with the largest shortfall.
-- Unlike SkillUp's proposal queue, these missions open directly without an approval step: a mission
-- commits no credits, no seats and no schedule, an admin can archive one at any time, and the
-- config kill switch below turns the mechanism off. auto_created marks generated missions;
-- source_sector / source_gap_at_creation record which gap opened the mission and how large it was.
ALTER TABLE IF EXISTS skills_hunt_missions ADD COLUMN IF NOT EXISTS auto_created BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS skills_hunt_missions ADD COLUMN IF NOT EXISTS source_sector TEXT;
ALTER TABLE IF EXISTS skills_hunt_missions ADD COLUMN IF NOT EXISTS source_gap_at_creation NUMERIC;
-- Database-level idempotency guard: at most one non-archived auto mission per (round, sector).
CREATE UNIQUE INDEX IF NOT EXISTS uq_skills_hunt_auto_mission_active
  ON skills_hunt_missions (round_id, source_sector)
  WHERE auto_created = TRUE AND status <> 'archived';
-- Auto-mission configuration. Singleton row of admin-editable knobs the generator reads;
-- coded defaults apply until the row is written (see lib/skills-hunt/auto-missions.ts).
CREATE TABLE IF NOT EXISTS skills_hunt_auto_mission_config (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  min_gap_threshold NUMERIC NOT NULL DEFAULT 25,
  max_per_round INTEGER NOT NULL DEFAULT 3,
  default_goal_target INTEGER NOT NULL DEFAULT 3,
  default_bonus_points INTEGER NOT NULL DEFAULT 0,
  updated_by_user_id TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skills_hunt_auto_mission_config ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS skills_hunt_auto_mission_config ADD COLUMN IF NOT EXISTS min_gap_threshold NUMERIC NOT NULL DEFAULT 25;
ALTER TABLE IF EXISTS skills_hunt_auto_mission_config ADD COLUMN IF NOT EXISTS max_per_round INTEGER NOT NULL DEFAULT 3;
ALTER TABLE IF EXISTS skills_hunt_auto_mission_config ADD COLUMN IF NOT EXISTS default_goal_target INTEGER NOT NULL DEFAULT 3;
ALTER TABLE IF EXISTS skills_hunt_auto_mission_config ADD COLUMN IF NOT EXISTS default_bonus_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skills_hunt_auto_mission_config ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT NOT NULL DEFAULT 'system';
ALTER TABLE IF EXISTS skills_hunt_auto_mission_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
COMMIT;

-- === account deletion events (cross-plugin orchestration log) ===
-- One row per user-initiated deletion the orchestrator runs: a per-plugin "delete my data"
-- (scope = 'service') or a whole-account deletion (scope = 'account'). This is the canonical,
-- retained accountability record of what the orchestrator did — it is never itself deleted by a
-- deletion. `summary` holds the per-table row counts the engine reported, for audit, plus
-- `initiatedBy` ('member' | 'operator'): who asked for the deletion. A whole-account row looks the
-- same whether the member chose to go or an operator cleared a duplicate/test account through the
-- manual removal workflow, and the Weekly Performance deleted-accounts row counts only the member's
-- own choice. Rows written before that field existed carry no marker and are read as 'member'.
CREATE TABLE IF NOT EXISTS account_deletion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('service', 'account')),
  -- For service scope this is the plugin slug; for account scope it is 'all-services'.
  service_name TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('requested', 'processing', 'completed', 'failed')),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE IF EXISTS account_deletion_events ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS account_deletion_events ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE IF EXISTS account_deletion_events ADD COLUMN IF NOT EXISTS service_name TEXT;
ALTER TABLE IF EXISTS account_deletion_events ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS account_deletion_events ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS account_deletion_events ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE IF EXISTS account_deletion_events ADD COLUMN IF NOT EXISTS summary JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Restore the CREATE TABLE guarantees on any drifted/legacy DB where the columns were added bare.
-- Backfill nullable rows first so SET NOT NULL cannot fail, then re-assert defaults, NOT NULL, and
-- the scope/status CHECK constraints (idempotently).
UPDATE account_deletion_events SET summary = '{}'::jsonb WHERE summary IS NULL;
UPDATE account_deletion_events SET requested_at = NOW() WHERE requested_at IS NULL;
ALTER TABLE IF EXISTS account_deletion_events ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE IF EXISTS account_deletion_events ALTER COLUMN scope SET NOT NULL;
ALTER TABLE IF EXISTS account_deletion_events ALTER COLUMN service_name SET NOT NULL;
ALTER TABLE IF EXISTS account_deletion_events ALTER COLUMN requested_at SET DEFAULT NOW();
ALTER TABLE IF EXISTS account_deletion_events ALTER COLUMN requested_at SET NOT NULL;
ALTER TABLE IF EXISTS account_deletion_events ALTER COLUMN status SET NOT NULL;
ALTER TABLE IF EXISTS account_deletion_events ALTER COLUMN summary SET DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS account_deletion_events ALTER COLUMN summary SET NOT NULL;
DO $account_deletion_events_scope_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'account_deletion_events_scope_check' AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE account_deletion_events
      ADD CONSTRAINT account_deletion_events_scope_check CHECK (scope IN ('service', 'account'));
  END IF;
END
$account_deletion_events_scope_check$;
DO $account_deletion_events_status_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'account_deletion_events_status_check' AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE account_deletion_events
      ADD CONSTRAINT account_deletion_events_status_check
      CHECK (status IN ('requested', 'processing', 'completed', 'failed'));
  END IF;
END
$account_deletion_events_status_check$;
CREATE INDEX IF NOT EXISTS idx_account_deletion_events_user_scope
  ON account_deletion_events(user_id, scope, requested_at DESC);

-- === skills-hunt-service-credits ===
-- Dropped 2026-06-27: `skills_hunt_service_credits_transactions` was a member-to-member transfer log
-- that was never wired into the reward flow. SkillsHunt is reward-only — the treasury mints the round
-- reward to a scout on an accepted nomination (recorded in the canonical ServiceCredits ledger +
-- `skills_hunt_submissions.credit_*`). The peer-transfer route that would have written here was removed
-- (#1105). Drop the unused table; nothing references it.
DROP TABLE IF EXISTS skills_hunt_service_credits_transactions CASCADE;

CREATE TABLE IF NOT EXISTS feed_render_config (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  render_mode TEXT NOT NULL,
  max_timeline_page_size INTEGER NOT NULL DEFAULT 100,
  enabled_channels JSONB NOT NULL DEFAULT '["announcements", "questions", "community"]'::jsonb,
  -- Commons consolidation: the blended channel is publicly viewable (read-only)
  -- to unauthenticated visitors when TRUE. Public-read enforcement route is tracked
  -- as a follow-up; this flag is the canonical config the admin/seed sets.
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by_user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Add columns with guarded DDL for legacy DBs
ALTER TABLE IF EXISTS feed_render_config ADD COLUMN IF NOT EXISTS singleton_key BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS feed_render_config ADD COLUMN IF NOT EXISTS render_mode TEXT NOT NULL DEFAULT 'card_only';
ALTER TABLE IF EXISTS feed_render_config ADD COLUMN IF NOT EXISTS max_timeline_page_size INTEGER NOT NULL DEFAULT 100;
ALTER TABLE IF EXISTS feed_render_config ADD COLUMN IF NOT EXISTS enabled_channels JSONB NOT NULL DEFAULT '["announcements", "questions", "community"]'::jsonb;
ALTER TABLE IF EXISTS feed_render_config ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS feed_render_config ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT NOT NULL DEFAULT 'system';
ALTER TABLE IF EXISTS feed_render_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Removed feature: drop the legacy kill-switch column if a prior DB created it.
ALTER TABLE IF EXISTS feed_render_config DROP COLUMN IF EXISTS kill_switch_enabled;
-- Seed default feed config row (idempotent)
INSERT INTO feed_render_config (singleton_key, render_mode, max_timeline_page_size, enabled_channels, updated_by_user_id, updated_at)
SELECT TRUE, 'card_only', 100, '["announcements", "questions", "community"]'::jsonb, 'system', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM feed_render_config WHERE singleton_key IS TRUE
);
UPDATE feed_render_config
SET enabled_channels = '["announcements", "questions", "community"]'::jsonb
WHERE enabled_channels IS NULL OR enabled_channels = '[]'::jsonb;
CREATE TABLE IF NOT EXISTS feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL,
  source_announcement_id UUID,
  source_question_id UUID,
  source_community_post_id UUID,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS feed_items ADD COLUMN IF NOT EXISTS source_question_id UUID;
ALTER TABLE IF EXISTS feed_items ADD COLUMN IF NOT EXISTS source_community_post_id UUID;
-- Retire the announcement priority/mandatory ranking (owner decision 2026-07-16): the Commons is a
-- single time-ordered stream, so there is no manual ranking and no non-dismissable flag. Dropping
-- priority cascade-drops idx_feed_items_timeline_lookup, so recreate it without the priority column.
ALTER TABLE IF EXISTS feed_items DROP COLUMN IF EXISTS priority;
ALTER TABLE IF EXISTS feed_items DROP COLUMN IF EXISTS mandatory;
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_items_source_announcement_unique ON feed_items(source_announcement_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_items_source_question_unique ON feed_items(source_question_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_items_source_community_post_unique ON feed_items(source_community_post_id);
CREATE INDEX IF NOT EXISTS idx_feed_items_timeline_lookup ON feed_items(item_type, is_active, published_at DESC);
-- === foundation_quote_requests ===
CREATE TABLE IF NOT EXISTS foundation_quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- user_id and request_text are legacy columns. The current quote flow writes survivor_user_id /
  -- provider_user_id / service_type / request_details (added below via ALTER) and never sets these two.
  -- They carry a DEFAULT '' so an insert that omits them still satisfies NOT NULL — matching production,
  -- where the ALTER ... ADD COLUMN below first created them as NOT NULL DEFAULT ''. Without the default a
  -- fresh database (e.g. the demo schema) created them NOT NULL with no default, so the second step of
  -- Request Quote failed.
  user_id TEXT NOT NULL DEFAULT '',
  request_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Repair an existing fresh/demo DB where these legacy columns were created NOT NULL with no default: add
-- the default so an omitting insert gets ''. On production (already NOT NULL DEFAULT '') these are no-ops.
ALTER TABLE IF EXISTS foundation_quote_requests ALTER COLUMN user_id SET DEFAULT '';
ALTER TABLE IF EXISTS foundation_quote_requests ALTER COLUMN request_text SET DEFAULT '';
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS request_text TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TABLE IF NOT EXISTS feed_item_targets (
  item_id UUID NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
  target_role TEXT,
  target_plugin TEXT,
  target_region TEXT
);
-- A NULL target_plugin/target_region means "any plugin / any region" — the read path
-- treats NULL as a wildcard (see listFeedTimeline: "t.target_plugin IS NULL"). NULL
-- cannot live in a PRIMARY KEY (PK columns are implicitly NOT NULL), so the old
-- PRIMARY KEY (item_id, target_role, target_plugin, target_region) made every
-- default-targeted feed item fail to insert — which broke posting community messages
-- and @comic questions. Replace it with a unique index that treats NULLs as equal
-- (NULLS NOT DISTINCT, Postgres 15+) so default targeting works and duplicate
-- (item, role, plugin, region) rows are still de-duplicated. Guarded DDL repairs
-- legacy databases that still carry the old primary key.
ALTER TABLE IF EXISTS feed_item_targets DROP CONSTRAINT IF EXISTS feed_item_targets_pkey;
ALTER TABLE IF EXISTS feed_item_targets ALTER COLUMN target_role DROP NOT NULL;
ALTER TABLE IF EXISTS feed_item_targets ALTER COLUMN target_plugin DROP NOT NULL;
ALTER TABLE IF EXISTS feed_item_targets ALTER COLUMN target_region DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_item_targets_unique
  ON feed_item_targets (item_id, target_role, target_plugin, target_region) NULLS NOT DISTINCT;
CREATE TABLE IF NOT EXISTS feed_user_read_state (
  user_id TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE IF NOT EXISTS feed_user_dismissals (
  user_id TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);

-- === GDP Publications ===
CREATE TABLE IF NOT EXISTS gdp_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  created_by_user_id TEXT NOT NULL,
  published_by_user_id TEXT,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  ,host_user_id TEXT
);

-- Add columns with guarded DDL for legacy DBs
ALTER TABLE IF EXISTS gdp_publications ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS gdp_publications ADD COLUMN IF NOT EXISTS week_start_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS gdp_publications ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS gdp_publications ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS gdp_publications ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE IF EXISTS gdp_publications ADD COLUMN IF NOT EXISTS created_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS gdp_publications ADD COLUMN IF NOT EXISTS published_by_user_id TEXT;
ALTER TABLE IF EXISTS gdp_publications ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS gdp_publications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS gdp_publications ADD COLUMN IF NOT EXISTS host_user_id TEXT;
-- One publication per week. The prior upsert keyed ON CONFLICT (id) with a fresh UUID each call, so the
-- conflict never fired and every save inserted a new row. Dedupe any legacy duplicates first — keep the
-- best row per week (a published row over a draft, then the most recently updated) — then enforce
-- uniqueness so the upsert can key on week_start_date. Idempotent: a no-op once there are no duplicates.
DO $$
BEGIN
  IF to_regclass('public.gdp_publications') IS NOT NULL THEN
    DELETE FROM gdp_publications p
    USING (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY week_start_date
               ORDER BY (status = 'published') DESC, updated_at DESC, id
             ) AS rn
      FROM gdp_publications
    ) ranked
    WHERE p.id = ranked.id AND ranked.rn > 1;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_gdp_publications_week_start_date ON gdp_publications(week_start_date);
CREATE TABLE IF NOT EXISTS feed_membership_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  request_id TEXT,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS announcement_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL,
  revision_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  schedule_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  targeting JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Backfill every column on legacy databases (per the mandatory CREATE + ALTER-IF-NOT-EXISTS rule).
-- A database whose announcement_revisions predates these columns keeps the old table on
-- CREATE TABLE IF NOT EXISTS, so without these ALTERs the app's revision insert (which lists
-- targeting/status/schedule_at/expires_at) fails and the whole "create draft" transaction rolls
-- back with a 503. Defaults are supplied so the NOT NULL adds succeed on a table that already has rows.
ALTER TABLE IF EXISTS announcement_revisions ADD COLUMN IF NOT EXISTS announcement_id UUID;
ALTER TABLE IF EXISTS announcement_revisions ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS announcement_revisions ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS announcement_revisions ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS announcement_revisions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
-- Retire announcement priority/mandatory (owner decision 2026-07-16): drop them from the revision
-- history too so a re-created draft no longer records either field.
ALTER TABLE IF EXISTS announcement_revisions DROP COLUMN IF EXISTS priority;
ALTER TABLE IF EXISTS announcement_revisions DROP COLUMN IF EXISTS mandatory;
ALTER TABLE IF EXISTS announcement_revisions ADD COLUMN IF NOT EXISTS schedule_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS announcement_revisions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS announcement_revisions ADD COLUMN IF NOT EXISTS targeting JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS announcement_revisions ADD COLUMN IF NOT EXISTS created_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS announcement_revisions ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS announcement_revisions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS announcement_revisions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_announcement_revisions_announcement_revision ON announcement_revisions(announcement_id, revision_number);
CREATE TABLE IF NOT EXISTS announcement_delivery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS announcement_user_state (
  user_id TEXT NOT NULL,
  announcement_id UUID NOT NULL,
  read_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, announcement_id)
);
CREATE TABLE IF NOT EXISTS announcement_membership_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  request_id TEXT,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feed_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asked_by_user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  location_context JSONB NULL,
  llm_consent_granted BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS feed_questions ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS feed_questions ADD COLUMN IF NOT EXISTS asked_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_questions ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_questions ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';
ALTER TABLE IF EXISTS feed_questions ADD COLUMN IF NOT EXISTS location_context JSONB NULL;
ALTER TABLE IF EXISTS feed_questions ADD COLUMN IF NOT EXISTS llm_consent_granted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS feed_questions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE IF EXISTS feed_questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS feed_questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS feed_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES feed_questions(id) ON DELETE CASCADE,
  answer_type TEXT NOT NULL CHECK (answer_type IN ('llm', 'community')),
  body TEXT NOT NULL,
  confidence NUMERIC(5,4) NULL,
  model_id TEXT NULL,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  author_user_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS feed_answers ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS feed_answers ADD COLUMN IF NOT EXISTS question_id UUID;
ALTER TABLE IF EXISTS feed_answers ADD COLUMN IF NOT EXISTS answer_type TEXT NOT NULL DEFAULT 'community';
ALTER TABLE IF EXISTS feed_answers ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_answers ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,4) NULL;
ALTER TABLE IF EXISTS feed_answers ADD COLUMN IF NOT EXISTS model_id TEXT NULL;
ALTER TABLE IF EXISTS feed_answers ADD COLUMN IF NOT EXISTS sources JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS feed_answers ADD COLUMN IF NOT EXISTS author_user_id TEXT NULL;
ALTER TABLE IF EXISTS feed_answers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS feed_answers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Moderation for member-facing Q&A (2026-07-30). These tables had no moderation_status at all, so a
-- flagged answer could be read by an admin and then nothing could be done about it — the flag queue was
-- unbuildable. Same two states and same reason vocabulary as the Commons post tables, so one admin
-- surface can drive both. Nullable reason/actor/timestamp, null until a moderator acts.
ALTER TABLE IF EXISTS feed_questions ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'accepted';
ALTER TABLE IF EXISTS feed_questions ADD COLUMN IF NOT EXISTS moderation_reason TEXT NULL;
ALTER TABLE IF EXISTS feed_questions ADD COLUMN IF NOT EXISTS moderated_by_user_id TEXT NULL;
ALTER TABLE IF EXISTS feed_questions ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS feed_answers ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'accepted';
ALTER TABLE IF EXISTS feed_answers ADD COLUMN IF NOT EXISTS moderation_reason TEXT NULL;
ALTER TABLE IF EXISTS feed_answers ADD COLUMN IF NOT EXISTS moderated_by_user_id TEXT NULL;
ALTER TABLE IF EXISTS feed_answers ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ NULL;
-- Serves the flag queue: flagged answers, newest first, without scanning every answer.
CREATE INDEX IF NOT EXISTS idx_feed_answers_moderation_status
  ON feed_answers (moderation_status, created_at DESC);
CREATE TABLE IF NOT EXISTS feed_answer_ratings (
  user_id TEXT NOT NULL,
  answer_id UUID NOT NULL REFERENCES feed_answers(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('helpful', 'not_helpful', 'flagged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, answer_id)
);
ALTER TABLE IF EXISTS feed_answer_ratings ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_answer_ratings ADD COLUMN IF NOT EXISTS answer_id UUID;
ALTER TABLE IF EXISTS feed_answer_ratings ADD COLUMN IF NOT EXISTS rating TEXT NOT NULL DEFAULT 'helpful';
ALTER TABLE IF EXISTS feed_answer_ratings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS feed_answer_ratings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS llm_inference_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id TEXT NOT NULL,
  question_id UUID NOT NULL REFERENCES feed_questions(id) ON DELETE CASCADE,
  answer_id UUID NOT NULL REFERENCES feed_answers(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(5,4) NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  prompt_token_count INTEGER NOT NULL DEFAULT 0,
  completion_token_count INTEGER NOT NULL DEFAULT 0,
  total_token_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS actor_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS question_id UUID;
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS answer_id UUID;
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS model_id TEXT NOT NULL DEFAULT 'ctf-approved-sources-summarizer-v1';
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS request_payload JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS response_payload JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS sources JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,4) NULL;
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS latency_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS prompt_token_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS completion_token_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS total_token_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE IF EXISTS llm_inference_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS feed_community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id TEXT NOT NULL,
  author_username TEXT,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  moderation_status TEXT NOT NULL DEFAULT 'accepted',
  reply_count INTEGER NOT NULL DEFAULT 0,
  reply_to_post_id UUID REFERENCES feed_community_posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS feed_community_posts ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS feed_community_posts ADD COLUMN IF NOT EXISTS author_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_community_posts ADD COLUMN IF NOT EXISTS author_username TEXT;
ALTER TABLE IF EXISTS feed_community_posts ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_community_posts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';
ALTER TABLE IF EXISTS feed_community_posts ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'accepted';
-- Why a row was hidden, who hid it, and when (Commons moderation, 2026-07-29). Nullable and null on
-- every pre-existing row: these are only stamped when a moderator acts. The reason matters because the
-- day-to-day moderation problem is volume of OFF-TOPIC content — Quora-style discussion that is not
-- about the economy — so a sweep needs to record which judgment was applied, not just that something
-- was taken down. Reason is a short code from FEED_MODERATION_REASON, never free text about a member.
ALTER TABLE IF EXISTS feed_community_posts ADD COLUMN IF NOT EXISTS moderation_reason TEXT NULL;
ALTER TABLE IF EXISTS feed_community_posts ADD COLUMN IF NOT EXISTS moderated_by_user_id TEXT NULL;
ALTER TABLE IF EXISTS feed_community_posts ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS feed_community_posts ADD COLUMN IF NOT EXISTS reply_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS feed_community_posts ADD COLUMN IF NOT EXISTS reply_to_post_id UUID REFERENCES feed_community_posts(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS feed_community_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS feed_community_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Clear Commons timeline copies whose source row is gone (owner report, 2026-08-09).
-- Every community post and AI question is copied into a feed_items row that carries the same text.
-- Account deletion used to remove the post/question but keep the copy, so a deleted member's words
-- stayed on the Commons, re-labeled with the fallback handle built from the placeholder author id
-- ("user-hub-syst") — the same handle every time, so it looked like an anonymised post rather than a
-- deletion. The deletion registry now removes the copy with the source; this clears the ones already
-- left behind. Announcement copies carry neither source id and are untouched. Idempotent: a second
-- run matches nothing. Deleting a feed_items row cascades its targets, read state, and dismissals.
DELETE FROM feed_items f
WHERE (
        f.source_community_post_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM feed_community_posts p WHERE p.id = f.source_community_post_id)
      )
   OR (
        f.source_question_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM feed_questions q WHERE q.id = f.source_question_id)
      );

CREATE TABLE IF NOT EXISTS feed_community_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES feed_community_posts(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'accepted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS feed_community_replies ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS feed_community_replies ADD COLUMN IF NOT EXISTS post_id UUID;
ALTER TABLE IF EXISTS feed_community_replies ADD COLUMN IF NOT EXISTS author_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_community_replies ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_community_replies ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'accepted';
-- Why a row was hidden, who hid it, and when (Commons moderation, 2026-07-29). Nullable and null on
-- every pre-existing row: these are only stamped when a moderator acts. The reason matters because the
-- day-to-day moderation problem is volume of OFF-TOPIC content — Quora-style discussion that is not
-- about the economy — so a sweep needs to record which judgment was applied, not just that something
-- was taken down. Reason is a short code from FEED_MODERATION_REASON, never free text about a member.
ALTER TABLE IF EXISTS feed_community_replies ADD COLUMN IF NOT EXISTS moderation_reason TEXT NULL;
ALTER TABLE IF EXISTS feed_community_replies ADD COLUMN IF NOT EXISTS moderated_by_user_id TEXT NULL;
ALTER TABLE IF EXISTS feed_community_replies ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ NULL;

-- Commons guidance notices, published automatically on a cadence (owner decision, 2026-07-30). Three
-- notices with three different rhythms: what the Commons is for, how the public rooms work, and telling
-- signal from noise. One row per (notice, period) actually published.
--
-- `(notice_key, milestone_count)` is UNIQUE and that uniqueness IS the idempotency: two members posting
-- at the same moment across a boundary both compute the same period and both try to claim it, and the
-- second loses the ON CONFLICT DO NOTHING race and skips. `milestone_count` means the post count for a
-- post-count cadence, and the period index (days since epoch / interval) for a time cadence — one
-- mechanism serves both.
CREATE TABLE IF NOT EXISTS feed_commons_guidance_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_key TEXT NOT NULL DEFAULT 'commons_purpose',
  milestone_count INTEGER NOT NULL,
  announcement_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS feed_commons_guidance_milestones ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS feed_commons_guidance_milestones ADD COLUMN IF NOT EXISTS notice_key TEXT NOT NULL DEFAULT 'commons_purpose';
ALTER TABLE IF EXISTS feed_commons_guidance_milestones ADD COLUMN IF NOT EXISTS milestone_count INTEGER;
ALTER TABLE IF EXISTS feed_commons_guidance_milestones ADD COLUMN IF NOT EXISTS announcement_id UUID NULL;
ALTER TABLE IF EXISTS feed_commons_guidance_milestones ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Drop the single-column key from the first cut of this table so the composite one can take over.
DROP INDEX IF EXISTS feed_commons_guidance_milestones_count_key;
CREATE UNIQUE INDEX IF NOT EXISTS feed_commons_guidance_milestones_notice_period_key
  ON feed_commons_guidance_milestones (notice_key, milestone_count);

-- Which standing notices a member has already been shown once, on arrival (owner decision, 2026-07-30).
--
-- Separate from the cadence table because it answers a different question. The cadence table asks "has
-- this period been served for the room"; this asks "has THIS MEMBER seen it yet". The public-rooms notice
-- needs both: a member who posts before their first cadence hit could say something identifying without
-- ever having been told the room is readable by anyone. A rotation cannot fix that — only showing it on
-- arrival can.
CREATE TABLE IF NOT EXISTS feed_commons_notice_seen (
  user_id TEXT NOT NULL,
  notice_key TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, notice_key)
);
ALTER TABLE IF EXISTS feed_commons_notice_seen ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS feed_commons_notice_seen ADD COLUMN IF NOT EXISTS notice_key TEXT;
ALTER TABLE IF EXISTS feed_commons_notice_seen ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS feed_community_replies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS feed_community_replies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Emoji reactions on community (peer) posts. Stored in our own database (not Stream).
-- One row per (post, member, emoji) — the unique index makes a reaction a toggle: a second
-- tap of the same emoji removes the row. The emoji is constrained to a small fixed quick set
-- at the application layer (see FEED_REACTION_EMOJIS).
CREATE TABLE IF NOT EXISTS feed_community_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES feed_community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS feed_community_post_reactions ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS feed_community_post_reactions ADD COLUMN IF NOT EXISTS post_id UUID;
ALTER TABLE IF EXISTS feed_community_post_reactions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_community_post_reactions ADD COLUMN IF NOT EXISTS emoji TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_community_post_reactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Per-member "last seen" marker for the Commons home channel, used to draw a single
-- "New messages" divider where a member left off. One row per member; updated to NOW()
-- after the member views the chat. Best-effort: a read/write failure must never break chat.
--
-- Renamed from `feed_hub_last_seen` on 2026-08-09 with the rest of the hub → commons rename. The
-- rename MUST run before the CREATE TABLE below: otherwise `CREATE TABLE IF NOT EXISTS` would make
-- an empty `feed_commons_last_seen` first and every member's marker would be stranded in the old
-- table, resetting the unread divider for everyone. Guarded on both sides so it happens exactly
-- once and a re-run is a no-op.
DO $rename_feed_hub_last_seen$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'feed_hub_last_seen'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'feed_commons_last_seen'
  ) THEN
    ALTER TABLE feed_hub_last_seen RENAME TO feed_commons_last_seen;
    -- RENAME TO leaves the primary key named after the old table; rename it too so a later reader
    -- of \d output is not sent looking for a table that no longer exists.
    ALTER INDEX IF EXISTS feed_hub_last_seen_pkey RENAME TO feed_commons_last_seen_pkey;
  END IF;
END
$rename_feed_hub_last_seen$;

CREATE TABLE IF NOT EXISTS feed_commons_last_seen (
  user_id TEXT PRIMARY KEY,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS feed_commons_last_seen ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS feed_commons_last_seen ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Per-admin "last opened" marker for each admin area, powering the "new to review" dot on the admin
-- landing tiles. A dot shows for an area when its newest actionable item (a pending review, a new
-- report, etc.) is newer than this admin's marker for that area, or the admin has never opened it.
-- One row per (admin, area); updated to NOW() when the admin opens that area. Best-effort: a read or
-- write failure must never break the admin landing.
CREATE TABLE IF NOT EXISTS admin_area_seen (
  user_id TEXT NOT NULL,
  area_slug TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, area_slug)
);
ALTER TABLE IF EXISTS admin_area_seen ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS admin_area_seen ADD COLUMN IF NOT EXISTS area_slug TEXT;
ALTER TABLE IF EXISTS admin_area_seen ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_feed_questions_created_at ON feed_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_answers_question_created_at ON feed_answers(question_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_answer_ratings_answer_id ON feed_answer_ratings(answer_id);
CREATE INDEX IF NOT EXISTS idx_llm_inference_log_question_created_at ON llm_inference_log(question_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_community_posts_created_at ON feed_community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_community_posts_reply_to ON feed_community_posts(reply_to_post_id);
CREATE INDEX IF NOT EXISTS idx_feed_community_replies_post_created_at ON feed_community_replies(post_id, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_community_post_reactions_unique ON feed_community_post_reactions(post_id, user_id, emoji);
CREATE INDEX IF NOT EXISTS idx_feed_community_post_reactions_post ON feed_community_post_reactions(post_id);

-- === unlock tables (prod-compatible) ===
CREATE TABLE IF NOT EXISTS unlock_verification_submissions (
  user_id TEXT PRIMARY KEY,
  access_tier TEXT NOT NULL,
  incentive_granted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  id SERIAL,
  quora_profile_url TEXT NOT NULL,
  quora_profile_url_normalized TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('pending', 'approved', 'rejected', 'spam', 'duplicate')),
  unlock_window_expires_at TIMESTAMPTZ NOT NULL,
  reminder_stage INTEGER NOT NULL DEFAULT 0,
  reviewed_by_user_id TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  -- Duplicate-identity guard: a normalized Quora URL earns the verification reward on ONE account.
  -- When a second account is approved with a URL another account already holds, its reward is held
  -- (reward_withheld_at) for an admin determination instead of auto-granted. reward_revoked_at marks a
  -- reward an admin clawed back (the "loser" of a determination, or a perp).
  reward_withheld_at TIMESTAMPTZ,
  reward_revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns with guarded DDL for legacy DBs
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS access_tier TEXT;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS incentive_granted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS quora_profile_url TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS quora_profile_url_normalized TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS review_status TEXT;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS unlock_window_expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS reminder_stage INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS reviewed_by_user_id TEXT;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS reward_withheld_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS reward_revoked_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- The app upserts a submission with `ON CONFLICT (user_id)` (createOrUpdateUnlockSubmission). That
-- requires a unique constraint on user_id as the conflict target. schema.sql declares user_id as the
-- PRIMARY KEY, but on databases cloned with the primary key on `id` instead, the conflict target is
-- missing and every submission INSERT fails with "there is no unique or exclusion constraint matching
-- the ON CONFLICT specification" — which surfaces to members as the generic 503 "Unlock submission
-- unavailable." A unique index on user_id is a valid conflict target regardless of which column is
-- the primary key. Dedupe first (keep the most recently updated row per member) so the index can
-- build even if a legacy row pair slipped in; idempotent once there is one row per member.
DELETE FROM unlock_verification_submissions
WHERE ctid IN (
  SELECT ctid FROM (
    SELECT ctid, ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY updated_at DESC, id DESC
    ) AS rn
    FROM unlock_verification_submissions
  ) ranked
  WHERE ranked.rn > 1
);
-- Widen the review-status check to allow 'duplicate' on databases whose constraint predates it. One
-- Quora profile on two accounts under different emails is a common and ordinary thing, and it is not
-- spam: the person is real, they simply already have an account. It needed its own decision because
-- 'rejected' leaves them in the community with support access and 'spam' brands an honest member. Drop
-- + re-add is idempotent and keeps fresh and legacy schemas identical.
ALTER TABLE IF EXISTS unlock_verification_submissions
  DROP CONSTRAINT IF EXISTS unlock_verification_submissions_review_status_check;
ALTER TABLE IF EXISTS unlock_verification_submissions
  ADD CONSTRAINT unlock_verification_submissions_review_status_check
  CHECK (review_status IN ('pending', 'approved', 'rejected', 'spam', 'duplicate'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_unlock_verification_submissions_user_id
  ON unlock_verification_submissions (user_id);
-- Supports the duplicate-identity guard: find every account that has claimed a given normalized Quora
-- URL (and which one currently holds the reward) without scanning the table.
CREATE INDEX IF NOT EXISTS idx_unlock_verification_submissions_url_normalized
  ON unlock_verification_submissions (quora_profile_url_normalized);

-- Persistent spam denylist of normalized Quora profile URLs. When an admin marks a submission spam,
-- its normalized URL is recorded here. This serves two purposes: (1) a member's per-member submission
-- row is hard-deleted when they delete their account/data, but this denylist is deliberately keyed on
-- the URL (never on a member id) and retained for abuse prevention, so the spam URL survives that
-- deletion; (2) a fresh submission of a denylisted URL (even from a new account) is auto-marked spam at
-- submission time and never re-enters the review queue. A later approve/reject of the same URL removes
-- it here, so a mistaken spam mark is fully reversible.
CREATE TABLE IF NOT EXISTS unlock_spam_quora_urls (
  quora_profile_url_normalized TEXT PRIMARY KEY,
  quora_profile_url TEXT NOT NULL,
  flagged_by_user_id TEXT,
  flag_count INTEGER NOT NULL DEFAULT 1,
  first_flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS unlock_spam_quora_urls ADD COLUMN IF NOT EXISTS quora_profile_url TEXT;
ALTER TABLE IF EXISTS unlock_spam_quora_urls ADD COLUMN IF NOT EXISTS flagged_by_user_id TEXT;
ALTER TABLE IF EXISTS unlock_spam_quora_urls ADD COLUMN IF NOT EXISTS flag_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS unlock_spam_quora_urls ADD COLUMN IF NOT EXISTS first_flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS unlock_spam_quora_urls ADD COLUMN IF NOT EXISTS last_flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS unlock_spam_quora_urls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Accounts the Unlock admin's sign-up counters leave out: the owner's own demo/recording accounts and
-- any other test account. The Unlock admin reads the full sign-up roster from the auth provider so the
-- owner does not have to open the provider dashboard to see how many people have joined; those totals
-- are only useful once the handful of accounts that are not real members are taken out, and there is no
-- marker on the account itself that says so. An admin marks them here, one row per excluded account, and
-- every sign-up counter on that page subtracts them.
CREATE TABLE IF NOT EXISTS unlock_excluded_accounts (
  user_id TEXT PRIMARY KEY,
  note TEXT,
  excluded_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS unlock_excluded_accounts ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE IF EXISTS unlock_excluded_accounts ADD COLUMN IF NOT EXISTS excluded_by_user_id TEXT;
ALTER TABLE IF EXISTS unlock_excluded_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS unlock_excluded_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Members who asked for help from the Unlock screen instead of submitting a Quora URL. Pressing that
-- button is what lets them into the Commons (support-only) straight away, so there is somebody to ask.
-- Without a row here a first-time member has no submission, so no access tier, so no way to reach the
-- one surface where help lives — the wall and the help are on opposite sides of the same door.
--
-- One row per member, kept after they verify: it is also the record of how many people could not get
-- through the Quora step on their own, which is the number that says whether that step is working.
CREATE TABLE IF NOT EXISTS unlock_help_requests (
  user_id TEXT PRIMARY KEY,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS unlock_help_requests ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add prod unlock audit/config tables if missing.
-- `user_id` and `action` are nullable: the current writer (insertUnlockAudit) records the
-- actor_user_id/command/policy_status/reason columns and does NOT populate the legacy user_id/action
-- columns, so requiring them NOT NULL would make every audit INSERT fail (and, because the submission
-- route awaits the audit write, would turn an otherwise-successful submission into the same 503).
CREATE TABLE IF NOT EXISTS unlock_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  action TEXT,
  details JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id TEXT,
  command TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  policy_status TEXT,
  reason TEXT,
  request_id TEXT,
  target_user_id TEXT
);
-- Guarded DDL for legacy unlock_audit_log tables: make sure the columns the writer uses exist, and
-- drop the legacy NOT NULL on user_id/action (the writer does not populate them).
ALTER TABLE IF EXISTS unlock_audit_log ADD COLUMN IF NOT EXISTS actor_user_id TEXT;
ALTER TABLE IF EXISTS unlock_audit_log ADD COLUMN IF NOT EXISTS command TEXT;
ALTER TABLE IF EXISTS unlock_audit_log ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE IF EXISTS unlock_audit_log ADD COLUMN IF NOT EXISTS policy_status TEXT;
ALTER TABLE IF EXISTS unlock_audit_log ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE IF EXISTS unlock_audit_log ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE IF EXISTS unlock_audit_log ADD COLUMN IF NOT EXISTS target_user_id TEXT;
ALTER TABLE IF EXISTS unlock_audit_log ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS unlock_audit_log ALTER COLUMN action DROP NOT NULL;

CREATE TABLE IF NOT EXISTS unlock_runtime_config (
  singleton_id INTEGER PRIMARY KEY DEFAULT 1,
  submission_window_hours INTEGER DEFAULT 168 NOT NULL,
  reminder_schedule_hours INTEGER[] DEFAULT ARRAY[0, 24, 72, 168] NOT NULL,
  incentive_amount TEXT DEFAULT '100' NOT NULL,
  support_only_after_expiry BOOLEAN DEFAULT TRUE NOT NULL
);
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS reviewed_by_user_id TEXT;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS incentive_granted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS unlock_verification_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Duplicate CREATE TABLE blocks for unlock_audit_log and unlock_runtime_config
-- were removed here; the canonical definitions are above (unlock_audit_log
-- keeps its richer column set). The ALTER ... ADD COLUMN reconciliation for
-- unlock_runtime_config (for databases created before some columns existed)
-- follows.
ALTER TABLE IF EXISTS unlock_runtime_config ADD COLUMN IF NOT EXISTS singleton_id INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS unlock_runtime_config ADD COLUMN IF NOT EXISTS submission_window_hours INTEGER NOT NULL DEFAULT 168;
ALTER TABLE IF EXISTS unlock_runtime_config ADD COLUMN IF NOT EXISTS reminder_schedule_hours INTEGER[] NOT NULL DEFAULT ARRAY[0,24,72,168];
ALTER TABLE IF EXISTS unlock_runtime_config ADD COLUMN IF NOT EXISTS incentive_amount TEXT NOT NULL DEFAULT '100';
ALTER TABLE IF EXISTS unlock_runtime_config ADD COLUMN IF NOT EXISTS support_only_after_expiry BOOLEAN NOT NULL DEFAULT TRUE;
-- Multi-currency (issue #120): the verification incentive is an internal ServiceCredits payout.
-- incentive_currency names the currency of incentive_amount; it defaults to ServiceCredits (code 'SC').
ALTER TABLE IF EXISTS unlock_runtime_config ADD COLUMN IF NOT EXISTS incentive_currency TEXT NOT NULL DEFAULT 'SC' REFERENCES currencies(code);

-- Hyphenation/cleanup rename (2026-06-26): slug/folder/route became `level-up`; tables move to
-- the matching snake_case prefix `level_up_`. Kept verbatim: it is the path a database older than
-- 2026-06-26 still takes before the SkillUp rename below picks it up.
ALTER TABLE IF EXISTS levelup_enrollments RENAME TO level_up_enrollments;
ALTER TABLE IF EXISTS levelup_cohorts RENAME TO level_up_cohorts;
ALTER TABLE IF EXISTS levelup_curriculum_items RENAME TO level_up_curriculum_items;
ALTER TABLE IF EXISTS levelup_milestones RENAME TO level_up_milestones;
ALTER TABLE IF EXISTS levelup_command_idempotency RENAME TO level_up_command_idempotency;
ALTER TABLE IF EXISTS levelup_audit_events RENAME TO level_up_audit_events;
ALTER TABLE IF EXISTS levelup_rate_limit_counters RENAME TO level_up_rate_limit_counters;
ALTER TABLE IF EXISTS levelup_enrollment_milestone_escrows RENAME TO level_up_enrollment_milestone_escrows;
ALTER TABLE IF EXISTS levelup_milestone_validations RENAME TO level_up_milestone_validations;
ALTER TABLE IF EXISTS levelup_disputes RENAME TO level_up_disputes;
ALTER TABLE IF EXISTS levelup_dispute_comments RENAME TO level_up_dispute_comments;
ALTER TABLE IF EXISTS levelup_disbursements RENAME TO level_up_disbursements;
ALTER TABLE IF EXISTS levelup_trainers RENAME TO level_up_trainers;
ALTER TABLE IF EXISTS levelup_achievements RENAME TO level_up_achievements;
ALTER TABLE IF EXISTS levelup_user_achievements RENAME TO level_up_user_achievements;

-- Brand rename (2026-08-29): the plugin is now SkillUp, so every table moves from the
-- `level_up_` prefix to `skill_up_`. This runs AFTER the 2026-06-26 block above so all three
-- database generations land in the same place: a database older than 2026-06-26 goes
-- `levelup_` -> `level_up_` -> `skill_up_`, a current database goes `level_up_` -> `skill_up_`,
-- and a fresh database no-ops through both and is built by the CREATE statements below.
-- The three tables added after 2026-06-26 (auto_cohort_config, auto_cohort_term_overrides,
-- cohort_proposals) only ever carried the `level_up_` prefix, so they appear here only.
ALTER TABLE IF EXISTS level_up_enrollments RENAME TO skill_up_enrollments;
ALTER TABLE IF EXISTS level_up_cohorts RENAME TO skill_up_cohorts;
ALTER TABLE IF EXISTS level_up_curriculum_items RENAME TO skill_up_curriculum_items;
ALTER TABLE IF EXISTS level_up_milestones RENAME TO skill_up_milestones;
ALTER TABLE IF EXISTS level_up_command_idempotency RENAME TO skill_up_command_idempotency;
ALTER TABLE IF EXISTS level_up_audit_events RENAME TO skill_up_audit_events;
ALTER TABLE IF EXISTS level_up_rate_limit_counters RENAME TO skill_up_rate_limit_counters;
ALTER TABLE IF EXISTS level_up_enrollment_milestone_escrows RENAME TO skill_up_enrollment_milestone_escrows;
ALTER TABLE IF EXISTS level_up_milestone_validations RENAME TO skill_up_milestone_validations;
ALTER TABLE IF EXISTS level_up_disputes RENAME TO skill_up_disputes;
ALTER TABLE IF EXISTS level_up_dispute_comments RENAME TO skill_up_dispute_comments;
ALTER TABLE IF EXISTS level_up_disbursements RENAME TO skill_up_disbursements;
ALTER TABLE IF EXISTS level_up_trainers RENAME TO skill_up_trainers;
ALTER TABLE IF EXISTS level_up_achievements RENAME TO skill_up_achievements;
ALTER TABLE IF EXISTS level_up_user_achievements RENAME TO skill_up_user_achievements;
ALTER TABLE IF EXISTS level_up_auto_cohort_config RENAME TO skill_up_auto_cohort_config;
ALTER TABLE IF EXISTS level_up_auto_cohort_term_overrides RENAME TO skill_up_auto_cohort_term_overrides;
ALTER TABLE IF EXISTS level_up_cohort_proposals RENAME TO skill_up_cohort_proposals;

-- === skill_up_enrollments table (guarded DDL, schema drift prevention) ===
CREATE TABLE IF NOT EXISTS skill_up_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  -- 'enrolled' is the value the enrollment insert actually writes; it was missing from this list, so
  -- on a brand-new database every enrollment failed the check while the long-running database (whose
  -- table predates this block) accepted them. 'active' stays for the rows written before the value
  -- changed — both count as a live enrollment everywhere in the code.
  status TEXT NOT NULL CHECK (status IN ('enrolled', 'active', 'completed', 'dropped', 'pending')),
  credits_deposited INTEGER NOT NULL DEFAULT 0,
  assigned_trainer_id TEXT,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  progress_percent NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cohort_id, user_id)
);
ALTER TABLE IF EXISTS skill_up_enrollments ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skill_up_enrollments ADD COLUMN IF NOT EXISTS cohort_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skill_up_enrollments ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_enrollments ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE IF EXISTS skill_up_enrollments ADD COLUMN IF NOT EXISTS credits_deposited INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_enrollments ADD COLUMN IF NOT EXISTS assigned_trainer_id TEXT;
-- enrolled_at: when the member joined. It exists on the long-running database (it came over with the
-- legacy `levelup_enrollments` table) but was never declared here, so a database built from this file
-- lacked it while three live reads order or measure by it — the admin lead-time number, the trainer
-- trainee list, and the member's own enrollment list.
ALTER TABLE IF EXISTS skill_up_enrollments ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skill_up_enrollments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skill_up_enrollments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Add unique constraint if not exists (Postgres 15+)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'skill_up_enrollments' AND indexname = 'skill_up_enrollments_cohort_id_user_id_key' AND schemaname = current_schema()
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS skill_up_enrollments_cohort_id_user_id_key ON skill_up_enrollments(cohort_id, user_id)';
  END IF;
END $$;
-- Shed the legacy level_id column if an older database still carries it.
-- It was NOT NULL with no default, so cohort-based inserts (which never set
-- it) failed. Dropping the column also removes its dependent
-- uq_skill_up_enrollments_user_level index. Safe no-op on databases that
-- never had the legacy column.
ALTER TABLE IF EXISTS skill_up_enrollments DROP COLUMN IF EXISTS level_id;
-- Hyphenation/cleanup rename (2026-06-26): slug/folder/route became `trust-transport`; tables move to
-- the matching snake_case prefix `trust_transport_`. Renames run first so an existing DB keeps its data;
-- on a fresh DB the IF EXISTS renames are no-ops and the CREATE statements below build the new names.
ALTER TABLE IF EXISTS trusttransport_requests RENAME TO trust_transport_requests;
ALTER TABLE IF EXISTS trusttransport_status_events RENAME TO trust_transport_status_events;
ALTER TABLE IF EXISTS trusttransport_offers RENAME TO trust_transport_offers;
ALTER TABLE IF EXISTS trusttransport_trips RENAME TO trust_transport_trips;
ALTER TABLE IF EXISTS trusttransport_risk_signals RENAME TO trust_transport_risk_signals;
ALTER TABLE IF EXISTS trusttransport_disputes RENAME TO trust_transport_disputes;
-- Ratings removed (owner directive: rating of people is not allowed). Drop the table on any database
-- that still carries it, under either the legacy or current name. This deletes stored rating rows by
-- design; the feature was backend-only and never surfaced in the app.
DROP TABLE IF EXISTS trust_transport_ratings;
DROP TABLE IF EXISTS trusttransport_ratings;
ALTER TABLE IF EXISTS trusttransport_market_config RENAME TO trust_transport_market_config;
ALTER TABLE IF EXISTS trusttransport_user_extension RENAME TO trust_transport_user_extension;
ALTER TABLE IF EXISTS trusttransport_proof_artifacts RENAME TO trust_transport_proof_artifacts;
ALTER TABLE IF EXISTS trusttransport_payout_requests RENAME TO trust_transport_payout_requests;
ALTER TABLE IF EXISTS trusttransport_earnings_ledger RENAME TO trust_transport_earnings_ledger;
ALTER TABLE IF EXISTS trusttransport_admin_audit_trail RENAME TO trust_transport_admin_audit_trail;
-- Drop the legacy-named price-consistency CHECK constraint if an older DB still carries it; the
-- DO-block further down recreates it under the new `trust_transport_requests_price_consistency_check`
-- name. Safe no-op on a fresh DB that never had the old constraint.
ALTER TABLE IF EXISTS trust_transport_requests DROP CONSTRAINT IF EXISTS trusttransport_requests_price_consistency_check;
CREATE TABLE IF NOT EXISTS trust_transport_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  pickup_city TEXT,
  dropoff_city TEXT,
  pickup_geo_redacted TEXT,
  dropoff_geo_redacted TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- How the requester will settle the ride (issue #420): the chosen value type + an optional amount.
-- "Free" (asking for a free ride — valid mutual aid) and "Barter" carry no amount; priced types
-- (ServiceCredits, fiat, crypto) carry a positive amount. Both NULL means none was chosen.
ALTER TABLE IF EXISTS trust_transport_requests ADD COLUMN IF NOT EXISTS price_amount NUMERIC;
ALTER TABLE IF EXISTS trust_transport_requests ADD COLUMN IF NOT EXISTS price_currency TEXT REFERENCES currencies(code);
ALTER TABLE IF EXISTS trust_transport_requests DROP CONSTRAINT IF EXISTS trust_transport_requests_price_consistency_check;
DO $trust_transport_requests_price_consistency$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'trust_transport_requests_price_consistency_check' AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE trust_transport_requests
      ADD CONSTRAINT trust_transport_requests_price_consistency_check
      CHECK (
        (price_amount IS NULL AND price_currency IS NULL) OR
        (price_currency IS NOT NULL AND (price_amount IS NULL OR price_amount > 0))
      );
  END IF;
END
$trust_transport_requests_price_consistency$;
-- Accepted currencies (split settlements): every currency the requester can settle the ride in,
-- independent of the single listed price above — one row per accepted code, mirroring
-- lighthouse_property_accepted_currencies and socket_relay_request_accepted_currencies.
CREATE TABLE IF NOT EXISTS trust_transport_request_accepted_currencies (
  request_id UUID NOT NULL REFERENCES trust_transport_requests(id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  PRIMARY KEY (request_id, currency_code)
);
ALTER TABLE IF EXISTS trust_transport_request_accepted_currencies ADD COLUMN IF NOT EXISTS request_id UUID;
ALTER TABLE IF EXISTS trust_transport_request_accepted_currencies ADD COLUMN IF NOT EXISTS currency_code TEXT;
CREATE INDEX IF NOT EXISTS idx_trust_transport_request_accepted_currencies_request ON trust_transport_request_accepted_currencies(request_id);
-- === foundation_capacity_policies ===
CREATE TABLE IF NOT EXISTS foundation_capacity_policies (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  max_active_threads_per_user INTEGER NOT NULL DEFAULT 20,
  max_messages_per_minute INTEGER NOT NULL DEFAULT 20,
  max_searches_per_minute INTEGER NOT NULL DEFAULT 40,
  max_quote_transitions_per_minute INTEGER NOT NULL DEFAULT 20,
  max_call_duration_minutes INTEGER NOT NULL DEFAULT 45,
  quota_state TEXT NOT NULL DEFAULT 'green' CHECK (quota_state IN ('green', 'yellow', 'orange', 'red')),
  updated_by_user_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS foundation_capacity_policies ADD COLUMN IF NOT EXISTS singleton_key BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS foundation_capacity_policies ADD COLUMN IF NOT EXISTS max_active_threads_per_user INTEGER NOT NULL DEFAULT 20;
ALTER TABLE IF EXISTS foundation_capacity_policies ADD COLUMN IF NOT EXISTS max_messages_per_minute INTEGER NOT NULL DEFAULT 20;
ALTER TABLE IF EXISTS foundation_capacity_policies ADD COLUMN IF NOT EXISTS max_searches_per_minute INTEGER NOT NULL DEFAULT 40;
ALTER TABLE IF EXISTS foundation_capacity_policies ADD COLUMN IF NOT EXISTS max_quote_transitions_per_minute INTEGER NOT NULL DEFAULT 20;
ALTER TABLE IF EXISTS foundation_capacity_policies ADD COLUMN IF NOT EXISTS max_call_duration_minutes INTEGER NOT NULL DEFAULT 45;
ALTER TABLE IF EXISTS foundation_capacity_policies ADD COLUMN IF NOT EXISTS quota_state TEXT DEFAULT 'green';
ALTER TABLE IF EXISTS foundation_capacity_policies ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT;
ALTER TABLE IF EXISTS foundation_capacity_policies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Removed feature: drop the legacy kill-switch column if a prior DB created it.
ALTER TABLE IF EXISTS foundation_capacity_policies DROP COLUMN IF EXISTS kill_switch_enabled;
-- === foundation_capacity_policy_events ===
-- Append-only audit log of each capacity-policy change (issue #1960). The policy itself is a singleton
-- row; this records who changed it, to what values, and when — with a monotonic policy_version — so the
-- admin update has a real audit trail (the command contract's policyVersion/activatedAt outputs and its
-- capacity_policy_event_log audit reference this table).
CREATE TABLE IF NOT EXISTS foundation_capacity_policy_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version INTEGER NOT NULL UNIQUE,
  max_active_threads_per_user INTEGER NOT NULL,
  max_messages_per_minute INTEGER NOT NULL,
  max_searches_per_minute INTEGER NOT NULL,
  max_quote_transitions_per_minute INTEGER NOT NULL,
  max_call_duration_minutes INTEGER NOT NULL,
  quota_state TEXT NOT NULL CHECK (quota_state IN ('green', 'yellow', 'orange', 'red')),
  changed_by_user_id TEXT,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS foundation_capacity_policy_events ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS foundation_capacity_policy_events ADD COLUMN IF NOT EXISTS policy_version INTEGER;
ALTER TABLE IF EXISTS foundation_capacity_policy_events ADD COLUMN IF NOT EXISTS max_active_threads_per_user INTEGER;
ALTER TABLE IF EXISTS foundation_capacity_policy_events ADD COLUMN IF NOT EXISTS max_messages_per_minute INTEGER;
ALTER TABLE IF EXISTS foundation_capacity_policy_events ADD COLUMN IF NOT EXISTS max_searches_per_minute INTEGER;
ALTER TABLE IF EXISTS foundation_capacity_policy_events ADD COLUMN IF NOT EXISTS max_quote_transitions_per_minute INTEGER;
ALTER TABLE IF EXISTS foundation_capacity_policy_events ADD COLUMN IF NOT EXISTS max_call_duration_minutes INTEGER;
ALTER TABLE IF EXISTS foundation_capacity_policy_events ADD COLUMN IF NOT EXISTS quota_state TEXT;
ALTER TABLE IF EXISTS foundation_capacity_policy_events ADD COLUMN IF NOT EXISTS changed_by_user_id TEXT;
ALTER TABLE IF EXISTS foundation_capacity_policy_events ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_foundation_capacity_policy_events_activated_at
  ON foundation_capacity_policy_events (activated_at DESC);
CREATE TABLE IF NOT EXISTS trust_transport_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES trust_transport_requests(id) ON DELETE CASCADE,
  trip_id UUID,
  actor_user_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS trust_transport_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES trust_transport_requests(id) ON DELETE CASCADE,
  provider_user_id TEXT NOT NULL,
  note TEXT,
  proposed_amount INTEGER,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS trust_transport_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES trust_transport_requests(id) ON DELETE CASCADE,
  offer_id UUID,
  requester_user_id TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  stream_channel_id TEXT,
  canceled_reason TEXT,
  completed_at TIMESTAMPTZ,
  requester_completion_confirmed_at TIMESTAMPTZ,
  provider_completion_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS trust_transport_risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID,
  trip_id UUID,
  actor_user_id TEXT NOT NULL,
  target_user_id TEXT,
  signal_type TEXT NOT NULL,
  severity TEXT,
  notes TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by_user_id TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS trust_transport_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID,
  request_id UUID,
  opened_by_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS trust_transport_market_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS trust_transport_user_extension (
  user_id TEXT PRIMARY KEY,
  availability_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  work_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  service_deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS trust_transport_proof_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trust_transport_trips(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  artifact_redacted TEXT,
  captured_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS trust_transport_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS trust_transport_earnings_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id TEXT NOT NULL,
  trip_id UUID,
  entry_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Multi-currency (issue #120): model the settlement currency as an admin-curated, referenced code.
-- The legacy free-text `currency` column is superseded by `price_currency` (FK -> currencies.code), which
-- the GDP estimation layer (issue #121) reads. Existing rows are backfilled from `currency` only where it
-- already matches a known code; unknown legacy values are left for manual reconciliation so no money data
-- is overwritten. This never asserts a ServiceCredits<->fiat parity.
ALTER TABLE IF EXISTS trust_transport_payout_requests ADD COLUMN IF NOT EXISTS price_currency TEXT REFERENCES currencies(code);
ALTER TABLE IF EXISTS trust_transport_earnings_ledger ADD COLUMN IF NOT EXISTS price_currency TEXT REFERENCES currencies(code);
UPDATE trust_transport_payout_requests SET price_currency = currency
  WHERE price_currency IS NULL AND currency IN (SELECT code FROM currencies);
UPDATE trust_transport_earnings_ledger SET price_currency = currency
  WHERE price_currency IS NULL AND currency IN (SELECT code FROM currencies);
-- Earnings/payout money precision + trip linkage (issue #1233): amounts must hold fractional currency
-- (e.g. 24.50), and a settlement credit is linked to its trip for idempotency. Widen the legacy INTEGER
-- amount columns to NUMERIC and add the earnings-ledger trip_id on existing databases.
ALTER TABLE IF EXISTS trust_transport_earnings_ledger ADD COLUMN IF NOT EXISTS trip_id UUID;
ALTER TABLE IF EXISTS trust_transport_earnings_ledger ALTER COLUMN amount TYPE NUMERIC USING amount::numeric;
ALTER TABLE IF EXISTS trust_transport_payout_requests ALTER COLUMN amount TYPE NUMERIC USING amount::numeric;
CREATE TABLE IF NOT EXISTS trust_transport_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- === workforce tables ===
CREATE TABLE IF NOT EXISTS workforce_profiles (
  user_id TEXT PRIMARY KEY,
  occupation_id UUID NOT NULL,
  skill_level TEXT NOT NULL,
  region TEXT NOT NULL,
  recruited_state BOOLEAN NOT NULL DEFAULT FALSE,
  recruited_resolved_at TIMESTAMPTZ,
  updated_by_user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- workforce_occupations is no longer read or written by the Workforce plugin: occupations are read
-- live from Skills Taxonomy (job titles), and Workforce never creates them. The SkillsHunt rare-skill
-- snapshot stopped reading it on 2026-08-27 (it uses the live gap model now); the remaining reference
-- is the demo seed (ctf/scripts/seedDemo.mjs) — do not drop it without updating that consumer.
CREATE TABLE IF NOT EXISTS workforce_occupations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS workforce_user_extension (
  user_id TEXT PRIMARY KEY,
  availability_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  work_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  service_deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS workforce_recruited_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Workforce config is the plugin's own (admin-editable) population model. Demand is derived as
-- population * participation_rate, distributed across sectors by each sector's Skills Taxonomy
-- workforce share. This config is never written to Directory or Skills Taxonomy.
CREATE TABLE IF NOT EXISTS workforce_config (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  population NUMERIC NOT NULL DEFAULT 5000000,
  participation_rate NUMERIC NOT NULL DEFAULT 0.5,
  min_recruitable NUMERIC NOT NULL DEFAULT 2000000,
  max_recruitable NUMERIC NOT NULL DEFAULT 5000000,
  updated_by_user_id TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- New population-model columns (idempotent add) and removal of retired columns. The export toggle and
-- report-week settings were removed when workforce became a read-only live tracker; the legacy
-- kill-switch column is also dropped if a prior DB created it.
ALTER TABLE IF EXISTS workforce_config ADD COLUMN IF NOT EXISTS population NUMERIC NOT NULL DEFAULT 5000000;
ALTER TABLE IF EXISTS workforce_config ADD COLUMN IF NOT EXISTS participation_rate NUMERIC NOT NULL DEFAULT 0.5;
ALTER TABLE IF EXISTS workforce_config ADD COLUMN IF NOT EXISTS min_recruitable NUMERIC NOT NULL DEFAULT 2000000;
ALTER TABLE IF EXISTS workforce_config ADD COLUMN IF NOT EXISTS max_recruitable NUMERIC NOT NULL DEFAULT 5000000;
ALTER TABLE IF EXISTS workforce_config ALTER COLUMN updated_by_user_id SET DEFAULT 'system';
ALTER TABLE IF EXISTS workforce_config DROP COLUMN IF EXISTS kill_switch_enabled;
ALTER TABLE IF EXISTS workforce_config DROP COLUMN IF EXISTS exports_enabled;
ALTER TABLE IF EXISTS workforce_config DROP COLUMN IF EXISTS report_week_timezone;
ALTER TABLE IF EXISTS workforce_config DROP COLUMN IF EXISTS report_week_start_dow;
CREATE TABLE IF NOT EXISTS workforce_recruited_sync_cursor (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  last_cursor_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Service-scoped deletion event log for DELETE /api/workforce/profile (deletion contract section 8).
CREATE TABLE IF NOT EXISTS workforce_deletion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  result TEXT NOT NULL,
  request_id TEXT,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS workforce_deletion_events ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS workforce_deletion_events ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS workforce_deletion_events ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS workforce_deletion_events ADD COLUMN IF NOT EXISTS plugin_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS workforce_deletion_events ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS workforce_deletion_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS workforce_deletion_events ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS workforce_deletion_events ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE IF EXISTS workforce_deletion_events ADD COLUMN IF NOT EXISTS trace_id TEXT;
ALTER TABLE IF EXISTS workforce_deletion_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === ServiceCredits tables ===
CREATE TABLE IF NOT EXISTS service_credits_wallets (
  user_id TEXT PRIMARY KEY,
  available_balance NUMERIC NOT NULL DEFAULT 0,
  escrow_balance NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Wallet freeze (trust & safety): a frozen wallet cannot spend on either rail. Distinct from the
-- mutual-credit limit, which only bounds going negative.
ALTER TABLE IF EXISTS service_credits_wallets ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS service_credits_wallets ADD COLUMN IF NOT EXISTS frozen_reason TEXT;
ALTER TABLE IF EXISTS service_credits_wallets ADD COLUMN IF NOT EXISTS frozen_by_user_id TEXT;
ALTER TABLE IF EXISTS service_credits_wallets ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS service_credits_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  origin_plugin TEXT,
  reason_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- origin_plugin records which surface initiated the transfer: 'service-credits' for a direct member
-- send from the ServiceCredits "Send Credits" form, or the plugin slug when a plugin feature moved the
-- credits (e.g. 'chyme' for a tip, 'foundation' for a call charge). reason_code is the finer intent.
-- These let GDP recognition count only genuine direct peer-to-peer economic activity and attribute
-- plugin-mediated transfers to each plugin, instead of blindly summing the ledger (issue: GDP scope).
ALTER TABLE IF EXISTS service_credits_transfers ADD COLUMN IF NOT EXISTS origin_plugin TEXT;
ALTER TABLE IF EXISTS service_credits_transfers ADD COLUMN IF NOT EXISTS reason_code TEXT;
CREATE TABLE IF NOT EXISTS service_credits_command_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command TEXT NOT NULL,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS service_credits_adapter_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS service_credits_escrow_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_user_id TEXT NOT NULL,
  transfer_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS service_credits_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  accounting_scope TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS service_credits_governance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS service_credits_treasury_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS service_credits_wallet_tombstones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  final_available_balance NUMERIC NOT NULL,
  final_escrow_balance NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS service_credits_account_deletion_reclaims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  amount_transferred NUMERIC NOT NULL,
  transfer_id UUID,
  tombstone_id UUID,
  provider_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS service_credits_dispute_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL,
  adjustment_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS service_credits_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS service_credits_treasury_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_user_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS service_credits_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL,
  opened_by_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Per-account mutual-credit limit: the most negative a wallet's available_balance may reach is
-- -credit_limit. Absent a row, the member's limit is the treasury policy mutualCredit.defaultLimit.
CREATE TABLE IF NOT EXISTS service_credits_credit_limits (
  user_id TEXT PRIMARY KEY,
  credit_limit NUMERIC NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  updated_by_user_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS service_credits_credit_limits ADD COLUMN IF NOT EXISTS credit_limit NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS service_credits_credit_limits ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT;
ALTER TABLE IF EXISTS service_credits_credit_limits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Enforce non-negative limits on legacy tables too (idempotent; the constraint inverts floor behavior if negative).
DO $service_credits_credit_limits_non_negative$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'service_credits_credit_limits_credit_limit_check' AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE service_credits_credit_limits
      ADD CONSTRAINT service_credits_credit_limits_credit_limit_check
      CHECK (credit_limit >= 0);
  END IF;
END
$service_credits_credit_limits_non_negative$;

-- === lighthouse-core ===
CREATE TABLE IF NOT EXISTS lighthouse_user_extension (
  user_id TEXT PRIMARY KEY,
  service_deleted_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lighthouse_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('seeker', 'host')),
  bio TEXT NULL,
  phone_number TEXT NULL,
  signal_url TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  has_property BOOLEAN NOT NULL DEFAULT FALSE,
  housing_needs TEXT NULL,
  desired_move_in_date DATE NULL,
  budget_min NUMERIC NULL,
  budget_max NUMERIC NULL,
  desired_country TEXT NULL,
  service_deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lighthouse_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  property_type TEXT NULL,
  address_line TEXT NULL,
  city TEXT NULL,
  state TEXT NULL,
  country TEXT NULL,
  zip_code TEXT NULL,
  bedrooms INTEGER NULL,
  bathrooms NUMERIC NULL,
  monthly_rent NUMERIC NULL,
  available_from DATE NULL,
  amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
  house_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  airbnb_profile_url TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Multi-currency (issue #120): monthly_rent is the listed amount; rent_currency names its currency.
-- "Accepts ServiceCredits" (and any other accepted currency) is a SEPARATE field, never derived from
-- rent_currency. A fiat rent shown beside an "Accepts ServiceCredits" badge is two distinct fields.
ALTER TABLE IF EXISTS lighthouse_properties ADD COLUMN IF NOT EXISTS rent_currency TEXT REFERENCES currencies(code);
-- Backfill: everything to date is USD; Canadian rows with no cost yet keep NULL rent (no currency).
UPDATE lighthouse_properties SET rent_currency = 'USD' WHERE monthly_rent IS NOT NULL AND rent_currency IS NULL;

CREATE TABLE IF NOT EXISTS lighthouse_property_accepted_currencies (
  property_id UUID NOT NULL REFERENCES lighthouse_properties(id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  PRIMARY KEY (property_id, currency_code)
);
ALTER TABLE IF EXISTS lighthouse_property_accepted_currencies ADD COLUMN IF NOT EXISTS property_id UUID;
ALTER TABLE IF EXISTS lighthouse_property_accepted_currencies ADD COLUMN IF NOT EXISTS currency_code TEXT;
CREATE INDEX IF NOT EXISTS idx_lighthouse_property_accepted_currencies_property ON lighthouse_property_accepted_currencies(property_id);

CREATE TABLE IF NOT EXISTS lighthouse_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES lighthouse_properties(id) ON DELETE CASCADE,
  seeker_user_id TEXT NOT NULL,
  host_user_id TEXT NOT NULL,
  message TEXT NULL,
  proposed_move_in_date DATE NULL,
  host_response TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'canceled', 'completed')),
  stream_channel_id TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lighthouse_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id TEXT NOT NULL,
  blocked_user_id TEXT NOT NULL,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);

CREATE TABLE IF NOT EXISTS lighthouse_admin_audit_trail (
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

ALTER TABLE IF EXISTS lighthouse_user_extension
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS service_deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS lighthouse_profiles
  ADD COLUMN IF NOT EXISTS id UUID,
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS profile_type TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT NULL,
  ADD COLUMN IF NOT EXISTS phone_number TEXT NULL,
  ADD COLUMN IF NOT EXISTS signal_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS has_property BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS housing_needs TEXT NULL,
  ADD COLUMN IF NOT EXISTS desired_move_in_date DATE NULL,
  ADD COLUMN IF NOT EXISTS budget_min NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS budget_max NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS desired_country TEXT NULL,
  ADD COLUMN IF NOT EXISTS service_deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'demo'
      AND table_name = 'lighthouse_profiles'
      AND column_name = 'move_in_date'
  ) THEN
    EXECUTE '
      UPDATE lighthouse_profiles
      SET desired_move_in_date = COALESCE(desired_move_in_date, move_in_date::date)
      WHERE move_in_date IS NOT NULL
    ';
  END IF;
END
$$;

ALTER TABLE IF EXISTS lighthouse_properties
  ADD COLUMN IF NOT EXISTS id UUID,
  ADD COLUMN IF NOT EXISTS host_user_id TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS property_type TEXT NULL,
  ADD COLUMN IF NOT EXISTS address_line TEXT NULL,
  ADD COLUMN IF NOT EXISTS city TEXT NULL,
  ADD COLUMN IF NOT EXISTS state TEXT NULL,
  ADD COLUMN IF NOT EXISTS country TEXT NULL,
  ADD COLUMN IF NOT EXISTS zip_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS bedrooms INTEGER NULL,
  ADD COLUMN IF NOT EXISTS bathrooms NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS monthly_rent NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS available_from DATE NULL,
  ADD COLUMN IF NOT EXISTS amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS house_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS airbnb_profile_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_by_user_id TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS lighthouse_matches
  ADD COLUMN IF NOT EXISTS id UUID,
  ADD COLUMN IF NOT EXISTS property_id UUID,
  ADD COLUMN IF NOT EXISTS seeker_user_id TEXT,
  ADD COLUMN IF NOT EXISTS host_user_id TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT NULL,
  ADD COLUMN IF NOT EXISTS proposed_move_in_date DATE NULL,
  ADD COLUMN IF NOT EXISTS host_response TEXT NULL,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS stream_channel_id TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS lighthouse_blocks
  ADD COLUMN IF NOT EXISTS id UUID,
  ADD COLUMN IF NOT EXISTS blocker_user_id TEXT,
  ADD COLUMN IF NOT EXISTS blocked_user_id TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS lighthouse_admin_audit_trail
  ADD COLUMN IF NOT EXISTS id UUID,
  ADD COLUMN IF NOT EXISTS actor_id TEXT,
  ADD COLUMN IF NOT EXISTS command TEXT,
  ADD COLUMN IF NOT EXISTS policy_status TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS target_type TEXT,
  ADD COLUMN IF NOT EXISTS target_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_lighthouse_profiles_profile_type ON lighthouse_profiles(profile_type);
CREATE INDEX IF NOT EXISTS idx_lighthouse_profiles_updated_at ON lighthouse_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lighthouse_properties_host_user_id ON lighthouse_properties(host_user_id);
CREATE INDEX IF NOT EXISTS idx_lighthouse_properties_updated_at ON lighthouse_properties(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lighthouse_matches_property_id ON lighthouse_matches(property_id);
CREATE INDEX IF NOT EXISTS idx_lighthouse_matches_seeker_user_id ON lighthouse_matches(seeker_user_id);
CREATE INDEX IF NOT EXISTS idx_lighthouse_matches_host_user_id ON lighthouse_matches(host_user_id);
CREATE INDEX IF NOT EXISTS idx_lighthouse_matches_status ON lighthouse_matches(status);
CREATE INDEX IF NOT EXISTS idx_lighthouse_matches_updated_at ON lighthouse_matches(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lighthouse_admin_audit_trail_created_at ON lighthouse_admin_audit_trail(created_at DESC);

-- === plugin-registry-phase-deprecation ===
ALTER TABLE IF EXISTS ctf_plugin_registry DROP COLUMN IF EXISTS phase;
ALTER TABLE IF EXISTS ctf_plugin_registry DROP COLUMN IF EXISTS start_gate;

-- ============================================================
-- Schema Drift Batch Fix (2026-04-02)
-- Adds 64 missing tables + 87 missing columns
-- Generated by audit-schema-queries.mjs cross-referencing
-- ctf/packages/web/ SQL queries against schema.sql
-- ============================================================

-- === ANNOUNCEMENTS (feed module) ===
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  schedule_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  targeting JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Optional plugin this announcement points at. When set, the published feed item gets an
  -- "Open <Plugin>" link to /apps/<slug> so a reader can jump straight to the referenced app.
  -- Legacy single-link column; kept for back-compat and mirrored to the first entry of
  -- linked_plugin_slugs. New code reads/writes linked_plugin_slugs (up to 3 links).
  linked_plugin_slug TEXT,
  -- Ordered list of plugin slugs this announcement links to (0–3). The published feed item and the
  -- announcement card render one "Open <Plugin>" affordance per entry, in order.
  linked_plugin_slugs JSONB NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE IF EXISTS announcements ADD COLUMN IF NOT EXISTS id UUID;
-- Repair legacy tables where `id` was added (above) before it had a default. Without a default, an
-- INSERT that omits id stored NULL; the dependent announcement_revisions insert then failed on its
-- NOT NULL announcement_id, so "Create draft" returned "Unable to create announcement draft.". Set
-- the default, backfill any NULL ids, and enforce NOT NULL so drafts can be created on legacy DBs.
-- All three statements are no-ops on a fresh DB (CREATE TABLE already gives id a default + PK).
ALTER TABLE IF EXISTS announcements ALTER COLUMN id SET DEFAULT gen_random_uuid();
UPDATE announcements SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE IF EXISTS announcements ALTER COLUMN id SET NOT NULL;
-- Convert a legacy text/varchar id column to uuid. schema.sql declares announcements.id UUID, but
-- some legacy databases stored it as text. Publish, archive and edit-draft all run
-- `WHERE id = $1::uuid`, which errors on a text column ("operator does not exist: character varying
-- = uuid") and surfaced as "Unable to publish announcement.". Every stored id is a uuid string
-- (gen_random_uuid default), so the in-place cast is lossless. Guarded so it only runs when the
-- column is not already uuid; a no-op on a fresh DB (id is uuid from CREATE TABLE).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'demo' AND table_name = 'announcements' AND column_name = 'id' AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE announcements ALTER COLUMN id TYPE uuid USING id::uuid;
    ALTER TABLE announcements ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
END $$;
ALTER TABLE IF EXISTS announcements ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS announcements ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS announcements ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS announcements ADD COLUMN IF NOT EXISTS schedule_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS announcements ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS announcements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS announcements ADD COLUMN IF NOT EXISTS targeting JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS announcements ADD COLUMN IF NOT EXISTS created_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS announcements ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS announcements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS announcements ADD COLUMN IF NOT EXISTS linked_plugin_slug TEXT;
ALTER TABLE IF EXISTS announcements ADD COLUMN IF NOT EXISTS linked_plugin_slugs JSONB NOT NULL DEFAULT '[]'::jsonb;
-- Backfill the multi-link array from the legacy single-link column for announcements created before
-- multi-link support, so their existing "Open <Plugin>" link survives. No-op once the array is set.
UPDATE announcements
  SET linked_plugin_slugs = to_jsonb(ARRAY[linked_plugin_slug])
  WHERE linked_plugin_slug IS NOT NULL
    AND linked_plugin_slug <> ''
    AND (linked_plugin_slugs IS NULL OR linked_plugin_slugs = '[]'::jsonb);
-- Retire announcement priority/mandatory (owner decision 2026-07-16). The Commons is one
-- time-ordered stream, so there is no manual priority ranking, and every announcement flows through
-- the Commons with no non-dismissable "mandatory" flag. Guarded drops; no-op on a fresh database.
ALTER TABLE IF EXISTS announcements DROP COLUMN IF EXISTS priority;
ALTER TABLE IF EXISTS announcements DROP COLUMN IF EXISTS mandatory;
-- Drop the pre-v3 `content` column. Legacy databases carried a NOT NULL `content` column that the
-- v3 app (which authors into `body`) never fills, so every "Create draft" failed with
-- "null value in column content violates not-null constraint". schema.sql has no `content` column,
-- so bring legacy tables in line: preserve any old text into `body` where `body` is empty, then drop
-- the defunct column. Guarded + idempotent — a no-op on a fresh database where `content` never
-- existed, and safe to run repeatedly.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'demo' AND table_name = 'announcements' AND column_name = 'content'
  ) THEN
    UPDATE announcements SET body = content WHERE (body IS NULL OR body = '') AND content IS NOT NULL;
    ALTER TABLE announcements DROP COLUMN content;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);

-- Emoji reactions on official announcements. Mirrors feed_community_post_reactions: one row per
-- (announcement, member, emoji), and the unique index makes a reaction a toggle — a second tap of
-- the same emoji removes the row. The emoji is constrained to the small fixed quick set at the
-- application layer (FEED_REACTION_EMOJIS). Deleting the announcement cascades its reactions.
CREATE TABLE IF NOT EXISTS announcement_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS announcement_reactions ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS announcement_reactions ADD COLUMN IF NOT EXISTS announcement_id UUID;
ALTER TABLE IF EXISTS announcement_reactions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS announcement_reactions ADD COLUMN IF NOT EXISTS emoji TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS announcement_reactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_announcement_reactions_unique
  ON announcement_reactions(announcement_id, user_id, emoji);
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_announcement
  ON announcement_reactions(announcement_id);

-- Replies on official announcements. Mirrors feed_community_replies but keyed on the announcement:
-- a member can reply to an official announcement, and the replies group under that
-- announcement as a thread. author_username is captured at reply time so the thread can show the
-- member's handle without a second lookup. Deleting the announcement cascades its replies.
CREATE TABLE IF NOT EXISTS announcement_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL,
  author_username TEXT,
  body TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'accepted',
  moderation_reason TEXT,
  moderated_by_user_id TEXT,
  moderated_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS announcement_replies ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS announcement_replies ADD COLUMN IF NOT EXISTS announcement_id UUID;
ALTER TABLE IF EXISTS announcement_replies ADD COLUMN IF NOT EXISTS author_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS announcement_replies ADD COLUMN IF NOT EXISTS author_username TEXT;
ALTER TABLE IF EXISTS announcement_replies ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS announcement_replies ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'accepted';
-- Why a moderator hid the reply, who hid it, and when. Added 2026-08-10 with announcement-reply
-- moderation: the shared hide/restore writer sets all three, so a table without them could not be
-- moderated at all — an admin could see a bad reply on an announcement and had no way to take it down.
ALTER TABLE IF EXISTS announcement_replies ADD COLUMN IF NOT EXISTS moderation_reason TEXT;
ALTER TABLE IF EXISTS announcement_replies ADD COLUMN IF NOT EXISTS moderated_by_user_id TEXT;
ALTER TABLE IF EXISTS announcement_replies ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;
-- Set when the author rewrites their own reply, so the thread can mark it "edited" rather than
-- silently showing different words under the same timestamp.
ALTER TABLE IF EXISTS announcement_replies ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS announcement_replies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS announcement_replies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_announcement_replies_announcement
  ON announcement_replies(announcement_id, created_at);

-- === FEED TIMELINE PROJECTION ===
CREATE TABLE IF NOT EXISTS feed_timeline_projection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL,
  source_announcement_id UUID,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS feed_timeline_projection ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS feed_timeline_projection ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_timeline_projection ADD COLUMN IF NOT EXISTS source_announcement_id UUID;
ALTER TABLE IF EXISTS feed_timeline_projection ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_timeline_projection ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
-- Retire priority/mandatory from the reserved projection read model too (owner decision 2026-07-16).
ALTER TABLE IF EXISTS feed_timeline_projection DROP COLUMN IF EXISTS priority;
ALTER TABLE IF EXISTS feed_timeline_projection DROP COLUMN IF EXISTS mandatory;
ALTER TABLE IF EXISTS feed_timeline_projection ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS feed_timeline_projection ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS feed_timeline_projection ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS feed_timeline_projection ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === CHYME ROOMS ===
-- The canonical chyme_rooms definition is earlier in this file (placed before
-- its dependent indexes). The duplicate CREATE TABLE that used to be here was
-- removed; the ALTER ... ADD COLUMN reconciliation below still brings older
-- databases up to date.
ALTER TABLE IF EXISTS chyme_rooms ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS chyme_rooms ADD COLUMN IF NOT EXISTS room_key TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS chyme_rooms ADD COLUMN IF NOT EXISTS room_name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS chyme_rooms ADD COLUMN IF NOT EXISTS call_active BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS chyme_rooms ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS chyme_rooms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === CTF PLUGIN REGISTRY ===
CREATE TABLE IF NOT EXISTS ctf_plugin_registry (
  plugin_slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  availability_state TEXT NOT NULL DEFAULT 'planned',
  nav_rank INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS ctf_plugin_registry ADD COLUMN IF NOT EXISTS plugin_slug TEXT;
ALTER TABLE IF EXISTS ctf_plugin_registry ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS ctf_plugin_registry ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS ctf_plugin_registry ADD COLUMN IF NOT EXISTS availability_state TEXT NOT NULL DEFAULT 'planned';
ALTER TABLE IF EXISTS ctf_plugin_registry ADD COLUMN IF NOT EXISTS nav_rank INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS ctf_plugin_registry ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS ctf_plugin_registry ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS ctf_plugin_registry ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Remove orphaned pre-rename plugin-registry rows. The hyphenation renames changed these slugs
-- (whatworks->what-works, trusttransport->trust-transport, socketrelay->socket-relay, levelup->level-up,
-- level-up->skill-up (the 2026-08-29 SkillUp brand rename, a hard cut with no alias),
-- gentlepulse->gentle-pulse, clicklog->click-log) and the new-slug rows are seeded below; but the
-- ON CONFLICT (plugin_slug) upsert cannot delete the old slug, so an existing DB kept BOTH rows and
-- listed the plugin twice in the Apps list. Purge the old rows.
DELETE FROM ctf_plugin_registry WHERE plugin_slug IN ('whatworks', 'trusttransport', 'socketrelay', 'levelup', 'gentlepulse', 'clicklog', 'level-up');

-- GentlePulse decommissioned 2026-07-27 (owner decision): remove its registry row from existing DBs.
DELETE FROM ctf_plugin_registry WHERE plugin_slug = 'gentle-pulse';

-- Seed plugin registry (upsert so re-running is safe).
--
-- THIS TABLE IS WHAT THE APPS LIST SHOWS. `fallbackPluginRegistry` in
-- packages/web/lib/plugins/repository.ts is only used when this table is empty or unreadable, which
-- is never true in production — so adding a plugin to that array alone puts NO tile in the launcher.
-- A new plugin needs a row here as well, or it is invisible to members.
INSERT INTO ctf_plugin_registry (plugin_slug, display_name, summary, availability_state, nav_rank, is_visible) VALUES
  ('chyme',              'Chyme',                'Live social audio rooms. Broadcast, listen, and connect in real time.',                       'implemented_shell', 10,  TRUE),
  ('skills-taxonomy',    'Skills Taxonomy',      'Browse the shared catalog of sectors, job titles, and skills.',                     'implemented_shell', 20,  TRUE),
  ('directory',          'Directory',            'Browse skills across the survivor community.',                      'implemented_shell', 30,  TRUE),
  ('workforce',          'Workforce',            'Real-time work and skills distribution among 5 million survivors globally.',                           'implemented_shell', 50,  TRUE),
  ('skills-hunt',        'SkillsHunt',          'Nominate survivors to build the Directory and grow the economy.', 'implemented_shell', 60,  TRUE),
  ('unlock',             'Unlock',               'Internal verification queue and staged unlock orchestration for Quora URL onboarding.',           'implemented_shell', 65,  FALSE),
  ('knowledge',          'Knowledge Library',    'Lend your own public writing so the assistant answers from more than one person.', 'implemented_shell', 66,  TRUE),
  ('foundation',         'Foundation',           'Find talent, tools, repairs, and infrastructure support in real time.',                      'implemented_shell', 70,  TRUE),
  ('lighthouse',         'LightHouse',           'Community housing listings from trauma-informed hosts; ServiceCredits accepted.', 'implemented_shell', 80,  TRUE),
  ('socket-relay',         'SocketRelay',          'Real-time resource sharing across the network.',                        'implemented_shell', 90,  TRUE),
  ('trust-transport',    'TrustTransport',       'Vetted transportation for safe travel. Drivers screened by the community, for the community.',                           'implemented_shell', 100, TRUE),
  ('peer-programming',   'PeerProgramming',     'Weekly global mastermind sessions.',                            'implemented_shell', 110, TRUE),
  ('mood',               'Mood',                 'Anonymous mood tracking and pattern awareness. Know yourself. See patterns. Take back control.',                        'implemented_shell', 120, TRUE),
  ('weekly-performance', 'Weekly Performance',   'Week selection/guardrails with metrics, comparisons, and export gate checks.',                    'implemented_shell', 140, TRUE),
  ('gdp',                'GDP',                  'Real time $300B global survivor economic tracker. Your contributions counted, recorded, visible.',                        'implemented_shell', 150, TRUE),
  ('service-credits',    'ServiceCredits',      'Alternative economy and credits exchange. Trade value inside the network — no outside systems needed.',                             'implemented_shell', 160, TRUE),
  ('skill-up',           'SkillUp',              'Paid skills-training cohorts — learn a skill with a trainer and earn stipends as you reach each milestone.','implemented_shell', 170, TRUE),
  ('click-log',          'ClickLog',             'Safety check-in and incident logging — location optional. Log what happened, check in when you''re safe.','implemented_shell', 180, TRUE),
  ('trust',              'Trust',                'Community reputation and verification. Trust signals built through real participation — your credibility, visible and portable.','implemented_shell', 190, TRUE),
  ('what-works',          'WhatWorks',            'One shared, survivor-verified list of tools — organized by the exact problems survivors face. No ads, no affiliates.','implemented_shell', 200, TRUE),
  ('contributions',      'Contributions',        'Voluntary fundraiser drives — gift-card, Quora-comment, and GitHub-star contributions with service-credit thank-you grants.',        'implemented_shell', 210, TRUE),
  ('bug-reporting',      'Bug Reporting',        'In-app problem reports that flow to a private triage repo; raw text stays private and a human approves any fix.','planned', 220, FALSE),
  ('beacon',             'Beacon',               'Live one-way broadcasts from Farah. Watch publicly with just a link; sign in to chat and react.','implemented_shell', 230, TRUE),
  ('recurring-activity', 'Recurring Activity',   'Acknowledge an ongoing activity with another member — one tap, no amounts to report. Recognition of your everyday ties, never a bill.','implemented_shell', 240, TRUE),
  ('mutual-time',        'Mutual Time',          'Find a meeting time everyone can make. Share one link; members pick times in their own timezone and the app chooses the slot with the most overlap.','implemented_shell', 250, TRUE)
ON CONFLICT (plugin_slug) DO UPDATE SET
  display_name       = EXCLUDED.display_name,
  summary            = EXCLUDED.summary,
  availability_state = EXCLUDED.availability_state,
  nav_rank           = EXCLUDED.nav_rank,
  is_visible         = EXCLUDED.is_visible,
  updated_at         = NOW();

-- Feed + Announcements was consolidated into the Commons and is no longer a
-- navigable app: its data layer (the feed_* tables + /api/feed/*) and its admin
-- page at /admin/feed-announcements remain, but it is not a plugin tile/route.
-- Remove any registry row left from when it was seeded as a visible app so the
-- /apps/feed-announcements route 404s (idempotent; safe to re-run).
DELETE FROM ctf_plugin_registry WHERE plugin_slug = 'feed-announcements';

-- === SKILLS TAXONOMY (parent tables first) ===
CREATE TABLE IF NOT EXISTS skills_taxonomy_sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  workforce_share NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skills_taxonomy_sectors ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skills_taxonomy_sectors ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_taxonomy_sectors ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skills_taxonomy_sectors ADD COLUMN IF NOT EXISTS workforce_share NUMERIC;
ALTER TABLE IF EXISTS skills_taxonomy_sectors ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS skills_taxonomy_sectors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skills_taxonomy_sectors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS skills_taxonomy_job_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL REFERENCES skills_taxonomy_sectors(id),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skills_taxonomy_job_titles ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skills_taxonomy_job_titles ADD COLUMN IF NOT EXISTS sector_id UUID;
ALTER TABLE IF EXISTS skills_taxonomy_job_titles ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_taxonomy_job_titles ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skills_taxonomy_job_titles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS skills_taxonomy_job_titles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skills_taxonomy_job_titles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS skills_taxonomy_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title_id UUID NOT NULL REFERENCES skills_taxonomy_job_titles(id),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skills_taxonomy_skills ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skills_taxonomy_skills ADD COLUMN IF NOT EXISTS job_title_id UUID;
ALTER TABLE IF EXISTS skills_taxonomy_skills ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_taxonomy_skills ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skills_taxonomy_skills ADD COLUMN IF NOT EXISTS aliases JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS skills_taxonomy_skills ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS skills_taxonomy_skills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skills_taxonomy_skills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS skills_taxonomy_consumer_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  consumer_plugin TEXT NOT NULL,
  reference_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skills_taxonomy_consumer_bindings ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skills_taxonomy_consumer_bindings ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE IF EXISTS skills_taxonomy_consumer_bindings ADD COLUMN IF NOT EXISTS target_id UUID;
ALTER TABLE IF EXISTS skills_taxonomy_consumer_bindings ADD COLUMN IF NOT EXISTS consumer_plugin TEXT;
ALTER TABLE IF EXISTS skills_taxonomy_consumer_bindings ADD COLUMN IF NOT EXISTS reference_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS skills_taxonomy_consumer_bindings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skills_taxonomy_consumer_bindings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE skills_taxonomy_consumer_bindings
SET target_type = 'unknown'
WHERE target_type IS NULL;
UPDATE skills_taxonomy_consumer_bindings
SET target_id = gen_random_uuid()
WHERE target_id IS NULL;
UPDATE skills_taxonomy_consumer_bindings
SET consumer_plugin = 'unknown'
WHERE consumer_plugin IS NULL;

CREATE TABLE IF NOT EXISTS skills_taxonomy_flattened_projection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id UUID NOT NULL,
  sector_name TEXT NOT NULL,
  job_title_id UUID NOT NULL,
  job_title_name TEXT NOT NULL,
  skill_id UUID NOT NULL,
  skill_name TEXT NOT NULL,
  skill_aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skills_taxonomy_flattened_projection ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skills_taxonomy_flattened_projection ADD COLUMN IF NOT EXISTS sector_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skills_taxonomy_flattened_projection ADD COLUMN IF NOT EXISTS sector_name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_taxonomy_flattened_projection ADD COLUMN IF NOT EXISTS job_title_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skills_taxonomy_flattened_projection ADD COLUMN IF NOT EXISTS job_title_name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_taxonomy_flattened_projection ADD COLUMN IF NOT EXISTS skill_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skills_taxonomy_flattened_projection ADD COLUMN IF NOT EXISTS skill_name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_taxonomy_flattened_projection ADD COLUMN IF NOT EXISTS skill_aliases JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS skills_taxonomy_flattened_projection ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS skills_taxonomy_flattened_projection ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skills_taxonomy_flattened_projection ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS skills_taxonomy_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skills_taxonomy_change_events ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skills_taxonomy_change_events ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_taxonomy_change_events ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_taxonomy_change_events ADD COLUMN IF NOT EXISTS target_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skills_taxonomy_change_events ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_taxonomy_change_events ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_taxonomy_change_events ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS skills_taxonomy_change_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- The action vocabulary: the app's delete path writes 'delete'; the taxonomy change apply engine
-- writes 'create', 'rename', 'reparent', 'deactivate', and 'reactivate' ('update' is kept for any
-- pre-existing rows). Both checks are added NOT VALID: the audit log is append-only and historical
-- rows are never rewritten to fit a newer vocabulary (ledger discipline), so the checks constrain
-- new writes only. Without NOT VALID the ADD fails on legacy rows ("violated by some row") and psql
-- stops mid-file, leaving everything after this line unapplied — that is exactly what broke the
-- 2026-07-03 Neon runs. Drop + re-add stays idempotent (same idiom as currencies_kind_check).
ALTER TABLE IF EXISTS skills_taxonomy_change_events DROP CONSTRAINT IF EXISTS skills_taxonomy_change_events_action_check;
ALTER TABLE IF EXISTS skills_taxonomy_change_events ADD CONSTRAINT skills_taxonomy_change_events_action_check CHECK (action IN ('create', 'update', 'delete', 'rename', 'reparent', 'deactivate', 'reactivate')) NOT VALID;
-- target_type vocabulary shared by both writers ('job-title' with a hyphen, matching the app's
-- delete path). Declared explicitly so no live-only vocabulary hides from code review.
ALTER TABLE IF EXISTS skills_taxonomy_change_events DROP CONSTRAINT IF EXISTS skills_taxonomy_change_events_target_type_check;
ALTER TABLE IF EXISTS skills_taxonomy_change_events ADD CONSTRAINT skills_taxonomy_change_events_target_type_check CHECK (target_type IN ('sector', 'job-title', 'skill')) NOT VALID;

-- === DIRECTORY MODULE ===
-- Per-profile skills live in the normalized directory_profile_skills junction
-- (below); the profile view reads skills only from that join. The original
-- platform instead stored skills as a free-text array column on the profile
-- (directory_profiles.skills TEXT[]). That legacy column is NOT recreated here —
-- it only exists on databases cloned from the old platform — and v3 does not read
-- it. post/0005_directory_backfill_skills_from_legacy_array.sql copies any such
-- legacy array into the junction once (guarded + idempotent); directory_profile_skills
-- is the authoritative source afterward.
-- Likewise the original platform stored the profile blurb in a legacy
-- directory_profiles.description column (not recreated here); v3 renders the blurb
-- from `bio`. post/0006_directory_backfill_bio_from_legacy_description.sql copies
-- description -> bio once where bio is empty. The legacy quora_url column also exists
-- only on cloned data; v3 renders the Quora link from profile_url, so
-- post/0007_directory_backfill_profile_url_from_legacy_quora_url.sql copies
-- quora_url -> profile_url once where profile_url is empty. The legacy signal_url
-- column is left in place and surfaced later by the Foundation/SocketRelay contact
-- flow, not copied here.
CREATE TABLE IF NOT EXISTS directory_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claimed_by_user_id TEXT,
  first_name TEXT,
  last_name TEXT,
  headline TEXT,
  bio TEXT,
  profile_url TEXT,
  sector_id UUID,
  job_title_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'self', 'community-generated')),
  invited_by_username TEXT,
  -- No inline UNIQUE: the case-insensitive unique index below owns uniqueness.
  -- A constraint-backed index here cannot be dropped by the DROP INDEX in the
  -- migration block (Postgres rejects it), which would break the fresh-schema
  -- path. See the directory_profiles_unclaimed_handle_unique DO block.
  unclaimed_handle TEXT,
  venmo_address TEXT,
  monero_address TEXT,
  bitcoin_address TEXT,
  service_credits_address TEXT,
  -- Member location (city / state or region / country). Standard fields so non-US members are
  -- represented accurately — Directory feeds nearly every other plugin. These are the SAME column
  -- names v2 used (directory_profiles.city / state / country, varchar(100) in the prod snapshot
  -- ctf/schema-prod4.6.2026.sql), so on the cloned production database the ADD COLUMN IF NOT EXISTS
  -- below is a no-op and the carried-over v2 values are preserved in place — no data-copy migration
  -- is needed (unlike skills/bio/profile_url, whose v3 targets differ from v2 and are backfilled in
  -- post/0005–0007). v3 simply never declared or read these columns before, which is why the data
  -- looked missing. Values are plain names ("United States", "California") per the shared location
  -- standard (packages/web/lib/geo/locations.ts).
  city TEXT,
  state TEXT,
  country TEXT,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS claimed_by_user_id TEXT;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
-- The legacy directory_profiles.description column (exists only on cloned data) is NOT NULL
-- with no default. v3 inserts (e.g. SkillsHunt auto-generated profiles on accept) do not set
-- it, so the insert fails on cloned databases and rolls back the whole operation. Drop the
-- NOT NULL where the legacy column exists so those inserts succeed; v3 reads the blurb from
-- bio (the description -> bio backfill lives in post/0006). Guarded + idempotent.
DO $directory_profiles_description_nullable$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'demo'
      AND table_name = 'directory_profiles'
      AND column_name = 'description'
  ) THEN
    ALTER TABLE directory_profiles ALTER COLUMN description DROP NOT NULL;
  END IF;
END
$directory_profiles_description_nullable$;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS profile_url TEXT;
-- is_public was removed 2026-05-18 — Directory is no longer public-facing;
-- all authenticated members see all active profiles. Drop is idempotent.
ALTER TABLE IF EXISTS directory_profiles DROP COLUMN IF EXISTS is_public;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS sector_id UUID;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS job_title_id UUID;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS venmo_address TEXT;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS monero_address TEXT;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS bitcoin_address TEXT;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS service_credits_address TEXT;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- SkillsHunt + Clerk username co-change (2026-05-11). See
-- docs/developer/ctf-plugin-feature-inventories/ctf-skills-hunt-session-continuity.md §4.
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'admin';
DO $directory_profiles_source_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'directory_profiles_source_check' AND constraint_schema = current_schema()
  ) THEN
    BEGIN
      ALTER TABLE directory_profiles
        ADD CONSTRAINT directory_profiles_source_check
        CHECK (source IN ('admin', 'self', 'community-generated'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$directory_profiles_source_check$;
-- NOTE (2026-07-16): a DB CHECK requiring a country on every ACTIVE directory profile is intended but
-- deliberately NOT added here yet. Country is now required at the app layer (the member/admin edit forms
-- gate Save on a country and validateProfileInput rejects a blank one; SkillsHunt already requires it at
-- submit time), so no new blank-country profile can be created through the product. The DB constraint is
-- sequenced AFTER backfilling the existing blank rows (owner request): adding it now — even NOT VALID —
-- would make claiming the one legacy blank-country profile, or accepting any pre-requirement SkillsHunt
-- submission whose country is null, fail as a raw constraint violation. Once those legacy rows are
-- backfilled (and any null-country accepted submissions cleared), add it as a clean, fully-validated
-- constraint, scoped to active rows so the account-deletion anonymization path (which sets
-- is_active = false and nulls city/state/country) keeps working:
--   ALTER TABLE directory_profiles
--     ADD CONSTRAINT directory_profiles_active_country_present
--     CHECK (is_active = false OR (country IS NOT NULL AND btrim(country) <> ''));
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS invited_by_username TEXT;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS unclaimed_handle TEXT;
ALTER TABLE IF EXISTS directory_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
-- Case-insensitive uniqueness on unclaimed_handle so "Community-7F3A2B" and
-- "community-7f3a2b" can't both exist. Idempotent: drops the old case-
-- sensitive index if it exists, then recreates on lower(unclaimed_handle).
DO $directory_profiles_unclaimed_handle_unique$
BEGIN
  -- If the legacy case-sensitive index exists, drop it so we can replace
  -- with the case-insensitive variant below.
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'directory_profiles_unclaimed_handle_key' AND schemaname = current_schema()
      AND indexdef NOT ILIKE '%lower(unclaimed_handle)%'
  ) THEN
    -- A legacy DB may have created this name as a UNIQUE *constraint*
    -- (constraint-backed index), which Postgres refuses to DROP INDEX. Drop
    -- the constraint first (cascades to its index); the DROP INDEX then mops
    -- up any standalone index left by an earlier migration run.
    ALTER TABLE directory_profiles
      DROP CONSTRAINT IF EXISTS directory_profiles_unclaimed_handle_key;
    EXECUTE 'DROP INDEX IF EXISTS directory_profiles_unclaimed_handle_key';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'directory_profiles_unclaimed_handle_key' AND schemaname = current_schema()
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX directory_profiles_unclaimed_handle_key
        ON directory_profiles (lower(unclaimed_handle))
        WHERE unclaimed_handle IS NOT NULL;
    EXCEPTION WHEN duplicate_table THEN
      NULL;
    END;
  END IF;
END
$directory_profiles_unclaimed_handle_unique$;
CREATE INDEX IF NOT EXISTS idx_directory_profiles_source ON directory_profiles (source) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_directory_profiles_unclaimed ON directory_profiles (claimed_by_user_id, deleted_at) WHERE claimed_by_user_id IS NULL AND deleted_at IS NULL;
-- One-shot backfill: assign reserved community-<hex> handles to existing
-- unclaimed Directory profiles so the @handle URL story is consistent on
-- day one. Idempotent: only fires for rows without a handle and retries on
-- collision by re-running gen_random_bytes until UNIQUE succeeds.
DO $directory_profiles_backfill_handles$
DECLARE
  candidate TEXT;
  attempts INTEGER;
  row_record RECORD;
BEGIN
  FOR row_record IN
    SELECT id FROM directory_profiles
    WHERE claimed_by_user_id IS NULL
      AND unclaimed_handle IS NULL
      AND (deleted_at IS NULL)
  LOOP
    attempts := 0;
    LOOP
      candidate := 'community-' || encode(gen_random_bytes(3), 'hex');
      BEGIN
        UPDATE directory_profiles
        SET unclaimed_handle = candidate, updated_at = NOW()
        WHERE id = row_record.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        attempts := attempts + 1;
        IF attempts > 16 THEN
          RAISE NOTICE 'directory_profiles: could not allocate unique unclaimed_handle for %', row_record.id;
          EXIT;
        END IF;
      END;
    END LOOP;
  END LOOP;
END
$directory_profiles_backfill_handles$;

CREATE TABLE IF NOT EXISTS directory_profile_skills (
  profile_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, skill_id)
);
ALTER TABLE IF EXISTS directory_profile_skills ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE IF EXISTS directory_profile_skills ADD COLUMN IF NOT EXISTS skill_id UUID;
ALTER TABLE IF EXISTS directory_profile_skills ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS directory_profile_tags (
  profile_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  PRIMARY KEY (profile_id, tag_id)
);
ALTER TABLE IF EXISTS directory_profile_tags ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE IF EXISTS directory_profile_tags ADD COLUMN IF NOT EXISTS tag_id UUID;

-- Free-text "skill not listed" entries a member adds to their own profile through the self-edit
-- form. They are NOT canonical taxonomy skills: each renders as a muted "pending review" chip
-- (alongside SkillsHunt-nominated pending skills) until an admin promotes it into the taxonomy.
-- Keyed by profile_id so it cascades with the profile on deletion (like directory_profile_skills).
CREATE TABLE IF NOT EXISTS directory_profile_proposed_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  skill_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS directory_profile_proposed_skills ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS directory_profile_proposed_skills ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE IF EXISTS directory_profile_proposed_skills ADD COLUMN IF NOT EXISTS skill_label TEXT;
ALTER TABLE IF EXISTS directory_profile_proposed_skills ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE IF EXISTS directory_profile_proposed_skills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS directory_profile_proposed_skills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS directory_profile_proposed_skills_profile_idx ON directory_profile_proposed_skills (profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS directory_profile_proposed_skills_unique_label ON directory_profile_proposed_skills (profile_id, lower(skill_label));

CREATE TABLE IF NOT EXISTS directory_user_extension (
  user_id TEXT PRIMARY KEY,
  profile_visibility TEXT NOT NULL DEFAULT 'workspace',
  service_deleted_at TIMESTAMPTZ,
  venmo_address TEXT,
  monero_address TEXT,
  bitcoin_address TEXT,
  service_credits_address TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS directory_user_extension ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS directory_user_extension ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'workspace';
ALTER TABLE IF EXISTS directory_user_extension ADD COLUMN IF NOT EXISTS service_deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS directory_user_extension ADD COLUMN IF NOT EXISTS venmo_address TEXT;
ALTER TABLE IF EXISTS directory_user_extension ADD COLUMN IF NOT EXISTS monero_address TEXT;
ALTER TABLE IF EXISTS directory_user_extension ADD COLUMN IF NOT EXISTS bitcoin_address TEXT;
ALTER TABLE IF EXISTS directory_user_extension ADD COLUMN IF NOT EXISTS service_credits_address TEXT;
ALTER TABLE IF EXISTS directory_user_extension ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS directory_profile_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS directory_profile_change_events ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS directory_profile_change_events ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_profile_change_events ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_profile_change_events ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_profile_change_events ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_profile_change_events ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_profile_change_events ADD COLUMN IF NOT EXISTS target_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS directory_profile_change_events ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS directory_profile_change_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Append-only history of a member's Quora profile URL. The Quora URL is the only social-proof signal
-- and can be changed after a member is approved (Directory is the only post-unlock place it can be
-- edited). A member may replace it with a new valid Quora URL but can never empty it (see
-- upsertOwnProfile — an empty/invalid submission keeps the previous URL). Every real change is
-- recorded here (first set at Unlock onboarding, later edits in Directory, and any admin edit) so an
-- admin can review the trail in the Unlock queue and revoke someone gaming the low-bar social proof.
-- Changing a URL is NOT by itself a red flag — Quora sometimes deletes an account and the member must
-- re-profile — so this is a watch/audit trail for a human, never an automated flag.
CREATE TABLE IF NOT EXISTS directory_quora_url_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  previous_url TEXT,
  new_url TEXT NOT NULL,
  previous_url_normalized TEXT,
  new_url_normalized TEXT NOT NULL,
  changed_by_user_id TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS directory_quora_url_history ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS directory_quora_url_history ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_quora_url_history ADD COLUMN IF NOT EXISTS previous_url TEXT;
ALTER TABLE IF EXISTS directory_quora_url_history ADD COLUMN IF NOT EXISTS new_url TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_quora_url_history ADD COLUMN IF NOT EXISTS previous_url_normalized TEXT;
ALTER TABLE IF EXISTS directory_quora_url_history ADD COLUMN IF NOT EXISTS new_url_normalized TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_quora_url_history ADD COLUMN IF NOT EXISTS changed_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_quora_url_history ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_quora_url_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_directory_quora_url_history_user
  ON directory_quora_url_history (user_id, created_at DESC);

-- Suppression list for the "remove at the person's request" takedown (distinct from the ordinary
-- unclaimed-profile delete, which is for duplicates/accidents and does NOT block re-adding). When an
-- admin takes down a community-generated profile because the (accountless) person asked to be removed,
-- the profile row is deleted and its normalized Quora URL is recorded here. A row with is_overridden =
-- false is an ACTIVE block: that Quora URL cannot be listed in the directory again (auto-generated from
-- a SkillsHunt accept, or added by an admin) until an admin lifts the block with a reason (override).
CREATE TABLE IF NOT EXISTS directory_suppressed_quora_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_url TEXT NOT NULL,
  original_url TEXT NOT NULL,
  reason TEXT NOT NULL,
  removed_profile_id TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  overridden_by_user_id TEXT,
  overridden_at TIMESTAMPTZ,
  override_reason TEXT
);
ALTER TABLE IF EXISTS directory_suppressed_quora_urls ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS directory_suppressed_quora_urls ADD COLUMN IF NOT EXISTS normalized_url TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_suppressed_quora_urls ADD COLUMN IF NOT EXISTS original_url TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_suppressed_quora_urls ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_suppressed_quora_urls ADD COLUMN IF NOT EXISTS removed_profile_id TEXT;
ALTER TABLE IF EXISTS directory_suppressed_quora_urls ADD COLUMN IF NOT EXISTS created_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_suppressed_quora_urls ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS directory_suppressed_quora_urls ADD COLUMN IF NOT EXISTS is_overridden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS directory_suppressed_quora_urls ADD COLUMN IF NOT EXISTS overridden_by_user_id TEXT;
ALTER TABLE IF EXISTS directory_suppressed_quora_urls ADD COLUMN IF NOT EXISTS overridden_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS directory_suppressed_quora_urls ADD COLUMN IF NOT EXISTS override_reason TEXT;
-- At most one ACTIVE (non-overridden) suppression per normalized URL; a URL may be re-suppressed after
-- an override, so the uniqueness is partial rather than on the column outright.
CREATE UNIQUE INDEX IF NOT EXISTS directory_suppressed_quora_urls_active_unique
  ON directory_suppressed_quora_urls (normalized_url) WHERE is_overridden = FALSE;
CREATE INDEX IF NOT EXISTS directory_suppressed_quora_urls_normalized_idx
  ON directory_suppressed_quora_urls (normalized_url);

CREATE TABLE IF NOT EXISTS directory_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS directory_announcements ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS directory_announcements ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_announcements ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_announcements ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS directory_announcements ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS directory_announcements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS directory_announcements ADD COLUMN IF NOT EXISTS created_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_announcements ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_announcements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS directory_announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS directory_deletion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  result TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS directory_deletion_events ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS directory_deletion_events ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_deletion_events ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_deletion_events ADD COLUMN IF NOT EXISTS plugin_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_deletion_events ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS directory_deletion_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS directory_deletion_events ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_deletion_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === SKILLUP MODULE ===
CREATE TABLE IF NOT EXISTS skill_up_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- title carries no plugin-name prefix. A cohort opened from the proposal queue used to be titled
  -- "SkillUp: <occupation>" (and "LevelUp: <occupation>" before the 2026-08-29 rename), which
  -- repeated the name of the plugin the row is already inside on every card. It is the occupation on
  -- its own now; post/0009_skill_up_cohort_title_drop_plugin_prefix.sql strips the prefix from the
  -- rows written under the old template. Do not reintroduce the prefix.
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  track TEXT NOT NULL,
  seats INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  required_credits NUMERIC NOT NULL,
  materials_cost NUMERIC NOT NULL DEFAULT 0,
  device_support BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft',
  allow_no_deposit BOOLEAN NOT NULL DEFAULT FALSE,
  trainer_split_percent NUMERIC NOT NULL,
  completion_bonus_credits NUMERIC NOT NULL DEFAULT 0,
  stipend_mode TEXT NOT NULL DEFAULT 'none',
  stipend_amount_per_payout NUMERIC NOT NULL DEFAULT 0,
  stipend_interval_days INTEGER,
  microgrant_mode TEXT NOT NULL DEFAULT 'none',
  microgrant_amount NUMERIC NOT NULL DEFAULT 0,
  refund_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  payout_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS track TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS seats INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS start_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS end_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS required_credits NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS materials_cost NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS device_support BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS allow_no_deposit BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS trainer_split_percent NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS completion_bonus_credits NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS stipend_mode TEXT NOT NULL DEFAULT 'none';
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS stipend_amount_per_payout NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS stipend_interval_days INTEGER;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS microgrant_mode TEXT NOT NULL DEFAULT 'none';
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS microgrant_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS refund_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS payout_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS policy_json JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS created_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Multi-currency (issue #120): SkillUp stipends and microgrants are internal ServiceCredits payouts.
-- stipend_currency / microgrant_currency name the currency of stipend_amount_per_payout / microgrant_amount;
-- both default to ServiceCredits (code 'SC').
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS stipend_currency TEXT NOT NULL DEFAULT 'SC' REFERENCES currencies(code);
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS microgrant_currency TEXT NOT NULL DEFAULT 'SC' REFERENCES currencies(code);
-- Auto-cohort creation (issue #904): SkillUp stands up cohorts from Workforce occupation gaps.
-- auto_created marks a cohort the scheduled run created (vs a human-built one). source_job_title_id
-- ties it to the exact Skills Taxonomy occupation that triggered it (the Workforce gap's jobTitleId),
-- so a re-run never duplicates a cohort for the same occupation. source_sector / source_gap_at_creation
-- are kept for display and audit. source_job_title_id intentionally has no hard FK (it mirrors
-- directory_profiles.job_title_id, which is also a plain UUID reference to skills_taxonomy_job_titles).
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS auto_created BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS source_job_title_id UUID;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS source_sector TEXT;
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS source_gap_at_creation NUMERIC;
-- The occupation this cohort trains, as a Skills Taxonomy job title. Distinct from
-- source_job_title_id, which is provenance (the Workforce gap that triggered an auto cohort);
-- this one is a first-class property of every cohort, hand-built ones included, and it is what the
-- trainer claim gate matches a person's Directory skills against. Required on new cohorts (owner
-- decision 2026-08-29); post/0010 backfills it from source_job_title_id on the rows that predate
-- it. No hard FK, mirroring source_job_title_id and directory_profiles.job_title_id.
ALTER TABLE IF EXISTS skill_up_cohorts ADD COLUMN IF NOT EXISTS job_title_id UUID;
CREATE INDEX IF NOT EXISTS idx_skill_up_cohorts_job_title ON skill_up_cohorts (job_title_id);
-- Database-level idempotency guard: at most one open/active auto-created cohort per source occupation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_skill_up_auto_cohort_active_source
  ON skill_up_cohorts (source_job_title_id)
  WHERE auto_created = TRUE AND status IN ('open', 'active');

-- Auto-cohort configuration (issue #904). Singleton row holding the knobs the scheduled run reads;
-- admin-editable. Defaults match the lean launch policy: top 10 Foundational gaps, 3 concurrent
-- cohorts, one per sector, above a minimum gap, fixed 90-day term.
CREATE TABLE IF NOT EXISTS skill_up_auto_cohort_config (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  min_gap_threshold NUMERIC NOT NULL DEFAULT 25,
  max_concurrent INTEGER NOT NULL DEFAULT 3,
  per_sector_cap INTEGER NOT NULL DEFAULT 1,
  skill_level_filter TEXT NOT NULL DEFAULT 'Foundational',
  top_n INTEGER NOT NULL DEFAULT 10,
  default_term_days INTEGER NOT NULL DEFAULT 90,
  default_seats INTEGER NOT NULL DEFAULT 12,
  -- Economic policy applied to every auto-created cohort (issue #904). One global policy for now;
  -- per-occupation tuning is deferred (see #1197). default_required_credits 0 = free to join.
  default_required_credits NUMERIC NOT NULL DEFAULT 0,
  default_trainer_split_percent NUMERIC NOT NULL DEFAULT 25,
  default_completion_bonus_credits NUMERIC NOT NULL DEFAULT 0,
  -- Proposal-queue cadence (issue #904, 2026-07-23): how often gaps are re-read into proposals,
  -- and when they were last read.
  generation_interval_days INTEGER NOT NULL DEFAULT 90,
  last_generated_at TIMESTAMPTZ,
  updated_by_user_id TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS min_gap_threshold NUMERIC NOT NULL DEFAULT 25;
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS max_concurrent INTEGER NOT NULL DEFAULT 3;
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS per_sector_cap INTEGER NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS skill_level_filter TEXT NOT NULL DEFAULT 'Foundational';
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS top_n INTEGER NOT NULL DEFAULT 10;
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS default_term_days INTEGER NOT NULL DEFAULT 90;
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS default_seats INTEGER NOT NULL DEFAULT 12;
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS default_required_credits NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS default_trainer_split_percent NUMERIC NOT NULL DEFAULT 25;
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS default_completion_bonus_credits NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT NOT NULL DEFAULT 'system';
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Proposal-queue model (issue #904, owner decision 2026-07-23): gaps are re-read on a cadence and
-- turned into an admin-approved proposal queue, not auto-created cohorts. generation_interval_days is
-- how often the gaps are re-read (default 90); last_generated_at gates the cadence.
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS generation_interval_days INTEGER NOT NULL DEFAULT 90;
ALTER TABLE IF EXISTS skill_up_auto_cohort_config ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMPTZ;

-- Per-occupation term overrides (issue #904): admins set how long a given occupation's auto cohort
-- runs ("Mechanics × term", "Elementary teachers × term"); falls back to default_term_days when absent.
CREATE TABLE IF NOT EXISTS skill_up_auto_cohort_term_overrides (
  job_title_id UUID PRIMARY KEY,
  occupation TEXT NOT NULL DEFAULT '',
  term_days INTEGER NOT NULL,
  updated_by_user_id TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_auto_cohort_term_overrides ADD COLUMN IF NOT EXISTS occupation TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_auto_cohort_term_overrides ADD COLUMN IF NOT EXISTS term_days INTEGER NOT NULL DEFAULT 90;
ALTER TABLE IF EXISTS skill_up_auto_cohort_term_overrides ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT NOT NULL DEFAULT 'system';
ALTER TABLE IF EXISTS skill_up_auto_cohort_term_overrides ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Cohort proposal queue (issue #904, owner decision 2026-07-23). Instead of auto-creating cohorts,
-- the scheduled run reads the Workforce gaps and writes ranked, sector-diverse *proposals* here; an
-- admin approves one (choosing a 1/3/5-month term, which opens a real cohort) or dismisses it. Status:
-- pending (awaiting a decision), approved (a cohort was opened — see created_cohort_id), dismissed
-- (admin declined), superseded (a later generation invalidated it — occupation now covered or gap fell
-- below threshold).
CREATE TABLE IF NOT EXISTS skill_up_cohort_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_job_title_id UUID NOT NULL,
  occupation TEXT NOT NULL,
  sector TEXT NOT NULL DEFAULT 'Unassigned',
  skill_level TEXT NOT NULL DEFAULT '',
  gap_at_proposal NUMERIC NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  generated_source TEXT NOT NULL DEFAULT 'cron',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by_user_id TEXT,
  decided_at TIMESTAMPTZ,
  created_cohort_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_cohort_proposals ADD COLUMN IF NOT EXISTS source_job_title_id UUID;
ALTER TABLE IF EXISTS skill_up_cohort_proposals ADD COLUMN IF NOT EXISTS occupation TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_cohort_proposals ADD COLUMN IF NOT EXISTS sector TEXT NOT NULL DEFAULT 'Unassigned';
ALTER TABLE IF EXISTS skill_up_cohort_proposals ADD COLUMN IF NOT EXISTS skill_level TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_cohort_proposals ADD COLUMN IF NOT EXISTS gap_at_proposal NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_cohort_proposals ADD COLUMN IF NOT EXISTS rank INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_cohort_proposals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE IF EXISTS skill_up_cohort_proposals ADD COLUMN IF NOT EXISTS generated_source TEXT NOT NULL DEFAULT 'cron';
ALTER TABLE IF EXISTS skill_up_cohort_proposals ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skill_up_cohort_proposals ADD COLUMN IF NOT EXISTS decided_by_user_id TEXT;
ALTER TABLE IF EXISTS skill_up_cohort_proposals ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS skill_up_cohort_proposals ADD COLUMN IF NOT EXISTS created_cohort_id UUID;
ALTER TABLE IF EXISTS skill_up_cohort_proposals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skill_up_cohort_proposals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- At most one live (pending) proposal per occupation — mirrors uq_skill_up_auto_cohort_active_source.
CREATE UNIQUE INDEX IF NOT EXISTS uq_skill_up_cohort_proposal_pending
  ON skill_up_cohort_proposals (source_job_title_id)
  WHERE status = 'pending';
-- Ranked read of the live queue for the admin surface.
CREATE INDEX IF NOT EXISTS idx_skill_up_cohort_proposal_pending_rank
  ON skill_up_cohort_proposals (status, rank);

-- Trainer skill audit (owner decision 2026-08-29). A person claims a cohort to train by holding a
-- matching skill on their claimed Directory profile — no admin approval, so nothing human stands
-- between adding a skill and claiming it. That removes the bias and the queue, and this table is
-- what stands in for the reviewer who is no longer there.
--
-- Read it for REMOVALS, not adds. Adding a skill shortly before claiming is ordinary: profiles here
-- start out community-generated and members are new, so filling in real skills is what someone does
-- when they first engage. A skill taken back off after it has done its work — especially while the
-- cohort claimed on it is still held — is the thing worth looking at.
--
-- Every add and every remove on a CLAIMED Directory profile is written here, not only the changes
-- made by people who are already trainers: a first claim is preceded by the add that enabled it, so
-- a log scoped to existing trainers would hold the removal with nothing before it.
--
-- Written from Directory's profile-skill write path through lib/shared/skill-up-interface.ts, the
-- sanctioned crossing point (Directory never imports lib/skill-up directly). Append-only: rows are
-- never updated, and the deletion registry retains them as an integrity record.
CREATE TABLE IF NOT EXISTS skill_up_trainer_skill_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  profile_id UUID NOT NULL,
  skill_id UUID NOT NULL,
  -- Denormalized so a row still reads after a taxonomy skill is renamed or retired.
  skill_name TEXT NOT NULL DEFAULT '',
  job_title_id UUID,
  action TEXT NOT NULL CHECK (action IN ('added', 'removed')),
  -- What caused the change: a member editing their own profile, or a profile-wide wipe on unclaim
  -- or delete. A wipe erases skills too, so it is logged rather than leaving a silent gap.
  change_source TEXT NOT NULL DEFAULT 'profile_edit',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_trainer_skill_audit ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_trainer_skill_audit ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE IF EXISTS skill_up_trainer_skill_audit ADD COLUMN IF NOT EXISTS skill_id UUID;
ALTER TABLE IF EXISTS skill_up_trainer_skill_audit ADD COLUMN IF NOT EXISTS skill_name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_trainer_skill_audit ADD COLUMN IF NOT EXISTS job_title_id UUID;
ALTER TABLE IF EXISTS skill_up_trainer_skill_audit ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'added';
ALTER TABLE IF EXISTS skill_up_trainer_skill_audit ADD COLUMN IF NOT EXISTS change_source TEXT NOT NULL DEFAULT 'profile_edit';
ALTER TABLE IF EXISTS skill_up_trainer_skill_audit ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- The fraud read: one person's skill history, newest first.
CREATE INDEX IF NOT EXISTS idx_skill_up_trainer_skill_audit_user
  ON skill_up_trainer_skill_audit (user_id, changed_at DESC);
-- The other read: everyone who has touched the skills behind one occupation.
CREATE INDEX IF NOT EXISTS idx_skill_up_trainer_skill_audit_job_title
  ON skill_up_trainer_skill_audit (job_title_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS skill_up_curriculum_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_curriculum_items ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skill_up_curriculum_items ADD COLUMN IF NOT EXISTS cohort_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skill_up_curriculum_items ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_curriculum_items ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_curriculum_items ADD COLUMN IF NOT EXISTS sequence_no INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_curriculum_items ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS skill_up_curriculum_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skill_up_curriculum_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS skill_up_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL,
  name TEXT NOT NULL,
  percent_release NUMERIC NOT NULL,
  required_task TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_milestones ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skill_up_milestones ADD COLUMN IF NOT EXISTS cohort_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skill_up_milestones ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_milestones ADD COLUMN IF NOT EXISTS percent_release NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_milestones ADD COLUMN IF NOT EXISTS required_task TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_milestones ADD COLUMN IF NOT EXISTS sequence_no INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_milestones ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skill_up_milestones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS skill_up_command_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (actor_id, command_name, idempotency_key)
);
ALTER TABLE IF EXISTS skill_up_command_idempotency ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skill_up_command_idempotency ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_command_idempotency ADD COLUMN IF NOT EXISTS command_name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_command_idempotency ADD COLUMN IF NOT EXISTS idempotency_key TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_command_idempotency ADD COLUMN IF NOT EXISTS response_payload JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS skill_up_command_idempotency ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS skill_up_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_audit_events ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skill_up_audit_events ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_audit_events ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_audit_events ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_audit_events ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_audit_events ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_audit_events ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_audit_events ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS skill_up_audit_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS skill_up_rate_limit_counters (
  user_id TEXT NOT NULL,
  command_name TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  window_seconds INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, command_name, window_started_at, window_seconds)
);
ALTER TABLE IF EXISTS skill_up_rate_limit_counters ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS skill_up_rate_limit_counters ADD COLUMN IF NOT EXISTS command_name TEXT;
ALTER TABLE IF EXISTS skill_up_rate_limit_counters ADD COLUMN IF NOT EXISTS window_started_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS skill_up_rate_limit_counters ADD COLUMN IF NOT EXISTS window_seconds INTEGER;
ALTER TABLE IF EXISTS skill_up_rate_limit_counters ADD COLUMN IF NOT EXISTS request_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS skill_up_rate_limit_counters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS skill_up_enrollment_milestone_escrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL,
  milestone_id UUID NOT NULL,
  escrow_id UUID NOT NULL,
  held_amount NUMERIC NOT NULL,
  release_status TEXT NOT NULL DEFAULT 'held',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (enrollment_id, milestone_id)
);
ALTER TABLE IF EXISTS skill_up_enrollment_milestone_escrows ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skill_up_enrollment_milestone_escrows ADD COLUMN IF NOT EXISTS enrollment_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skill_up_enrollment_milestone_escrows ADD COLUMN IF NOT EXISTS milestone_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skill_up_enrollment_milestone_escrows ADD COLUMN IF NOT EXISTS escrow_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skill_up_enrollment_milestone_escrows ADD COLUMN IF NOT EXISTS held_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_enrollment_milestone_escrows ADD COLUMN IF NOT EXISTS release_status TEXT NOT NULL DEFAULT 'held';
ALTER TABLE IF EXISTS skill_up_enrollment_milestone_escrows ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS skill_up_milestone_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL,
  milestone_id UUID NOT NULL,
  validated_by_user_id TEXT,
  validation_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  release_transfer_id UUID,
  trainer_payout_governance_id UUID,
  released_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_milestone_validations ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skill_up_milestone_validations ADD COLUMN IF NOT EXISTS enrollment_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skill_up_milestone_validations ADD COLUMN IF NOT EXISTS milestone_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skill_up_milestone_validations ADD COLUMN IF NOT EXISTS validated_by_user_id TEXT;
ALTER TABLE IF EXISTS skill_up_milestone_validations ADD COLUMN IF NOT EXISTS validation_note TEXT;
ALTER TABLE IF EXISTS skill_up_milestone_validations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE IF EXISTS skill_up_milestone_validations ADD COLUMN IF NOT EXISTS release_transfer_id UUID;
ALTER TABLE IF EXISTS skill_up_milestone_validations ADD COLUMN IF NOT EXISTS trainer_payout_governance_id UUID;
ALTER TABLE IF EXISTS skill_up_milestone_validations ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS skill_up_milestone_validations ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS skill_up_milestone_validations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skill_up_milestone_validations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS skill_up_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL,
  milestone_id UUID,
  opened_by_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolution_comment TEXT,
  resolved_by_user_id TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_disputes ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skill_up_disputes ADD COLUMN IF NOT EXISTS enrollment_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skill_up_disputes ADD COLUMN IF NOT EXISTS milestone_id UUID;
ALTER TABLE IF EXISTS skill_up_disputes ADD COLUMN IF NOT EXISTS opened_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_disputes ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_disputes ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_disputes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE IF EXISTS skill_up_disputes ADD COLUMN IF NOT EXISTS resolution_comment TEXT;
ALTER TABLE IF EXISTS skill_up_disputes ADD COLUMN IF NOT EXISTS resolved_by_user_id TEXT;
ALTER TABLE IF EXISTS skill_up_disputes ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS skill_up_disputes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skill_up_disputes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS skill_up_dispute_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL,
  actor_user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_dispute_comments ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skill_up_dispute_comments ADD COLUMN IF NOT EXISTS dispute_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skill_up_dispute_comments ADD COLUMN IF NOT EXISTS actor_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_dispute_comments ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_dispute_comments ADD COLUMN IF NOT EXISTS attachment_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS skill_up_dispute_comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS skill_up_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL,
  recipient_user_id TEXT NOT NULL,
  disbursement_type TEXT NOT NULL DEFAULT 'trainer_payout',
  amount NUMERIC NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_disbursements ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skill_up_disbursements ADD COLUMN IF NOT EXISTS enrollment_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skill_up_disbursements ADD COLUMN IF NOT EXISTS recipient_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_disbursements ADD COLUMN IF NOT EXISTS disbursement_type TEXT NOT NULL DEFAULT 'trainer_payout';
ALTER TABLE IF EXISTS skill_up_disbursements ADD COLUMN IF NOT EXISTS amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_disbursements ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS skill_up_disbursements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === skill_up_trainers ===
-- Survivor-advocate trainers shown in the SkillUp "Trainers" directory.
-- Read-only browse surface; one row per trainer user.
CREATE TABLE IF NOT EXISTS skill_up_trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  headline TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_trainers ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skill_up_trainers ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_trainers ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_trainers ADD COLUMN IF NOT EXISTS headline TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_trainers ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_trainers ADD COLUMN IF NOT EXISTS tracks JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS skill_up_trainers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS skill_up_trainers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skill_up_trainers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === skill_up_achievements ===
-- Grant-only badge/milestone definitions. Never spend or deduct credits.
-- credit_reward documents the grant amount tied to earning the badge (display only).
CREATE TABLE IF NOT EXISTS skill_up_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  track TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'trophy',
  credit_reward NUMERIC NOT NULL DEFAULT 0,
  sequence_no INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_achievements ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skill_up_achievements ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_achievements ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_achievements ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_achievements ADD COLUMN IF NOT EXISTS track TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_achievements ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'trophy';
ALTER TABLE IF EXISTS skill_up_achievements ADD COLUMN IF NOT EXISTS credit_reward NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_achievements ADD COLUMN IF NOT EXISTS sequence_no INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_achievements ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS skill_up_achievements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skill_up_achievements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === skill_up_user_achievements ===
-- Per-user earned badge rows. Grant-only: a row means the badge was earned.
CREATE TABLE IF NOT EXISTS skill_up_user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  achievement_id UUID NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_credits NUMERIC NOT NULL DEFAULT 0,
  source_reference TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS skill_up_user_achievements ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skill_up_user_achievements ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_user_achievements ADD COLUMN IF NOT EXISTS achievement_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS skill_up_user_achievements ADD COLUMN IF NOT EXISTS earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skill_up_user_achievements ADD COLUMN IF NOT EXISTS granted_credits NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skill_up_user_achievements ADD COLUMN IF NOT EXISTS source_reference TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skill_up_user_achievements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'skill_up_user_achievements' AND indexname = 'skill_up_user_achievements_user_id_achievement_id_key' AND schemaname = current_schema()
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS skill_up_user_achievements_user_id_achievement_id_key ON skill_up_user_achievements(user_id, achievement_id)';
  END IF;
END $$;

-- === FOUNDATION MODULE ===
CREATE TABLE IF NOT EXISTS foundation_thread_participants (
  thread_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  participant_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);
ALTER TABLE IF EXISTS foundation_thread_participants ADD COLUMN IF NOT EXISTS thread_id UUID;
ALTER TABLE IF EXISTS foundation_thread_participants ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS foundation_thread_participants ADD COLUMN IF NOT EXISTS participant_role TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_thread_participants ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS foundation_message_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL,
  sender_user_id TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  message_text TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_message_id TEXT NOT NULL,
  stream_message_id TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'accepted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (thread_id, sender_user_id, client_message_id)
);
ALTER TABLE IF EXISTS foundation_message_metadata ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS foundation_message_metadata ADD COLUMN IF NOT EXISTS thread_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS foundation_message_metadata ADD COLUMN IF NOT EXISTS sender_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_message_metadata ADD COLUMN IF NOT EXISTS sender_role TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_message_metadata ADD COLUMN IF NOT EXISTS message_text TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_message_metadata ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS foundation_message_metadata ADD COLUMN IF NOT EXISTS client_message_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_message_metadata ADD COLUMN IF NOT EXISTS stream_message_id TEXT;
ALTER TABLE IF EXISTS foundation_message_metadata ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'accepted';
ALTER TABLE IF EXISTS foundation_message_metadata ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS foundation_message_metadata ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS foundation_notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  thread_id UUID,
  quote_request_id UUID,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS foundation_notification_events ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS foundation_notification_events ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_notification_events ADD COLUMN IF NOT EXISTS thread_id UUID;
ALTER TABLE IF EXISTS foundation_notification_events ADD COLUMN IF NOT EXISTS quote_request_id UUID;
ALTER TABLE IF EXISTS foundation_notification_events ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_notification_events ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_notification_events ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_notification_events ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS foundation_notification_events ADD COLUMN IF NOT EXISTS is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS foundation_notification_events ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS foundation_notification_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS foundation_quote_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL,
  actor_user_id TEXT NOT NULL,
  previous_state TEXT,
  current_state TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS foundation_quote_status_events ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS foundation_quote_status_events ADD COLUMN IF NOT EXISTS quote_request_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS foundation_quote_status_events ADD COLUMN IF NOT EXISTS actor_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_quote_status_events ADD COLUMN IF NOT EXISTS previous_state TEXT;
ALTER TABLE IF EXISTS foundation_quote_status_events ADD COLUMN IF NOT EXISTS current_state TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_quote_status_events ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE IF EXISTS foundation_quote_status_events ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS foundation_quote_status_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS foundation_rate_limit_counters (
  user_id TEXT NOT NULL,
  command_name TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  window_seconds INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, command_name, window_started_at, window_seconds)
);
ALTER TABLE IF EXISTS foundation_rate_limit_counters ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS foundation_rate_limit_counters ADD COLUMN IF NOT EXISTS command_name TEXT;
ALTER TABLE IF EXISTS foundation_rate_limit_counters ADD COLUMN IF NOT EXISTS window_started_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS foundation_rate_limit_counters ADD COLUMN IF NOT EXISTS window_seconds INTEGER;
ALTER TABLE IF EXISTS foundation_rate_limit_counters ADD COLUMN IF NOT EXISTS request_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS foundation_rate_limit_counters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS foundation_user_extension (
  user_id TEXT PRIMARY KEY,
  profile_visibility TEXT NOT NULL DEFAULT 'workspace',
  notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  accessibility_runtime_prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  trauma_informed_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  service_deleted_at TIMESTAMPTZ,
  instant_call_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  instant_call_rate_credits INTEGER,
  instant_call_interval_minutes INTEGER NOT NULL DEFAULT 10,
  short_description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'workspace';
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS accessibility_runtime_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS trauma_informed_defaults JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS service_deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Foundation instant 1:1 call opt-in (issue #808): a provider may opt in to take an immediate,
-- paid, time-metered live call. instant_call_enabled is the on/off switch; instant_call_rate_credits
-- is the whole-number ServiceCredits charge per block (nullable, only meaningful when enabled, >= 1
-- enforced in the app); instant_call_interval_minutes is the per-block length in minutes (default 10).
-- The ring/call/billing live in later tasks — these columns only hold the provider's settings.
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS instant_call_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS instant_call_rate_credits INTEGER;
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS instant_call_interval_minutes INTEGER NOT NULL DEFAULT 10;
-- Multi-currency (issue #120): a Foundation provider can list a service rate on their profile.
-- rate_amount is the listed amount; rate_currency names its currency (FK -> currencies.code). The quote
-- process stays free-text/manual this version (no structured quote amount). "Accepts ServiceCredits" is a
-- separate field in foundation_provider_accepted_currencies, never derived from rate_currency.
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS rate_amount NUMERIC;
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS rate_currency TEXT REFERENCES currencies(code);
-- A provider's own short blurb, one or two sentences, shown on their Foundation listing before a
-- member requests a quote. It is the provider's plain "here's what I offer" line — separate from the
-- Directory headline/bio (which the provider may not control) and from the offered-skill chips.
-- Capped to ~200 characters in the app; nullable, because a provider need not set one.
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS short_description TEXT;

-- A Foundation provider opts in to being contacted to offer specific skills. This is the
-- "willing to offer SAID skill" signal that distinguishes Foundation from the Directory (where a
-- profile merely lists a skill): a survivor searching Foundation only sees providers who chose to
-- be contactable for that skill. Each row is one offered skill for one provider; the skill_id must
-- be one the provider already lists on their claimed Directory profile (enforced in the repository).
-- A provider with zero rows here is not surfaced as a Foundation provider at all.
CREATE TABLE IF NOT EXISTS foundation_provider_skills (
  user_id TEXT NOT NULL,
  skill_id UUID NOT NULL REFERENCES skills_taxonomy_skills(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, skill_id)
);
ALTER TABLE IF EXISTS foundation_provider_skills ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_provider_skills ADD COLUMN IF NOT EXISTS skill_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS foundation_provider_skills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- skill_id must point at a real taxonomy skill; CASCADE so removing a skill clears the offers.
-- No FK on user_id: an offer doesn't require a foundation_user_extension row and there's no
-- canonical users table to reference; the repository constrains skill_id to the member's own
-- Directory skills on write, so the app can't create orphans. Guarded so a legacy table without
-- the constraint converges and a fresh table doesn't double-add it.
DO $foundation_provider_skills_skill_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'foundation_provider_skills_skill_id_fkey' AND constraint_schema = current_schema()
      AND table_name = 'foundation_provider_skills'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE foundation_provider_skills
      ADD CONSTRAINT foundation_provider_skills_skill_id_fkey
      FOREIGN KEY (skill_id) REFERENCES skills_taxonomy_skills(id) ON DELETE CASCADE;
  END IF;
END
$foundation_provider_skills_skill_fk$;
CREATE INDEX IF NOT EXISTS idx_foundation_provider_skills_skill ON foundation_provider_skills (skill_id);

CREATE TABLE IF NOT EXISTS foundation_provider_accepted_currencies (
  user_id TEXT NOT NULL REFERENCES foundation_user_extension(user_id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  PRIMARY KEY (user_id, currency_code)
);
ALTER TABLE IF EXISTS foundation_provider_accepted_currencies ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS foundation_provider_accepted_currencies ADD COLUMN IF NOT EXISTS currency_code TEXT;
CREATE INDEX IF NOT EXISTS idx_foundation_provider_accepted_currencies_user ON foundation_provider_accepted_currencies(user_id);

CREATE TABLE IF NOT EXISTS foundation_call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL,
  created_by_user_id TEXT NOT NULL,
  modality TEXT NOT NULL,
  stream_call_id TEXT NOT NULL,
  requested_duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS thread_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS created_by_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS modality TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS stream_call_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS requested_duration_minutes INTEGER NOT NULL DEFAULT 30;
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'created';
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Foundation instant 1:1 call ring/answer lifecycle (issue #808 task 3). The base table above models a
-- generic call session; these columns add the ring -> answer | declined | timed_out -> in_call -> ended
-- state machine for the opt-in metered "Connect now" call. caller_user_id is who rang, callee_user_id is
-- the provider being rung. ring_status is the lifecycle state. ring_expires_at is when an unanswered ring
-- auto-times-out (~60s). answered_at / ended_at / ended_by_user_id record the transitions.
-- first_block_charged is the clean seam for issue #808 task 4 (per-block billing): task 4 flips it true
-- when the first block is charged on answer. NO billing happens here -- this column is a placeholder the
-- billing task hooks into.
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS caller_user_id TEXT;
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS callee_user_id TEXT;
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS ring_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS ring_expires_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS ended_by_user_id TEXT;
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS first_block_charged BOOLEAN NOT NULL DEFAULT FALSE;
-- Issue #808 task 4 (per-block billing for the metered "Connect now" call). Each interval-minute block is
-- charged as a direct ServiceCredits transfer from caller_user_id to callee_user_id (no escrow). The
-- provider's rate + interval are SNAPSHOTTED onto the row at answer time (rate_credits_locked /
-- interval_minutes_locked) so a provider changing their rate mid-call cannot affect an in-progress call.
-- authorized_blocks is the buyer-set cap chosen at ring time (the call can never extend past it in v1).
-- blocks_charged counts paid blocks; paid_through_at = answered_at + blocks_charged * interval and drives
-- the display countdown plus the lazy paid-window expiry (no background job). last_transfer_id is the most
-- recent ServiceCredits transfer id, kept only for trace. The money itself lives in the service_credits_*
-- tables (financial-record retention) -- these columns only describe the call's billing state.
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS rate_credits_locked INTEGER;
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS interval_minutes_locked INTEGER;
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS authorized_blocks INTEGER;
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS blocks_charged INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS paid_through_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS last_transfer_id TEXT;
-- Why an answered/ringing call ended, when it was not a plain hang-up: 'caller_insufficient_funds' (a
-- block charge failed for lack of balance), 'paid_window_elapsed' (the prepaid time ran out and the caller
-- did not extend), or 'block_cap_reached' (an extend was attempted past the buyer-set cap). NULL for a
-- normal end/decline/timeout.
ALTER TABLE IF EXISTS foundation_call_sessions ADD COLUMN IF NOT EXISTS ended_reason TEXT;
-- One live ring per callee at a time: a partial unique index over the callee while the ring is still
-- ringing prevents two simultaneous incoming calls stacking on the same provider.
CREATE UNIQUE INDEX IF NOT EXISTS foundation_call_sessions_active_ring_per_callee
  ON foundation_call_sessions (callee_user_id)
  WHERE ring_status = 'ringing';
-- The callee's incoming-ring inbox poll and the timeout sweep both filter on ring_status; index it.
CREATE INDEX IF NOT EXISTS foundation_call_sessions_ring_status_idx
  ON foundation_call_sessions (ring_status, ring_expires_at);

-- Web push subscriptions (issue #808 task 5). Deliberately user-global and NOT Foundation-specific in
-- shape so the same table backs any future push need. The Foundation instant-call ring is the first
-- caller: when a provider enables call alerts on a device, that device's Web Push subscription is stored
-- here, and ringInstantCall sends a push to every subscription the callee owns.
--   kind     -- 'web' today; leaves room for 'expo' (native Android push) when #808's Android parity
--               ticket lands, without a schema change.
--   endpoint -- the push service URL the browser gave us (treated as the subscription identity).
--   p256dh / auth -- the subscription's public encryption keys from PushSubscription.getKey(); these are
--               per-subscription client keys, NOT the server VAPID private key (which is never stored in
--               the database and only lives in env).
--   user_agent   -- a short, non-identifying label so a member can tell their devices apart.
--   last_used_at -- stamped when we last sent to this subscription, for housekeeping.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'web',
  endpoint TEXT NOT NULL,
  p256dh TEXT,
  auth TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
ALTER TABLE IF EXISTS push_subscriptions ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS push_subscriptions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS push_subscriptions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'web';
ALTER TABLE IF EXISTS push_subscriptions ADD COLUMN IF NOT EXISTS endpoint TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS push_subscriptions ADD COLUMN IF NOT EXISTS p256dh TEXT;
ALTER TABLE IF EXISTS push_subscriptions ADD COLUMN IF NOT EXISTS auth TEXT;
ALTER TABLE IF EXISTS push_subscriptions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE IF EXISTS push_subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS push_subscriptions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
-- One row per (user, endpoint): a device re-subscribing upserts rather than duplicating.
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_key
  ON push_subscriptions (user_id, endpoint);
-- Sending a push loads all of a user's subscriptions; index the lookup.
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS foundation_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS foundation_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS foundation_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_admin_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_admin_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS foundation_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS foundation_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === SOCKET-RELAY MODULE ===
-- Rename legacy socket_relay_* tables to socket_relay_* before the CREATE ... IF NOT EXISTS blocks,
-- so an existing DB keeps its rows under the new names and a fresh DB builds the new names directly.
-- Each RENAME is a no-op on a fresh DB (table does not yet exist) and on a DB already renamed.
ALTER TABLE IF EXISTS socketrelay_user_extension RENAME TO socket_relay_user_extension;
ALTER TABLE IF EXISTS socketrelay_requests RENAME TO socket_relay_requests;
ALTER TABLE IF EXISTS socketrelay_request_accepted_currencies RENAME TO socket_relay_request_accepted_currencies;
ALTER TABLE IF EXISTS socketrelay_request_events RENAME TO socket_relay_request_events;
ALTER TABLE IF EXISTS socketrelay_fulfillments RENAME TO socket_relay_fulfillments;
ALTER TABLE IF EXISTS socketrelay_fulfillment_participants RENAME TO socket_relay_fulfillment_participants;
ALTER TABLE IF EXISTS socketrelay_messages RENAME TO socket_relay_messages;
ALTER TABLE IF EXISTS socketrelay_admin_audit_trail RENAME TO socket_relay_admin_audit_trail;
-- Drop the legacy-named price-consistency CHECK constraint if an older DB still carries it; the
-- DO-block further down recreates it under the new socket_relay_requests_price_consistency_check name.
ALTER TABLE IF EXISTS socket_relay_requests DROP CONSTRAINT IF EXISTS socketrelay_requests_price_consistency_check;
CREATE TABLE IF NOT EXISTS socket_relay_user_extension (
  user_id TEXT PRIMARY KEY,
  bio TEXT,
  relay_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  presence_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  service_deleted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS socket_relay_user_extension ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS socket_relay_user_extension ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE IF EXISTS socket_relay_user_extension ADD COLUMN IF NOT EXISTS relay_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS socket_relay_user_extension ADD COLUMN IF NOT EXISTS presence_opt_in BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS socket_relay_user_extension ADD COLUMN IF NOT EXISTS service_deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS socket_relay_user_extension ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS socket_relay_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  owner_username TEXT,
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  -- Per-request location (a request can be for a different place than where the member lives — a
  -- second property, a cross-city errand, a package delivery abroad). city/state/country default from
  -- the member's directory profile in the create form, but are freely overridable per request. City
  -- stays "city or neighborhood only, never an exact address" for privacy.
  city TEXT,
  state TEXT,
  country TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'open',
  reopened_count INTEGER NOT NULL DEFAULT 0,
  claimed_fulfillment_id UUID,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A post is automatically treated as expired once expires_at passes (28 days after it was posted or
  -- last re-posted). Expiry is derived at read time from this column, so no scheduled job is needed.
  expires_at TIMESTAMPTZ,
  UNIQUE (owner_user_id, idempotency_key)
);
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS owner_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS owner_username TEXT;
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS details TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS reopened_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS claimed_fulfillment_id UUID;
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS idempotency_key TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Auto-expiry (28 days). Nullable so it can be backfilled from each existing post's created_at without a
-- blocking default; new posts and re-posts always set it explicitly in code.
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
UPDATE socket_relay_requests SET expires_at = created_at + INTERVAL '28 days' WHERE expires_at IS NULL;
-- Multi-currency (issue #120): SocketRelay is mutual aid and posts are free. These OPTIONAL columns let a
-- request name an offered reward when one exists; "Free" must render from the ABSENCE of a price (NULL),
-- never as $0. Accepted currencies (if any) live in socket_relay_request_accepted_currencies.
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS price_amount NUMERIC;
ALTER TABLE IF EXISTS socket_relay_requests ADD COLUMN IF NOT EXISTS price_currency TEXT REFERENCES currencies(code);
-- Price/value-type consistency (issue #120 / #420): a request either names no value type (both NULL) or
-- names a value type, with a positive amount for priced types and NO amount for amount-less types
-- (Free, Barter — currencies.requires_amount = FALSE). "Free" therefore renders from price_currency =
-- 'FREE' with a NULL amount, never as $0. Drop the older strict constraint (which forbade amount-less
-- named types) so legacy DBs get the relaxed rule; the guarded block re-adds it under the same name.
ALTER TABLE IF EXISTS socket_relay_requests DROP CONSTRAINT IF EXISTS socket_relay_requests_price_consistency_check;
DO $socket_relay_requests_price_consistency$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'socket_relay_requests_price_consistency_check' AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE socket_relay_requests
      ADD CONSTRAINT socket_relay_requests_price_consistency_check
      CHECK (
        (price_amount IS NULL AND price_currency IS NULL) OR
        (price_currency IS NOT NULL AND (price_amount IS NULL OR price_amount > 0))
      );
  END IF;
END
$socket_relay_requests_price_consistency$;
CREATE TABLE IF NOT EXISTS socket_relay_request_accepted_currencies (
  request_id UUID NOT NULL REFERENCES socket_relay_requests(id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  PRIMARY KEY (request_id, currency_code)
);
ALTER TABLE IF EXISTS socket_relay_request_accepted_currencies ADD COLUMN IF NOT EXISTS request_id UUID;
ALTER TABLE IF EXISTS socket_relay_request_accepted_currencies ADD COLUMN IF NOT EXISTS currency_code TEXT;
CREATE INDEX IF NOT EXISTS idx_socket_relay_request_accepted_currencies_request ON socket_relay_request_accepted_currencies(request_id);

CREATE TABLE IF NOT EXISTS socket_relay_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  actor_user_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS socket_relay_request_events ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS socket_relay_request_events ADD COLUMN IF NOT EXISTS request_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS socket_relay_request_events ADD COLUMN IF NOT EXISTS actor_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_request_events ADD COLUMN IF NOT EXISTS event_name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_request_events ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS socket_relay_request_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS socket_relay_fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  requester_user_id TEXT NOT NULL,
  fulfiller_user_id TEXT NOT NULL,
  -- Denormalized @usernames captured at claim time (mirrors socket_relay_requests.owner_username):
  -- v3 has no server-side store of other members' handles, so store both so the Direct Line chat can
  -- show real participant names instead of a raw user id. Nullable for legacy rows / missing handles.
  requester_username TEXT,
  fulfiller_username TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  close_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS socket_relay_fulfillments ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS socket_relay_fulfillments ADD COLUMN IF NOT EXISTS request_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS socket_relay_fulfillments ADD COLUMN IF NOT EXISTS requester_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_fulfillments ADD COLUMN IF NOT EXISTS fulfiller_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_fulfillments ADD COLUMN IF NOT EXISTS requester_username TEXT;
ALTER TABLE IF EXISTS socket_relay_fulfillments ADD COLUMN IF NOT EXISTS fulfiller_username TEXT;
ALTER TABLE IF EXISTS socket_relay_fulfillments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS socket_relay_fulfillments ADD COLUMN IF NOT EXISTS close_reason TEXT;
ALTER TABLE IF EXISTS socket_relay_fulfillments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS socket_relay_fulfillments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS socket_relay_fulfillment_participants (
  fulfillment_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  participant_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (fulfillment_id, user_id)
);
ALTER TABLE IF EXISTS socket_relay_fulfillment_participants ADD COLUMN IF NOT EXISTS fulfillment_id UUID;
ALTER TABLE IF EXISTS socket_relay_fulfillment_participants ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS socket_relay_fulfillment_participants ADD COLUMN IF NOT EXISTS participant_role TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_fulfillment_participants ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS socket_relay_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id UUID NOT NULL,
  sender_user_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'accepted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS socket_relay_messages ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS socket_relay_messages ADD COLUMN IF NOT EXISTS fulfillment_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS socket_relay_messages ADD COLUMN IF NOT EXISTS sender_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_messages ADD COLUMN IF NOT EXISTS message_text TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_messages ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'accepted';
ALTER TABLE IF EXISTS socket_relay_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS socket_relay_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS socket_relay_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS socket_relay_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_admin_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_admin_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS socket_relay_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS socket_relay_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === GDP MODULE ===
CREATE TABLE IF NOT EXISTS gdp_metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  metric_key TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  dp_suppressed BOOLEAN NOT NULL DEFAULT FALSE,
  lawful_basis TEXT NOT NULL,
  source_plugin TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS gdp_metric_snapshots ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS gdp_metric_snapshots ADD COLUMN IF NOT EXISTS week_start_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS gdp_metric_snapshots ADD COLUMN IF NOT EXISTS metric_key TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS gdp_metric_snapshots ADD COLUMN IF NOT EXISTS metric_value NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS gdp_metric_snapshots ADD COLUMN IF NOT EXISTS dp_suppressed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS gdp_metric_snapshots ADD COLUMN IF NOT EXISTS lawful_basis TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS gdp_metric_snapshots ADD COLUMN IF NOT EXISTS source_plugin TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS gdp_metric_snapshots ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Multi-currency GDP recognition (issue #121): mark metrics that are USD-normalized ESTIMATES (e.g.
-- gdp_total_revenue, which rolls multi-currency volume into USD via currency_usd_rates). The in-product
-- "estimate" label reads this flag; small drift is acceptable and disclosed, since GDP is a morale/
-- transparency figure, not an accounting ledger.
ALTER TABLE IF EXISTS gdp_metric_snapshots ADD COLUMN IF NOT EXISTS is_estimate BOOLEAN NOT NULL DEFAULT FALSE;
-- Mark the USD-normalized aggregate(s) as estimates for any rows that predate the column.
UPDATE gdp_metric_snapshots SET is_estimate = TRUE WHERE metric_key = 'gdp_total_revenue' AND is_estimate = FALSE;

CREATE TABLE IF NOT EXISTS gdp_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS gdp_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS gdp_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS gdp_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS gdp_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS gdp_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS gdp_admin_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS gdp_admin_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS gdp_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS gdp_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Multi-currency GDP recognition (issue #121). The notional USD conversion factor per currency, used
-- ONLY by the GDP estimation layer to roll multi-currency transaction volume into the single,
-- estimate-labeled GDP figure. LEGAL GUARDRAIL: this rate is NEVER surfaced as a per-wallet or
-- per-price "ServiceCredits = fiat" equivalence; a user never sees "your N ServiceCredits = $X". The
-- only place a USD-normalized ServiceCredits value appears is inside the aggregate GDP estimate. The
-- owner curates rates over time; the most recent as_of per currency_code is the active rate.
CREATE TABLE IF NOT EXISTS currency_usd_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  usd_rate NUMERIC NOT NULL CHECK (usd_rate > 0),
  as_of DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (currency_code, as_of)
);
ALTER TABLE IF EXISTS currency_usd_rates ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS currency_usd_rates ADD COLUMN IF NOT EXISTS currency_code TEXT;
ALTER TABLE IF EXISTS currency_usd_rates ADD COLUMN IF NOT EXISTS usd_rate NUMERIC;
ALTER TABLE IF EXISTS currency_usd_rates ADD COLUMN IF NOT EXISTS as_of DATE;
ALTER TABLE IF EXISTS currency_usd_rates ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE IF EXISTS currency_usd_rates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_currency_usd_rates_code_asof ON currency_usd_rates(currency_code, as_of DESC);

-- === MOOD MODULE ===
-- Pseudonymous identity mapping (decoupling). This is the ONLY place a mood
-- pseudonym is linked back to a user_id. Check-ins (mood_submissions below) are
-- stored under the pseudonym, so the check-in/note rows carry no direct account
-- link (pseudo-anonymity). The 7-day cooldown is enforced on this
-- server-controlled pseudonym, which a member cannot mint for themselves, so the
-- cooldown still cannot be bypassed. See ctf/packages/web/lib/mood/repository.ts.
CREATE TABLE IF NOT EXISTS mood_client_identities (
  pseudonym UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS mood_client_identities ADD COLUMN IF NOT EXISTS pseudonym UUID;
ALTER TABLE IF EXISTS mood_client_identities ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS mood_client_identities ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_mood_client_identities_user ON mood_client_identities(user_id);

CREATE TABLE IF NOT EXISTS mood_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  mood_value INTEGER NOT NULL,
  note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pseudonym UUID
);
ALTER TABLE IF EXISTS mood_submissions ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS mood_submissions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS mood_submissions ADD COLUMN IF NOT EXISTS client_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS mood_submissions ADD COLUMN IF NOT EXISTS mood_value INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS mood_submissions ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE IF EXISTS mood_submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS mood_submissions ADD COLUMN IF NOT EXISTS pseudonym UUID;

-- Backfill + sever (idempotent, safe to re-run): assign one pseudonym per existing
-- user, repoint that user's check-ins to it, then blank the direct user_id link on
-- the submission rows so past data is decoupled too.
INSERT INTO mood_client_identities (user_id)
SELECT DISTINCT user_id FROM mood_submissions
WHERE user_id IS NOT NULL AND user_id <> ''
ON CONFLICT (user_id) DO NOTHING;
UPDATE mood_submissions s
SET pseudonym = m.pseudonym
FROM mood_client_identities m
WHERE m.user_id = s.user_id AND s.pseudonym IS NULL AND s.user_id <> '';
UPDATE mood_submissions SET user_id = '' WHERE pseudonym IS NOT NULL AND user_id <> '';

-- Deleting a mapping row cascades that user's check-ins, so account deletion runs
-- through the mapping (see ctf/packages/web/lib/account/deletion-registry.ts).
-- Guarded so re-running schema.sql is idempotent (Postgres has no
-- ADD CONSTRAINT IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mood_submissions_pseudonym_fkey' AND connamespace = current_schema()::regnamespace) THEN
    -- Self-heal orphaned check-ins before enforcing the FK. The backfill above
    -- severs the direct user_id link and repoints rows onto a mapping pseudonym,
    -- so a submission whose pseudonym has no mapping row (an orphan left by
    -- earlier data churn, or by a schema that never enforced this FK) would make
    -- the ADD CONSTRAINT below fail on existing data. Give each orphan its own
    -- server-controlled mapping — user_id is set to the pseudonym text, which is
    -- always unique and can never be a real Clerk id — so no check-in is lost and
    -- ON DELETE CASCADE still deletes it through the mapping. This runs only when
    -- the FK is absent, so on a schema that already enforces it (steady-state
    -- production) the whole block is skipped and no mapping rows are invented.
    INSERT INTO mood_client_identities (pseudonym, user_id)
    SELECT DISTINCT s.pseudonym, s.pseudonym::text
    FROM mood_submissions s
    LEFT JOIN mood_client_identities m ON m.pseudonym = s.pseudonym
    WHERE s.pseudonym IS NOT NULL AND m.pseudonym IS NULL
    ON CONFLICT DO NOTHING;

    ALTER TABLE mood_submissions
      ADD CONSTRAINT mood_submissions_pseudonym_fkey
      FOREIGN KEY (pseudonym) REFERENCES mood_client_identities(pseudonym) ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_mood_submissions_pseudonym ON mood_submissions(pseudonym, submitted_at DESC);

-- === GENTLE PULSE MODULE (DECOMMISSIONED 2026-07-27) ===
-- The GentlePulse plugin was removed from the product (owner decision). Drop its
-- tables and any pre-hyphenation predecessors so a fresh database never creates
-- them and an existing database sheds them. IF EXISTS keeps this a no-op once the
-- tables are already gone; CASCADE removes dependent objects (indexes/constraints).
DROP TABLE IF EXISTS gentle_pulse_favorites CASCADE;
DROP TABLE IF EXISTS gentle_pulse_ratings CASCADE;
DROP TABLE IF EXISTS gentle_pulse_play_events CASCADE;
DROP TABLE IF EXISTS gentle_pulse_library_items CASCADE;
DROP TABLE IF EXISTS gentlepulse_favorites CASCADE;
DROP TABLE IF EXISTS gentlepulse_ratings CASCADE;
DROP TABLE IF EXISTS gentlepulse_play_events CASCADE;
DROP TABLE IF EXISTS gentlepulse_library_items CASCADE;

-- === LEGACY REDIRECTS ===
CREATE TABLE IF NOT EXISTS legacy_profile_redirects (
  plugin_slug TEXT NOT NULL,
  scope TEXT NOT NULL,
  legacy_entity_id UUID NOT NULL,
  current_entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plugin_slug, scope, legacy_entity_id)
);
ALTER TABLE IF EXISTS legacy_profile_redirects ADD COLUMN IF NOT EXISTS plugin_slug TEXT;
ALTER TABLE IF EXISTS legacy_profile_redirects ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE IF EXISTS legacy_profile_redirects ADD COLUMN IF NOT EXISTS legacy_entity_id UUID;
ALTER TABLE IF EXISTS legacy_profile_redirects ADD COLUMN IF NOT EXISTS current_entity_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS legacy_profile_redirects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === LOGIN EVENTS (engagement) ===
-- The sign-in record, and the whole definition of an active member (owner decision, 2026-08-27): a
-- member is active on a day this table holds a row for them, whatever they opened next. `source`
-- says how the row got here. It came from v2 — production has carried it since before v3, defaulting
-- to 'webapp' — but this canonical schema never declared it, so a database built from schema.sql
-- alone lacked a column production has always had. Declared here so the two agree, and so the value
-- is writable everywhere: post/0008 marks the days it rebuilt as 'backfill_launch_gap', which is
-- what tells a reconstructed sign-in day from one that was recorded live.
CREATE TABLE IF NOT EXISTS login_events (
  user_id TEXT NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'webapp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS login_events ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS login_events ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'webapp';
ALTER TABLE IF EXISTS login_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_login_events_user ON login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_created ON login_events(created_at);
-- A constraint this file cannot express, recorded because writing to this table without knowing it
-- is how post/0008 failed on its first production run. Production carries a v2 foreign key,
-- `login_events_user_id_fkey`, from `user_id` to `users(id)` (see ctf/schema-prod4.6.2026.sql). It is
-- NOT created here: `users` is the Clerk mirror carried over from v2 and is not part of this
-- canonical schema, so a database built from this file alone has neither the table nor the key.
-- What it means for anything writing here: on production a sign-in row can only exist for an account
-- the identity mirror still holds, and the per-plugin command trails outlive that mirror, so evidence
-- of a session can name a member who is gone. Filter to members present in `users` when that table
-- exists, or one orphan aborts the whole insert.
-- Legacy guard: on databases cloned before `created_at` was a `timestamptz`, this column can be a
-- plain `timestamp without time zone`. The guarded `ADD COLUMN IF NOT EXISTS` above does NOT retype
-- an existing column, so it stays the legacy type. That breaks the UTC-day index below: with a
-- timestamp-without-tz input, `created_at AT TIME ZONE 'UTC'` resolves to the STABLE overload of
-- `timezone()` and the index build fails with "functions in index expression must be marked
-- IMMUTABLE" (this is what stalled the Update Neon DB apply). Retype it to `timestamptz` first,
-- interpreting the stored wall-clock as UTC. The block is conditional so it is a no-op (and does not
-- shift values) once the column is already `timestamptz`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'login_events' AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE login_events
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING (created_at AT TIME ZONE 'UTC');
  END IF;
END
$$;
-- One-time dedupe so the unique index below can be built on legacy data. Before that index existed
-- the app could write more than one row per member per UTC day (every sign-in, across instances),
-- so a database cloned from that era has duplicate (user_id, UTC-day) rows. Collapse each group to a
-- single row — keep the earliest sign-in of the day — before creating the index. `login_events` is
-- only a daily activity signal (the 7-day "active members" window reads DISTINCT user_id), so which
-- row survives does not matter. This DELETE is naturally idempotent: once deduped it removes nothing.
DELETE FROM login_events
WHERE ctid IN (
  SELECT ctid FROM (
    SELECT ctid, ROW_NUMBER() OVER (
      PARTITION BY user_id, (created_at AT TIME ZONE 'UTC')::date
      ORDER BY created_at ASC, ctid ASC
    ) AS rn
    FROM login_events
  ) ranked
  WHERE ranked.rn > 1
);
-- At most one row per member per UTC day. This makes the "record a sign-in once per day"
-- dedupe atomic at the database level (the app inserts with ON CONFLICT DO NOTHING), so two
-- concurrent requests for the same member on the same UTC day cannot both write a row. The day
-- is computed in UTC explicitly so the dedupe does not depend on the database session timezone.
-- Because `created_at` is guaranteed `timestamptz` by the block above, the `AT TIME ZONE 'UTC'`
-- expression here resolves to the IMMUTABLE overload of `timezone()` and is index-safe.
CREATE UNIQUE INDEX IF NOT EXISTS uq_login_events_user_utc_day
  ON login_events (user_id, ((created_at AT TIME ZONE 'UTC')::date));

-- === PeerProgramming MODULE ===
CREATE TABLE IF NOT EXISTS peer_programming_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  cohort_label TEXT NOT NULL,
  fallback_open BOOLEAN NOT NULL DEFAULT FALSE,
  topic_id UUID,
  assigned_by_user_id TEXT NOT NULL,
  is_standing BOOLEAN NOT NULL DEFAULT FALSE,
  -- Cohort lifecycle. 'active' is a live cohort; 'ended' is a closed, read-only cohort (admin "End
  -- cohort" today; a week-end auto-transition later). An ended cohort's Direct Line is frozen — the
  -- message/reply routes reject posting to it. The standing Cohort 1 is never ended.
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  ended_at TIMESTAMPTZ,
  ended_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (week_start_date, cohort_label)
);
ALTER TABLE IF EXISTS peer_programming_cohorts ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS peer_programming_cohorts ADD COLUMN IF NOT EXISTS week_start_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS peer_programming_cohorts ADD COLUMN IF NOT EXISTS cohort_label TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_cohorts ADD COLUMN IF NOT EXISTS fallback_open BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS peer_programming_cohorts ADD COLUMN IF NOT EXISTS topic_id UUID;
ALTER TABLE IF EXISTS peer_programming_cohorts ADD COLUMN IF NOT EXISTS assigned_by_user_id TEXT NOT NULL DEFAULT '';
-- The single standing, always-open Cohort 1 used in low-population mode
-- (PEER_PROGRAMMING_SINGLE_OPEN_COHORT). At most one row may have is_standing = TRUE, enforced by
-- the partial-unique index below; that one row persists across weeks and is found by is_standing,
-- not by the current week.
ALTER TABLE IF EXISTS peer_programming_cohorts ADD COLUMN IF NOT EXISTS is_standing BOOLEAN NOT NULL DEFAULT FALSE;
-- Cohort lifecycle status: 'active' (live) or 'ended' (closed, read-only Direct Line). Additive and
-- backfills every existing row to 'active'; nothing is ever 'ended' until an admin ends a cohort.
ALTER TABLE IF EXISTS peer_programming_cohorts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS peer_programming_cohorts ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS peer_programming_cohorts ADD COLUMN IF NOT EXISTS ended_by_user_id TEXT;
ALTER TABLE IF EXISTS peer_programming_cohorts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS peer_programming_cohorts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Guarantee there is at most one standing cohort. The find-or-create helper uses this partial-unique
-- index for its ON CONFLICT (is_standing) WHERE is_standing inference.
CREATE UNIQUE INDEX IF NOT EXISTS uq_peer_programming_cohorts_standing
  ON peer_programming_cohorts (is_standing)
  WHERE is_standing;

CREATE TABLE IF NOT EXISTS peer_programming_cohort_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cohort_id, user_id)
);
ALTER TABLE IF EXISTS peer_programming_cohort_members ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS peer_programming_cohort_members ADD COLUMN IF NOT EXISTS cohort_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS peer_programming_cohort_members ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_cohort_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Roster reads list a cohort's members ordered by join time (listCohortMemberUserIds). Under the
-- single standing, always-open Cohort 1 mode every active member joins one cohort, so that one row
-- set grows without bound; this index keeps the per-cohort, time-ordered read cheap instead of a
-- table scan + sort.
CREATE INDEX IF NOT EXISTS idx_peer_programming_cohort_members_cohort_created
  ON peer_programming_cohort_members (cohort_id, created_at);

CREATE TABLE IF NOT EXISTS peer_programming_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL,
  author_user_id TEXT NOT NULL,
  parent_message_id UUID,
  body TEXT NOT NULL,
  tier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS peer_programming_messages ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS peer_programming_messages ADD COLUMN IF NOT EXISTS cohort_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS peer_programming_messages ADD COLUMN IF NOT EXISTS author_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_messages ADD COLUMN IF NOT EXISTS parent_message_id UUID;
ALTER TABLE IF EXISTS peer_programming_messages ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_messages ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- The room read lists one cohort's messages in time order (listMessages: WHERE cohort_id = $1
-- ORDER BY created_at ASC LIMIT 300). Without this index that is a sequential scan + sort over the
-- whole table; under the single standing, always-open Cohort 1 mode every member's messages pile
-- into one cohort that grows without bound, so the scan eventually exceeds the DB statement timeout
-- and the room request fails (the room page then shows "Failed to load room"). This index keeps the
-- read on an index range so it stays fast as the table grows.
CREATE INDEX IF NOT EXISTS idx_peer_programming_messages_cohort_created
  ON peer_programming_messages (cohort_id, created_at);

CREATE TABLE IF NOT EXISTS peer_programming_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID,
  user_id TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  suggestion_category TEXT NOT NULL,
  release_surface TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS peer_programming_feedback ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS peer_programming_feedback ADD COLUMN IF NOT EXISTS cohort_id UUID;
ALTER TABLE IF EXISTS peer_programming_feedback ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_feedback ADD COLUMN IF NOT EXISTS issue_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_feedback ADD COLUMN IF NOT EXISTS suggestion_category TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_feedback ADD COLUMN IF NOT EXISTS release_surface TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_feedback ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_feedback ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS peer_programming_assignment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);
ALTER TABLE IF EXISTS peer_programming_assignment_notifications ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS peer_programming_assignment_notifications ADD COLUMN IF NOT EXISTS cohort_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS peer_programming_assignment_notifications ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_assignment_notifications ADD COLUMN IF NOT EXISTS idempotency_key TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_assignment_notifications ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS peer_programming_assignment_notifications ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS peer_programming_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS peer_programming_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS peer_programming_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_admin_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_admin_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS peer_programming_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS peer_programming_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Single-row settings singleton for admin-flippable PeerProgramming toggles. The CHECK on
-- singleton_id forces every row to share the same primary key value (TRUE), so there can only ever
-- be one row. single_open_cohort_enabled is nullable on purpose: NULL means "unset" — the resolver
-- then falls back to the env flag PEER_PROGRAMMING_SINGLE_OPEN_COHORT, then to default ON. A non-null
-- value (TRUE/FALSE) is the admin's explicit choice and supersedes the env flag.
CREATE TABLE IF NOT EXISTS peer_programming_settings (
  singleton_id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_id),
  single_open_cohort_enabled BOOLEAN,
  updated_by_user_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS peer_programming_settings ADD COLUMN IF NOT EXISTS singleton_id BOOLEAN;
ALTER TABLE IF EXISTS peer_programming_settings ADD COLUMN IF NOT EXISTS single_open_cohort_enabled BOOLEAN;
ALTER TABLE IF EXISTS peer_programming_settings ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT;
ALTER TABLE IF EXISTS peer_programming_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === TRUST MODULE ===
CREATE TABLE IF NOT EXISTS trust_user_extension (
  user_id TEXT PRIMARY KEY,
  trust_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS trust_user_extension ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS trust_user_extension ADD COLUMN IF NOT EXISTS trust_evidence JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS trust_user_extension ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Dropped 2026-08-10: a member never chose who sees their trust, so the column held a setting
-- the product does not have. What another member sees is decided in code, in
-- app/api/trust/user/[userId]/route.ts, the same way for everyone.
ALTER TABLE IF EXISTS trust_user_extension DROP COLUMN IF EXISTS trust_visibility;
-- Dropped 2026-08-10: admin verification review was removed, so nothing set this and no surface
-- showed it. The platform does not vet people; Trust reports what a member has actually done.
ALTER TABLE IF EXISTS trust_user_extension DROP COLUMN IF EXISTS trust_status;

CREATE TABLE IF NOT EXISTS trust_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id TEXT,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_user_id TEXT,
  request_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS trust_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS trust_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_user_id TEXT;
ALTER TABLE IF EXISTS trust_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS trust_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS trust_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS trust_admin_audit_trail ADD COLUMN IF NOT EXISTS target_user_id TEXT;
ALTER TABLE IF EXISTS trust_admin_audit_trail ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE IF EXISTS trust_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS trust_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- trust_signal_snapshot: an append-only record of one computed trust-signal pass for a user.
-- Trust owns no primary participation data; each row captures the COARSE, derived metrics
-- (login/engagement frequency and completed SocketRelay trades) read at snapshot time from the
-- already-seeded upstream plugins, plus the human-readable evidence built from those real counts.
-- It deliberately stores no numeric "trust score" — the signal is qualitative. `snapshot` holds the
-- derived metric bundle as JSONB; `snapshot_type` names the derivation model version.
CREATE TABLE IF NOT EXISTS trust_signal_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_type TEXT NOT NULL DEFAULT 'cross_plugin_engagement_v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS trust_signal_snapshot ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS trust_signal_snapshot ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS trust_signal_snapshot ADD COLUMN IF NOT EXISTS snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS trust_signal_snapshot ADD COLUMN IF NOT EXISTS snapshot_type TEXT NOT NULL DEFAULT 'cross_plugin_engagement_v1';
ALTER TABLE IF EXISTS trust_signal_snapshot ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_trust_signal_snapshot_user ON trust_signal_snapshot(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_signal_snapshot_created ON trust_signal_snapshot(created_at);

-- === WEEKLY PERFORMANCE MODULE ===
CREATE TABLE IF NOT EXISTS weekly_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  metric_key TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_unit TEXT NOT NULL,
  source_plugin TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS weekly_performance_metrics ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS weekly_performance_metrics ADD COLUMN IF NOT EXISTS week_start_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS weekly_performance_metrics ADD COLUMN IF NOT EXISTS metric_key TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS weekly_performance_metrics ADD COLUMN IF NOT EXISTS metric_value NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS weekly_performance_metrics ADD COLUMN IF NOT EXISTS metric_unit TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS weekly_performance_metrics ADD COLUMN IF NOT EXISTS source_plugin TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS weekly_performance_metrics ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS weekly_performance_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS weekly_performance_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS weekly_performance_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS weekly_performance_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS weekly_performance_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS weekly_performance_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS weekly_performance_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS weekly_performance_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS weekly_performance_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS weekly_performance_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- workforce_export_jobs is retained but unused: report exporting was removed (no routes write it);
-- the table is left in place rather than dropped to avoid a destructive migration. Workforce is a
-- read-only live tracker.
CREATE TABLE IF NOT EXISTS workforce_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  export_type TEXT NOT NULL,
  export_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Directory admin audit trail (added 2026-08-28). Owner directive: every admin action is recorded, on
-- every surface. Directory had lib/directory/audit.ts, which builds the whole contract-shaped event and
-- ends in console.info — a line in the server's log, which nothing can query, no screen can show, and
-- which ages out of the host's retention window. This is the record it should always have written,
-- including for the profile takedown a person outside the app asks for.
CREATE TABLE IF NOT EXISTS directory_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'success',
  error_category TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS directory_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS directory_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_admin_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_admin_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS directory_admin_audit_trail ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'success';
ALTER TABLE IF EXISTS directory_admin_audit_trail ADD COLUMN IF NOT EXISTS error_category TEXT;
ALTER TABLE IF EXISTS directory_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS directory_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- The Audit log tab reads newest-first; the actor and command columns support narrowing to one admin
-- or one kind of action without a sequential scan once the table has years in it.
CREATE INDEX IF NOT EXISTS idx_directory_admin_audit_trail_lookup
  ON directory_admin_audit_trail (created_at DESC, actor_id, command);

-- Feed and Announcements admin audit trail (added 2026-08-28). Owner directive: every admin action is
-- recorded, on every surface. Both surfaces share lib/feed/audit.ts, which builds the whole
-- contract-shaped event and ends in console.info — a line in the server's log, which nothing can
-- query, no screen can show, and which ages out of the host's retention window. One table serves
-- both because the helper already did: plugin_id says which surface the action was taken on.
CREATE TABLE IF NOT EXISTS feed_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  plugin_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'success',
  error_category TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS feed_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS feed_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_admin_audit_trail ADD COLUMN IF NOT EXISTS plugin_id TEXT NOT NULL DEFAULT 'feed';
ALTER TABLE IF EXISTS feed_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_admin_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_admin_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS feed_admin_audit_trail ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'success';
ALTER TABLE IF EXISTS feed_admin_audit_trail ADD COLUMN IF NOT EXISTS error_category TEXT;
ALTER TABLE IF EXISTS feed_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS feed_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- The Audit log panel reads newest-first and can narrow to one surface; actor and command support
-- narrowing to one admin or one kind of action without a sequential scan.
CREATE INDEX IF NOT EXISTS idx_feed_admin_audit_trail_lookup
  ON feed_admin_audit_trail (created_at DESC, plugin_id, actor_id, command);

-- Comic admin audit trail (added 2026-08-28). Owner directive: every admin action is recorded, on
-- every surface. lib/comic/audit.ts builds the whole contract-shaped event and ends in console.info —
-- a line in the server's log, which nothing can query, no screen can show, and which ages out of the
-- host's retention window. These are decisions about other people's contributions: accepting one,
-- declining it with a reason, editing a knowledge entry, regenerating or resolving a review turn.
CREATE TABLE IF NOT EXISTS comic_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'success',
  error_category TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS comic_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS comic_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_admin_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_admin_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_admin_audit_trail ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'success';
ALTER TABLE IF EXISTS comic_admin_audit_trail ADD COLUMN IF NOT EXISTS error_category TEXT;
ALTER TABLE IF EXISTS comic_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS comic_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- The Audit log panel reads newest-first; actor and command support narrowing to one admin or one
-- kind of decision without a sequential scan.
CREATE INDEX IF NOT EXISTS idx_comic_admin_audit_trail_lookup
  ON comic_admin_audit_trail (created_at DESC, actor_id, command);


-- What Works admin audit trail (added 2026-08-28). Owner directive: every admin action is recorded,
-- on every surface. lib/what-works/audit.ts builds the whole contract-shaped event and ends in
-- console.info — a line in the server's log, which nothing can query, no screen can show, and which
-- ages out of the host's retention window. These are decisions about what members see recommended
-- and about suggestions members made: editing or removing a product, adding or retiring a problem.
CREATE TABLE IF NOT EXISTS what_works_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'success',
  error_category TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS what_works_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS what_works_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS what_works_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS what_works_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS what_works_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS what_works_admin_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS what_works_admin_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS what_works_admin_audit_trail ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'success';
ALTER TABLE IF EXISTS what_works_admin_audit_trail ADD COLUMN IF NOT EXISTS error_category TEXT;
ALTER TABLE IF EXISTS what_works_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS what_works_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- The Audit log panel reads newest-first; actor and command support narrowing to one admin or one
-- kind of decision without a sequential scan.
CREATE INDEX IF NOT EXISTS idx_what_works_admin_audit_trail_lookup
  ON what_works_admin_audit_trail (created_at DESC, actor_id, command);

-- Mutual Time admin audit trail (added 2026-08-28). Owner directive: every admin action is recorded,
-- on every surface. lib/mutual-time/audit.ts builds the whole contract-shaped event and ends in
-- console.info — a line in the server's log, which nothing can query, no screen can show, and which
-- ages out of the host's retention window. Opening an event and closing one decide what members can
-- put their time into, so both belong in a record an admin can read back.
CREATE TABLE IF NOT EXISTS mutual_time_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'success',
  error_category TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS mutual_time_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS mutual_time_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS mutual_time_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS mutual_time_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS mutual_time_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS mutual_time_admin_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS mutual_time_admin_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS mutual_time_admin_audit_trail ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'success';
ALTER TABLE IF EXISTS mutual_time_admin_audit_trail ADD COLUMN IF NOT EXISTS error_category TEXT;
ALTER TABLE IF EXISTS mutual_time_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS mutual_time_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- The Audit log panel reads newest-first; actor and command support narrowing to one admin or one
-- kind of action without a sequential scan.
CREATE INDEX IF NOT EXISTS idx_mutual_time_admin_audit_trail_lookup
  ON mutual_time_admin_audit_trail (created_at DESC, actor_id, command);

-- Bug report admin audit trail (added 2026-08-28). Owner directive: every admin action is recorded,
-- on every surface. Bug reports had no audit machinery at all — no table, no helper, not even a log
-- line — so resolving a held report left nothing behind. That decision matters: 'release' sends the
-- member's redacted report on to the triage repo, 'reject' drops it so it never goes anywhere, and
-- the member is never told which happened.
--
-- Deliberately holds no report content and no reporter id: the report body is the sensitive part and
-- is redacted before it ever leaves this app, so the trail records which report was decided and by
-- whom, never what it said.
CREATE TABLE IF NOT EXISTS bug_report_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'success',
  error_category TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS bug_report_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS bug_report_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS bug_report_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS bug_report_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS bug_report_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS bug_report_admin_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS bug_report_admin_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS bug_report_admin_audit_trail ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'success';
ALTER TABLE IF EXISTS bug_report_admin_audit_trail ADD COLUMN IF NOT EXISTS error_category TEXT;
ALTER TABLE IF EXISTS bug_report_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS bug_report_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- The Audit log panel reads newest-first; actor and command support narrowing to one admin or one
-- kind of decision without a sequential scan.
CREATE INDEX IF NOT EXISTS idx_bug_report_admin_audit_trail_lookup
  ON bug_report_admin_audit_trail (created_at DESC, actor_id, command);

CREATE TABLE IF NOT EXISTS workforce_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS workforce_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS workforce_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS workforce_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS workforce_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS workforce_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS workforce_admin_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS workforce_admin_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS workforce_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workforce_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================
-- MISSING COLUMNS ON EXISTING TABLES (87 columns)
-- ============================================================

-- announcement_revisions (2 missing)
ALTER TABLE IF EXISTS announcement_revisions ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 0;

-- foundation_connection_threads (4 missing)
ALTER TABLE IF EXISTS foundation_connection_threads ADD COLUMN IF NOT EXISTS survivor_user_id TEXT;
ALTER TABLE IF EXISTS foundation_connection_threads ADD COLUMN IF NOT EXISTS provider_user_id TEXT;
ALTER TABLE IF EXISTS foundation_connection_threads ADD COLUMN IF NOT EXISTS stream_channel_id TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE IF EXISTS foundation_connection_threads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE IF EXISTS foundation_connection_threads ADD COLUMN IF NOT EXISTS provider_directory_profile_id TEXT;

-- foundation_quote_requests (5 missing)
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS survivor_user_id TEXT;
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS provider_user_id TEXT;
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES foundation_connection_threads(id);
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'open';
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS last_transitioned_at TIMESTAMPTZ;
-- Priced quote (issue #420/#425). This is the one-off engagement path only: when a provider responds
-- they attach an amount + currency, and on close that value is the settled value (settled_at stamped),
-- which the GDP recognition layer reads per currency. Foundation 1:1 instant calls are
-- ServiceCredits-only and settle elsewhere (foundation_call_sessions). Recurring engagements are not
-- quoted here at all — their ongoing value is recognized through the Recurring Activity plugin (owner
-- decision, legal), so there is no recurring flag on the quote. quoted_currency is an FK to the shared
-- currencies catalog (the same catalog LightHouse/TrustTransport use).
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS quoted_amount NUMERIC;
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS quoted_currency TEXT REFERENCES currencies(code);
ALTER TABLE IF EXISTS foundation_quote_requests ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

-- skill_up_enrollments (1 missing)
ALTER TABLE IF EXISTS skill_up_enrollments ADD COLUMN IF NOT EXISTS progress_percent NUMERIC NOT NULL DEFAULT 0;

-- service_credits_adapter_outbox (1 missing)
ALTER TABLE IF EXISTS service_credits_adapter_outbox ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;

-- service_credits_dispute_adjustments (9 missing)
ALTER TABLE IF EXISTS service_credits_dispute_adjustments ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE IF EXISTS service_credits_dispute_adjustments ADD COLUMN IF NOT EXISTS adjustment_reason TEXT;
ALTER TABLE IF EXISTS service_credits_dispute_adjustments ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE IF EXISTS service_credits_dispute_adjustments ADD COLUMN IF NOT EXISTS destination_user_id TEXT;
ALTER TABLE IF EXISTS service_credits_dispute_adjustments ADD COLUMN IF NOT EXISTS dispute_case_id UUID;
ALTER TABLE IF EXISTS service_credits_dispute_adjustments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE IF EXISTS service_credits_dispute_adjustments ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;
ALTER TABLE IF EXISTS service_credits_dispute_adjustments ADD COLUMN IF NOT EXISTS source_user_id TEXT;
ALTER TABLE IF EXISTS service_credits_dispute_adjustments ADD COLUMN IF NOT EXISTS transfer_id UUID;

-- service_credits_escrow_holds (1 missing)
ALTER TABLE IF EXISTS service_credits_escrow_holds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- service_credits_governance_events (7 missing)
ALTER TABLE IF EXISTS service_credits_governance_events ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE IF EXISTS service_credits_governance_events ADD COLUMN IF NOT EXISTS amount NUMERIC;
-- governance_ticket_id is a free-text ticket reference, not a UUID. Every automated mint passes a
-- prefixed string (e.g. 'unlock:submission:5', 'levelup:<cohort>:completion:<id>',
-- 'contribution-<id>') and the admin governance route accepts free text, so a UUID-typed column
-- rejects every such INSERT with "invalid input syntax for type uuid" and the mint silently fails
-- (best-effort callers swallow it; the unlock approval reward is the symptom that surfaced this).
-- Fresh databases get TEXT here; the guarded block below converts any legacy UUID column to TEXT.
ALTER TABLE IF EXISTS service_credits_governance_events ADD COLUMN IF NOT EXISTS governance_ticket_id TEXT;
ALTER TABLE IF EXISTS service_credits_governance_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE IF EXISTS service_credits_governance_events ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;
ALTER TABLE IF EXISTS service_credits_governance_events ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE IF EXISTS service_credits_governance_events ADD COLUMN IF NOT EXISTS target_user_id TEXT;
-- Legacy fix: if an existing database created governance_ticket_id as UUID, convert it to TEXT so the
-- non-UUID ticket references the app uses can be stored. Idempotent: skips when already TEXT; the
-- uuid->text cast preserves existing values as their canonical text form.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_credits_governance_events'
      AND column_name = 'governance_ticket_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE service_credits_governance_events
      ALTER COLUMN governance_ticket_id TYPE TEXT USING governance_ticket_id::text;
  END IF;
END $$;

-- service_credits_ledger_entries (1 missing — already in CREATE TABLE? double-check)
-- Note: created_at IS in CREATE TABLE; may be a column-ref extraction edge case.
-- Adding defensively since ALTER ADD COLUMN IF NOT EXISTS is safe:
ALTER TABLE IF EXISTS service_credits_ledger_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- service_credits_treasury_events (8 missing)
ALTER TABLE IF EXISTS service_credits_treasury_events ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE IF EXISTS service_credits_treasury_events ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE IF EXISTS service_credits_treasury_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE IF EXISTS service_credits_treasury_events ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;
ALTER TABLE IF EXISTS service_credits_treasury_events ADD COLUMN IF NOT EXISTS reason_code TEXT;
ALTER TABLE IF EXISTS service_credits_treasury_events ADD COLUMN IF NOT EXISTS source_user_id TEXT;
ALTER TABLE IF EXISTS service_credits_treasury_events ADD COLUMN IF NOT EXISTS transfer_id UUID;
ALTER TABLE IF EXISTS service_credits_treasury_events ADD COLUMN IF NOT EXISTS treasury_user_id TEXT;

-- skills_hunt_audit_log (1 — defensive, created_at likely exists via CREATE TABLE)
ALTER TABLE IF EXISTS skills_hunt_audit_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- skills_hunt_directory_profiles (2 — one defensive)
ALTER TABLE IF EXISTS skills_hunt_directory_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skills_hunt_directory_profiles ADD COLUMN IF NOT EXISTS created_by_user_id TEXT;

-- skills_hunt_notifications (2 missing)
ALTER TABLE IF EXISTS skills_hunt_notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skills_hunt_notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

-- skills_hunt_rounds (2 — defensive)
ALTER TABLE IF EXISTS skills_hunt_rounds ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skills_hunt_rounds ADD COLUMN IF NOT EXISTS created_by_user_id TEXT;
-- ServiceCredits reward config (per-round; defaults pay nothing so legacy rounds are unaffected).
-- Brand-new columns, so the CHECK constraints match the CREATE TABLE and add cleanly on a
-- drift-repaired database (the column does not pre-exist, so IF NOT EXISTS adds it with the check).
ALTER TABLE IF EXISTS skills_hunt_rounds ADD COLUMN IF NOT EXISTS reward_credits_per_accept INTEGER NOT NULL DEFAULT 0 CHECK (reward_credits_per_accept >= 0);
ALTER TABLE IF EXISTS skills_hunt_rounds ADD COLUMN IF NOT EXISTS reward_per_user_round_cap INTEGER CHECK (reward_per_user_round_cap IS NULL OR reward_per_user_round_cap >= 0);

-- skills_hunt_proposed_skill_promotions — companion ALTERs for every column so a
-- legacy copy of the table is healed (the CREATE TABLE IF NOT EXISTS above is skipped
-- when the table already exists). NOT NULL columns carry a DEFAULT so the ALTER
-- succeeds on tables with existing rows.
ALTER TABLE IF EXISTS skills_hunt_proposed_skill_promotions ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS skills_hunt_proposed_skill_promotions ADD COLUMN IF NOT EXISTS normalized_skill TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_hunt_proposed_skill_promotions ADD COLUMN IF NOT EXISTS skill_label TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_hunt_proposed_skill_promotions ADD COLUMN IF NOT EXISTS source_submission_id UUID;
ALTER TABLE IF EXISTS skills_hunt_proposed_skill_promotions ADD COLUMN IF NOT EXISTS suggested_sector TEXT;
ALTER TABLE IF EXISTS skills_hunt_proposed_skill_promotions ADD COLUMN IF NOT EXISTS suggested_occupation TEXT;
ALTER TABLE IF EXISTS skills_hunt_proposed_skill_promotions ADD COLUMN IF NOT EXISTS issue_number INTEGER;
ALTER TABLE IF EXISTS skills_hunt_proposed_skill_promotions ADD COLUMN IF NOT EXISTS issue_url TEXT;
ALTER TABLE IF EXISTS skills_hunt_proposed_skill_promotions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'proposed';
ALTER TABLE IF EXISTS skills_hunt_proposed_skill_promotions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS skills_hunt_proposed_skill_promotions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- skills_hunt_submissions (1 — defensive)
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- skills_hunt_submissions — companion ALTERs for every non-key column (2026-06-10).
-- The demo schema's copy of this table predates several columns and the CREATE TABLE
-- IF NOT EXISTS above skips existing tables, so the 2026-06-09 demo seed failed with
-- 'column "full_name" of relation "skills_hunt_submissions" does not exist'. Per the
-- migration rule, every column gets an ADD COLUMN IF NOT EXISTS so legacy tables are
-- always healed. NOT NULL columns carry a DEFAULT so the ALTER succeeds on tables
-- with existing rows. CHECK constraints are not re-added here (matches the existing
-- companion-ALTER precedent above, e.g. url_validation_result).
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS submitter_username TEXT;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS quora_profile_url TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS quora_profile_url_normalized TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS signature_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS country TEXT NULL;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS state TEXT NULL;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS city TEXT NULL;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS review_action TEXT;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS reviewed_by_user_id TEXT;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS points_awarded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS directory_profile_generated_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- skills_hunt_submissions: retire the pre-rename `display_name` column (2026-06-10).
-- The 2026-06-02 rename (`display_name` -> `full_name`) shipped as
-- db/migrations/post/0004, which the demo-schema apply path never runs, so a legacy
-- table can still carry `display_name NOT NULL` and reject inserts that only set
-- `full_name`. Two legacy states are healed here, idempotently:
--   1. `display_name` exists and `full_name` does not -> rename (same as post/0004).
--   2. both exist (the companion ALTER above added `full_name` next to the old
--      column) -> backfill `full_name` from `display_name`, then drop `display_name`.
-- Fresh databases and already-renamed tables match neither branch (no-op).
DO $skills_hunt_submissions_retire_display_name$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'demo'
      AND table_name = 'skills_hunt_submissions'
      AND column_name = 'display_name'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'demo'
        AND table_name = 'skills_hunt_submissions'
        AND column_name = 'full_name'
    ) THEN
      UPDATE skills_hunt_submissions
      SET full_name = display_name
      WHERE (full_name IS NULL OR full_name = '') AND display_name IS NOT NULL;
      ALTER TABLE skills_hunt_submissions DROP COLUMN display_name;
    ELSE
      ALTER TABLE skills_hunt_submissions RENAME COLUMN display_name TO full_name;
    END IF;
  END IF;
END
$skills_hunt_submissions_retire_display_name$;

-- The companion ALTERs above add full_name/bio/quora_profile_url/
-- quora_profile_url_normalized/signature_hash with a temporary DEFAULT '' so a
-- legacy table with existing rows can satisfy NOT NULL during the heal. The
-- canonical CREATE TABLE has no default on these columns, so drop the temporary
-- default now that the columns are populated — otherwise a healed database would
-- accept inserts that a fresh database rejects. DROP DEFAULT on a column that has
-- no default is a no-op, so this stays idempotent.
ALTER TABLE IF EXISTS skills_hunt_submissions ALTER COLUMN full_name DROP DEFAULT;
ALTER TABLE IF EXISTS skills_hunt_submissions ALTER COLUMN bio DROP DEFAULT;
ALTER TABLE IF EXISTS skills_hunt_submissions ALTER COLUMN quora_profile_url DROP DEFAULT;
ALTER TABLE IF EXISTS skills_hunt_submissions ALTER COLUMN quora_profile_url_normalized DROP DEFAULT;
ALTER TABLE IF EXISTS skills_hunt_submissions ALTER COLUMN signature_hash DROP DEFAULT;

-- SkillsHunt v2 (2026-05-11). See
-- docs/developer/ctf-plugin-feature-inventories/ctf-skills-hunt-session-continuity.md §6.
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS proposed_skills JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS participation_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS credit_granted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS credit_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS credit_granted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS url_validation_result TEXT;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS url_validation_checked_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS edit_history JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS skills_hunt_submissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DO $skills_hunt_submissions_url_validation_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'skills_hunt_submissions_url_validation_check' AND constraint_schema = current_schema()
  ) THEN
    BEGIN
      ALTER TABLE skills_hunt_submissions
        ADD CONSTRAINT skills_hunt_submissions_url_validation_check
        CHECK (url_validation_result IS NULL OR url_validation_result IN ('valid', 'invalid', 'dead'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$skills_hunt_submissions_url_validation_check$;

ALTER TABLE IF EXISTS skills_hunt_leaderboard ADD COLUMN IF NOT EXISTS first_match_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skills_hunt_leaderboard ADD COLUMN IF NOT EXISTS pending_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skills_hunt_leaderboard ADD COLUMN IF NOT EXISTS last_submission_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS skills_hunt_achievements ADD COLUMN IF NOT EXISTS round_id UUID;
ALTER TABLE IF EXISTS skills_hunt_achievements ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
DO $skills_hunt_achievements_round_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'skills_hunt_achievements_round_id_fkey' AND constraint_schema = current_schema()
      AND table_name = 'skills_hunt_achievements'
  ) THEN
    BEGIN
      ALTER TABLE skills_hunt_achievements
        ADD CONSTRAINT skills_hunt_achievements_round_id_fkey
        FOREIGN KEY (round_id) REFERENCES skills_hunt_rounds(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$skills_hunt_achievements_round_fk$;

-- SkillsHunt v2 Missions (post-design lock 2026-05-11). Defensive ALTERs
-- so legacy DBs that already created the tables get any later additions.
ALTER TABLE IF EXISTS skills_hunt_missions ADD COLUMN IF NOT EXISTS goal_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS skills_hunt_missions ADD COLUMN IF NOT EXISTS color_hex TEXT;
ALTER TABLE IF EXISTS skills_hunt_missions ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS skills_hunt_mission_progress ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- trust_transport_admin_audit_trail (1 — defensive)
ALTER TABLE IF EXISTS trust_transport_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- trust_transport_disputes (4 missing)
ALTER TABLE IF EXISTS trust_transport_disputes ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE IF EXISTS trust_transport_disputes ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS trust_transport_disputes ADD COLUMN IF NOT EXISTS resolved_by_user_id TEXT;

-- trust_transport_offers (1 — defensive)
ALTER TABLE IF EXISTS trust_transport_offers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- trust_transport_payout_requests (4 missing)
ALTER TABLE IF EXISTS trust_transport_payout_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS trust_transport_payout_requests ADD COLUMN IF NOT EXISTS decided_by_user_id TEXT;
ALTER TABLE IF EXISTS trust_transport_payout_requests ADD COLUMN IF NOT EXISTS decision_reason TEXT;
ALTER TABLE IF EXISTS trust_transport_payout_requests ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- trust_transport_requests (2 missing)
ALTER TABLE IF EXISTS trust_transport_requests ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- trust_transport_risk_signals (1 — defensive)
ALTER TABLE IF EXISTS trust_transport_risk_signals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- trust_transport_trips (1 — defensive)
ALTER TABLE IF EXISTS trust_transport_trips ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS trust_transport_trips ADD COLUMN IF NOT EXISTS requester_completion_confirmed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS trust_transport_trips ADD COLUMN IF NOT EXISTS provider_completion_confirmed_at TIMESTAMPTZ;

-- trust_transport_user_extension (4 missing)
ALTER TABLE IF EXISTS trust_transport_user_extension ADD COLUMN IF NOT EXISTS account_restricted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS trust_transport_user_extension ADD COLUMN IF NOT EXISTS restricted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS trust_transport_user_extension ADD COLUMN IF NOT EXISTS restricted_by_user_id TEXT;
ALTER TABLE IF EXISTS trust_transport_user_extension ADD COLUMN IF NOT EXISTS restriction_reason TEXT;

-- unlock_audit_log (7 missing — existing table has only id, user_id, action, details, created_at, updated_at)
ALTER TABLE IF EXISTS unlock_audit_log ADD COLUMN IF NOT EXISTS actor_user_id TEXT;
ALTER TABLE IF EXISTS unlock_audit_log ADD COLUMN IF NOT EXISTS command TEXT;
ALTER TABLE IF EXISTS unlock_audit_log ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS unlock_audit_log ADD COLUMN IF NOT EXISTS policy_status TEXT;
ALTER TABLE IF EXISTS unlock_audit_log ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE IF EXISTS unlock_audit_log ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE IF EXISTS unlock_audit_log ADD COLUMN IF NOT EXISTS target_user_id TEXT;

-- weekly_performance_weeks (3 missing)
ALTER TABLE IF EXISTS weekly_performance_weeks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE IF EXISTS weekly_performance_weeks ADD COLUMN IF NOT EXISTS selected_by_user_id TEXT;
ALTER TABLE IF EXISTS weekly_performance_weeks ADD COLUMN IF NOT EXISTS selected_at TIMESTAMPTZ;

-- workforce_recruited_events (6 missing)
ALTER TABLE IF EXISTS workforce_recruited_events ADD COLUMN IF NOT EXISTS directory_profile_id TEXT;
ALTER TABLE IF EXISTS workforce_recruited_events ADD COLUMN IF NOT EXISTS inference_dedupe_key TEXT;
ALTER TABLE IF EXISTS workforce_recruited_events ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS workforce_recruited_events ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS workforce_recruited_events ADD COLUMN IF NOT EXISTS resolved_recruited BOOLEAN;
ALTER TABLE IF EXISTS workforce_recruited_events ADD COLUMN IF NOT EXISTS source_event TEXT;
-- Required by `ON CONFLICT (inference_dedupe_key)` in repository.ts and the workforce seed;
-- recruited-event upserts fail without this unique index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_workforce_recruited_events_dedupe_key ON workforce_recruited_events(inference_dedupe_key);
-- Enforce a non-null dedupe key so ON CONFLICT (inference_dedupe_key) reliably
-- deduplicates: Postgres treats NULLs as distinct in a unique index, so a NULL key
-- would silently bypass the upsert. The write path always supplies a sha256 key;
-- backfill any legacy NULL rows deterministically before enforcing NOT NULL.
-- Idempotent: the UPDATE matches nothing on re-run, and SET NOT NULL on an
-- already-constrained column is a no-op.
UPDATE workforce_recruited_events SET inference_dedupe_key = 'legacy:' || id::text WHERE inference_dedupe_key IS NULL;
ALTER TABLE IF EXISTS workforce_recruited_events ALTER COLUMN inference_dedupe_key SET NOT NULL;

-- workforce_recruited_sync_cursor (1 missing)
ALTER TABLE IF EXISTS workforce_recruited_sync_cursor ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === REMAINING COLUMN DRIFT FIXES ===

-- foundation_user_extension (3 missing)
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS accessibility_runtime_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS foundation_user_extension ADD COLUMN IF NOT EXISTS trauma_informed_defaults JSONB NOT NULL DEFAULT '{}'::jsonb;

-- service_credits_account_deletion_reclaims (7 missing)
ALTER TABLE IF EXISTS service_credits_account_deletion_reclaims ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE IF EXISTS service_credits_account_deletion_reclaims ADD COLUMN IF NOT EXISTS deletion_request_id UUID;
ALTER TABLE IF EXISTS service_credits_account_deletion_reclaims ADD COLUMN IF NOT EXISTS treasury_user_id TEXT;
ALTER TABLE IF EXISTS service_credits_account_deletion_reclaims ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE IF EXISTS service_credits_account_deletion_reclaims ADD COLUMN IF NOT EXISTS trace_id TEXT;
ALTER TABLE IF EXISTS service_credits_account_deletion_reclaims ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE IF EXISTS service_credits_account_deletion_reclaims ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- service_credits_adapter_outbox (6 missing)
ALTER TABLE IF EXISTS service_credits_adapter_outbox ADD COLUMN IF NOT EXISTS command_name TEXT;
ALTER TABLE IF EXISTS service_credits_adapter_outbox ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE IF EXISTS service_credits_adapter_outbox ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE IF EXISTS service_credits_adapter_outbox ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'queued';
ALTER TABLE IF EXISTS service_credits_adapter_outbox ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE IF EXISTS service_credits_adapter_outbox ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

-- service_credits_command_idempotency (3 missing)
ALTER TABLE IF EXISTS service_credits_command_idempotency ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE IF EXISTS service_credits_command_idempotency ADD COLUMN IF NOT EXISTS command_name TEXT;
ALTER TABLE IF EXISTS service_credits_command_idempotency ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- The governance mint/transfer code upserts idempotency + adapter-outbox rows with
-- `ON CONFLICT (actor_id, command_name, idempotency_key)` and `ON CONFLICT (command_name,
-- idempotency_key)`, but the matching unique indexes were never created — so every mint threw
-- "no unique or exclusion constraint matching the ON CONFLICT specification" and the reward never
-- landed (this blocked the Unlock approval reward + its "Retry pending rewards" drain). Add the two
-- missing unique indexes, and relax the legacy `command` NOT NULL column (the code writes
-- `command_name`, never `command`, so leaving it NOT NULL also blocks the insert).
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_credits_adapter_outbox_command_idem
  ON service_credits_adapter_outbox (command_name, idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_credits_command_idempotency_actor_command_idem
  ON service_credits_command_idempotency (actor_id, command_name, idempotency_key);
-- Same gap on the account-deletion reclaim insert: markFullAccountDeletionRequested upserts the
-- reclaim row with `ON CONFLICT (account_id, deletion_request_id)`, but that unique index was never
-- created either — so every full-account deletion (self-service and the operator delete-account
-- workflow) threw "no unique or exclusion constraint matching the ON CONFLICT specification" at the
-- reclaim step and never completed. Add the missing index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_credits_account_deletion_reclaims_account_request
  ON service_credits_account_deletion_reclaims (account_id, deletion_request_id);
DO $sc_cmd_idem_command_nullable$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_credits_command_idempotency' AND column_name = 'command'
  ) THEN
    ALTER TABLE service_credits_command_idempotency ALTER COLUMN command DROP NOT NULL;
  END IF;
END
$sc_cmd_idem_command_nullable$;

-- service_credits_wallet_tombstones (2 missing)
ALTER TABLE IF EXISTS service_credits_wallet_tombstones ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE IF EXISTS service_credits_wallet_tombstones ADD COLUMN IF NOT EXISTS deletion_request_id UUID;

-- socket_relay_messages (1 missing)
ALTER TABLE IF EXISTS socket_relay_messages ADD COLUMN IF NOT EXISTS client_message_id TEXT;
-- Idempotency key backing sendFulfillmentMessage's `ON CONFLICT (fulfillment_id, sender_user_id,
-- client_message_id)`. Without a matching unique index Postgres rejects that ON CONFLICT (error 42P10)
-- and the message-send route throws — so this index is required for the route to work at all. Created
-- after the client_message_id column is added above so the referenced column always exists.
CREATE UNIQUE INDEX IF NOT EXISTS socket_relay_messages_idempotency_uidx
  ON socket_relay_messages (fulfillment_id, sender_user_id, client_message_id);

-- trust_transport_user_extension (5 missing)
ALTER TABLE IF EXISTS trust_transport_user_extension ADD COLUMN IF NOT EXISTS mode_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS trust_transport_user_extension ADD COLUMN IF NOT EXISTS safety_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS trust_transport_user_extension ADD COLUMN IF NOT EXISTS payout_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS trust_transport_user_extension ADD COLUMN IF NOT EXISTS provider_eligible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS trust_transport_user_extension ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === comic AI Assistant (@comic) — conversation + supervision + training layer ===
-- The @comic assistant captures every turn, drafts via Ollama, and routes every draft to human
-- review before the asker ever sees it. These tables back conversation capture, the owner
-- review/correction queue, and the training-example export.
-- The 'rasa' value in the engine CHECK below and the intent/nlu_confidence columns are retained
-- for historical rows only; the Rasa NLU integration was removed 2026-06-14 and no longer writes
-- them. Guarded DDL (CREATE TABLE IF NOT EXISTS + per-column ALTER ... ADD COLUMN IF NOT EXISTS)
-- per the migration rules so fresh and legacy DBs converge.

CREATE TABLE IF NOT EXISTS comic_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  asker_username TEXT NULL,
  channel TEXT NOT NULL DEFAULT 'commons' CHECK (channel IN ('commons', 'feed', 'hub')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS comic_conversations ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS comic_conversations ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_conversations ADD COLUMN IF NOT EXISTS asker_username TEXT NULL;
ALTER TABLE IF EXISTS comic_conversations ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'commons';
ALTER TABLE IF EXISTS comic_conversations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE IF EXISTS comic_conversations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS comic_conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_comic_conversations_user_id ON comic_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_comic_conversations_created_at ON comic_conversations(created_at DESC);

CREATE TABLE IF NOT EXISTS comic_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES comic_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'bot', 'human')),
  body TEXT NOT NULL,
  intent TEXT NULL,
  nlu_confidence NUMERIC(5,4) NULL,
  engine TEXT NOT NULL DEFAULT 'ollama' CHECK (engine IN ('rasa', 'ollama', 'template', 'human')),
  -- Applicable plugins an admin tagged when publishing this answer turn (approve/correct). Stored as
  -- a JSON array of plugin slugs (validated against the visible plugin registry, deduped, capped).
  -- Rendered as tappable plugin links beneath the published answer. Empty array = no links.
  linked_plugin_slugs JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Knowledge-base entry ids (comic_knowledge_entries) injected as grounding when this bot draft
  -- was generated (#504 retrieval step). Empty array = ungrounded draft. Lets grounded vs
  -- ungrounded drafts be compared on correction rate.
  grounding_entry_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS comic_turns ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS comic_turns ADD COLUMN IF NOT EXISTS conversation_id UUID;
ALTER TABLE IF EXISTS comic_turns ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE IF EXISTS comic_turns ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_turns ADD COLUMN IF NOT EXISTS intent TEXT NULL;
ALTER TABLE IF EXISTS comic_turns ADD COLUMN IF NOT EXISTS nlu_confidence NUMERIC(5,4) NULL;
ALTER TABLE IF EXISTS comic_turns ADD COLUMN IF NOT EXISTS engine TEXT NOT NULL DEFAULT 'ollama';
ALTER TABLE IF EXISTS comic_turns ADD COLUMN IF NOT EXISTS linked_plugin_slugs JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS comic_turns ADD COLUMN IF NOT EXISTS grounding_entry_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS comic_turns ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_comic_turns_conversation_id ON comic_turns(conversation_id);
CREATE INDEX IF NOT EXISTS idx_comic_turns_created_at ON comic_turns(created_at DESC);

CREATE TABLE IF NOT EXISTS comic_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id UUID NOT NULL REFERENCES comic_turns(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'corrected', 'rejected')),
  reviewer_user_id TEXT NULL,
  corrected_body TEXT NULL,
  -- The published answer turn the asker actually sees + rates once the review is approved/corrected:
  -- an approved bot draft, or the reviewer's human turn for a correction / approved human-first turn.
  -- NULL while pending/rejected (no answer is ever surfaced). SET NULL so deleting that turn does not
  -- drop the review row.
  answer_turn_id UUID NULL REFERENCES comic_turns(id) ON DELETE SET NULL,
  -- The AI draft bot turn generated in the background after the question is queued. turn_id always
  -- stays pointed at the asker's question turn (so the question is inferred stably); the reviewer
  -- reads the draft from here. NULL = human-first (no AI draft). SET NULL so deleting the draft turn
  -- does not drop the review row.
  draft_turn_id UUID NULL REFERENCES comic_turns(id) ON DELETE SET NULL,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ NULL
);
ALTER TABLE IF EXISTS comic_review_queue ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS comic_review_queue ADD COLUMN IF NOT EXISTS turn_id UUID;
ALTER TABLE IF EXISTS comic_review_queue ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE IF EXISTS comic_review_queue ADD COLUMN IF NOT EXISTS reviewer_user_id TEXT NULL;
ALTER TABLE IF EXISTS comic_review_queue ADD COLUMN IF NOT EXISTS corrected_body TEXT NULL;
ALTER TABLE IF EXISTS comic_review_queue ADD COLUMN IF NOT EXISTS answer_turn_id UUID NULL;
ALTER TABLE IF EXISTS comic_review_queue ADD COLUMN IF NOT EXISTS draft_turn_id UUID NULL;
ALTER TABLE IF EXISTS comic_review_queue ADD COLUMN IF NOT EXISTS reason TEXT NULL;
ALTER TABLE IF EXISTS comic_review_queue ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS comic_review_queue ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_comic_review_queue_status ON comic_review_queue(status);
CREATE INDEX IF NOT EXISTS idx_comic_review_queue_turn_id ON comic_review_queue(turn_id);
CREATE INDEX IF NOT EXISTS idx_comic_review_queue_answer_turn_id ON comic_review_queue(answer_turn_id);
CREATE INDEX IF NOT EXISTS idx_comic_review_queue_created_at ON comic_review_queue(created_at DESC);

CREATE TABLE IF NOT EXISTS comic_training_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_turn_id UUID NOT NULL REFERENCES comic_turns(id) ON DELETE CASCADE,
  intent_label TEXT NOT NULL DEFAULT 'general',
  text TEXT NOT NULL,
  entities JSONB NOT NULL DEFAULT '[]'::jsonb,
  story JSONB NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'exported', 'discarded')),
  exported_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS comic_training_examples ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS comic_training_examples ADD COLUMN IF NOT EXISTS source_turn_id UUID;
ALTER TABLE IF EXISTS comic_training_examples ADD COLUMN IF NOT EXISTS intent_label TEXT NOT NULL DEFAULT 'general';
ALTER TABLE IF EXISTS comic_training_examples ADD COLUMN IF NOT EXISTS text TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_training_examples ADD COLUMN IF NOT EXISTS entities JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS comic_training_examples ADD COLUMN IF NOT EXISTS story JSONB NULL;
ALTER TABLE IF EXISTS comic_training_examples ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE IF EXISTS comic_training_examples ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS comic_training_examples ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_comic_training_examples_intent_label ON comic_training_examples(intent_label);
CREATE INDEX IF NOT EXISTS idx_comic_training_examples_status ON comic_training_examples(status);
CREATE INDEX IF NOT EXISTS idx_comic_training_examples_source_turn_id ON comic_training_examples(source_turn_id);

-- Quality signal for answered @comic turns (helpful / not_helpful / flagged). Keyed on the
-- answered turn (the approved bot draft or the owner's corrected human turn) so a rating attaches
-- to the exact text the asker saw. One rating per (user, turn); re-rating updates in place.
-- Mirrors the feed_answer_ratings pattern but references comic_turns (feed_answer_ratings is FK'd
-- into feed_answers and cannot host comic turns). Feeds the CDD training flywheel.
CREATE TABLE IF NOT EXISTS comic_answer_ratings (
  user_id TEXT NOT NULL,
  turn_id UUID NOT NULL REFERENCES comic_turns(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('helpful', 'not_helpful', 'flagged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, turn_id)
);
ALTER TABLE IF EXISTS comic_answer_ratings ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_answer_ratings ADD COLUMN IF NOT EXISTS turn_id UUID;
ALTER TABLE IF EXISTS comic_answer_ratings ADD COLUMN IF NOT EXISTS rating TEXT NOT NULL DEFAULT 'helpful';
ALTER TABLE IF EXISTS comic_answer_ratings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS comic_answer_ratings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_comic_answer_ratings_turn_id ON comic_answer_ratings(turn_id);

-- Retrieval knowledge base for @comic draft grounding (#504, retrieval step). Rows are curated,
-- redacted excerpts of the owner's public writing (Quora export, repo wiki) plus, later, approved
-- answers. At draft time the top-ranked entries for the asker's question are injected into the
-- Ollama prompt so the draft is grounded in the community's own verified answers instead of the
-- base model's generic training. `content_hash` makes imports idempotent; `active` is the curation
-- off-switch (deactivated rows are never retrieved). Full-text search runs over
-- question + title + content via the expression index below.
CREATE TABLE IF NOT EXISTS comic_knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'quora_export' CHECK (source IN ('quora_export', 'github_wiki', 'approved_answer')),
  entry_type TEXT NOT NULL DEFAULT 'post' CHECK (entry_type IN ('answer', 'post', 'comment', 'submission', 'wiki')),
  title TEXT NULL,
  question TEXT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  -- Stable per-item identity for repo-sourced rows (e.g. 'quora:pedigree101/answers/0000'). When an
  -- edited source file is re-imported its content_hash changes but source_ref stays constant, so the
  -- import UPDATES the existing row in place instead of inserting a second copy (added 2026-07-28).
  -- NULL for legacy rows imported from the raw Quora HTML export, which dedupe on content_hash only.
  source_ref TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  authored_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL
);
ALTER TABLE IF EXISTS comic_knowledge_entries ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS comic_knowledge_entries ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'quora_export';
ALTER TABLE IF EXISTS comic_knowledge_entries ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'post';
ALTER TABLE IF EXISTS comic_knowledge_entries ADD COLUMN IF NOT EXISTS title TEXT NULL;
ALTER TABLE IF EXISTS comic_knowledge_entries ADD COLUMN IF NOT EXISTS question TEXT NULL;
ALTER TABLE IF EXISTS comic_knowledge_entries ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_knowledge_entries ADD COLUMN IF NOT EXISTS content_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_knowledge_entries ADD COLUMN IF NOT EXISTS source_ref TEXT NULL;
ALTER TABLE IF EXISTS comic_knowledge_entries ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS comic_knowledge_entries ADD COLUMN IF NOT EXISTS authored_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS comic_knowledge_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS comic_knowledge_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NULL;
-- Two idempotency strategies coexist, so the old global UNIQUE(content_hash) is replaced by two
-- partial unique indexes: repo-sourced rows dedupe on source_ref, legacy HTML-export rows on
-- content_hash. Drop the legacy auto-named column constraint first so legacy DBs converge.
ALTER TABLE IF EXISTS comic_knowledge_entries DROP CONSTRAINT IF EXISTS comic_knowledge_entries_content_hash_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_comic_knowledge_entries_source_ref
  ON comic_knowledge_entries(source_ref) WHERE source_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_comic_knowledge_entries_content_hash
  ON comic_knowledge_entries(content_hash) WHERE source_ref IS NULL;
CREATE INDEX IF NOT EXISTS idx_comic_knowledge_entries_search
  ON comic_knowledge_entries
  USING GIN (to_tsvector('english', COALESCE(question, '') || ' ' || COALESCE(title, '') || ' ' || content));
CREATE INDEX IF NOT EXISTS idx_comic_knowledge_entries_active ON comic_knowledge_entries(active);

-- comic_contributions: a member's offer of their own public Quora writing for the assistant's
-- reference library, plus the consent that makes using it lawful and honest.
--
-- The consent columns are the point of this table, not metadata around it. They record WHAT the
-- member agreed to and WHICH wording they read (consent_version), so a later change to the form
-- cannot retroactively be claimed as something an earlier contributor agreed to. A contribution with
-- no consent row is unusable by construction.
--
-- What is NOT here, deliberately:
--   * the uploaded .zip — the archive is parsed in memory and never stored. There is no file at rest
--     to leak, and nothing to delete later.
--   * inbox messages, drafts, profile data — dropped by the allowlist in
--     lib/comic/quora-export-intake.ts before this table is ever written.
-- Accepted entries are copied into comic_knowledge_entries, which is a retrieval table read at
-- answer time — NOT model weights. That is what makes withdrawal real: a row can be deactivated and
-- the assistant stops quoting it.
CREATE TABLE IF NOT EXISTS comic_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  -- How the member sent their writing. 'links' is the DEFAULT path and the one most people should
  -- use: they paste the two or three posts that are actually about being targeted. Most accounts are
  -- mixed — dating, politics, faith, memes — so an export makes the reviewer read hundreds of posts
  -- to find a handful, while the author can pick them out instantly. 'export' remains for the rarer
  -- member whose public writing is nearly all on-topic.
  kind TEXT NOT NULL DEFAULT 'links' CHECK (kind IN ('links', 'export')),
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'accepted', 'declined', 'withdrawn')),
  -- Consent, captured at submit time from the form on the contribute page.
  consent_version TEXT NOT NULL,
  consent_granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The member's own statement about third parties named in their posts, so a reviewer knows to look
  -- before anything is accepted. Free text; empty when they said nobody is named.
  third_party_note TEXT NOT NULL DEFAULT '',
  -- Intake summary, shown back to the contributor as their receipt and kept as the record of what
  -- the automatic strip did. `discarded_sections` names the parts thrown away (inbox, drafts, …).
  entry_count INTEGER NOT NULL DEFAULT 0,
  discarded_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Review outcome. reviewed_by is an admin user id; decline_reason is shown to the contributor.
  reviewed_by TEXT NULL,
  reviewed_at TIMESTAMPTZ NULL,
  decline_reason TEXT NOT NULL DEFAULT '',
  -- Set when the ServiceCredits recognition grant has been made, so a re-review cannot double-grant.
  granted_at TIMESTAMPTZ NULL,
  -- Set when the member asked for their material back out; the accepted knowledge rows are
  -- deactivated at the same time.
  withdrawn_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'links';
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_review';
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS consent_version TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS consent_granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS third_party_note TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS entry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS discarded_sections JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS reviewed_by TEXT NULL;
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS decline_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS comic_contributions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_comic_contributions_user ON comic_contributions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comic_contributions_status ON comic_contributions(status, created_at DESC);

-- comic_contribution_entries: the surviving public entries from one contribution, held here for
-- review. Nothing here is visible to the assistant — only an accepted entry is copied into
-- comic_knowledge_entries. Cascade-deletes with its contribution so a withdrawal that removes the
-- submission cannot strand its text.
CREATE TABLE IF NOT EXISTS comic_contribution_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id UUID NOT NULL REFERENCES comic_contributions(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL DEFAULT 'post'
    CHECK (entry_type IN ('answer', 'post', 'comment', 'submission')),
  question TEXT NULL,
  content TEXT NOT NULL,
  -- For a linked post: where it came from, kept as PROVENANCE so a reviewer can confirm the post is
  -- public and belongs to the contributor. It is deliberately not a fetch target — nothing here
  -- scrapes Quora, because a link that rots between paste and read would leave an entry nobody can
  -- verify, and the redaction pass strips links from the content itself for the same reason.
  source_url TEXT NULL,
  -- Set once a reviewer promotes this entry into the knowledge base, so re-running review is safe.
  knowledge_entry_id UUID NULL,
  excluded BOOLEAN NOT NULL DEFAULT FALSE,
  authored_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS comic_contribution_entries ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS comic_contribution_entries ADD COLUMN IF NOT EXISTS contribution_id UUID;
ALTER TABLE IF EXISTS comic_contribution_entries ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'post';
ALTER TABLE IF EXISTS comic_contribution_entries ADD COLUMN IF NOT EXISTS question TEXT NULL;
ALTER TABLE IF EXISTS comic_contribution_entries ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS comic_contribution_entries ADD COLUMN IF NOT EXISTS source_url TEXT NULL;
ALTER TABLE IF EXISTS comic_contribution_entries ADD COLUMN IF NOT EXISTS knowledge_entry_id UUID NULL;
ALTER TABLE IF EXISTS comic_contribution_entries ADD COLUMN IF NOT EXISTS excluded BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS comic_contribution_entries ADD COLUMN IF NOT EXISTS authored_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS comic_contribution_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_comic_contribution_entries_contribution
  ON comic_contribution_entries(contribution_id);

-- Link a knowledge row back to the contribution it came from, so ACCOUNT DELETION reaches it.
-- Withdrawal only deactivates a row (curation here is an off-switch, and a member may change their
-- mind); deleting the account is the stronger promise and must actually remove the words. Making
-- that a foreign key rather than a step in the deletion orchestrator means it cannot be forgotten:
-- deleting comic_contributions cascades here automatically.
-- NULL for everything seeded from the owner's own exports, which no member deletion touches.
ALTER TABLE IF EXISTS comic_knowledge_entries ADD COLUMN IF NOT EXISTS contribution_id UUID NULL;
DO $comic_knowledge_entries_contribution_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'comic_knowledge_entries_contribution_id_fkey'
      AND constraint_schema = current_schema()
  ) THEN
    BEGIN
      ALTER TABLE comic_knowledge_entries
        ADD CONSTRAINT comic_knowledge_entries_contribution_id_fkey
        FOREIGN KEY (contribution_id) REFERENCES comic_contributions(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$comic_knowledge_entries_contribution_fk$;
CREATE INDEX IF NOT EXISTS idx_comic_knowledge_entries_contribution
  ON comic_knowledge_entries(contribution_id);

-- Named CHECK constraints for the comic_* enum/range columns. Idempotent (skip if present) so
-- legacy DBs that predate the inline CHECKs converge. Enum values mirror lib/comic/constants.ts.
-- comic_conversations.channel: 'hub' → 'commons' (2026-08-09, with the rest of the rename).
--
-- Order is load-bearing. The old constraint forbids 'commons', so it has to go before the data can
-- move; the new one is added after. Dropping unconditionally and letting the guarded block below
-- re-add it keeps this convergent on a fresh DB (where CREATE TABLE already made the constraint
-- under the same auto-generated name) and on a legacy one, and a re-run is a no-op.
ALTER TABLE IF EXISTS comic_conversations DROP CONSTRAINT IF EXISTS comic_conversations_channel_check;
UPDATE comic_conversations SET channel = 'commons' WHERE channel = 'hub';
ALTER TABLE IF EXISTS comic_conversations ALTER COLUMN channel SET DEFAULT 'commons';

-- 'hub' is still ACCEPTED here, deliberately and temporarily. This file is applied by
-- update-neon-db.yml on push to main, while the web app redeploys separately — so for a few minutes
-- the previous release is still serving with the database already migrated. A strict
-- CHECK (channel IN ('commons', 'feed')) would make any @comic question asked in that window fail
-- on a constraint violation. No row is written with 'hub' after this ships (the API coerces every
-- non-'feed' value to 'commons'), and reads normalize a legacy 'hub' to 'commons', so the value is
-- write-dead already. Drop 'hub' from this list in a follow-up once the deploy has settled — that
-- change is this one line plus the matching UPDATE above becoming a no-op.
DO $comic_conversations_channel_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'comic_conversations_channel_check' AND constraint_schema = current_schema()
  ) THEN
    BEGIN
      ALTER TABLE comic_conversations
        ADD CONSTRAINT comic_conversations_channel_check
        CHECK (channel IN ('commons', 'feed', 'hub'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$comic_conversations_channel_check$;

DO $comic_conversations_status_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'comic_conversations_status_check' AND constraint_schema = current_schema()
  ) THEN
    BEGIN
      ALTER TABLE comic_conversations
        ADD CONSTRAINT comic_conversations_status_check
        CHECK (status IN ('open', 'closed'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$comic_conversations_status_check$;

DO $comic_turns_role_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'comic_turns_role_check' AND constraint_schema = current_schema()
  ) THEN
    BEGIN
      ALTER TABLE comic_turns
        ADD CONSTRAINT comic_turns_role_check
        CHECK (role IN ('user', 'bot', 'human'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$comic_turns_role_check$;

DO $comic_turns_engine_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'comic_turns_engine_check' AND constraint_schema = current_schema()
  ) THEN
    BEGIN
      ALTER TABLE comic_turns
        ADD CONSTRAINT comic_turns_engine_check
        CHECK (engine IN ('rasa', 'ollama', 'template', 'human'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$comic_turns_engine_check$;

DO $comic_turns_nlu_confidence_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'comic_turns_nlu_confidence_check' AND constraint_schema = current_schema()
  ) THEN
    BEGIN
      ALTER TABLE comic_turns
        ADD CONSTRAINT comic_turns_nlu_confidence_check
        CHECK (nlu_confidence IS NULL OR (nlu_confidence >= 0 AND nlu_confidence <= 1));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$comic_turns_nlu_confidence_check$;

DO $comic_review_queue_status_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'comic_review_queue_status_check' AND constraint_schema = current_schema()
  ) THEN
    BEGIN
      ALTER TABLE comic_review_queue
        ADD CONSTRAINT comic_review_queue_status_check
        CHECK (status IN ('pending', 'approved', 'corrected', 'rejected'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$comic_review_queue_status_check$;

DO $comic_training_examples_status_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'comic_training_examples_status_check' AND constraint_schema = current_schema()
  ) THEN
    BEGIN
      ALTER TABLE comic_training_examples
        ADD CONSTRAINT comic_training_examples_status_check
        CHECK (status IN ('pending', 'exported', 'discarded'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$comic_training_examples_status_check$;

DO $comic_answer_ratings_rating_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'comic_answer_ratings_rating_check' AND constraint_schema = current_schema()
  ) THEN
    BEGIN
      ALTER TABLE comic_answer_ratings
        ADD CONSTRAINT comic_answer_ratings_rating_check
        CHECK (rating IN ('helpful', 'not_helpful', 'flagged'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$comic_answer_ratings_rating_check$;

-- === user_ui_preferences (per-user UI theme choice) ===
-- Stores the signed-in user's selected app theme so the choice follows their account
-- across devices. Anonymous visitors rely on localStorage only. `theme` is 'default'
-- (the original dark UI) or 'comic' (the comic-book dark theme).
CREATE TABLE IF NOT EXISTS user_ui_preferences (
  user_id TEXT PRIMARY KEY,
  theme TEXT NOT NULL DEFAULT 'default',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS user_ui_preferences ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'default';
ALTER TABLE IF EXISTS user_ui_preferences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === BUG REPORTS (in-app "Report a problem" capture; raw text stays private) ===
-- Users file problem reports from inside the app and never touch GitHub. The raw
-- message is the private source of truth and is NEVER published. A separate process
-- redacts it and creates an issue in the private triage repo (see rule 129). Anything
-- flagged is held for owner review and is never auto-published (fail closed).
CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'held_for_review', 'issue_created', 'rejected', 'resolved')),
  raw_message TEXT NOT NULL,
  raw_context TEXT NULL,
  page_url TEXT NULL,
  plugin_slug TEXT NULL,
  app_version TEXT NULL,
  user_agent TEXT NULL,
  redacted_message TEXT NULL,
  redacted_context TEXT NULL,
  risk_flags TEXT[] NOT NULL DEFAULT '{}',
  risk_level TEXT NOT NULL DEFAULT 'unknown'
    CHECK (risk_level IN ('clean', 'flagged', 'unknown')),
  triage_repo TEXT NULL,
  issue_number INTEGER NULL,
  issue_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS raw_message TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS raw_context TEXT NULL;
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS page_url TEXT NULL;
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS plugin_slug TEXT NULL;
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS app_version TEXT NULL;
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS user_agent TEXT NULL;
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS redacted_message TEXT NULL;
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS redacted_context TEXT NULL;
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS risk_flags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS triage_repo TEXT NULL;
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS issue_number INTEGER NULL;
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS issue_url TEXT NULL;
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS bug_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_bug_reports_status_created_at ON bug_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_created_at ON bug_reports(user_id, created_at DESC);

-- === QUORA ACCOUNT DELETION SURVEY (research capture) ===
-- Self-reports from people whose Quora accounts were removed. The blog posts cite counts of
-- removals, and until now those counts rested on nothing a reader could check; these tables are
-- the record behind them.
--
-- What this survey is for (owner, 2026-08-19), because it decides what belongs in these columns:
-- documenting that content and handles are being scattered and removed to discredit people —
-- history erasure. The handles are public, and a person types them here on purpose. Someone who
-- does not want their handle history on record does not fill in the form.
--
-- So the response carries the member id of the account that sent it. An earlier build stored no
-- identity, on the theory that a respondent needed protecting from the reader of this table; that
-- was wrong for this survey and was reversed on the owner's instruction the same day. Keeping the
-- id is what makes a duplicate answer detectable, lets a response be lined up against that
-- member's Unlock submission, and leaves a route to reach someone about what they reported.
--
-- What is still deliberately absent: no IP address, no user agent, no contact detail (owner
-- decision, 2026-08-18 — the follow-up contact field was removed from the questionnaire).
--
-- Publication is governed by the three consent flags below and by nothing else. Storing who
-- answered is not permission to print it: a handle or a quote leaves this table only with the
-- matching TRUE on that row.
--
-- Account deletion: `user_id` is nullable so `lib/account/deletion-registry.ts` can pseudonymize
-- rather than destroy. A survey answer is a record of an erasure; deleting it when its author
-- leaves would repeat the thing the survey exists to document. NULL therefore means "the account
-- that sent this was deleted", never "this was anonymous".
CREATE TABLE IF NOT EXISTS quora_deletion_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The member who sent this. Always set on insert; nullable only so account deletion can clear
  -- it and leave the answer standing. See the note above.
  user_id TEXT,
  -- Q1. Yes or no, no third option (owner decision, 2026-08-18). The form requires an answer
  -- before it will send, so the default below is only ever the column default and never the
  -- recorded answer of someone who declined to state one.
  targeted_individual TEXT NOT NULL DEFAULT 'no'
    CHECK (targeted_individual IN ('yes', 'no')),
  -- Q2. Yes/no only (owner decision, 2026-08-18). The COUNT of removals is not asked as a number;
  -- it is derived from the account rows below, so every removal counted is one backed by a handle
  -- and a date rather than a figure someone typed.
  any_account_removed BOOLEAN NOT NULL DEFAULT FALSE,
  -- Q13. Whether they still have a Quora account that was not removed. The yes/no lives here; the
  -- URL deliberately does NOT. That URL is their Unlock verification URL — it identifies them —
  -- and storing it on this row would make an otherwise anonymous response identifiable, which is
  -- the one promise this table makes. It is carried to the verification step in the browser and
  -- never written here.
  --
  -- Nullable, unlike the two questions above, because this one is optional and NULL is the answer
  -- "did not say". Asking a targeted person to name an account they still hold is a larger ask
  -- than asking about ones already gone, so skipping it is expected — and a skipped question
  -- stored as FALSE would be counted later as "has no account left", which is a different claim
  -- than the person made.
  has_current_profile BOOLEAN NULL,
  -- Q10/Q11. Free text. Evidence is whatever the person can show (the text of the notice Quora
  -- sent, an archive.org link to the dead profile); notes is anything else they want on record.
  evidence_note TEXT NULL,
  other_notes TEXT NULL,
  -- Q12. Three separate consents, each yes/no, each defaulting to NO. Publishing a handle or a
  -- quote without the matching TRUE here is a breach of what the form promised, so the default
  -- has to fail closed even if a future writer forgets to check.
  consent_publish_handles BOOLEAN NOT NULL DEFAULT FALSE,
  consent_quote BOOLEAN NOT NULL DEFAULT FALSE,
  consent_attribute_quote BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS quora_deletion_survey_responses ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS quora_deletion_survey_responses ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS quora_deletion_survey_responses ADD COLUMN IF NOT EXISTS targeted_individual TEXT NOT NULL DEFAULT 'no';
ALTER TABLE IF EXISTS quora_deletion_survey_responses ADD COLUMN IF NOT EXISTS any_account_removed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS quora_deletion_survey_responses ADD COLUMN IF NOT EXISTS has_current_profile BOOLEAN NULL;
ALTER TABLE IF EXISTS quora_deletion_survey_responses ADD COLUMN IF NOT EXISTS evidence_note TEXT NULL;
ALTER TABLE IF EXISTS quora_deletion_survey_responses ADD COLUMN IF NOT EXISTS other_notes TEXT NULL;
ALTER TABLE IF EXISTS quora_deletion_survey_responses ADD COLUMN IF NOT EXISTS consent_publish_handles BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS quora_deletion_survey_responses ADD COLUMN IF NOT EXISTS consent_quote BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS quora_deletion_survey_responses ADD COLUMN IF NOT EXISTS consent_attribute_quote BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS quora_deletion_survey_responses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_quora_deletion_survey_responses_created_at
  ON quora_deletion_survey_responses(created_at DESC);
-- Finds every response one member sent, which is how a duplicate answer becomes visible at all.
CREATE INDEX IF NOT EXISTS idx_quora_deletion_survey_responses_user
  ON quora_deletion_survey_responses(user_id, created_at DESC);

-- One row per removed account (Q3-Q9). A person who lost four accounts files one response with
-- four of these, so "how many times" is a row count and each removal carries its own handle,
-- date, outcome, and subject matter. `position` preserves the order the person listed them in.
CREATE TABLE IF NOT EXISTS quora_deletion_survey_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES quora_deletion_survey_responses(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  handle TEXT NOT NULL,
  -- Q4. What Quora actually did. 'answers_removed' and 'space_removed' matter as much as a full
  -- deletion: an account kept but emptied is the same silencing with the evidence left standing.
  action TEXT NOT NULL DEFAULT 'account_deleted'
    CHECK (action IN (
      'account_deleted', 'account_suspended', 'answers_removed', 'space_removed', 'posting_blocked'
    )),
  -- Q5. Month and year only. Asking for an exact date invites a guess; asking for the month gets
  -- an answer someone can actually stand behind years later.
  removed_month INTEGER NULL CHECK (removed_month IS NULL OR (removed_month BETWEEN 1 AND 12)),
  removed_year INTEGER NULL CHECK (removed_year IS NULL OR (removed_year BETWEEN 2005 AND 2100)),
  -- Q6. The reason Quora gave, in Quora's words as far as the person can recall. 'none_given' is
  -- an answer, not a missing value, and is expected to be the most common one.
  stated_reason TEXT NOT NULL DEFAULT 'none_given'
    CHECK (stated_reason IN (
      'none_given', 'spam', 'harassment', 'misinformation', 'impersonation',
      'adult_content', 'ban_evasion', 'other', 'do_not_recall'
    )),
  -- Q7. Whether an appeal was made and whether anything came back.
  appealed BOOLEAN NOT NULL DEFAULT FALSE,
  reinstated BOOLEAN NOT NULL DEFAULT FALSE,
  -- Q8. What the account mostly wrote about. The load-bearing column for the blog claim: it is
  -- what separates "accounts get removed" from "accounts writing about THIS get removed".
  topics TEXT[] NOT NULL DEFAULT '{}',
  -- Q9. Rough size and lifespan of the account, both optional. Someone who lost an eight-year
  -- account with thousands of answers is reporting a different event from someone who lost a
  -- week-old one, and the difference is invisible without these.
  approx_post_count INTEGER NULL CHECK (approx_post_count IS NULL OR approx_post_count >= 0),
  approx_active_months INTEGER NULL CHECK (approx_active_months IS NULL OR approx_active_months >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS quora_deletion_survey_accounts ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS quora_deletion_survey_accounts ADD COLUMN IF NOT EXISTS response_id UUID;
ALTER TABLE IF EXISTS quora_deletion_survey_accounts ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS quora_deletion_survey_accounts ADD COLUMN IF NOT EXISTS handle TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS quora_deletion_survey_accounts ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'account_deleted';
ALTER TABLE IF EXISTS quora_deletion_survey_accounts ADD COLUMN IF NOT EXISTS removed_month INTEGER NULL;
ALTER TABLE IF EXISTS quora_deletion_survey_accounts ADD COLUMN IF NOT EXISTS removed_year INTEGER NULL;
ALTER TABLE IF EXISTS quora_deletion_survey_accounts ADD COLUMN IF NOT EXISTS stated_reason TEXT NOT NULL DEFAULT 'none_given';
ALTER TABLE IF EXISTS quora_deletion_survey_accounts ADD COLUMN IF NOT EXISTS appealed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS quora_deletion_survey_accounts ADD COLUMN IF NOT EXISTS reinstated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS quora_deletion_survey_accounts ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE IF EXISTS quora_deletion_survey_accounts ADD COLUMN IF NOT EXISTS approx_post_count INTEGER NULL;
ALTER TABLE IF EXISTS quora_deletion_survey_accounts ADD COLUMN IF NOT EXISTS approx_active_months INTEGER NULL;
ALTER TABLE IF EXISTS quora_deletion_survey_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_quora_deletion_survey_accounts_response
  ON quora_deletion_survey_accounts(response_id, position);

-- What happened at this survey, without recording who it happened to.
--
-- Two different things are audited here and they have opposite rules, which is the whole reason
-- this table needs a comment. For a SUBMIT the event is recorded and the person is not: the
-- response id, how many account rows came with it, which consent flags were set, and whether it
-- was accepted or refused. No user id, and no IP — the rate limiter sees one, and it stops there,
-- because an address beside a timestamp re-identifies the response this table exists to protect.
-- For an ADMIN READ the opposite: the admin's id is the point, since the question that record
-- answers is who looked at the responses and took a copy away.
CREATE TABLE IF NOT EXISTS quora_deletion_survey_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Null on every survey submit event, always: naming the member who submitted would undo the
  -- anonymity of the response row the event is about. Populated for the identified actions —
  -- an admin reading or exporting the table, and a respondent choosing on the confirmation
  -- screen to start Unlock verification, which is an act on their own account rather than on
  -- the survey. No IP address is stored on any row here.
  actor_user_id TEXT,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL DEFAULT 'allow' CHECK (policy_status IN ('allow', 'deny')),
  reason TEXT,
  response_id UUID,
  row_count INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS quora_deletion_survey_audit_log ADD COLUMN IF NOT EXISTS actor_user_id TEXT;
ALTER TABLE IF EXISTS quora_deletion_survey_audit_log ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS quora_deletion_survey_audit_log ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT 'allow';
ALTER TABLE IF EXISTS quora_deletion_survey_audit_log ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE IF EXISTS quora_deletion_survey_audit_log ADD COLUMN IF NOT EXISTS response_id UUID;
ALTER TABLE IF EXISTS quora_deletion_survey_audit_log ADD COLUMN IF NOT EXISTS row_count INTEGER;
ALTER TABLE IF EXISTS quora_deletion_survey_audit_log ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS quora_deletion_survey_audit_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_quora_deletion_survey_audit_created_at
  ON quora_deletion_survey_audit_log(created_at DESC);

-- === QUORA LIVE ACCOUNT CENSUS (admin-only observational snapshot) ===
-- The other half of the Quora research. The deletion survey records what was REMOVED, which can
-- never establish what REMAINS — a claim about which accounts are still standing needs someone to
-- look at what is standing, on a stated date, by a stated method.
--
-- So this is observation, not self-report: an admin opens Quora on a fixed date, works through the
-- accounts a defined search turns up, and codes each one by what it writes about and the stance it
-- takes. The coding list deliberately includes categories that would REFUTE the claim being tested
-- (practical help, organizing) alongside the ones that would support it. A scheme with only the
-- expected answers in it produces the expected answer, which is worth nothing.
--
-- Nothing here is member data: every row describes a public Quora account observed from outside.
-- The one user column is `created_by_user_id` on a run, recording which admin made the
-- observations — an audit stamp, registered in lib/account/deletion-registry.ts as `retain` for
-- the same reason every other admin/reviewer column is. The entry rows carry no user column.
CREATE TABLE IF NOT EXISTS quora_live_census_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The fixed date the snapshot describes. Separate from created_at: coding a run can span days,
  -- but the census is only citable as "what was live on this date".
  observed_on DATE NOT NULL,
  -- Where the accounts came from, and it decides what the run can support.
  --
  -- 'existing_list' — a list assembled BEFORE this run, on a criterion unrelated to what the
  -- accounts say (the app's own directory_profiles with source 'admin' or 'community-generated'
  -- are exactly this: added because the person is a targeted individual, regardless of what they
  -- author). Walking that list today gives a real removal rate against a fixed denominator, AND
  -- the stance mix among the survivors.
  --
  -- 'fresh_search' — searching Quora today. This CANNOT see a removed account: a search returns
  -- survivors and nothing else. Such a run says something about what the survivors say, and
  -- nothing whatsoever about how many were removed. Recording the difference is what stops the
  -- second kind being read as the first.
  frame_kind TEXT NOT NULL DEFAULT 'fresh_search'
    CHECK (frame_kind IN ('existing_list', 'fresh_search')),
  -- What was searched, in plain words, and how accounts were picked from it. Without both, the
  -- numbers are unreproducible and indistinguishable from cherry-picking, so they are NOT NULL.
  topic_scope TEXT NOT NULL,
  sampling_method TEXT NOT NULL,
  notes TEXT NULL,
  -- 'open' while coding is in progress, 'closed' when the run is finished. Only a closed run should
  -- ever be quoted: a half-coded run reports whatever was entered first, which is usually whatever
  -- was easiest to find.
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by_user_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS quora_live_census_runs ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS quora_live_census_runs ADD COLUMN IF NOT EXISTS observed_on DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS quora_live_census_runs ADD COLUMN IF NOT EXISTS frame_kind TEXT NOT NULL DEFAULT 'fresh_search';
ALTER TABLE IF EXISTS quora_live_census_runs ADD COLUMN IF NOT EXISTS topic_scope TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS quora_live_census_runs ADD COLUMN IF NOT EXISTS sampling_method TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS quora_live_census_runs ADD COLUMN IF NOT EXISTS notes TEXT NULL;
ALTER TABLE IF EXISTS quora_live_census_runs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE IF EXISTS quora_live_census_runs ADD COLUMN IF NOT EXISTS created_by_user_id TEXT NULL;
ALTER TABLE IF EXISTS quora_live_census_runs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS quora_live_census_runs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_quora_live_census_runs_observed_on
  ON quora_live_census_runs(observed_on DESC);

-- One observed account. `stance` is the column the whole census exists for: it is what separates
-- "accounts about this subject are still there" from "what is still there says give up".
CREATE TABLE IF NOT EXISTS quora_live_census_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES quora_live_census_runs(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  profile_url TEXT NULL,
  -- Coded from the account as it appeared on the run's observed_on date. 'gone' is kept as an
  -- option because a link found part-way through a run sometimes no longer resolves — recording
  -- that is more honest than dropping the row.
  account_state TEXT NOT NULL DEFAULT 'live'
    CHECK (account_state IN ('live', 'gone', 'renamed_or_moved')),
  -- Same subject list as the deletion survey, on purpose: the two datasets only answer the
  -- question together, and they cannot be compared if they are coded differently. Changing one
  -- list without the other silently breaks that comparison.
  topics TEXT[] NOT NULL DEFAULT '{}',
  -- What the account does, NOT how the person behind it seems to be doing (owner decision,
  -- 2026-08-19). The three wellbeing values this once had — distress with no way forward, tells
  -- others to give up, says targeting is not real — were a psychological judgment about an
  -- identifiable person, inferred from their posts and stored against their handle, about a
  -- population that believes it is being catalogued and was never asked. The deletion survey
  -- promises the opposite standard about the same people; the census does not get a looser one
  -- because its subjects cannot object.
  --
  -- The cost is real and is not hidden: with these values gone the census cannot test whether what
  -- remains is discouraging. It measures survival and subject matter. See the inventory.
  stance TEXT NOT NULL DEFAULT 'unclear'
    CHECK (stance IN (
      'practical_help', 'organizing', 'personal_account', 'unclear', 'unrelated'
    )),
  approx_answer_count INTEGER NULL CHECK (approx_answer_count IS NULL OR approx_answer_count >= 0),
  last_active_year INTEGER NULL
    CHECK (last_active_year IS NULL OR (last_active_year BETWEEN 2005 AND 2100)),
  -- Where the coder looked, ideally an archive link, so a later reader can check the call rather
  -- than take it on trust.
  evidence_url TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS quora_live_census_entries ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS quora_live_census_entries ADD COLUMN IF NOT EXISTS run_id UUID;
ALTER TABLE IF EXISTS quora_live_census_entries ADD COLUMN IF NOT EXISTS handle TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS quora_live_census_entries ADD COLUMN IF NOT EXISTS profile_url TEXT NULL;
ALTER TABLE IF EXISTS quora_live_census_entries ADD COLUMN IF NOT EXISTS account_state TEXT NOT NULL DEFAULT 'live';
ALTER TABLE IF EXISTS quora_live_census_entries ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE IF EXISTS quora_live_census_entries ADD COLUMN IF NOT EXISTS stance TEXT NOT NULL DEFAULT 'unclear';
ALTER TABLE IF EXISTS quora_live_census_entries ADD COLUMN IF NOT EXISTS approx_answer_count INTEGER NULL;
ALTER TABLE IF EXISTS quora_live_census_entries ADD COLUMN IF NOT EXISTS last_active_year INTEGER NULL;
ALTER TABLE IF EXISTS quora_live_census_entries ADD COLUMN IF NOT EXISTS evidence_url TEXT NULL;
ALTER TABLE IF EXISTS quora_live_census_entries ADD COLUMN IF NOT EXISTS notes TEXT NULL;
ALTER TABLE IF EXISTS quora_live_census_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- A legacy row coded under one of the retired wellbeing values collapses to 'unclear' rather than
-- being deleted: the account was still observed, and its survival still counts toward the removal
-- rate. Runs before this change hold no such rows in production, so this is a no-op there. It also
-- has to run before the CHECK above can be trusted on a legacy database.
UPDATE quora_live_census_entries
   SET stance = 'unclear'
 WHERE stance IN ('distress_no_coping', 'discouraging', 'dismissive');
CREATE INDEX IF NOT EXISTS idx_quora_live_census_entries_run ON quora_live_census_entries(run_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quora_live_census_entries_run_handle
  ON quora_live_census_entries(run_id, lower(handle));

-- Who read the census, and when. An admin can download a file naming third parties; without this
-- nothing records that it happened. Shaped after unlock_audit_log (actor, command, status, reason,
-- metadata) so the two read the same way.
CREATE TABLE IF NOT EXISTS quora_live_census_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id TEXT,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL DEFAULT 'allow' CHECK (policy_status IN ('allow', 'deny')),
  reason TEXT,
  run_id UUID,
  row_count INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS quora_live_census_audit_log ADD COLUMN IF NOT EXISTS actor_user_id TEXT;
ALTER TABLE IF EXISTS quora_live_census_audit_log ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS quora_live_census_audit_log ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT 'allow';
ALTER TABLE IF EXISTS quora_live_census_audit_log ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE IF EXISTS quora_live_census_audit_log ADD COLUMN IF NOT EXISTS run_id UUID;
ALTER TABLE IF EXISTS quora_live_census_audit_log ADD COLUMN IF NOT EXISTS row_count INTEGER;
ALTER TABLE IF EXISTS quora_live_census_audit_log ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS quora_live_census_audit_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_quora_live_census_audit_created_at
  ON quora_live_census_audit_log(created_at DESC);

-- === contributions plugin (voluntary fundraiser drives) ===
-- Fundraiser cycles: each row is one time window (~3 months, owner-controlled) with
-- owner-editable goals on the three external surfaces (fiat gift cards, Quora comments,
-- GitHub stars). The "current cycle" is the row whose window contains now() (latest if
-- windows overlap).
CREATE TABLE IF NOT EXISTS contributions_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  fiat_goal_usd NUMERIC NOT NULL DEFAULT 0,
  quora_comment_goal INTEGER NOT NULL DEFAULT 0,
  github_star_goal INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS contributions_cycles ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS contributions_cycles ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS contributions_cycles ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS contributions_cycles ADD COLUMN IF NOT EXISTS fiat_goal_usd NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS contributions_cycles ADD COLUMN IF NOT EXISTS quora_comment_goal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS contributions_cycles ADD COLUMN IF NOT EXISTS github_star_goal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS contributions_cycles ADD COLUMN IF NOT EXISTS created_by_user_id TEXT;
ALTER TABLE IF EXISTS contributions_cycles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS contributions_cycles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_contributions_cycles_window ON contributions_cycles(starts_at, ends_at);
DO $contributions_cycles_window_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'contributions_cycles_window_check' AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE contributions_cycles
      ADD CONSTRAINT contributions_cycles_window_check CHECK (ends_at > starts_at);
  END IF;
END
$contributions_cycles_window_check$;
DO $contributions_cycles_goals_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'contributions_cycles_goals_check' AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE contributions_cycles
      ADD CONSTRAINT contributions_cycles_goals_check
      CHECK (fiat_goal_usd >= 0 AND quora_comment_goal >= 0 AND github_star_goal >= 0);
  END IF;
END
$contributions_cycles_goals_check$;

-- Contribution claims. The gift-card CODE is never collected or stored anywhere in the
-- platform — the member sends it to the owner over Signal, outside the app. signal_contact
-- is the member's own Signal URL or phone number (personal data; deleted with the account).
CREATE TABLE IF NOT EXISTS contributions_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('gift_card', 'quora_comment', 'github_star')),
  method TEXT,
  claimed_amount_usd NUMERIC,
  signal_contact TEXT,
  quora_post_url TEXT,
  github_profile_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  confirmed_amount_usd NUMERIC,
  credits_granted NUMERIC NOT NULL DEFAULT 0,
  credit_governance_event_id TEXT,
  cycle_id UUID,
  reviewed_by_user_id TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS claimed_amount_usd NUMERIC;
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS signal_contact TEXT;
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS quora_post_url TEXT;
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS github_profile_url TEXT;
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS confirmed_amount_usd NUMERIC;
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS credits_granted NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS credit_governance_event_id TEXT;
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS cycle_id UUID;
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS reviewed_by_user_id TEXT;
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS contributions_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_contributions_submissions_user ON contributions_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_submissions_status ON contributions_submissions(status);
DO $contributions_submissions_amounts_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'contributions_submissions_amounts_check' AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE contributions_submissions
      ADD CONSTRAINT contributions_submissions_amounts_check
      CHECK (
        (claimed_amount_usd IS NULL OR claimed_amount_usd >= 0) AND
        (confirmed_amount_usd IS NULL OR confirmed_amount_usd >= 0) AND
        credits_granted >= 0
      );
  END IF;
END
$contributions_submissions_amounts_check$;
-- A gift-card claim must carry the member's Signal contact (the only way the owner can match
-- a code received over Signal to the claim). Non-monetary kinds never set it.
DO $contributions_submissions_gift_card_signal_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'contributions_submissions_gift_card_signal_check' AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE contributions_submissions
      ADD CONSTRAINT contributions_submissions_gift_card_signal_check
      CHECK (kind <> 'gift_card' OR NULLIF(signal_contact, '') IS NOT NULL);
  END IF;
END
$contributions_submissions_gift_card_signal_check$;
-- cycle_id stays NULLABLE on purpose: a claim made while no drive is active has no cycle. The
-- foreign key only constrains non-null values.
DO $contributions_submissions_cycle_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contributions_submissions_cycle_id_fkey' AND constraint_schema = current_schema()
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE contributions_submissions
      ADD CONSTRAINT contributions_submissions_cycle_id_fkey
      FOREIGN KEY (cycle_id) REFERENCES contributions_cycles(id);
  END IF;
END
$contributions_submissions_cycle_fk$;

-- Runtime configuration singleton (id BOOLEAN PRIMARY KEY DEFAULT TRUE, same pattern as
-- service_credits_treasury_config; fields are individual columns like unlock_runtime_config).
-- banner_snooze_months is an internal knob and is never surfaced to members.
CREATE TABLE IF NOT EXISTS contributions_runtime_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  credits_per_usd NUMERIC NOT NULL DEFAULT 10,
  non_monetary_unit_value_usd NUMERIC NOT NULL DEFAULT 1,
  per_user_cycle_credit_cap NUMERIC NOT NULL DEFAULT 300,
  banner_snooze_months INTEGER NOT NULL DEFAULT 2,
  banner_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  signal_instructions TEXT NOT NULL DEFAULT '',
  updated_by_user_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS contributions_runtime_config ADD COLUMN IF NOT EXISTS id BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS contributions_runtime_config ADD COLUMN IF NOT EXISTS credits_per_usd NUMERIC NOT NULL DEFAULT 10;
ALTER TABLE IF EXISTS contributions_runtime_config ADD COLUMN IF NOT EXISTS non_monetary_unit_value_usd NUMERIC NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS contributions_runtime_config ADD COLUMN IF NOT EXISTS per_user_cycle_credit_cap NUMERIC NOT NULL DEFAULT 300;
ALTER TABLE IF EXISTS contributions_runtime_config ADD COLUMN IF NOT EXISTS banner_snooze_months INTEGER NOT NULL DEFAULT 2;
ALTER TABLE IF EXISTS contributions_runtime_config ADD COLUMN IF NOT EXISTS banner_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS contributions_runtime_config ADD COLUMN IF NOT EXISTS signal_instructions TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS contributions_runtime_config ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT;
ALTER TABLE IF EXISTS contributions_runtime_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
DO $contributions_runtime_config_positive_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'contributions_runtime_config_positive_check' AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE contributions_runtime_config
      ADD CONSTRAINT contributions_runtime_config_positive_check
      CHECK (
        credits_per_usd > 0 AND
        non_monetary_unit_value_usd > 0 AND
        per_user_cycle_credit_cap > 0 AND
        banner_snooze_months > 0
      );
  END IF;
END
$contributions_runtime_config_positive_check$;
-- Migrate the banner snooze from the original 6-month default to 2 months (owner request,
-- 2026-07-18). Only touches a row still holding the old default; the snooze length is not surfaced
-- in the admin UI, so any stored 6 is that leftover default, safe to move to the new default.
UPDATE contributions_runtime_config SET banner_snooze_months = 2, updated_at = NOW() WHERE banner_snooze_months = 6;

-- Per-user fundraiser banner state. Dismissing the banner silently snoozes it for
-- banner_snooze_months; nothing is shown to the member about the snooze length.
CREATE TABLE IF NOT EXISTS contributions_banner_state (
  user_id TEXT PRIMARY KEY,
  snoozed_until TIMESTAMPTZ,
  last_shown_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS contributions_banner_state ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
ALTER TABLE IF EXISTS contributions_banner_state ADD COLUMN IF NOT EXISTS last_shown_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS contributions_banner_state ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Audit log (same shape family as unlock_audit_log). Banner dismissal is deliberately NOT
-- logged (low value, privacy). signal_contact values are never written into metadata.
CREATE TABLE IF NOT EXISTS contributions_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_submission_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS contributions_audit_log ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS contributions_audit_log ADD COLUMN IF NOT EXISTS actor_user_id TEXT;
ALTER TABLE IF EXISTS contributions_audit_log ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE IF EXISTS contributions_audit_log ADD COLUMN IF NOT EXISTS target_submission_id UUID;
ALTER TABLE IF EXISTS contributions_audit_log ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS contributions_audit_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- skills_taxonomy_dependency_graph view — defined at the END so its source table
-- (skills_taxonomy_consumer_bindings, created above) already exists. Defining it at the
-- top of the file made a fresh-DB `migrate:schema` fail: the view referenced a table
-- that had not been created yet.
CREATE OR REPLACE VIEW skills_taxonomy_dependency_graph AS
  SELECT target_type, target_id, sum(reference_count)::integer AS total_references, max(updated_at) AS snapshot_at
  FROM skills_taxonomy_consumer_bindings
  GROUP BY target_type, target_id;

-- === account_restrictions (platform-wide trust & safety signal) ===
-- One canonical record of whether a member is restricted, and at what scope. The auth gate blocks an
-- 'all'-scope restriction on every product route; value-movement and contact points additionally
-- honour 'trading'/'contact' scopes. Supersedes the per-plugin flags
-- (trust_transport_user_extension.account_restricted, service_credits_wallets.is_frozen), which are
-- retired in code and backfilled below. Defined at the END so the tables it backfills from already exist.
CREATE TABLE IF NOT EXISTS account_restrictions (
  user_id TEXT PRIMARY KEY,
  is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  restriction_scope TEXT NOT NULL DEFAULT 'all' CHECK (restriction_scope IN ('all', 'trading', 'contact')),
  restricted_at TIMESTAMPTZ,
  restricted_by_user_id TEXT,
  restriction_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS account_restrictions ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS account_restrictions ADD COLUMN IF NOT EXISTS restriction_scope TEXT NOT NULL DEFAULT 'all';
ALTER TABLE IF EXISTS account_restrictions ADD COLUMN IF NOT EXISTS restricted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS account_restrictions ADD COLUMN IF NOT EXISTS restricted_by_user_id TEXT;
ALTER TABLE IF EXISTS account_restrictions ADD COLUMN IF NOT EXISTS restriction_reason TEXT;
ALTER TABLE IF EXISTS account_restrictions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS account_restrictions_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('restrict', 'unrestrict')),
  target_user_id TEXT NOT NULL,
  scope TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_restrictions_audit_created ON account_restrictions_audit(created_at DESC);

-- One-time backfill from the retired per-plugin flags. ON CONFLICT DO NOTHING so it never
-- re-restricts a member whose canonical row already exists (e.g. after an operator unrestricts).
INSERT INTO account_restrictions (user_id, is_restricted, restriction_scope, restricted_at, restricted_by_user_id, restriction_reason)
SELECT user_id, TRUE, 'trading', COALESCE(restricted_at, NOW()), restricted_by_user_id, restriction_reason
FROM trust_transport_user_extension
WHERE account_restricted = TRUE
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO account_restrictions (user_id, is_restricted, restriction_scope, restricted_at, restricted_by_user_id, restriction_reason)
SELECT user_id, TRUE, 'trading', COALESCE(frozen_at, NOW()), frozen_by_user_id, frozen_reason
FROM service_credits_wallets
WHERE is_frozen = TRUE
ON CONFLICT (user_id) DO NOTHING;

-- === beacon-plugin ===
-- Beacon: admin-only one-way livestream. An admin goes live ad hoc to broadcast a live demo
-- (screen content), flagship use the "State of the Skills Economy" address. Watching is public
-- (HLS, no sign-in); chatting/reacting needs a signed-in member (Stream Chat). Live chat is
-- ephemeral (Stream only) and is NOT stored here — only the event lifecycle and the saved recording.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS beacon_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'ended')),
  host_user_id TEXT NOT NULL,
  stream_call_type TEXT NOT NULL DEFAULT 'livestream',
  stream_call_id TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_url TEXT,
  recording_ready_at TIMESTAMPTZ,
  commons_live_post_id UUID,
  commons_recording_post_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guarded DDL so legacy DBs gain every column. Every ALTER carries a default (the id-default lesson
-- from the announcements fix) so adding a column to a table with existing rows never fails.
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS host_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS stream_call_type TEXT NOT NULL DEFAULT 'livestream';
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS stream_call_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS recording_ready_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS commons_live_post_id UUID;
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS commons_recording_post_id UUID;
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS beacon_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- At most one live event at a time keeps the public viewer unambiguous and bounds Stream video cost.
CREATE UNIQUE INDEX IF NOT EXISTS beacon_events_one_live_idx ON beacon_events ((status = 'live')) WHERE status = 'live';
CREATE INDEX IF NOT EXISTS beacon_events_status_idx ON beacon_events (status);
CREATE INDEX IF NOT EXISTS beacon_events_created_at_idx ON beacon_events (created_at DESC);

CREATE TABLE IF NOT EXISTS beacon_events_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL DEFAULT 'allow' CHECK (policy_status IN ('allow', 'deny')),
  reason TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT '',
  target_id TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS beacon_events_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS beacon_events_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS beacon_events_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS beacon_events_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT 'allow';
ALTER TABLE IF EXISTS beacon_events_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS beacon_events_admin_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS beacon_events_admin_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS beacon_events_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS beacon_events_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS beacon_events_admin_audit_trail_created_at_idx ON beacon_events_admin_audit_trail (created_at DESC);

-- member_plugin_presence: a shared, cross-plugin index of where each member is active.
-- Each plugin (or, for this first cut, a one-time backfill) writes one row per member-owned
-- listing it holds. The Directory provider profile reads this index to show "Also active in"
-- for a claimed profile, instead of querying every plugin's tables directly. Read-only from
-- the Directory's point of view; rows are owned and maintained by the source plugins.
CREATE TABLE IF NOT EXISTS member_plugin_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  plugin_slug TEXT NOT NULL,
  ref_type TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  label TEXT NOT NULL,
  deep_link TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS member_plugin_presence ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS member_plugin_presence ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS member_plugin_presence ADD COLUMN IF NOT EXISTS plugin_slug TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS member_plugin_presence ADD COLUMN IF NOT EXISTS ref_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS member_plugin_presence ADD COLUMN IF NOT EXISTS ref_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS member_plugin_presence ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS member_plugin_presence ADD COLUMN IF NOT EXISTS deep_link TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS member_plugin_presence ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS member_plugin_presence ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS member_plugin_presence ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- One presence row per (member, plugin, ref_type, ref_id) so the backfill and future write hooks
-- can upsert idempotently without creating duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS member_plugin_presence_unique_ref_idx
  ON member_plugin_presence (user_id, plugin_slug, ref_type, ref_id);
CREATE INDEX IF NOT EXISTS member_plugin_presence_user_id_idx ON member_plugin_presence (user_id);

-- member_blocks: product-wide, cross-cutting member blocking (issue #809, owner-signed model
-- 2026-06-24). One member (blocker_user_id) blocks another (blocked_user_id). A block is created
-- one-way and is invisible to the blocked person, but enforcement is SYMMETRIC: once A blocks B,
-- neither A nor B can see or contact the other on any member-to-member surface. The shared helper
-- `isBlockedBetween(a, b)` (ctf/packages/web/lib/blocks/repository.ts) is the single check every
-- surface consults, mirroring how unlock gating is one shared check.
--
-- No `reason` column: ordinary blocks are private and the admin never reads them. A member may block
-- anyone for any reason. The optional "report as suspected predator/trafficker" escalation is a
-- SEPARATE mechanism (a member safety report kept apart from this table) built in a later task; it is
-- deliberately not stored here so ordinary blocks stay out of the admin's view.
--
-- user_id columns are TEXT to line up with the user-id type used elsewhere (e.g.
-- foundation_provider_skills.user_id, directory_profiles.claimed_by_user_id) so joins/casts match.
CREATE TABLE IF NOT EXISTS member_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id TEXT NOT NULL,
  blocked_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT member_blocks_blocker_blocked_unique UNIQUE (blocker_user_id, blocked_user_id),
  CONSTRAINT member_blocks_no_self_block CHECK (blocker_user_id <> blocked_user_id)
);

ALTER TABLE IF EXISTS member_blocks ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS member_blocks ADD COLUMN IF NOT EXISTS blocker_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS member_blocks ADD COLUMN IF NOT EXISTS blocked_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS member_blocks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Converge a legacy table that predates the unique constraint / self-block check. Guarded so a fresh
-- table (which already has them from CREATE TABLE) does not double-add, and a legacy one gains them.
DO $member_blocks_unique_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'member_blocks_blocker_blocked_unique' AND constraint_schema = current_schema()
      AND table_name = 'member_blocks'
  ) THEN
    BEGIN
      ALTER TABLE member_blocks
        ADD CONSTRAINT member_blocks_blocker_blocked_unique UNIQUE (blocker_user_id, blocked_user_id);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$member_blocks_unique_constraint$;

DO $member_blocks_no_self_block$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'member_blocks_no_self_block' AND constraint_schema = current_schema()
  ) THEN
    BEGIN
      ALTER TABLE member_blocks
        ADD CONSTRAINT member_blocks_no_self_block CHECK (blocker_user_id <> blocked_user_id);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$member_blocks_no_self_block$;

-- The symmetric lookup (`WHERE (blocker=$1 AND blocked=$2) OR (blocker=$2 AND blocked=$1)`) runs on
-- many hot paths, so index it both ways. The unique constraint already covers the
-- (blocker_user_id, blocked_user_id) direction; this composite index covers the reverse direction so
-- the OR-query is index-served regardless of which user is the blocker.
CREATE INDEX IF NOT EXISTS member_blocks_blocked_blocker_idx
  ON member_blocks (blocked_user_id, blocker_user_id);

-- member_safety_reports: the optional safety escalation on the member-block flow (issue #809, task 3,
-- owner-signed model 2026-06-24). This table is DELIBERATELY SEPARATE from member_blocks. An ordinary
-- block is the member's own private boundary and the admin never sees it; only when the blocking
-- member flags the block as a safety concern ("suspected predator / human trafficker") is a row
-- written here, and only those rows ever reach the admin. Keeping the two tables apart is what
-- guarantees ordinary blocks stay out of the admin's view while a safety report always reaches the
-- owner so they can ban globally (the global ban itself is task 5, built later).
--
-- reporter_user_id  — the member who raised the concern (the blocker).
-- reported_user_id  — the member the concern is about (the blocked person).
-- detail            — optional free-text context the reporter chose to add (nullable).
-- status            — open | reviewed | dismissed. New reports are 'open'; the admin marks them
--                     reviewed or dismissed from the admin queue. CHECK keeps the value in-range.
-- reviewed_at / reviewed_by_user_id — stamped when an admin moves a report out of 'open'.
--
-- user_id columns are TEXT to line up with member_blocks and the user-id type used elsewhere.
CREATE TABLE IF NOT EXISTS member_safety_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id TEXT NOT NULL,
  reported_user_id TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id TEXT,
  CONSTRAINT member_safety_reports_status_check CHECK (status IN ('open', 'reviewed', 'dismissed')),
  CONSTRAINT member_safety_reports_no_self_report CHECK (reporter_user_id <> reported_user_id)
);

ALTER TABLE IF EXISTS member_safety_reports ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS member_safety_reports ADD COLUMN IF NOT EXISTS reporter_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS member_safety_reports ADD COLUMN IF NOT EXISTS reported_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS member_safety_reports ADD COLUMN IF NOT EXISTS detail TEXT;
ALTER TABLE IF EXISTS member_safety_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE IF EXISTS member_safety_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS member_safety_reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS member_safety_reports ADD COLUMN IF NOT EXISTS reviewed_by_user_id TEXT;

-- Converge a legacy table that predates the CHECK constraints. Guarded so a fresh table (which
-- already has them from CREATE TABLE) does not double-add, and a legacy one gains them.
DO $member_safety_reports_status_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'member_safety_reports_status_check' AND constraint_schema = current_schema()
  ) THEN
    BEGIN
      ALTER TABLE member_safety_reports
        ADD CONSTRAINT member_safety_reports_status_check CHECK (status IN ('open', 'reviewed', 'dismissed'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$member_safety_reports_status_check$;

DO $member_safety_reports_no_self_report$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'member_safety_reports_no_self_report' AND constraint_schema = current_schema()
  ) THEN
    BEGIN
      ALTER TABLE member_safety_reports
        ADD CONSTRAINT member_safety_reports_no_self_report CHECK (reporter_user_id <> reported_user_id);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END
$member_safety_reports_no_self_report$;

-- The admin queue reads open reports first (status filter + newest-first), and counts open reports
-- per reported member so a repeat offender stands out. Index status for the queue read, and
-- reported_user_id for the per-member repeat count.
CREATE INDEX IF NOT EXISTS member_safety_reports_status_idx
  ON member_safety_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS member_safety_reports_reported_user_idx
  ON member_safety_reports (reported_user_id);

-- safety_admin_audit_trail: an append-only record of admin moderation decisions on safety reports.
-- Marking a report reviewed or dismissed is an irreversible moderation action, so each one writes an
-- audit row here in addition to stamping reviewed_at / reviewed_by_user_id on the report itself. This
-- mirrors the per-plugin *_admin_audit_trail tables (e.g. service_credits_admin_audit_trail) so the
-- safety queue has the same durable, admin-visible trail. Rows are never updated or deleted.
CREATE TABLE IF NOT EXISTS safety_admin_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS safety_admin_audit_trail ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS safety_admin_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS safety_admin_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS safety_admin_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS safety_admin_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS safety_admin_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS safety_admin_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS safety_admin_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS safety_admin_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS safety_admin_audit_trail_target_idx
  ON safety_admin_audit_trail (target_type, target_id, created_at DESC);

-- === recurring_activities (Recurring Activity plugin; issue #885) =================================
-- A member's self-declared, counterparty-confirmed ONGOING activity with one other member — the way
-- the platform captures recurring peer relationships (rent, an ongoing service, a standing favor)
-- WITHOUT becoming a payment processor or a recurring-payment record. Design constraints, all load-
-- bearing (see the Recurring Activity feature inventory and issue #885):
--   * NOT a ledger. No value ever moves here; this only records that an ongoing activity exists.
--   * NO free-text anywhere. `sector` is a fixed dropdown (the "brief description"); there is no note
--     column, by owner decision — a vulnerable population must not be able to over-disclose an
--     auditable detail in free text.
--   * Fiat carries NO amount. A fiat-denominated line stores only the currency label + cadence, never
--     a number, so the platform never holds a summable recurring-fiat-payment total (the liability
--     firewall). Only ServiceCredits — an internal utility token with no outside reporting duty —
--     carries a declared value (`sc_value`), and even that is a declared figure, never an executed
--     transfer, so it never touches real ServiceCredits balances or the SC ledger.
--   * Two-sided. Created `pending`; it only counts toward Trust or GDP once the counterparty confirms
--     it (`active`). Either party can end it (`ended`); the counterparty may decline it (`declined`).
--   * Private by default. `visibility` defaults to 'private'; only coarse aggregate counts ever reach
--     public surfaces (Trust distinct-counterparty signal, GDP count/value contribution).
CREATE TABLE IF NOT EXISTS recurring_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  counterparty_user_id TEXT NOT NULL,
  sector TEXT NOT NULL DEFAULT 'general' CHECK (sector IN ('housing','service','favor','general')),
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  cadence TEXT NOT NULL DEFAULT 'monthly' CHECK (cadence IN ('weekly','biweekly','monthly','quarterly')),
  sc_value NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','ended','declined')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','restricted','public')),
  confirmed_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  ended_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recurring_activities_no_self CHECK (owner_user_id <> counterparty_user_id)
);
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS owner_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS counterparty_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS sector TEXT NOT NULL DEFAULT 'general';
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS currency_code TEXT;
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS cadence TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS sc_value NUMERIC(14,2);
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS ended_by_user_id TEXT;
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Which app the member declared this from, when they used that app's inline "mark as recurring"
-- control instead of walking over to the Recurring Activity plugin (the plugin's own form leaves this
-- NULL). Two jobs: it lets a surface show where a relationship came from, and it lets GDP recognition
-- tell apart a declaration made in an app that already records every single exchange (Foundation calls,
-- TrustTransport trips, SocketRelay favors — where counting a declared ServiceCredits value again would
-- count the same value twice) from one made in an app that only records the arrangement (LightHouse).
-- Free text rather than a CHECK: the plugin list changes, and an unknown value simply falls back to the
-- safe treatment. Validated against the plugin registry at write time.
ALTER TABLE IF EXISTS recurring_activities ADD COLUMN IF NOT EXISTS origin_plugin TEXT;
CREATE INDEX IF NOT EXISTS recurring_activities_owner_idx ON recurring_activities (owner_user_id, status);
CREATE INDEX IF NOT EXISTS recurring_activities_counterparty_idx ON recurring_activities (counterparty_user_id, status);
CREATE INDEX IF NOT EXISTS recurring_activities_status_currency_idx ON recurring_activities (status, currency_code);

-- Append-only audit trail for every Recurring Activity mutation (create/confirm/decline/end) and for
-- denied attempts. Mirrors trust_admin_audit_trail. No sensitive raw payload is stored — only coarse
-- metadata (sector, currency code, cadence, status transition).
CREATE TABLE IF NOT EXISTS recurring_activity_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id TEXT,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL DEFAULT 'allow',
  reason TEXT NOT NULL DEFAULT '',
  activity_id UUID,
  request_id TEXT,
  trace_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS recurring_activity_audit_trail ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS recurring_activity_audit_trail ADD COLUMN IF NOT EXISTS actor_user_id TEXT;
ALTER TABLE IF EXISTS recurring_activity_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS recurring_activity_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT 'allow';
ALTER TABLE IF EXISTS recurring_activity_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS recurring_activity_audit_trail ADD COLUMN IF NOT EXISTS activity_id UUID;
ALTER TABLE IF EXISTS recurring_activity_audit_trail ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE IF EXISTS recurring_activity_audit_trail ADD COLUMN IF NOT EXISTS trace_id TEXT;
ALTER TABLE IF EXISTS recurring_activity_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS recurring_activity_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS recurring_activity_audit_trail_activity_idx ON recurring_activity_audit_trail (activity_id, created_at DESC);

-- === contributor-access (gated-channel / contributor badge eligibility module) ===
-- Owns the categorical "eligible / not-yet" decision described in
-- ctf/docs/developer/TRUSTED_CHANNELS_AND_CONTRIBUTOR_BADGE_PROPOSAL.md (working badge name
-- "Keeper of the Commons" — doc-comment only, no member-facing copy in this slice). This module is
-- deliberately separate from the Trust plugin: it never reads or writes any trust_* table.

-- Single-row owner-tunable config (id fixed to 1). `weights` holds per value-event-key overrides
-- of the engine's DEFAULT_WEIGHTS; a missing key falls back to the default. `channel_open` is the
-- gated channel's launch gate: the admin config route only lets it turn on once the eligible count
-- reaches `min_eligible_to_open_channel`, and the member channel routes deny while it is off.
CREATE TABLE IF NOT EXISTS contributor_access_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  threshold NUMERIC NOT NULL DEFAULT 100,
  min_account_age_days INT NOT NULL DEFAULT 90,
  min_distinct_plugins INT NOT NULL DEFAULT 3,
  min_counterparties INT NOT NULL DEFAULT 5,
  min_eligible_to_open_channel INT NOT NULL DEFAULT 10,
  channel_open BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS contributor_access_config ADD COLUMN IF NOT EXISTS id INT;
ALTER TABLE IF EXISTS contributor_access_config ADD COLUMN IF NOT EXISTS weights JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS contributor_access_config ADD COLUMN IF NOT EXISTS threshold NUMERIC NOT NULL DEFAULT 100;
ALTER TABLE IF EXISTS contributor_access_config ADD COLUMN IF NOT EXISTS min_account_age_days INT NOT NULL DEFAULT 90;
ALTER TABLE IF EXISTS contributor_access_config ADD COLUMN IF NOT EXISTS min_distinct_plugins INT NOT NULL DEFAULT 3;
ALTER TABLE IF EXISTS contributor_access_config ADD COLUMN IF NOT EXISTS min_counterparties INT NOT NULL DEFAULT 5;
ALTER TABLE IF EXISTS contributor_access_config ADD COLUMN IF NOT EXISTS min_eligible_to_open_channel INT NOT NULL DEFAULT 10;
ALTER TABLE IF EXISTS contributor_access_config ADD COLUMN IF NOT EXISTS channel_open BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS contributor_access_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Per-member eligibility. Additive only: once `eligible` is TRUE it is never unset by recompute —
-- only a for-cause revoke (a reviewed harm/abuse action) flips it off. `reason_snapshot` is the
-- internal evidence behind the decision (per-event counts, gates); it is never exposed on any
-- member-facing surface — no numeric score, ever (proposal hard guardrail; rule 132 for the
-- Foundation per-member counts inside it).
CREATE TABLE IF NOT EXISTS contributor_access_eligibility (
  user_id TEXT PRIMARY KEY,
  eligible BOOLEAN NOT NULL DEFAULT FALSE,
  first_earned_at TIMESTAMPTZ NULL,
  reason_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_for_cause BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_reason TEXT NULL,
  revoked_at TIMESTAMPTZ NULL,
  revoked_by TEXT NULL
);
ALTER TABLE IF EXISTS contributor_access_eligibility ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS contributor_access_eligibility ADD COLUMN IF NOT EXISTS eligible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS contributor_access_eligibility ADD COLUMN IF NOT EXISTS first_earned_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS contributor_access_eligibility ADD COLUMN IF NOT EXISTS reason_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS contributor_access_eligibility ADD COLUMN IF NOT EXISTS computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS contributor_access_eligibility ADD COLUMN IF NOT EXISTS revoked_for_cause BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS contributor_access_eligibility ADD COLUMN IF NOT EXISTS revoked_reason TEXT;
ALTER TABLE IF EXISTS contributor_access_eligibility ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS contributor_access_eligibility ADD COLUMN IF NOT EXISTS revoked_by TEXT;
CREATE INDEX IF NOT EXISTS contributor_access_eligibility_eligible_idx ON contributor_access_eligibility (eligible, first_earned_at);

-- Admin allow/deny audit log. Same shape as weekly_performance_audit_trail.
CREATE TABLE IF NOT EXISTS contributor_access_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  command TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS contributor_access_audit_trail ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS contributor_access_audit_trail ADD COLUMN IF NOT EXISTS actor_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS contributor_access_audit_trail ADD COLUMN IF NOT EXISTS command TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS contributor_access_audit_trail ADD COLUMN IF NOT EXISTS policy_status TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS contributor_access_audit_trail ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS contributor_access_audit_trail ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS contributor_access_audit_trail ADD COLUMN IF NOT EXISTS target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS contributor_access_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS contributor_access_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Gated contributor channel messages. Same architecture as the Commons: the database is the
-- message source of truth (custom UI + polling) and Stream is only the live layer. Rows are
-- visible ONLY to channel members (the eligibility flag) and admins — never to the public
-- Commons/feed. `reply_to_post_id` is the Signal-style quoted reply (the channel's thread
-- mechanism). Text only — there is no image/file column and none may be added (proposal hard
-- guardrail: no images in v1). `moderation_status` mirrors the Commons feed_community_posts
-- column (posts that pass the content gate store 'accepted'; reads filter to it). `deleted_at` /
-- `deleted_by` are the author/admin soft delete: content is hidden from every read, not erased,
-- and `deleted_by` records who removed it (the author, or an admin acting as moderator).
CREATE TABLE IF NOT EXISTS contributor_access_channel_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id TEXT NOT NULL,
  author_username TEXT NULL,
  body TEXT NOT NULL,
  reply_to_post_id UUID NULL,
  moderation_status TEXT NOT NULL DEFAULT 'accepted',
  deleted_at TIMESTAMPTZ NULL,
  deleted_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS contributor_access_channel_posts ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS contributor_access_channel_posts ADD COLUMN IF NOT EXISTS author_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS contributor_access_channel_posts ADD COLUMN IF NOT EXISTS author_username TEXT;
ALTER TABLE IF EXISTS contributor_access_channel_posts ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS contributor_access_channel_posts ADD COLUMN IF NOT EXISTS reply_to_post_id UUID;
ALTER TABLE IF EXISTS contributor_access_channel_posts ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'accepted';
ALTER TABLE IF EXISTS contributor_access_channel_posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS contributor_access_channel_posts ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE IF EXISTS contributor_access_channel_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS contributor_access_channel_posts_created_idx ON contributor_access_channel_posts (created_at DESC);

-- Emoji reactions on gated-channel posts. Emoji values are validated in code against the fixed
-- gated reaction set (richer than the Commons set).
CREATE TABLE IF NOT EXISTS contributor_access_channel_post_reactions (
  post_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id, emoji)
);
ALTER TABLE IF EXISTS contributor_access_channel_post_reactions ADD COLUMN IF NOT EXISTS post_id UUID;
ALTER TABLE IF EXISTS contributor_access_channel_post_reactions ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS contributor_access_channel_post_reactions ADD COLUMN IF NOT EXISTS emoji TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS contributor_access_channel_post_reactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- === Mutual Time (one-link meeting-time picker, spec #1780) ============================
-- An owner/admin creates an event with one shareable link. Approved members open the link and pick
-- up to 3 one-hour windows (snapped to the half-hour) in their own timezone. When the survey closes
-- (at closes_at, or manually), the app picks the one-hour window the most members can make (ties go
-- to the earliest) and shows it in each viewer's own timezone with a link to where the meeting happens.
-- No credits are involved anywhere. Candidate slots are computed from window_start_date + window_days
-- (not stored per-slot); only cast votes are stored. A member's votes (and any events they created)
-- are removed on account deletion — see lib/account/deletion-registry.ts.
CREATE TABLE IF NOT EXISTS mutual_time_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT NOT NULL,
  title TEXT NULL,
  description TEXT NULL,
  meeting_plugin TEXT NOT NULL CHECK (meeting_plugin IN ('chyme', 'peer-programming', 'beacon')),
  window_start_date DATE NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 7 CHECK (window_days BETWEEN 1 AND 14),
  opens_at TIMESTAMPTZ NULL,
  closes_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  result_slot_start TIMESTAMPTZ NULL,
  result_can_make_it INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL,
  -- TRUE when the survey closed itself at closes_at rather than an admin pressing Close. It is what
  -- the admin-landing dot keys on: a survey that chose its own time needs the admin told, where one
  -- they closed by hand does not.
  auto_closed BOOLEAN NOT NULL DEFAULT FALSE
);
-- Column reconciliation (all added nullable / with safe defaults so they never fail on a populated table).
ALTER TABLE IF EXISTS mutual_time_events ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE IF EXISTS mutual_time_events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS mutual_time_events ADD COLUMN IF NOT EXISTS meeting_plugin TEXT;
ALTER TABLE IF EXISTS mutual_time_events ADD COLUMN IF NOT EXISTS window_start_date DATE;
ALTER TABLE IF EXISTS mutual_time_events ADD COLUMN IF NOT EXISTS window_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE IF EXISTS mutual_time_events ADD COLUMN IF NOT EXISTS opens_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS mutual_time_events ADD COLUMN IF NOT EXISTS closes_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS mutual_time_events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE IF EXISTS mutual_time_events ADD COLUMN IF NOT EXISTS result_slot_start TIMESTAMPTZ;
ALTER TABLE IF EXISTS mutual_time_events ADD COLUMN IF NOT EXISTS result_can_make_it INTEGER;
ALTER TABLE IF EXISTS mutual_time_events ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS mutual_time_events ADD COLUMN IF NOT EXISTS auto_closed BOOLEAN NOT NULL DEFAULT FALSE;
-- "Where we'll meet" vocabulary. Beacon was added after the table shipped, so an existing database
-- still carries the two-value check from the original CREATE TABLE. Drop + re-add keeps it idempotent
-- and brings a legacy database up to date (same idiom as currencies_kind_check). NOT VALID so the ADD
-- can never fail on an existing row and stop the rest of the file from being applied.
ALTER TABLE IF EXISTS mutual_time_events DROP CONSTRAINT IF EXISTS mutual_time_events_meeting_plugin_check;
ALTER TABLE IF EXISTS mutual_time_events ADD CONSTRAINT mutual_time_events_meeting_plugin_check CHECK (meeting_plugin IN ('chyme', 'peer-programming', 'beacon')) NOT VALID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mutual_time_events_slug ON mutual_time_events(slug);
CREATE INDEX IF NOT EXISTS idx_mutual_time_events_creator ON mutual_time_events(created_by_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mutual_time_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES mutual_time_events(id) ON DELETE CASCADE,
  voter_user_id TEXT NOT NULL,
  slot_start_utc TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS mutual_time_votes ADD COLUMN IF NOT EXISTS slot_start_utc TIMESTAMPTZ;
ALTER TABLE IF EXISTS mutual_time_votes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- One row per (event, voter, slot): a voter cannot double-count a slot, and revising picks is a
-- delete-then-insert of that voter's rows for the event.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mutual_time_votes_event_voter_slot ON mutual_time_votes(event_id, voter_user_id, slot_start_utc);
CREATE INDEX IF NOT EXISTS idx_mutual_time_votes_event_slot ON mutual_time_votes(event_id, slot_start_utc);
CREATE INDEX IF NOT EXISTS idx_mutual_time_votes_voter ON mutual_time_votes(voter_user_id);

-- ============================================================================
-- Notifications center (cross-plugin, member-facing)
-- ----------------------------------------------------------------------------
-- One central feed of notify-worthy events across plugins. A row stores only a
-- reference (source_plugin, notification_type, target_ref) plus a short, neutral,
-- pre-rendered summary and an in-app link — never sensitive detail — so a
-- notification never leaks on a shared/monitored device and never renders content
-- the member has since lost access to. The in-app feed is always available; only
-- device push is gated by notification_preferences (opt-out by default).
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Recipient (Clerk user id).
  user_id TEXT NOT NULL,
  -- Originating plugin slug, e.g. 'commons', 'foundation', 'service-credits'.
  source_plugin TEXT NOT NULL,
  -- Specific event type, e.g. 'commons.reply', 'foundation.call.incoming'.
  notification_type TEXT NOT NULL,
  -- Coarse opt-in bucket: 'safety' | 'activity' | 'community'.
  category TEXT NOT NULL,
  -- Short, neutral, member-facing statement of what happened. No sensitive detail.
  summary TEXT NOT NULL,
  -- In-app deep link to open (e.g. '/apps/foundation'); null when there is nowhere to go.
  link_path TEXT,
  -- Opaque id of the underlying row (for dedupe and optional resolve). Null when not applicable.
  target_ref TEXT,
  -- Null = unread; set when the member opens/marks it read.
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS source_plugin TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS notification_type TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'activity';
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS link_path TEXT;
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS target_ref TEXT;
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id) WHERE read_at IS NULL;
-- Dedupe guard: the same event is never inserted twice for the same recipient.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedupe
  ON notifications (user_id, notification_type, target_ref)
  WHERE target_ref IS NOT NULL;

-- Per-member device-push opt-in. The in-app feed is NOT gated by this — only device push is.
-- All category opt-ins default FALSE (opt-out by default). discreet_push keeps push text generic
-- (no plugin name or content) and defaults TRUE, the safest choice for a shared/monitored device.
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY,
  push_safety BOOLEAN NOT NULL DEFAULT FALSE,
  push_activity BOOLEAN NOT NULL DEFAULT FALSE,
  push_community BOOLEAN NOT NULL DEFAULT FALSE,
  discreet_push BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS notification_preferences ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS notification_preferences ADD COLUMN IF NOT EXISTS push_safety BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS notification_preferences ADD COLUMN IF NOT EXISTS push_activity BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS notification_preferences ADD COLUMN IF NOT EXISTS push_community BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS notification_preferences ADD COLUMN IF NOT EXISTS discreet_push BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS notification_preferences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
COMMIT;


-- spelling:disable — this migration must name the old British value to rewrite it; every
-- occurrence below is the value being migrated away from, not new usage.
-- === US-SPELLING DATA MIGRATION: cancelled -> canceled (owner-directed, 2026-07-31) ===
-- "cancelled" was a stored status value in several tables. The owner directed the repo-wide switch
-- to US spelling to include stored values, so this block renames every persisted occurrence. It is
-- idempotent and stays in the schema permanently: each deploy re-runs it, so any straggler row
-- written by not-yet-redeployed code is corrected on the next apply. The code, contracts, and docs
-- were renamed in the same PR, so reader and writer agree from the same deploy onward.
BEGIN;

-- Column rename: trust_transport_trips.cancelled_reason -> canceled_reason. Guarded so it runs
-- once on a legacy database and never on a fresh one (where CREATE TABLE already used the new name).
-- The guard must name the schema: the database also holds the demo schema, and an unfiltered
-- information_schema lookup matched the demo copy of the column after the public one was already
-- renamed, sending the ALTER at a column that no longer exists (issue #2030). The demo-schema
-- generator retargets the table_schema value, so the demo apply guards its own copy the same way.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'demo'
      AND table_name = 'trust_transport_trips' AND column_name = 'cancelled_reason'
  ) THEN
    ALTER TABLE trust_transport_trips RENAME COLUMN cancelled_reason TO canceled_reason;
  END IF;
END $$;

-- Status values. WHERE makes each UPDATE a no-op after the first run.
UPDATE trust_transport_requests SET status = 'canceled' WHERE status = 'cancelled';
UPDATE trust_transport_trips SET status = 'canceled' WHERE status = 'cancelled';
UPDATE trust_transport_status_events SET event_name = 'order_canceled' WHERE event_name = 'order_cancelled';
UPDATE trust_transport_status_events SET from_status = 'canceled' WHERE from_status = 'cancelled';
UPDATE trust_transport_status_events SET to_status = 'canceled' WHERE to_status = 'cancelled';
UPDATE lighthouse_matches SET status = 'canceled' WHERE status = 'cancelled';
UPDATE socket_relay_requests SET status = 'canceled' WHERE status = 'cancelled';
UPDATE socket_relay_fulfillments SET status = 'canceled' WHERE status = 'cancelled';
UPDATE skill_up_cohorts SET status = 'canceled' WHERE status = 'cancelled';
UPDATE service_credits_transfers SET status = 'canceled' WHERE status = 'cancelled';
UPDATE foundation_call_sessions SET status = 'canceled' WHERE status = 'cancelled';

-- lighthouse_matches carries the only CHECK constraint naming the old value. On a legacy database
-- the inline constraint still allows 'cancelled' and not 'canceled', so swap it: drop whichever
-- form exists, then re-add with the US value. Runs after the UPDATE above so validation passes.
ALTER TABLE IF EXISTS lighthouse_matches DROP CONSTRAINT IF EXISTS lighthouse_matches_status_check;
ALTER TABLE IF EXISTS lighthouse_matches
  ADD CONSTRAINT lighthouse_matches_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'canceled', 'completed'));
-- === SkillUp brand rename (2026-08-29): stored values that carry the old plugin name ===
--
-- Renaming the tables above moves the rows but not the strings written INSIDE other plugins' tables.
-- Each statement below is a plain value swap, safe to re-run, and scoped to the exact old value.
--
-- Deliberately NOT renamed (unchanged since 2026-06-26, and still correct): the ServiceCredits
-- ledger and governance values `levelup_trainer_split`, `levelup_completion_bonus`,
-- `levelup_milestone_validated`, `levelup_enrollment_setup_failed`, `levelup_transfer`, and the
-- `levelup:` governance ticket prefix. Those are matched against existing production rows and are
-- read by the GDP recognizer; renaming them would orphan that history and drop SkillUp trainer
-- payouts out of the Community Value Index.

-- Weekly Performance keeps one row per metric per week, keyed by metric_key, so a renamed key would
-- start a fresh series and leave last week's figure unreadable for the week-over-week comparison.
UPDATE weekly_performance_metrics SET metric_key = 'value.skill_up_completions' WHERE metric_key = 'value.level_up_completions';
UPDATE weekly_performance_metrics SET metric_key = 'value.skill_up_trainer_payouts' WHERE metric_key = 'value.level_up_trainer_payouts';
UPDATE weekly_performance_metrics SET source_plugin = 'skill-up' WHERE source_plugin = 'level-up';
UPDATE weekly_performance_goal_snapshots SET metric_key = REPLACE(metric_key, 'level_up_', 'skill_up_') WHERE metric_key LIKE '%level\_up\_%';

-- Notifications already delivered point at /apps/level-up, which stops resolving after this rename.
UPDATE notifications SET link_path = REPLACE(link_path, '/apps/level-up', '/apps/skill-up') WHERE link_path LIKE '/apps/level-up%';
UPDATE notifications SET source_plugin = 'skill-up' WHERE source_plugin = 'level-up';
UPDATE notifications SET notification_type = 'skill-up' || SUBSTRING(notification_type FROM 9) WHERE notification_type LIKE 'level-up.%';

-- ServiceCredits transfers record the plugin that started them; isRegisteredPluginSlug() rejects a
-- slug that is no longer in the registry, so a left-behind 'level-up' would read as an unknown origin.
UPDATE service_credits_transfers SET origin_plugin = 'skill-up' WHERE origin_plugin = 'level-up';
UPDATE recurring_activities SET origin_plugin = 'skill-up' WHERE origin_plugin = 'level-up';

-- The scheduled auto-cohort run writes itself as the actor. post/0008 treats this id as "not a
-- person", so both the audit rows and that exclusion list have to move together.
UPDATE skill_up_audit_events SET actor_id = 'skill-up-auto-cohort-scheduler' WHERE actor_id = 'level-up-auto-cohort-scheduler';

-- Command names are stored on every audit row, every idempotency record, and every rate-limit
-- window. The idempotency rows matter most: replay lookups match on command_name, so a row left at
-- the old name would let an already-applied command run a second time.
UPDATE skill_up_audit_events SET command = 'skill-up' || SUBSTRING(command FROM 9) WHERE command LIKE 'level-up.%';
UPDATE skill_up_command_idempotency SET command_name = 'skill-up' || SUBSTRING(command_name FROM 9) WHERE command_name LIKE 'level-up.%';
UPDATE skill_up_rate_limit_counters SET command_name = 'skill-up' || SUBSTRING(command_name FROM 9) WHERE command_name LIKE 'level-up.%';

-- spelling:enable
COMMIT;

-- ── post migration: 0001_directory_display_name_to_first_last.sql ──
-- Directory: move the single v2 `display_name` field to honest v3
-- `first_name` + `last_name` columns, then drop `display_name`.
--
-- Why this exists:
--   schema.sql now defines `directory_profiles` with `first_name` and
--   `last_name` and no `display_name`. On a fresh v3 database those columns
--   already exist and there is nothing to do. But a database cloned from v2
--   still carries the old `display_name` column (and may hold the only copy of
--   a person's name there). schema.sql is purely additive and cannot drop a
--   column, so the drop and the data carry-over live here, after the canonical
--   schema has run.
--
-- What it does, only when the old column is still present:
--   1. Carry any name that lives only in `display_name` into `first_name`
--      (where `first_name` is empty/NULL), as a best-effort single-name value.
--   2. Drop the `display_name` column.
--
-- Safe to re-run: the whole body is guarded on `display_name` still existing.
-- Once the column has been dropped, every later run is a no-op.

DO $directory_display_name_to_first_last$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'demo'
      AND table_name = 'directory_profiles'
      AND column_name = 'display_name'
  ) THEN
    UPDATE directory_profiles
    SET first_name = btrim(display_name),
        updated_at = NOW()
    WHERE (first_name IS NULL OR btrim(first_name) = '')
      AND display_name IS NOT NULL
      AND btrim(display_name) <> '';

    ALTER TABLE directory_profiles DROP COLUMN display_name;
  END IF;
END
$directory_display_name_to_first_last$;


-- ── post migration: 0002_chyme_drop_display_name.sql ──
-- Chyme: drop the redundant `display_name` column from `chyme_room_members`
-- and `chyme_messages`.
--
-- Why this exists:
--   Chyme already stores the raw `username` on both tables and the app now
--   renders the author handle as `@username` (falling back to `user-<id>` when
--   the username is null). The old `display_name` column only ever held that
--   same `@username` string, so it is redundant. schema.sql no longer defines
--   the column, but it is purely additive and cannot drop a column that a
--   database cloned from an earlier shape still carries. The drop lives here,
--   after the canonical schema has run.
--
-- What it does, only when the old column is still present:
--   Drop `display_name` from `chyme_room_members`, then from `chyme_messages`.
--
-- Safe to re-run: each drop is guarded on `display_name` still existing, so
-- once a column has been dropped every later run is a no-op.

DO $chyme_room_members_drop_display_name$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'demo'
      AND table_name = 'chyme_room_members'
      AND column_name = 'display_name'
  ) THEN
    ALTER TABLE chyme_room_members DROP COLUMN display_name;
  END IF;
END
$chyme_room_members_drop_display_name$;

DO $chyme_messages_drop_display_name$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'demo'
      AND table_name = 'chyme_messages'
      AND column_name = 'display_name'
  ) THEN
    ALTER TABLE chyme_messages DROP COLUMN display_name;
  END IF;
END
$chyme_messages_drop_display_name$;


-- ── post migration: 0003_socketrelay_drop_display_name.sql ──
-- SocketRelay: drop the unused `display_name` column from
-- `socket_relay_user_extension`.
--
-- Why this exists:
--   The column held an optional per-user profile name, but nothing in the v3
--   product ever rendered it — SocketRelay identifies people by their Clerk
--   `@username` (built in the chat/relay routes), not a stored display name.
--   schema.sql no longer defines the column, but it is purely additive and
--   cannot drop a column that a database cloned from an earlier shape still
--   carries, so the drop lives here, after the canonical schema has run.
--
-- What it does, only when the old column is still present:
--   Drop `display_name` from `socket_relay_user_extension`.
--
-- Safe to re-run: guarded on the column still existing, so once it has been
-- dropped every later run is a no-op. This post-migration runs after schema.sql,
-- which has already renamed the table to socket_relay_user_extension, so it
-- targets the new name; on a fresh DB the column is absent and this is a no-op.

DO $socket_relay_user_extension_drop_display_name$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'demo'
      AND table_name = 'socket_relay_user_extension'
      AND column_name = 'display_name'
  ) THEN
    ALTER TABLE socket_relay_user_extension DROP COLUMN display_name;
  END IF;
END
$socket_relay_user_extension_drop_display_name$;


-- ── post migration: 0004_skills_hunt_submissions_display_name_to_full_name.sql ──
-- SkillsHunt: rename `display_name` to `full_name` on `skills_hunt_submissions`.
--
-- Why this exists:
--   The owner relabeled the nominee's name field from "Display name" to
--   "Full name" (a design bypass was granted for the copy change). A Skills
--   Hunt nominee is a free-text full name, not a signed-up user, so the field
--   stays a single free-text value. schema.sql now defines the column as
--   `full_name`, but a database cloned from an earlier shape still carries the
--   old `display_name` column. A plain CREATE/ALTER cannot rename it, so the
--   rename lives here, after the canonical schema has run.
--
-- What it does, only when the old column is still present and the new one is
-- not: rename `display_name` to `full_name` on `skills_hunt_submissions`.
--
-- Safe to re-run: the rename is guarded on `display_name` still existing AND
-- `full_name` not yet existing, so once the column has been renamed every later
-- run is a no-op.

DO $skills_hunt_submissions_display_name_to_full_name$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'demo'
      AND table_name = 'skills_hunt_submissions'
      AND column_name = 'display_name'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'demo'
      AND table_name = 'skills_hunt_submissions'
      AND column_name = 'full_name'
  ) THEN
    ALTER TABLE skills_hunt_submissions RENAME COLUMN display_name TO full_name;
  END IF;
END
$skills_hunt_submissions_display_name_to_full_name$;


-- ── post migration: 0005_directory_backfill_skills_from_legacy_array.sql ──
-- post/0005: Backfill directory_profile_skills from the legacy directory_profiles.skills text[].
--
-- The original platform stored up to three skills as a free-text array column
-- (directory_profiles.skills TEXT[]). v3 normalized skills into the
-- directory_profile_skills junction (profile_id -> skill_id -> skills_taxonomy_skills)
-- and reads skills ONLY from that junction. The v2->v3 clone carried the profile rows
-- (and the legacy skills array column) forward but no migration ever populated the
-- junction, so every cloned profile showed zero skills.
--
-- This copies each legacy skill name into the junction by matching it
-- (case-insensitively) against skills_taxonomy_skills. It is:
--   * guarded   — no-ops on a fresh v3 DB that never had the legacy skills column.
--   * idempotent — ON CONFLICT (profile_id, skill_id) DO NOTHING; safe to re-run
--     and safe to run after the same backfill was applied by hand.
--   * deterministic — when a legacy name matches more than one taxonomy skill (the
--     same skill name under different job titles), DISTINCT ON picks exactly one
--     (active first, then lowest display_order, then lowest id), so a profile never
--     gets the same name twice.
-- Legacy names with no taxonomy match are skipped (no junction row); those are
-- reported separately so a name-mapping can be decided if needed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'demo'
      AND table_name = 'directory_profiles'
      AND column_name = 'skills'
  ) THEN
    INSERT INTO directory_profile_skills (profile_id, skill_id, display_order)
    SELECT picked.profile_id, picked.skill_id, picked.display_order
    FROM (
      SELECT DISTINCT ON (dp.id, lower(trim(s.skill_name)))
             dp.id::uuid AS profile_id,
             tax.id      AS skill_id,
             s.ord       AS display_order
      FROM directory_profiles dp
      CROSS JOIN LATERAL unnest(dp.skills) WITH ORDINALITY AS s(skill_name, ord)
      JOIN LATERAL (
        SELECT sts.id
        FROM skills_taxonomy_skills AS sts
        WHERE lower(sts.name) = lower(trim(s.skill_name))
        -- skills_taxonomy_skills is unique only per job_title_id, so the same name
        -- can exist under several job titles. Prefer the one under the profile's own
        -- job title when known. Legacy profiles usually have a NULL job_title_id, in
        -- which case this term is NULL for every candidate and the active/display_order/id
        -- tie-break below decides.
        ORDER BY (sts.job_title_id::text = dp.job_title_id::text) DESC NULLS LAST,
                 sts.is_active DESC, sts.display_order ASC, sts.id ASC
        LIMIT 1
      ) AS tax ON true
      WHERE dp.skills IS NOT NULL
        AND array_length(dp.skills, 1) > 0
        -- directory_profiles.id is varchar on cloned data; only cast values that are
        -- actually UUID-shaped so one malformed id can never abort the migration.
        AND dp.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        -- Only seed profiles that have NO normalized skills yet. Once a member or
        -- admin edits skills through the app (writing directory_profile_skills), that
        -- junction is authoritative; re-running this backfill must not re-add a skill
        -- they removed, by copying a stale value from the legacy array.
        AND NOT EXISTS (
          SELECT 1 FROM directory_profile_skills existing
          WHERE existing.profile_id::text = lower(dp.id::text)
        )
      ORDER BY dp.id, lower(trim(s.skill_name)), s.ord
    ) AS picked
    ON CONFLICT (profile_id, skill_id) DO NOTHING;
  END IF;
END $$;


-- ── post migration: 0006_directory_backfill_bio_from_legacy_description.sql ──
-- post/0006: Backfill directory_profiles.bio from the legacy free-text description.
--
-- The original platform stored the profile blurb in directory_profiles.description
-- (VARCHAR(140) NOT NULL). v3 renders the blurb from `bio`, which was never
-- populated for cloned profiles — so a carried-over profile showed only a name.
-- This copies description -> bio, but ONLY where bio is currently empty, so an
-- in-app edit is never overwritten. Guarded (no-ops on a fresh v3 DB that never
-- had the legacy column) and idempotent (re-running changes nothing once bio is set).
--
-- The legacy contact columns (directory_profiles.signal_url, directory_profiles.quora_url)
-- are intentionally NOT touched here: they stay on the profile row (tied to the
-- Clerk member via claimed_by_user_id once claimed) and will be surfaced by the
-- Foundation/SocketRelay contact flow when that is built. They are not copied into
-- the core `users` table, which is the cloned legacy table keyed by a legacy uuid
-- and is disconnected from v3's Clerk identity.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'demo'
      AND table_name = 'directory_profiles'
      AND column_name = 'description'
  ) THEN
    UPDATE directory_profiles
    SET bio = btrim(description)
    WHERE (bio IS NULL OR btrim(bio) = '')
      AND description IS NOT NULL
      AND btrim(description) <> '';
  END IF;
END $$;


-- ── post migration: 0007_directory_backfill_profile_url_from_legacy_quora_url.sql ──
-- post/0007: Backfill directory_profiles.profile_url from the legacy quora_url.
--
-- The original platform stored each profile's Quora link in directory_profiles.quora_url.
-- v3 renders the Quora link from profile_url — the directory profile detail shows
-- "View Quora profile" when it is set and "Quora profile not linked yet" when it is
-- empty. profile_url was never populated for cloned / manually-created profiles, so a
-- carried-over profile showed "not linked yet" even though it had a Quora link in the
-- legacy column. This copies quora_url -> profile_url, but ONLY where profile_url is
-- currently empty, so an in-app edit is never overwritten. Guarded (no-ops on a DB that
-- never had the legacy column) and idempotent (re-running changes nothing once
-- profile_url is set).
--
-- Companion to post/0006, which deliberately left the legacy contact columns alone.
-- The Quora link is now surfaced directly on the profile, so it is backfilled here;
-- signal_url is still left in place for the Foundation/SocketRelay contact flow.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'demo'
      AND table_name = 'directory_profiles'
      AND column_name = 'quora_url'
  ) THEN
    UPDATE directory_profiles
    SET profile_url = btrim(quora_url),
        updated_at = NOW()
    WHERE (profile_url IS NULL OR btrim(profile_url) = '')
      AND quora_url IS NOT NULL
      AND btrim(quora_url) <> '';
  END IF;
END $$;


-- ── post migration: 0007_drop_workforce_announcements.sql ──
-- post/0007: Drop the per-plugin workforce announcements table.
--
-- Announcements are now posted in one place — the Feed (feed-announcements
-- plugin), which can target any plugin. Workforce no longer keeps its own
-- announcements, so the dedicated table is removed. Guarded with IF EXISTS so
-- it no-ops on a fresh database that never had the table, and idempotent
-- (re-running changes nothing once the table is gone).
DROP TABLE IF EXISTS workforce_announcements;


-- ── post migration: 0008_login_events_backfill_launch_gap.sql ──
-- post/0008: Rebuild the sign-in days that nothing recorded between v2 stopping and v3 starting.
--
-- `login_events` is the whole definition of an active member (owner decision, 2026-08-27): a member
-- is active on a day the sign-in record holds a row for them, whatever they opened next. The record
-- carries real history from v2 — its first row is 2025-12-15 — but it has a hole. v2 wrote its last
-- row on 2026-05-26 and v3's writer did not exist until 2026-06-19, so for 23 days nothing wrote
-- anything down. The platform launched on 2026-06-12, inside that hole, which is why the oldest week
-- the Weekly Performance picker offers reported nobody at all while people were plainly using it.
--
-- This does not change what "active" means and does not widen it. It repairs the record for those
-- days only, from first-party evidence that an authenticated session existed: a row in a plugin's
-- command trail naming the member as the actor, or a row the member wrote themselves, is proof that
-- member was signed in on that day. Every source is member-attributed and dated by the member's own
-- action; rows whose timestamp belongs to a counterparty or an admin acting ON a member are not
-- evidence that the member turned up and are not used.
--
-- Properties:
--   * scoped     — only days in [2026-05-27, 2026-06-19). Outside the hole the record was being
--                  written, so an absent day there is a real absence and is left alone.
--   * guarded    — every source is checked for existence before it is read, so a database missing
--                  any of these tables simply contributes nothing instead of failing.
--   * idempotent — WHERE NOT EXISTS on the (member, UTC day) pair plus ON CONFLICT DO NOTHING. Safe
--                  to re-run, and safe to run after the same repair was applied by hand.
--   * honest     — where the table has v2's `source` column, backfilled rows are marked
--                  'backfill_launch_gap' so a reconstructed day is never mistaken for one that was
--                  recorded live. The timestamp is the member's earliest proven action that day.
--   * people only — actor ids the platform writes for itself (scheduled runs, the platform-authored
--                  Commons notice, the `anonymous`/`system` fallbacks) are excluded by name, and so
--                  is any member the `users` identity mirror no longer holds. Production's
--                  login_events has a v2 foreign key to users(id) (see
--                  ctf/schema-prod4.6.2026.sql), and the command trails outlive that mirror: a
--                  deleted account leaves audit rows behind. One such orphan is what made the first
--                  production run of this migration abort without writing anything.
--
-- Applied by the "Neon — Update DB" GitHub Action, which runs every post/ migration on a push to
-- main that touches this folder — so merging is what runs it, with no command to type. It reports as
-- it goes in the workflow log: the evidence it found, a line per day naming how many members that day
-- has evidence for, and how many rows it wrote. Being idempotent, it is re-applied on every later run
-- of that workflow and on every fresh database clone, writing nothing the second time.

DO $$
DECLARE
  gap_start CONSTANT timestamptz := TIMESTAMPTZ '2026-05-27 00:00:00+00';
  gap_end   CONSTANT timestamptz := TIMESTAMPTZ '2026-06-19 00:00:00+00';
  -- Actor ids the platform writes for itself. None of these is a person turning up.
  non_member_actors CONSTANT text[] := ARRAY[
    'anonymous',
    'system',
    'system:commons-guidance',
    'skills-hunt-auto-mission-scheduler',
    'skill-up-auto-cohort-scheduler',
    -- The value those rows carried before the 2026-08-29 SkillUp rename. Listed as well as the
    -- new one so this stays correct whichever order the rename and this backfill run in.
    'level-up-auto-cohort-scheduler',
    'unlock-incentive-system',
    'internal_service_credits_reclaimer'
  ];
  src record;
  has_source boolean;
  evidence_days bigint;
  evidence_members bigint;
  skipped bigint;
  written bigint;
BEGIN
  IF to_regclass('public.login_events') IS NULL THEN
    RAISE NOTICE 'login_events does not exist in this database; nothing to repair.';
    RETURN;
  END IF;

  CREATE TEMP TABLE _login_gap_evidence (
    user_id text NOT NULL,
    activity_day date NOT NULL,
    first_seen timestamptz NOT NULL
  );

  -- Every source is (table, member column). The date column is `created_at` throughout except where
  -- named otherwise below, and each is read only for the gap window.
  FOR src IN
    SELECT * FROM (VALUES
      -- Rows the member wrote themselves.
      ('click_log_incidents', 'user_id', 'created_at'),
      ('mood_submissions', 'user_id', 'submitted_at'),
      ('feed_community_posts', 'author_user_id', 'created_at'),
      ('feed_community_replies', 'author_user_id', 'created_at'),
      ('feed_community_post_reactions', 'user_id', 'created_at'),
      ('peer_programming_messages', 'author_user_id', 'created_at'),
      ('skill_up_dispute_comments', 'actor_user_id', 'created_at'),
      -- Command trails: one row per command the member ran, actor and time from their own request.
      ('account_restrictions_audit', 'actor_id', 'created_at'),
      ('announcement_membership_events', 'actor_id', 'created_at'),
      ('beacon_events_admin_audit_trail', 'actor_id', 'created_at'),
      ('contributions_audit_log', 'actor_user_id', 'created_at'),
      ('contributor_access_audit_trail', 'actor_id', 'created_at'),
      ('directory_profile_change_events', 'actor_id', 'created_at'),
      ('feed_membership_events', 'actor_id', 'created_at'),
      ('foundation_admin_audit_trail', 'actor_id', 'created_at'),
      ('foundation_quote_status_events', 'actor_user_id', 'created_at'),
      ('gdp_admin_audit_trail', 'actor_id', 'created_at'),
      ('skill_up_audit_events', 'actor_id', 'created_at'),
      ('lighthouse_admin_audit_trail', 'actor_id', 'created_at'),
      ('llm_inference_log', 'actor_user_id', 'created_at'),
      ('peer_programming_admin_audit_trail', 'actor_id', 'created_at'),
      ('quora_deletion_survey_audit_log', 'actor_user_id', 'created_at'),
      ('quora_live_census_audit_log', 'actor_user_id', 'created_at'),
      ('recurring_activity_audit_trail', 'actor_user_id', 'created_at'),
      ('safety_admin_audit_trail', 'actor_id', 'created_at'),
      ('service_credits_admin_audit_trail', 'actor_id', 'created_at'),
      ('skills_hunt_audit_log', 'actor_id', 'created_at'),
      ('skills_taxonomy_change_events', 'actor_id', 'created_at'),
      ('socket_relay_admin_audit_trail', 'actor_id', 'created_at'),
      ('socket_relay_request_events', 'actor_user_id', 'created_at'),
      ('trust_admin_audit_trail', 'actor_user_id', 'created_at'),
      ('trust_transport_admin_audit_trail', 'actor_id', 'created_at'),
      ('trust_transport_status_events', 'actor_user_id', 'created_at'),
      ('unlock_audit_log', 'actor_user_id', 'created_at'),
      ('weekly_performance_audit_trail', 'actor_id', 'created_at'),
      ('workforce_admin_audit_trail', 'actor_id', 'created_at')
    ) AS t(table_name, user_column, date_column)
  LOOP
    CONTINUE WHEN to_regclass('public.' || src.table_name) IS NULL;
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'demo' AND table_name = src.table_name AND column_name = src.user_column
    );
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'demo' AND table_name = src.table_name AND column_name = src.date_column
    );

    EXECUTE format(
      'INSERT INTO _login_gap_evidence (user_id, activity_day, first_seen)
       SELECT btrim(%1$I),
              (%2$I AT TIME ZONE ''UTC'')::date,
              MIN(%2$I)
       FROM public.%3$I
       WHERE %2$I >= $1 AND %2$I < $2
         AND %1$I IS NOT NULL
         AND btrim(%1$I) <> ''''
         AND btrim(%1$I) <> ALL ($3)
       GROUP BY 1, 2',
      src.user_column, src.date_column, src.table_name
    ) USING gap_start, gap_end, non_member_actors;
  END LOOP;

  -- Production's login_events carries a v2 foreign key to users(id), so a sign-in row can only exist
  -- for an account the identity mirror still holds. The command trails outlive that mirror: an
  -- account deleted since the gap leaves its audit rows behind, and those rows are evidence of a
  -- session that did happen but whose member is gone. Inserting for them is both impossible and
  -- wrong, so they are dropped here rather than at the insert — where one orphan aborted the whole
  -- statement and wrote nothing at all. Reported, not silent: a skipped day is a real day that
  -- cannot be recovered, and the operator should see the count.
  IF to_regclass('public.users') IS NOT NULL THEN
    DELETE FROM _login_gap_evidence e
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = e.user_id);
    GET DIAGNOSTICS skipped = ROW_COUNT;
    IF skipped > 0 THEN
      RAISE NOTICE
        'Skipped % row(s) of evidence whose member is no longer in the users table; their days cannot be rebuilt.',
        skipped;
    END IF;
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT user_id)
    INTO evidence_days, evidence_members
  FROM (SELECT DISTINCT user_id, activity_day FROM _login_gap_evidence) d;

  RAISE NOTICE 'Evidence in the gap: % member-day(s) across % member(s).', evidence_days, evidence_members;

  -- A line per day, so the repair is legible rather than a single number to take on trust. The gap
  -- is 23 days, so this is bounded and short.
  FOR src IN
    SELECT activity_day, COUNT(DISTINCT user_id) AS members
    FROM _login_gap_evidence
    GROUP BY activity_day
    ORDER BY activity_day
  LOOP
    RAISE NOTICE '  % — % member(s) with evidence', src.activity_day, src.members;
  END LOOP;

  has_source := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'demo' AND table_name = 'login_events' AND column_name = 'source'
  );

  -- The WHERE NOT EXISTS guard is the one that always applies; it holds even on a database where the
  -- (user_id, UTC-day) unique index was never built. The bare ON CONFLICT DO NOTHING closes the race
  -- wherever that index does exist.
  IF has_source THEN
    INSERT INTO login_events (user_id, created_at, source)
    SELECT e.user_id, MIN(e.first_seen), 'backfill_launch_gap'
    FROM _login_gap_evidence e
    WHERE NOT EXISTS (
      SELECT 1 FROM login_events le
      WHERE le.user_id = e.user_id
        AND (le.created_at AT TIME ZONE 'UTC')::date = e.activity_day
    )
    GROUP BY e.user_id, e.activity_day
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO login_events (user_id, created_at)
    SELECT e.user_id, MIN(e.first_seen)
    FROM _login_gap_evidence e
    WHERE NOT EXISTS (
      SELECT 1 FROM login_events le
      WHERE le.user_id = e.user_id
        AND (le.created_at AT TIME ZONE 'UTC')::date = e.activity_day
    )
    GROUP BY e.user_id, e.activity_day
    ON CONFLICT DO NOTHING;
  END IF;

  GET DIAGNOSTICS written = ROW_COUNT;
  RAISE NOTICE 'Sign-in days written: %. Re-running this migration writes 0.', written;

  DROP TABLE _login_gap_evidence;
END
$$;


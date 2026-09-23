-- Accounts an admin has banned outright, paired with a ban at the auth provider.
--
-- Before this, a blocking decision was a row in our own database and nothing else: review_status went
-- to spam, access_tier dropped, and the app stopped letting them in. That was the entire gate while
-- the app was the only thing the auth provider fronted. Anything else signing people in through the
-- same provider asks the provider, not us, and the provider was still answering yes.
--
-- schema.sql carries the same CREATE TABLE. An existing database is not re-seeded from it, so this
-- migration is what makes the table appear in production.
CREATE TABLE IF NOT EXISTS unlock_banned_accounts (
  user_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  note TEXT,
  banned_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS unlock_banned_accounts ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT 'perp';
ALTER TABLE IF EXISTS unlock_banned_accounts ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE IF EXISTS unlock_banned_accounts ADD COLUMN IF NOT EXISTS banned_by_user_id TEXT;
ALTER TABLE IF EXISTS unlock_banned_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE IF EXISTS unlock_banned_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

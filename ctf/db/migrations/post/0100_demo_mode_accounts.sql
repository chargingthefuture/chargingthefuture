-- Safe to re-run. Starts empty: an admin switches each demo account on from the Unlock admin.
-- Accounts that see demo data. An admin switches an account on from its card on the Unlock admin;
-- every request from that account then reads and writes the demo schema and uses the Stream and
-- Formance staging instances (lib/demo-mode/demo-accounts.ts). It replaced the flag service's
-- demo-mode targeting. Production schema only, always named with public. so the demo schema never
-- holds a copy: the app reads it from the public pool, before it knows which schema a request uses.
CREATE TABLE IF NOT EXISTS public.demo_mode_accounts (
  user_id TEXT PRIMARY KEY,
  added_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS public.demo_mode_accounts ADD COLUMN IF NOT EXISTS added_by_user_id TEXT;
ALTER TABLE IF EXISTS public.demo_mode_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

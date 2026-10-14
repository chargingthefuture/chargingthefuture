-- The starting list for /admin/expenses (added 2026-09-26).
--
-- Why: the owner pays the running costs of Skills Economy and needs one screen that lists every
-- service the app runs on, so each one can be priced and weighed. This fills the new admin_expenses
-- table with those services, so the screen opens with the full list rather than empty.
--
-- What it writes: one recurring line per service, with what it pays for and how the provider bills
-- (fixed or usage-based). No amounts and no check dates. What each one costs is the owner's own data
-- and is entered on the screen, never in this repository, which is public. Infisical, Unleash and
-- the Formance ledger get their own lines with a note that they run on Railway, so their cost is
-- found in the Railway line rather than on a separate bill.
--
-- Safe to re-run: it only writes while admin_expenses_audit_trail is empty, which is true until the
-- first add, edit or removal on the screen. After that the list belongs to the owner, and a re-run
-- (every qualifying push runs post/) must never bring back a line they removed. The fixed ids plus
-- ON CONFLICT DO NOTHING cover two runs landing before anybody has touched the screen.
INSERT INTO admin_expenses (id, provider, purpose, kind, billing, notes)
SELECT v.id::uuid, v.provider, v.purpose, 'recurring', v.billing, v.notes
FROM (VALUES
  ('5e0a1c00-0000-4000-8000-000000000001', 'Render', 'Hosting for the web app, the background worker and the route-weather service', 'fixed', ''),
  ('5e0a1c00-0000-4000-8000-000000000002', 'Railway', 'Hosting for Infisical, Unleash and the Formance ledger and its database', 'usage', ''),
  ('5e0a1c00-0000-4000-8000-000000000003', 'Claude Code', 'The coding agent that builds and maintains the app', 'fixed', ''),
  ('5e0a1c00-0000-4000-8000-000000000004', 'Phone', 'The owner''s only machine; every part of the work is done on it', 'fixed', ''),
  ('5e0a1c00-0000-4000-8000-000000000005', 'RunPod', 'GPU for the self-hosted AI model that drafts AI Assistant answers', 'usage', 'Pay as you go: billed for GPU time used.'),
  ('5e0a1c00-0000-4000-8000-000000000006', 'Infisical', 'Secrets store', 'fixed', 'Runs on Railway; its cost is in the Railway line.'),
  ('5e0a1c00-0000-4000-8000-000000000007', 'Unleash', 'Feature flags', 'fixed', 'Runs on Railway; its cost is in the Railway line.'),
  ('5e0a1c00-0000-4000-8000-000000000008', 'Formance', 'Ledger for ServiceCredits', 'fixed', 'Runs on Railway; its cost is in the Railway line.'),
  ('5e0a1c00-0000-4000-8000-000000000009', 'Neon', 'The main database', 'usage', ''),
  ('5e0a1c00-0000-4000-8000-00000000000a', 'GetStream', 'Chat and Chyme live audio', 'usage', ''),
  ('5e0a1c00-0000-4000-8000-00000000000b', 'Sentry', 'Error reports', 'usage', ''),
  ('5e0a1c00-0000-4000-8000-00000000000c', 'Clerk', 'Sign-in and accounts', 'usage', ''),
  ('5e0a1c00-0000-4000-8000-00000000000d', 'Supabase', 'Document storage', 'usage', ''),
  ('5e0a1c00-0000-4000-8000-00000000000e', 'Expo', 'Android app builds', 'usage', ''),
  ('5e0a1c00-0000-4000-8000-00000000000f', 'GitHub', 'Code hosting and the Actions that test and deploy it', 'usage', ''),
  ('5e0a1c00-0000-4000-8000-000000000010', 'ntfy', 'Alert messages from scheduled jobs', 'fixed', ''),
  ('5e0a1c00-0000-4000-8000-000000000011', 'Domain name', 'chargingthefuture.com registration', 'fixed', 'Usually billed once a year; enter it as the monthly share.')
) AS v(id, provider, purpose, billing, notes)
WHERE NOT EXISTS (SELECT 1 FROM admin_expenses_audit_trail)
ON CONFLICT (id) DO NOTHING;

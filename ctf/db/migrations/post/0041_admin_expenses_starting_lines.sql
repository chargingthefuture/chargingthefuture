-- The starting list for /admin/expenses (added 2026-09-26).
--
-- Why: the owner pays every running cost of Skills Economy personally and is deciding what to cut,
-- with no screen that says what anything costs. This fills the new admin_expenses table with every
-- provider in the stack, so the screen opens with the full list rather than empty.
--
-- What it writes:
--   * The five amounts the owner gave on 2026-09-26 (Render, Railway, Claude Code, the phone, RunPod),
--     marked checked that day. RunPod's amount was not stated, so it is left blank rather than guessed.
--   * Infisical, Unleash and the Formance ledger at $0 on their own lines: they are self-hosted on
--     Railway (docs/spec.md, docs/developer/FORMANCE.md), so what they cost is already inside the
--     Railway line. Listed so nobody goes looking for a separate bill.
--   * Every other provider the app uses (Neon, GetStream, Sentry, Clerk, Supabase, Expo, GitHub, ntfy,
--     the domain) with no amount and no check date. Nobody has read those bills into this list yet;
--     the screen shows them as "not priced yet" and keeps them out of the total until somebody does.
--
-- Safe to re-run: it only writes while admin_expenses_audit_trail is empty, which is true until the
-- first add, edit or removal on the screen. After that the list belongs to the owner, and a re-run
-- (every qualifying push runs post/) must never bring back a line they removed. The fixed ids plus
-- ON CONFLICT DO NOTHING cover two runs landing before anybody has touched the screen.
INSERT INTO admin_expenses
  (id, provider, purpose, kind, billing, amount_cents, amount_max_cents, last_checked_on, notes)
SELECT v.id::uuid, v.provider, v.purpose, 'recurring', v.billing, v.amount_cents, v.amount_max_cents,
       v.last_checked_on::date, v.notes
FROM (VALUES
  ('5e0a1c00-0000-4000-8000-000000000001', 'Render', 'Hosting for the web app, the background worker and the route-weather service', 'fixed', 2500, NULL, '2026-09-26', ''),
  ('5e0a1c00-0000-4000-8000-000000000002', 'Railway', 'Hosting for Infisical, Unleash and the Formance ledger and its database', 'usage', 1800, 2500, '2026-09-26', 'Moves between $18 and $25 a month.'),
  ('5e0a1c00-0000-4000-8000-000000000003', 'Claude Code', 'The coding agent that builds and maintains the app', 'fixed', 10000, NULL, '2026-09-26', ''),
  ('5e0a1c00-0000-4000-8000-000000000004', 'Phone', 'The owner''s only machine; every part of the work is done on it', 'fixed', 6000, NULL, '2026-09-26', ''),
  ('5e0a1c00-0000-4000-8000-000000000005', 'RunPod', 'GPU for the self-hosted AI model that drafts AI Assistant answers', 'usage', NULL, NULL, '2026-09-26', 'Going up and expected to keep rising. Amount not stated yet.'),
  ('5e0a1c00-0000-4000-8000-000000000006', 'Infisical', 'Secrets store', 'fixed', 0, NULL, '2026-09-26', 'Self-hosted on Railway; its cost is inside the Railway line.'),
  ('5e0a1c00-0000-4000-8000-000000000007', 'Unleash', 'Feature flags', 'fixed', 0, NULL, '2026-09-26', 'Self-hosted on Railway; its cost is inside the Railway line.'),
  ('5e0a1c00-0000-4000-8000-000000000008', 'Formance', 'Ledger for ServiceCredits', 'fixed', 0, NULL, '2026-09-26', 'Self-hosted on Railway; its cost is inside the Railway line.'),
  ('5e0a1c00-0000-4000-8000-000000000009', 'Neon', 'The main database', 'usage', NULL, NULL, NULL, ''),
  ('5e0a1c00-0000-4000-8000-00000000000a', 'GetStream', 'Chat and Chyme live audio', 'usage', NULL, NULL, NULL, ''),
  ('5e0a1c00-0000-4000-8000-00000000000b', 'Sentry', 'Error reports', 'usage', NULL, NULL, NULL, ''),
  ('5e0a1c00-0000-4000-8000-00000000000c', 'Clerk', 'Sign-in and accounts', 'usage', NULL, NULL, NULL, ''),
  ('5e0a1c00-0000-4000-8000-00000000000d', 'Supabase', 'Document storage', 'usage', NULL, NULL, NULL, ''),
  ('5e0a1c00-0000-4000-8000-00000000000e', 'Expo', 'Android app builds', 'usage', NULL, NULL, NULL, ''),
  ('5e0a1c00-0000-4000-8000-00000000000f', 'GitHub', 'Code hosting and the Actions that test and deploy it', 'usage', NULL, NULL, NULL, ''),
  ('5e0a1c00-0000-4000-8000-000000000010', 'ntfy', 'Alert messages from scheduled jobs', 'fixed', NULL, NULL, NULL, ''),
  ('5e0a1c00-0000-4000-8000-000000000011', 'Domain name', 'chargingthefuture.com registration', 'fixed', NULL, NULL, NULL, 'Usually billed once a year; enter it as the monthly share.')
) AS v(id, provider, purpose, billing, amount_cents, amount_max_cents, last_checked_on, notes)
WHERE NOT EXISTS (SELECT 1 FROM admin_expenses_audit_trail)
ON CONFLICT (id) DO NOTHING;

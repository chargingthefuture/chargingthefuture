# v2 → v3 Production Migration Guide

> Authoritative record of all schema hazards discovered while validating `schema.sql` against a
> 62-user v2 Neon clone (branch `ep-royal-tooth-ad6i85or`, 2026-05-27). Validated on Neon PG 17.
> Keep this doc updated as new hazards are discovered.

## Overview

Migration sequence on the target v2 Neon clone:

1. **Pre-migration** — drop v2 objects that conflict with v3 DDL (see below).
2. **`migrate:schema`** — run `pnpm migrate:schema` (`schema.sql` via `runMigrationFile.mjs`).
3. **`migrate:demo-schema`** — run `pnpm migrate:demo-schema` after step 2 succeeds.
4. **Seed** — run per-plugin seed scripts targeting the `demo` schema.

Do NOT run `migrate:schema` before the pre-migration steps — it will fail.

## Pre-migration steps (run before schema.sql)

These must be executed once against the target DB before applying `schema.sql`. They are
**destructive** (DROPs). v2 data in these objects is confirmed to not carry over to v3.

### 1. Drop v2 Chyme tables

Chyme v2 is fully deprecated — nothing carries over to v3. The v2 `chyme_rooms` table exists
without `room_key` and `chyme_messages` without `sent_at`; the v3 `schema.sql` tries to create a
UNIQUE INDEX on `room_key` (line 52) inside a transaction BEFORE the `ALTER TABLE ADD COLUMN` that
adds it (line 1403), causing the entire first `BEGIN/COMMIT` block to abort.

```sql
DROP TABLE IF EXISTS chyme_survey_responses CASCADE;
DROP TABLE IF EXISTS chyme_user_blocks CASCADE;
DROP TABLE IF EXISTS chyme_user_follows CASCADE;
DROP TABLE IF EXISTS chyme_announcements CASCADE;
DROP TABLE IF EXISTS chyme_room_participants CASCADE;
DROP TABLE IF EXISTS chyme_messages CASCADE;
DROP TABLE IF EXISTS chyme_profiles CASCADE;
DROP TABLE IF EXISTS chyme_rooms CASCADE;
```

### 2. Drop `skills_taxonomy_flattened_projection` view

In v2 this was a SQL VIEW. v3 promotes it to a BASE TABLE. `CREATE TABLE IF NOT EXISTS` is skipped
when the relation exists (even as a VIEW), and then `ALTER TABLE IF EXISTS ... ADD COLUMN` fails
with "ADD COLUMN cannot be performed on relation" because views don't support ALTER TABLE.

```sql
DROP VIEW IF EXISTS skills_taxonomy_flattened_projection CASCADE;
```

### 3. Optional: other v2-only tables to consider

The v2 DB had these tables not present in v3 schema and not referenced by v3 code. They are
harmless to leave (schema.sql ignores them) but they represent dead data. Owner decision required
before dropping in production:

| Table | v2 purpose | v3 status |
|---|---|---|
| `chat_groups`, `chat_messages`, `chatgroups_announcements` | v2 chat (predates Chyme) | Dead — Chyme replaced it |
| `admin_action_logs` | v2 admin audit | Not in v3 schema; may still be queried |
| `auth_tokens`, `login_events`, `otp_codes`, `sessions` | v2 session/OTP auth | Dead — Clerk handles auth |
| `messages` | v2 direct messages | Dead — Chyme/feed replaced |
| `default_alive_or_dead_ebitda_snapshots`, `default_alive_or_dead_financial_entries` | v2 financial | Dead |
| `exclusions`, `partnerships` | v2 matching | Dead |
| `support_match_profiles`, `supportmatch_announcements` | v2 support match | Dead |
| `skills_job_titles`, `skills_sectors`, `skills_skills` | v2 skills (pre-taxonomy) | Dead — `skills_taxonomy_*` replaced |
| `invite_codes`, `waitlist_signups` | v2 onboarding | Owner decision |
| `nps_responses` | feedback | Owner decision |
| `pricing_tiers`, `payments` | v2 payments | Owner decision |
| `moderation_reports`, `reports` | v2 moderation | Owner decision |

## Known schema.sql hazards (internal — for maintainers)

These describe structural issues in `schema.sql` itself that are safe for fresh-DB provisioning but
fail when the target DB already has v2 table structures.

### H1: Index before column — `chyme_rooms.room_key`

- **Location:** Line 52 (inside the first `BEGIN/COMMIT` block, lines 3–97).
- **Symptom on v2 clone:** `column "room_key" does not exist` → entire first transaction aborts.
- **Root cause:** `CREATE UNIQUE INDEX uq_chyme_rooms_room_key ON chyme_rooms(room_key)` runs when
  the table already exists (from v2) without `room_key`; the `ALTER TABLE ADD COLUMN room_key` is
  at line 1403 (too late).
- **Fix applied for migration:** Drop v2 `chyme_rooms` first (step 1 above).
- **Long-term schema fix:** Move line 52 to after line 1403. (Low priority — fresh DBs are fine.)

### H2: Index before column — `chyme_messages.sent_at`

- **Location:** Line 83 (inside same first `BEGIN/COMMIT`).
- **Symptom:** Would fail with "column sent_at does not exist" on v2's `chyme_messages` (which has
  `created_at` instead). Masked in practice by H1 aborting the transaction first.
- **Root cause:** Same as H1 — v2 `chyme_messages` lacks `sent_at`.
- **Fix applied for migration:** Drop v2 `chyme_messages` (step 1 above).

### H3: VIEW promoted to TABLE — `skills_taxonomy_flattened_projection`

- **Location:** Lines 1537–1560.
- **Symptom:** `ALTER action ADD COLUMN cannot be performed on relation "skills_taxonomy_flattened_projection"`.
- **Root cause:** v2 defined this as a VIEW; `CREATE TABLE IF NOT EXISTS` is skipped; `ALTER TABLE`
  then fails because VIEWs don't accept `ADD COLUMN`.
- **Fix applied for migration:** Drop the v2 VIEW first (step 2 above).

### H4: `public.`-qualified statements — for demo schema provisioner only

Not a migration hazard (they run fine on `public`), but the demo schema provisioner must handle:
- `ALTER TABLE IF EXISTS public.chyme_room_members ADD COLUMN` (line 148) → retargeted to
  `chyme_room_members` (unqualified, resolves to `demo` via search_path).
- `ALTER TABLE IF EXISTS public.chyme_messages ADD COLUMN` (line 149) → same retarget.
- `ALTER TABLE IF EXISTS public.users ADD COLUMN` (lines 145–147) + the DO block for the unique
  index (lines 155–172) → suppressed in demo (no `users` table in the demo schema).
- `migrateToDemo.mjs` applies these transforms automatically.

### H5: `users` table not CREATEd in schema.sql

The `users` table is Clerk-managed (external); `schema.sql` only ALTERs it (lines 145–147, all
`IF EXISTS`). This is intentional for `public`. For the `demo` schema, the demo provisioner skips
the `public.users` block — the pool routing is identity-based (request headers/cookies), so a
`demo.users` table is not needed.

## Migration validation checklist

After running pre-migration + `migrate:schema`:

- [ ] `SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'` — should be ≥ 200 tables.
- [ ] `\d chyme_rooms` — must include `room_key`, `room_name`, `call_active` columns.
- [ ] `SELECT table_type FROM information_schema.tables WHERE table_name='skills_taxonomy_flattened_projection'`
      — must be `BASE TABLE`, not `VIEW`.
- [ ] `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'chyme_%' AND table_schema='public'`
      — must return v3 tables only (`chyme_rooms`, `chyme_room_members`, `chyme_messages`,
      `chyme_service_profiles`, `chyme_deletion_events`).

After running `migrate:demo-schema`:

- [ ] `SELECT schema_name FROM information_schema.schemata WHERE schema_name='demo'` — exists.
- [ ] `SELECT COUNT(*) FROM pg_tables WHERE schemaname='demo'` — must match `public` table count.
- [ ] Spot-check: `demo.chyme_rooms` has `room_key`, `demo.ctf_plugin_registry` exists.
- [ ] `SELECT table_name FROM information_schema.tables WHERE table_name='users' AND table_schema='demo'`
      — must return 0 rows (no `demo.users` table).

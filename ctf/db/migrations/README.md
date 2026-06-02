# Database migrations

These are one-off SQL steps that the canonical schema file (`ctf/schema.sql`) **cannot** express on
its own. `schema.sql` is purely additive — it uses `CREATE TABLE IF NOT EXISTS` and
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so it can create new tables and add new columns, but it
**cannot** fix a table that already exists with the wrong shape (a column whose type drifted, a table
that needs to be dropped and rebuilt, a rename, or a data backfill). Those go here.

## How it runs

The "Update Neon DB" GitHub Action (`.github/workflows/update-neon-db.yml`) applies the database in
this exact order against the `DATABASE_URL` it is given:

1. every file in `pre/` (sorted by name) — structural fixes that must happen **before** the canonical
   schema (e.g. drop a drifted table so `schema.sql` can recreate it correctly);
2. `ctf/schema.sql` — the canonical v3 desired state;
3. every file in `post/` (sorted by name) — anything that must happen **after** the tables exist
   (data backfills, cleanups).

That workflow runs automatically on a push to `main` that changes `schema.sql` or this folder, and it
can also be run manually (its "Run workflow" button). To bring a fresh clone of the live v2 database
up to the v3 spec: point the `DATABASE_URL` secret at the clone and run the workflow once.

## Writing a migration

- **Name files `NNNN_short_description.sql`** with a zero-padded number so they sort in run order
  (`0001_…`, `0002_…`). Put it in `pre/` or `post/` depending on whether it must run before or after
  `schema.sql`.
- **Make it idempotent and guarded.** It will be run more than once (every qualifying push, and again
  on each fresh clone). Detect the condition you are fixing and only act when it is present, so a
  second run is a no-op. Prefer `IF EXISTS` / `IF NOT EXISTS` and `DO $$ … $$` guards.
- **Never edit a migration once it has been run against a database you care about.** Add a new
  numbered file instead.
- **One edge case per file**, with a comment block at the top explaining why it exists, what it does,
  and why it is safe to re-run.

## Current migrations

| File | When | Purpose |
| --- | --- | --- |
| `pre/0001_lighthouse_v2_to_v3_rebuild.sql` | pre | Drop the drifted v2 LightHouse tables (varchar ids) so `schema.sql` recreates them with uuid ids; drop the v2-only `lighthouse_announcements`. Guarded on the drift being present. |
| `pre/0002_socketrelay_v2_to_v3_rebuild.sql` | pre | Drop the drifted v2 SocketRelay tables that `schema.sql` rebuilds (`socketrelay_requests`/`fulfillments`/`messages`, varchar ids) so they are recreated with uuid ids; the v2-only `socketrelay_profiles`/`socketrelay_announcements` are left untouched. Guarded on the drift being present. |

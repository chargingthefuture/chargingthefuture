# Formance Ledger — Backup & Disaster Recovery

The Formance ledger holds **real production financial data** (the Service Credits
economy). This is the runbook for backing it up and for spinning up a new ledger
environment from scratch or from a backup. Goal: never lose financial data, and be
able to recover or clone the ledger in an automated, repeatable way.

## What the ledger is made of

- **Service**: a stateless container — `ops/formance/Dockerfile.ledger` on Render
  (`ctf-formance-ledger`). It runs `ledger serve`; `AUTO_UPGRADE=true` brings the
  Formance **system schema** up to date in Postgres on start.
- **State**: an external **Neon Postgres** database (`FORMANCE_POSTGRES_URI` /
  `FORMANCE_DATABASE_URL`). All balances and transactions live here.
- **Named ledger books**: `ctf-main` (production, `FORMANCE_LEDGER`) and `ctf-demo`
  (demo mode, `FORMANCE_LEDGER_STAGING`). These are created **via the API**, not by
  the container — see "Spin up a new environment" below. In Postgres each ledger is
  its own schema.

> The container starting ≠ the ledger existing. `AUTO_UPGRADE` creates the system
> schema; the named books must be created with `formanceBootstrap.sh` (or they arrive
> with a restored/branched copy of the database).

## Backups (in place)

- **Nightly `pg_dump`** → Supabase Storage: `.github/workflows/backup-formance-supabase.yml`
  runs `scripts/backupFormanceToSupabase.mjs` daily at 03:00 UTC (and on manual
  dispatch). It does `pg_dump --format=custom` of `FORMANCE_DATABASE_URL`, uploads to
  the Supabase `backups/formance/` bucket, and verifies the object exists.
  Run manually: `pnpm --filter <root> formance:backup` (needs `FORMANCE_DATABASE_URL`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- The custom-format dump is a complete, restorable snapshot (schema + every ledger
  book + all transactions).

## Recommended: also enable Neon's native backups (primary safety net)

For production financial data, use **defense in depth**:

1. **Neon Point-in-Time Restore (PITR) — primary.** Neon continuously retains WAL, so
   you can restore the Formance project to *any* instant within the retention window
   (not just last night's 03:00 dump). Enable the longest retention your Neon plan
   allows on the Formance project. This is the strongest protection against
   "we corrupted/dropped data at 14:32 today."
2. **Neon branching — fastest clone.** `neonctl branches create` (or the console)
   makes an instant copy-on-write branch of the prod Formance DB with all ledger data.
   Point a new `ctf-formance-ledger` service at the branch's connection string and you
   have a full environment in seconds — no dump/restore needed, ledgers already exist.
3. **`pg_dump` → Supabase — portable offsite secondary (already in place).** Keep it:
   it is provider-independent (restore to *any* Postgres, not just Neon) and survives a
   Neon-account-level incident.

Keep both 1–2 (Neon) and 3 (pg_dump). Neon PITR/branching is the day-to-day recovery
and cloning tool; the Supabase dump is the offsite escape hatch.

## Spin up a new environment (automated, pick one path)

### Path A — Clone prod via Neon branch (fastest; ledgers + data included)
1. `neonctl branches create --project-id <formance-project> --name <env>` (or console).
2. Set the new `ctf-formance-ledger` service's `FORMANCE_POSTGRES_URI` to the branch URL.
3. Deploy the ledger image. `AUTO_UPGRADE` reconciles the schema; the named ledgers and
   data are already present from the branch. Done.

### Path B — Restore from the Supabase dump (cross-provider DR)
1. Provision a fresh Postgres (new Neon project/branch) and set `FORMANCE_DATABASE_URL`
   to it.
2. `FORMANCE_RESTORE_CONFIRM=1 pnpm --filter <root> formance:restore`
   (`scripts/restoreFormanceFromSupabase.mjs` — downloads the latest dump, or a specific
   one via `FORMANCE_BACKUP_FILE`, and `pg_restore`s it). Needs `SUPABASE_URL` +
   `SUPABASE_SERVICE_ROLE_KEY`. The dump includes the system schema + ledger books +
   data, so no separate bootstrap is needed.
3. Deploy the ledger image pointed at that DB.

### Path C — Net-new empty environment (no data to restore)
1. Provision a fresh Postgres; set `FORMANCE_POSTGRES_URI` on a new ledger service.
2. Set `FORMANCE_API_TOKEN`, `FORMANCE_LEDGER` (e.g. `ctf-main`), and
   `FORMANCE_LEDGER_STAGING` (e.g. `ctf-demo`) on the **ledger service** (Infisical → Render Sync).
3. Deploy the ledger image. `AUTO_UPGRADE` creates the system schema, and the image's
   **entrypoint (`formance-entrypoint.sh`) auto-creates the named ledger books idempotently** once
   the API is healthy — no manual SSH/bootstrap step (issue #106). If the env vars above are missing
   or `curl` is unavailable, the ledger still serves; create the books once with
   `pnpm --filter <root> formance:bootstrap`. (Optional `FORMANCE_BOOTSTRAP_SMOKE=1` on the manual
   script posts one test transaction — to the **demo** ledger only; it never touches the production book.)

## Safety rails

- **Restore is confirm-gated**: `restoreFormanceFromSupabase.mjs` refuses to run without
  `FORMANCE_RESTORE_CONFIRM=1`, and `pg_restore --clean` overwrites the target — only
  point it at a NEW/recovery database, never production unless you are intentionally
  rolling production back.
- **Bootstrap never writes to the production ledger**: ledger creation is a no-op write;
  the optional smoke transaction targets `ctf-demo` only, so `ctf-main` stays clean.
- **Ledger creation is automatic and idempotent**: the image entrypoint
  (`formance-entrypoint.sh`) starts the server, waits for the API, then creates the named ledger
  books — safe to re-run on every restart (existing books return 400/409 and are treated as present).
  It runs the bootstrap in the background and never blocks `ledger serve`, so a bootstrap hiccup can
  never take the ledger offline. The standalone `pnpm formance:bootstrap` remains as a manual fallback.

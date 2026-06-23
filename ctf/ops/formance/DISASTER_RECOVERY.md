# Formance Ledger — Backup & Disaster Recovery

The Formance ledger holds **real production financial data** (the ServiceCredits
economy). This is the runbook for backing it up and for spinning up a new ledger
environment from scratch or from a backup. Goal: never lose financial data, and be
able to recover or clone the ledger in an automated, repeatable way.

## What the ledger is made of

- **Service**: a stateless container — `ops/formance/Dockerfile.ledger` on **Railway**
  (`ctf-formance-ledger`, deployed from the GHCR image). It runs `ledger serve`;
  `AUTO_UPGRADE=true` brings the Formance **system schema** up to date in Postgres on
  start. (See `ctf/docs/developer/FORMANCE.md` → "Where it runs" for why Railway, not
  Render.)
- **State**: a **Railway-managed Postgres** database (`FORMANCE_POSTGRES_URI` /
  `FORMANCE_DATABASE_URL`). All balances and transactions live here.
- **Named ledger books**: `ctf-main` (production, `FORMANCE_LEDGER`) and `ctf-demo`
  (demo mode, `FORMANCE_LEDGER_STAGING`). These are created **via the API**, not by
  the container — see "Spin up a new environment" below. In Postgres each ledger is
  its own schema.

> The container starting ≠ the ledger existing. `AUTO_UPGRADE` creates the system
> schema; the named books must be created with `formanceBootstrap.sh` (or they arrive
> with a restored/branched copy of the database).

## Backups (in place)

- **Nightly `pg_dump`** → GitHub Release asset on a **private backup repo**:
  `.github/workflows/backup-formance.yml` runs `scripts/backupFormanceToPrivateRepo.mjs`
  daily at 03:00 UTC (and on manual dispatch). It does `pg_dump --format=custom` of
  `FORMANCE_DATABASE_URL`, creates a release tagged `formance-backup-<iso>` on the
  backup repo, uploads the dump as that release's asset, and verifies the asset exists.
  Run manually: `pnpm --filter <root> formance:backup` (needs `FORMANCE_DATABASE_URL`,
  `GH_PAT` with `contents: write` on the backup repo, `BACKUP_REPO` = `owner/name`).
- **Owner setup (one-time):** create a **PRIVATE** GitHub repo, set `BACKUP_REPO`
  (= `owner/name`) as a GitHub Actions secret, and ensure `GH_PAT` has
  `contents: write` on that repo. If any required secret is missing the backup job
  fails red — backups must fail loudly.
- The custom-format dump is a complete, restorable snapshot (schema + every ledger
  book + all transactions).

## Recommended: also enable Railway Postgres backups (primary safety net)

For production financial data, use **defense in depth**:

1. **Railway Postgres backups/snapshots — primary.** Enable Railway's managed Postgres
   backups on the Formance database and keep the longest retention the plan allows.
   Restoring a snapshot is the fastest way back from "we corrupted/dropped data at
   14:32 today." (Railway's point-in-time/snapshot capabilities depend on the plan —
   confirm what's available and set retention accordingly.)
2. **`pg_dump` → private GitHub repo Release — portable offsite secondary (already in place).** Keep it:
   it is provider-independent (restore to *any* Postgres, not just Railway) and
   survives a Railway-account-level incident. This is the cross-provider escape hatch.

Keep both 1 (Railway snapshots) and 2 (pg_dump). Railway snapshots are the day-to-day
recovery tool; the private-repo dump is the offsite escape hatch.

## Spin up a new environment (automated, pick one path)

### Path A — Clone prod via a Railway Postgres snapshot (fastest; ledgers + data included)

1. Restore/branch the Formance Postgres from a Railway snapshot into a new database.
2. Set the new `ctf-formance-ledger` service's `FORMANCE_POSTGRES_URI` to the new DB URL.
3. Deploy the ledger image. `AUTO_UPGRADE` reconciles the schema; the named ledgers and
   data are already present from the snapshot. Done.

### Path B — Restore from the private-repo dump (cross-provider DR)

1. Provision a fresh Postgres (new Railway Postgres) and set `FORMANCE_DATABASE_URL`
   to it.
2. `FORMANCE_RESTORE_CONFIRM=1 pnpm --filter <root> formance:restore`
   (`scripts/restoreFormanceFromPrivateRepo.mjs` — downloads the latest release's dump,
   or a specific one via `FORMANCE_BACKUP_TAG` / `FORMANCE_BACKUP_FILE`, and `pg_restore`s
   it). Needs `GH_PAT` (read access to the backup repo) + `BACKUP_REPO` (`owner/name`).
   The dump includes the system schema + ledger books + data, so no separate bootstrap
   is needed.

   **Easiest trigger:** the manual GitHub Actions workflow `restore-formance.yml`
   (Actions → "Formance — Restore from Private Repo" → Run workflow). It restores into the
   `FORMANCE_RESTORE_TARGET_DATABASE_URL` **secret** — distinct from the prod
   `FORMANCE_DATABASE_URL`, so it can never overwrite production — and sets the confirm flag
   for you. Set that secret to the new environment's Railway Postgres URL before running; the optional
   `backup_tag` input pins a release (blank = latest) and `backup_file` pins a specific asset.
3. Deploy the ledger image pointed at that DB.

### Path C — Net-new empty environment (no data to restore)

1. Provision a fresh Postgres; set `FORMANCE_POSTGRES_URI` on a new ledger service.
2. Set `FORMANCE_API_TOKEN`, `FORMANCE_LEDGER` (e.g. `ctf-main`), and
   `FORMANCE_LEDGER_STAGING` (e.g. `ctf-demo`) on the **Railway ledger service** (set directly in Railway, or via Infisical → Railway sync).
3. Deploy the ledger image. `AUTO_UPGRADE` creates the system schema, and the image's
   **entrypoint (`formance-entrypoint.sh`) auto-creates the named ledger books idempotently** once
   the API is healthy — no manual SSH/bootstrap step (issue #106). If the env vars above are missing
   or `curl` is unavailable, the ledger still serves; create the books once with
   `pnpm --filter <root> formance:bootstrap`. (Optional `FORMANCE_BOOTSTRAP_SMOKE=1` on the manual
   script posts one test transaction — to the **demo** ledger only; it never touches the production book.)

## Safety rails

- **Restore is confirm-gated**: `restoreFormanceFromPrivateRepo.mjs` refuses to run without
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

# Formance Ledger

Single reference for the Formance ledger that backs Service Credits. Deployment
mechanics live in code — this doc covers only what code does not: the runtime
contract, one-time ledger bootstrap, and backup/restore.

## Where it runs

The ledger and its Postgres run on **Railway**, not Render. A ledger is a
mostly-idle stateful service whose database must stay awake 24/7 (the ledger runs a
background worker that polls Postgres), so a flat per-instance Render tier plus a
managed DB on a sleep-assumed free tier (Neon free = 100 compute-hours/month, which
an always-awake DB exhausts before month-end) is the wrong fit. Railway meters
actual RAM/CPU and never caps with suspension, so a quiet ledger + its Postgres are
cheaper there (~$7–12/mo metered vs ~$26/mo for a Render private service + Neon
Launch). This is the same reasoning that keeps Infisical and Unleash on Railway —
see the note in `render.yaml`.

## Source of Truth (code, not prose)

| Concern | File |
|---|---|
| Container image, pinned digest, runtime flags, start command | `ctf/ops/formance/Dockerfile.ledger` |
| Image build → GHCR | `.github/workflows/build-images.yml` (`build-formance-ledger`) → `ghcr.io/chargingthefuture/ctf-formance-ledger:latest` |
| Service definition (image, env) | **Railway** service `ctf-formance-ledger` (deployed from the GHCR image; see "Deploy on Railway" below) |
| Nightly backup automation | `ctf/scripts/backupFormanceToPrivateRepo.mjs` + `.github/workflows/backup-formance.yml` |

State lives entirely in a Railway-managed Postgres. `AUTO_UPGRADE=true` runs schema
migrations on container start. `FORMANCE_POSTGRES_URI` is set on the Railway ledger
service (the `Dockerfile.ledger` entrypoint maps it to the `POSTGRES_URI` the binary
expects); the simplest wiring is Railway's own Postgres reference variable.

To update the pinned image, change the digest in `Dockerfile.ledger` after
verifying it (`docker buildx imagetools inspect ghcr.io/formancehq/ledger:<tag>`),
merge to `main` so `build-images.yml` rebuilds `ctf-formance-ledger:latest`, then
redeploy the Railway service to pull the new `:latest`.

## Deploy on Railway

The ledger is the wrapper image `ghcr.io/chargingthefuture/ctf-formance-ledger:latest`
(built by `build-images.yml` from `ctf/ops/formance/Dockerfile.ledger`). Railway runs
it as a Docker-image service; no Dockerfile build happens on Railway.

1. **Add a Postgres** to the Railway project (New → Database → PostgreSQL). This
   replaces the Neon `formance` project. No data migration is needed while there are
   no real transactions — the books are recreated by the bootstrap step below.
2. **Create the ledger service** from the image: New → Deploy from Docker image →
   `ghcr.io/chargingthefuture/ctf-formance-ledger:latest`. (If the GHCR package is
   private, add a registry credential; the package is normally public.)
3. **Set the ledger service env vars** (the runtime flags — `AUTO_UPGRADE`,
   `EXPERIMENTAL_FEATURES`, pool sizes — are baked into the image, so only these are
   set on the service):
   - `FORMANCE_POSTGRES_URI` — the Railway Postgres connection string. Reference the
     Postgres plugin's variable (e.g. `${{ Postgres.DATABASE_URL }}`) so it tracks
     automatically. The entrypoint maps it to `POSTGRES_URI`.
   - `FORMANCE_API_TOKEN` — bearer token the ledger API expects (and the entrypoint's
     auto-bootstrap uses). Generate with `openssl rand -hex 16`.
   - `FORMANCE_LEDGER` — production book name (e.g. `ctf-service-credits`).
   - `FORMANCE_LEDGER_STAGING` — optional demo book name.
   - `PORT` — the entrypoint binds whatever `PORT` is set to (default 3068). Railway
     may inject its own `PORT`; the public domain's target port (next step) MUST match
     whatever the ledger actually listens on. Deterministic setup: set `PORT=3068`
     here and use target port 3068 below. A mismatch returns curl `(52) Empty reply
     from server` even though the container logs `HTTP server started`.
4. **Expose the service** (Settings → Networking → public domain) and set its
   **target port** to the ledger's listen port (3068 with the pin above). Copy the
   public `https://…up.railway.app` domain (or a custom domain).
5. **Point the web app at it.** In Infisical (which syncs to the Render web service),
   set:
   - `FORMANCE_API_URL` — the ledger's **public https** Railway URL.
   - `FORMANCE_API_TOKEN` — same token as the ledger service.
   - `FORMANCE_LEDGER` — same book name.
   Remove the old `FORMANCE_POSTGRES_URI` from the web service (the web app never
   talks to the ledger's Postgres directly; only the ledger service does).
6. **Bootstrap the ledger book** once the service is up (see "Ledger Bootstrap"
   below). The image's entrypoint also auto-creates the book on start, so this is a
   verify-and-smoke-test step.
7. **Repoint the backup** secret `FORMANCE_DATABASE_URL` (used by
   `backup-formance.yml`) at the Railway Postgres connection string.

Note on networking: with the web app on Render and the ledger on Railway, the
web→ledger call crosses providers, so it uses the ledger's **public https** URL with
the `FORMANCE_API_TOKEN` bearer — there is no shared private network between the two.
The CTF env precheck (`check-formance-env.mjs`) requires https for any non-internal
host, which this satisfies. (When both ran on Render, `FORMANCE_API_URL` was the
plain-http internal address `http://ctf-formance-ledger:3068`; that no longer
applies.)

## Runtime Contract (`@ctf/web`)

Required:
- `FORMANCE_API_URL` — public https Railway URL of the ledger service (e.g. `https://ctf-formance-ledger-production.up.railway.app`). The web app is on Render and the ledger is on Railway, so this is cross-provider public traffic secured by `FORMANCE_API_TOKEN`; the precheck requires https for non-internal hosts.
- `FORMANCE_LEDGER` — ledger namespace (e.g. `ctf-service-credits`).
- `FORMANCE_API_TOKEN` — required by the CTF env precheck.

Optional:
- `FORMANCE_ASSET` (defaults to `SERVICE_CREDITS`)
- `SERVICE_CREDITS_REQUIRE_FORMANCE` (force prestart validation outside production)
- `SERVICE_CREDITS_INTERNAL_TOKEN` (required for the internal reclaim endpoint)

Behavior: Service Credits value-moving commands fail closed when Formance is
unavailable. Missing config → `service_credits_external_ledger_not_configured`;
upstream rejection/unavailable → `service_credits_external_ledger_unavailable`
(deterministic 503 deny on `POST /api/service-credits/transfers`).

## Ledger Bootstrap (one-time)

Run once after the service is up. Set shell vars to the deployed values:

```bash
export FORMANCE_API_URL="https://ctf-formance-ledger-production.up.railway.app"
export FORMANCE_LEDGER="ctf-service-credits"
export FORMANCE_API_TOKEN="<token>"
```

Create the ledger namespace (`201` created, `409` already exists — both safe):

```bash
curl -sS -i -X POST \
  -H "Authorization: Bearer ${FORMANCE_API_TOKEN}" \
  "${FORMANCE_API_URL}/v2/${FORMANCE_LEDGER}"
```

Verify it exists, then write + read a smoke transaction:

```bash
curl -sS -H "Authorization: Bearer ${FORMANCE_API_TOKEN}" "${FORMANCE_API_URL}/v2" | jq .

curl -sS -i -X POST \
  -H "Authorization: Bearer ${FORMANCE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  "${FORMANCE_API_URL}/v2/${FORMANCE_LEDGER}/transactions" \
  -d '{"reference":"bootstrap-smoke-001","postings":[{"source":"world","destination":"wallet:test-user","amount":100,"asset":"SERVICE_CREDITS"}],"metadata":{"plugin":"service-credits","flow":"bootstrap_smoke"}}'

curl -sS -H "Authorization: Bearer ${FORMANCE_API_TOKEN}" "${FORMANCE_API_URL}/v2/${FORMANCE_LEDGER}/transactions" | jq .
```

Failure checks: `401/403` → token mismatch; `404` on ledger endpoints → namespace
not created yet; connection refused/timeout → wrong host or not using the ledger's
public Railway https URL.

> Do not run CTF SQL migrations against Formance Postgres. Formance manages its
> own schema lifecycle; CTF migrations target the CTF database only.

## Backup & Restore

A GitHub Actions workflow (`backup-formance.yml`) runs
`backupFormanceToPrivateRepo.mjs` daily at 03:00 UTC: `pg_dump --format=custom`
→ uploaded as a **GitHub Release asset** on a **private backup repo**. Each
nightly run creates a release tagged `formance-backup-<iso>` whose single asset
is `formance-backup-<iso>.dump`.

Required secrets: `FORMANCE_DATABASE_URL` (read access), `GH_PAT` (a token with
`contents: write` on the backup repo), `BACKUP_REPO` (the backup repo as
`owner/name`).

Owner setup (one-time): create a **PRIVATE** GitHub repo to hold the backups,
set `BACKUP_REPO` (= `owner/name`) as a GitHub Actions secret, and make sure
`GH_PAT` has `contents: write` on that repo. If any required secret is missing
the backup job fails red — backups must fail loudly, never silently.

Manual backup:

```bash
FORMANCE_DATABASE_URL=postgres://user:pass@host:port/db \
GH_PAT=<token-with-contents-write> \
BACKUP_REPO=owner/name \
node ctf/scripts/backupFormanceToPrivateRepo.mjs
```

Restore (downloads a release asset and `pg_restore`s it; confirm-gated):

```bash
FORMANCE_DATABASE_URL=postgres://user:pass@host:port/target-db \
GH_PAT=<token-with-read-access> \
BACKUP_REPO=owner/name \
FORMANCE_RESTORE_CONFIRM=1 \
node ctf/scripts/restoreFormanceFromPrivateRepo.mjs
# Optional: FORMANCE_BACKUP_TAG=formance-backup-<iso> to pin a release
#           (blank = latest); FORMANCE_BACKUP_FILE=<asset name> to pin an asset.
```

Verify: confirm the daily workflow succeeded, check the latest release on the
private backup repo, and periodically test-restore to staging. For data-loss
incidents, follow this procedure alongside the escalation/audit steps in
[REVERT_PROTOCOL.md](./REVERT_PROTOCOL.md).

## Operational Controls

- **Token rotation:** generate new token → update `FORMANCE_API_TOKEN` → redeploy web → revoke old token after smoke checks pass.
- **Incident handling:** if Formance is unavailable, do not disable fail-closed behavior; keep returning deterministic 503 deny codes.

## Known Follow-Ups

- Adapter outbox replay worker + dead-letter handling.
- Reconciliation job between local adapter state and Formance history.

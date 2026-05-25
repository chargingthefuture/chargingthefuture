# Formance Ledger

Single reference for the Formance ledger that backs Service Credits. Deployment
mechanics live in code — this doc covers only what code does not: the runtime
contract, one-time ledger bootstrap, and backup/restore.

## Source of Truth (code, not prose)

| Concern | File |
|---|---|
| Container image, pinned digest, runtime flags, start command | `ctf/ops/formance/Dockerfile.ledger` |
| Service definition, plan, region, env wiring | `render.yaml` (`ctf-formance-ledger`) |
| Nightly backup automation | `ctf/scripts/backupFormanceToSupabase.mjs` + `.github/workflows/backup-formance-supabase.yml` |

State lives entirely in external Neon Postgres (Render has no persistent
volumes). `AUTO_UPGRADE=true` runs schema migrations on container start.
`FORMANCE_POSTGRES_URI` is injected from Infisical → Render Sync (the
`Dockerfile.ledger` entrypoint maps it to the `POSTGRES_URI` the binary expects).

To update the pinned image, change the digest in `Dockerfile.ledger` after
verifying it: `docker buildx imagetools inspect ghcr.io/formancehq/ledger:<tag>`.

## Runtime Contract (`@ctf/web`)

Required:
- `FORMANCE_API_URL` — Render internal URL of `ctf-formance-ledger` (e.g. `http://ctf-formance-ledger:3068`). Never route service-to-service traffic through a public domain.
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
export FORMANCE_API_URL="http://ctf-formance-ledger:3068"
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
not created yet; connection refused/timeout → wrong host or not using the Render
internal address.

> Do not run CTF SQL migrations against Formance Postgres. Formance manages its
> own schema lifecycle; CTF migrations target the CTF database only.

## Backup & Restore

A GitHub Actions workflow runs `backupFormanceToSupabase.mjs` daily at 03:00 UTC:
`pg_dump` (compressed) → upload to `backups/formance/` in Supabase Storage.

Required secrets: `FORMANCE_DATABASE_URL` (read access), `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` (write access to the `backups` bucket).

Manual backup:

```bash
FORMANCE_DATABASE_URL=postgres://user:pass@host:port/db \
SUPABASE_URL=https://xyz.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<key> \
node ctf/scripts/backupFormanceToSupabase.mjs
```

Restore:

```bash
supabase storage download backups/formance/formance-backup-YYYY-MM-DDTHHMMSSZ.dump
pg_restore --clean --no-owner --no-privileges \
  --dbname=postgres://user:pass@host:port/db \
  formance-backup-YYYY-MM-DDTHHMMSSZ.dump
```

Verify: confirm the daily workflow succeeded, list `backups/formance/`, and
periodically test-restore to staging. For data-loss incidents, follow this
procedure alongside the escalation/audit steps in [REVERT_PROTOCOL.md](./REVERT_PROTOCOL.md).

## Operational Controls

- **Token rotation:** generate new token → update `FORMANCE_API_TOKEN` → redeploy web → revoke old token after smoke checks pass.
- **Incident handling:** if Formance is unavailable, do not disable fail-closed behavior; keep returning deterministic 503 deny codes.

## Known Follow-Ups

- Adapter outbox replay worker + dead-letter handling.
- Reconciliation job between local adapter state and Formance history.

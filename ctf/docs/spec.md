# Spec: Infisical as Single Source of Truth for Secrets

## Problem Statement

Secrets are currently fragmented across four systems: GitHub Actions encrypted secrets, Railway service variables, Ona project secrets, and `.env.local.example` as a reference-only file. There is no single source of truth. When a secret changes, it must be updated in multiple places. Agents have no access to secrets at runtime. CI has no access to secrets outside GitHub Actions. Railway services have no access to secrets outside the Railway dashboard.

Additionally, two CI checks fail on every push due to pre-existing issues unrelated to any feature work: EOF formatting on ~20 files, and the `deploy-backend-railway.yml` workflow.

The goal is to:
1. Add the Infisical CLI to the dev container so agents and developers can use it
2. Fix the pre-existing CI failures (EOF formatting, deploy workflow)
3. Migrate all secrets to the self-hosted Infisical instance on Railway as the single source of truth — replacing GitHub Actions secrets, Railway service variables, and Ona project secrets

---

## Architecture After Migration

```
Infisical (self-hosted on Railway)
    ├── Project: chargingthefuture
    │   ├── Environment: staging
    │   └── Environment: production
    │
    ├── GitHub Actions  → infisical/secrets-action injects secrets at job start
    ├── Railway services → Infisical Railway integration syncs vars automatically
    └── Ona environments → INFISICAL_TOKEN secret + infisical run -- <cmd> in setup
```

**Single bootstrap secret required everywhere:** `INFISICAL_TOKEN` (machine identity token from Infisical). Everything else is fetched from Infisical at runtime.

---

## Injection Strategy

| Platform | Method | Why |
|---|---|---|
| GitHub Actions | `infisical/secrets-action` — official GH Action, injects secrets as env vars before each job | Native, no shell scripting, works with existing workflow structure |
| Railway services | Infisical Railway native integration — syncs secrets directly into Railway service variables | No token needed at runtime, Railway handles injection natively |
| Ona environments | `INFISICAL_TOKEN` Ona project secret + `infisical run --` prefix in `setup.sh` commands that need secrets | Minimal bootstrap, secrets available as env vars in all tasks |

---

## Requirements

### R1 — Infisical CLI in Dev Container

Add `@infisical/cli` to `setup.sh` alongside the existing CLI installs. The CLI must:
- Be installed via `npm install -g @infisical/cli`
- Be guarded with a presence check (same pattern as Railway, Vercel CLIs)
- Be available in all Ona tasks and agent sessions without a restart

### R2 — Fix EOF CI Failures

The `check-eof-format.sh` script fails on ~20 files missing a trailing newline. Fix all affected files by appending a single newline. Files identified:

- `packages/web/postcss.config.js`
- `packages/mobile/package.json`
- `packages/mobile/src/index.ts`
- `packages/mobile/src/features/announcements/MockAnnouncements.tsx`
- `packages/mobile/src/features/weekly-performance/WeeklyPerformance.tsx`
- `packages/mobile/src/features/community/index.ts`
- `packages/mobile/src/features/community/MockCommunity.tsx`
- `packages/mobile/src/features/workforce/Workforce.tsx`
- `packages/mobile/src/features/questions/MockQuestions.tsx`
- `packages/mobile/src/features/questions/index.ts`
- `packages/mobile/src/features/feed/MockFeed.tsx`
- `packages/mobile/src/features/feed/feedDemoData.ts`
- `packages/pm-mcp-server/src/react-native.d.ts`
- `packages/shared/package.json`
- `packages/shared/src/index.ts`
- `packages/shared/src/stream/chyme.ts`
- `artifacts/performance/perf-budget-report.json`
- `docs/contracts/TRUST_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`
- `docs/contracts/TRUST_PLUGIN_AUDIT_CONTRACTS.yaml`
- `docs/contracts/TRUST_PLUGIN_COMMAND_CONTRACTS.yaml`

### R3 — Fix deploy-backend-railway.yml CI Failures

The `deploy-backend-railway.yml` workflow fails on every push. The `railway-deploy` job's `if` condition references `needs.main-quality-gate.result == 'success'` but `main-quality-gate` only runs on `main` branch — on other branches it is skipped, which causes the condition to evaluate incorrectly. Fix the condition to treat a skipped `main-quality-gate` as passing (i.e. `== 'success' || == 'skipped'`).

### R4 — Infisical Project Structure (manual, documented)

Define the Infisical project structure that maps to the existing environment contract:

| Infisical environment | Maps to | Secret prefix pattern |
|---|---|---|
| `staging` | Staging Railway | `RAILWAY_STAGING_*` vars + universal vars |
| `production` | Production Railway | `RAILWAY_PROD_*` vars + universal vars |

All secrets from `ctf/packages/web/.env.local.example` must be present in Infisical before migration. This is a manual step documented in `ctf/docs/infisical-migration-guide.md`.

### R5 — GitHub Actions Integration

Replace all `secrets.*` references in `deploy-backend-railway.yml` with Infisical injection:

1. Add `infisical/secrets-action` as the first step in each job that consumes secrets
2. The action requires only `INFISICAL_TOKEN` and `INFISICAL_PROJECT_ID` as GitHub Actions secrets (the only two secrets that remain in GitHub)
3. All other secrets are fetched from Infisical and injected as env vars automatically

### R6 — Railway Services Integration (manual, documented)

Configure the Infisical Railway native integration to sync secrets into each Railway service:

- CTF app service → Infisical `production` environment
- Ledger (Formance) service → Infisical `production` environment
- Infisical service itself → bootstrapped manually (cannot self-reference)
- Ollama service → no secrets needed
- Postgres service → managed by Railway, no Infisical integration needed

### R7 — Ona Environment Integration

Replace Ona project secrets (except `INFISICAL_TOKEN` and `GITHUB_TOKEN`) with Infisical injection:

1. Keep only two Ona project secrets: `INFISICAL_TOKEN`, `GITHUB_TOKEN`
2. Update `railway-debug` and `railway-redeploy` tasks in `automations.yaml` to use `infisical run --` prefix

### R8 — Migration Guide Document

Create `ctf/docs/infisical-migration-guide.md` covering:
- Manual steps: Infisical project setup, environment creation, secret population
- Machine identity token creation
- Railway native integration setup per service
- Ona secrets cleanup (what to remove, what to keep)
- GitHub Actions secrets cleanup (what to remove, what to keep)
- Verification checklist

### R9 — Update AGENTS.md and ona-secrets-inventory.md

Update both documents to reflect the new two-secret bootstrap model.

---

## Acceptance Criteria

- [ ] `infisical --version` runs successfully in an Ona environment
- [ ] `check-eof-format.sh` passes with zero failures in `ctf/`
- [ ] `deploy-backend-railway.yml` does not fail on non-main branch pushes due to skipped jobs
- [ ] `infisical/secrets-action` is the first step in all jobs that consume secrets in `deploy-backend-railway.yml`
- [ ] Only `INFISICAL_TOKEN` and `INFISICAL_PROJECT_ID` remain as GitHub Actions secrets
- [ ] Only `INFISICAL_TOKEN` and `GITHUB_TOKEN` remain as Ona project secrets
- [ ] `ctf/docs/infisical-migration-guide.md` exists with complete manual steps
- [ ] No secret values are committed to the repository
- [ ] `AGENTS.md` and `ona-secrets-inventory.md` reflect the new model

---

## Implementation Approach

### Manual steps (human required before or after code changes)

**M1 — Set up Infisical project** (before merging)
1. Log into self-hosted Infisical on Railway
2. Create project `chargingthefuture`, environments `staging` and `production`
3. Populate all secrets from `.env.local.example` with real values

**M2 — Create machine identity token** (before merging)
1. Infisical → Project Settings → Machine Identities → New Identity
2. Name: `ci-agent`, role: `member`
3. Copy token → this becomes `INFISICAL_TOKEN` everywhere
4. Note the Project ID

**M3 — Add bootstrap secrets** (before merging)
- GitHub Actions: add `INFISICAL_TOKEN` + `INFISICAL_PROJECT_ID`
- Ona project secrets: add `INFISICAL_TOKEN`

**M4 — Configure Railway native integration** (after merging)
1. Infisical → Integrations → Railway
2. Connect CTF app and Ledger services to `production` environment
3. Verify sync

**M5 — Clean up old secrets** (after verifying M4)
- Remove all individual secrets from GitHub Actions (keep only `INFISICAL_TOKEN`, `INFISICAL_PROJECT_ID`)
- Remove all individual secrets from Ona project (keep only `INFISICAL_TOKEN`, `GITHUB_TOKEN`)
- Remove all manually-set vars from Railway service dashboards (Infisical sync replaces them)

### Code changes (agent executes)

**C1** — Add Infisical CLI install to `setup.sh`
**C2** — Fix trailing newline on all 20 EOF-failing files
**C3** — Fix `railway-deploy` job condition in `deploy-backend-railway.yml`
**C4** — Add `infisical/secrets-action` to all secret-consuming jobs in `deploy-backend-railway.yml`
**C5** — Update `automations.yaml` tasks to use `infisical run --` prefix
**C6** — Create `ctf/docs/infisical-migration-guide.md`
**C7** — Update `ctf/docs/ona-secrets-inventory.md`
**C8** — Update `AGENTS.md`

---

## Files Changed

| File | Action |
|---|---|
| `.devcontainer/setup.sh` | Add Infisical CLI install |
| `ctf/packages/web/postcss.config.js` + 19 other files | Add trailing newline (EOF fix) |
| `.github/workflows/deploy-backend-railway.yml` | Fix job condition + add Infisical secrets injection |
| `.ona/automations.yaml` | Update tasks to use `infisical run --` |
| `ctf/docs/infisical-migration-guide.md` | New — full migration guide |
| `ctf/docs/ona-secrets-inventory.md` | Update to two-secret Ona model |
| `AGENTS.md` | Document Infisical-first secret model |

---

## Constraints

- `INFISICAL_TOKEN` and `INFISICAL_PROJECT_ID` are the only secrets that remain outside Infisical. They are the bootstrap credentials needed to reach Infisical.
- Secret values must never be committed to the repository.
- Secret names in Infisical must match `.env.local.example` exactly — no renaming.
- The Infisical service on Railway cannot self-reference for its own secrets — it must be bootstrapped manually.
- The Railway Postgres service is managed by Railway and does not need Infisical integration.

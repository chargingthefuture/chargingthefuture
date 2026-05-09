# Infisical Migration Guide

Single source of truth for all secrets. After completing this guide, secrets are managed only in Infisical. GitHub Actions, Railway services, and Ona environments all pull from Infisical at runtime.

**Bootstrap secrets (the only ones that live outside Infisical):**
- `INFISICAL_TOKEN` — machine identity token to authenticate with Infisical
- `INFISICAL_CLIENT_ID` — machine identity client ID (for GitHub Actions)
- `INFISICAL_CLIENT_SECRET` — machine identity client secret (for GitHub Actions)
- `INFISICAL_PROJECT_SLUG` — your Infisical project slug
- `INFISICAL_PROJECT_ID` — your Infisical project ID
- `INFISICAL_URL` — your self-hosted Infisical URL (e.g. `https://infisical.yourdomain.com`)
- `GITHUB_TOKEN` — for git push operations in Ona

---

## Step 1 — Set up Infisical project

1. Log into your self-hosted Infisical instance on Railway
2. Create a new project named `chargingthefuture`
3. Note the **Project ID** and **Project Slug** from Project Settings
4. Create two environments:
   - `staging` — maps to Railway staging services
   - `production` — maps to Railway production services

---

## Step 2 — Populate secrets in Infisical

Add every secret from `ctf/packages/web/.env.local.example` to both environments with real values.

Use the Infisical dashboard: Project → Secrets → select environment → Add Secret.

**Universal secrets** (same value in both environments):

| Secret name | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon key |
| `STREAM_VIDEO_API_KEY` | GetStream video API key |
| `STREAM_VIDEO_API_SECRET` | GetStream video API secret |
| `STREAM_FEEDS_API_KEY` | GetStream feeds API key |
| `STREAM_FEEDS_API_SECRET` | GetStream feeds API secret |
| `STREAM_API_SECRET` | GetStream chat API secret |
| `STREAM_API_KEY` | GetStream chat API key |
| `OBSERVABILITY_PROVIDER` | e.g. `sentry` |
| `CLERK_ENCRYPTION_KEY` | Shared Clerk encryption key |
| `WORKFORCE_SYNC_TOKEN` | Internal sync endpoint auth token |
| `CRON_SECRET` | Sentry Cron Jobs auth token |
| `SERVICE_CREDITS_INTERNAL_TOKEN` | Internal deletion reclaim token |
| `EXPO_MOBILE_PROJECT_ID` | Expo project ID |
| `EXPO_MOBILE_UPDATES_URL` | Expo OTA updates URL |
| `EXPO_SENTRY_DSN` | Sentry DSN for mobile |

**Environment-specific secrets** (different values per environment):

| Secret name | Staging | Production |
|---|---|---|
| `DATABASE_URL` | Staging Neon DB URL | Production Neon DB URL |
| `NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY` | Staging auth key | Production auth key |
| `AUTH_SECRET_KEY` | Staging auth secret | Production auth secret |
| `AUTH_SIGN_IN_URL` | Staging sign-in URL | Production sign-in URL |
| `AUTH_AFTER_SIGN_OUT_URL` | Staging sign-out URL | Production sign-out URL |
| `RAILWAY_TOKEN` | Staging project token | Production project token |
| `RAILWAY_API_TOKEN` | Account-level token | Account-level token |
| `RAILWAY_NEXT_PUBLIC_APP_URL` | Staging app URL | Production app URL |
| `RAILWAY_SENTRY_DSN` | Staging Sentry DSN | Production Sentry DSN |
| `FORMANCE_API_URL` | `http://ledger.railway.internal:8080` | `http://ledger.railway.internal:8080` |
| `FORMANCE_LEDGER` | Staging ledger name | Production ledger name |
| `FORMANCE_API_TOKEN` | Staging Formance token | Production Formance token |
| `FORMANCE_ASSET` | Staging asset (optional) | Production asset (optional) |
| `SERVICE_CREDITS_REQUIRE_FORMANCE` | `false` | `true` |

---

## Step 3 — Create machine identity

Machine identities authenticate non-human callers (CI, Ona tasks) to Infisical.

1. In Infisical: Project Settings → Machine Identities → **Create Identity**
2. Name: `ci-agent`
3. Role: `member` (read access to secrets)
4. After creation, click the identity → **Add Client Secret**
5. Copy:
   - **Client ID** → `INFISICAL_CLIENT_ID`
   - **Client Secret** → `INFISICAL_CLIENT_SECRET`
6. Also create a **Universal Auth token** for CLI use:
   - Identity → **Create Token** → copy value → `INFISICAL_TOKEN`

---

## Step 4 — Add bootstrap secrets to GitHub Actions

In your GitHub repository: Settings → Secrets and variables → Actions → New repository secret.

Add only these secrets:

| Secret name | Value |
|---|---|
| `INFISICAL_CLIENT_ID` | From Step 3 |
| `INFISICAL_CLIENT_SECRET` | From Step 3 |
| `INFISICAL_PROJECT_SLUG` | From Step 1 |
| `INFISICAL_URL` | Your Infisical Railway URL |

All other GitHub Actions secrets can be removed after verifying the pipeline works.

---

## Step 5 — Add bootstrap secrets to Ona

In Ona dashboard: Project → Settings → Secrets → New Secret.

Add only these secrets:

| Secret name | Value |
|---|---|
| `INFISICAL_TOKEN` | From Step 3 |
| `INFISICAL_PROJECT_ID` | From Step 1 |
| `GITHUB_TOKEN` | Your GitHub PAT (for git push) |

All other Ona project secrets can be removed after verifying tasks work.

---

## Step 6 — Configure Railway native integration

This syncs Infisical secrets directly into Railway service environment variables.

1. In Infisical dashboard: **Integrations** → **Railway**
2. Authenticate with your Railway account
3. For each service, configure:

| Railway service | Infisical environment |
|---|---|
| CTF app (`@ctf/web`) | `production` |
| Ledger (Formance) | `production` |
| Ollama | _(no secrets needed)_ |
| Postgres | _(managed by Railway, skip)_ |
| Infisical | _(bootstrapped manually, skip)_ |

4. Click **Sync** and verify secrets appear in each Railway service's Variables tab

After sync is verified, remove manually-set variables from Railway service dashboards — Infisical owns them now.

---

## Step 7 — Verify everything works

**GitHub Actions:**
```bash
# Trigger a push to a non-main branch and confirm:
# - "Inject secrets from Infisical" step succeeds
# - railway-deploy job runs (not skipped)
# - Deploy completes
```

**Ona environment:**
```bash
# In an Ona terminal after restart:
echo $INFISICAL_TOKEN        # should be set
infisical --version          # should print version
gitpod automations task start railway-debug  # should fetch Railway logs
```

**Railway services:**
```bash
# In Railway dashboard → each service → Variables:
# Confirm secrets are present and match Infisical values
```

---

## Step 8 — Clean up old secrets

After all verification passes:

**GitHub Actions** — remove all secrets except:
- `INFISICAL_CLIENT_ID`
- `INFISICAL_CLIENT_SECRET`
- `INFISICAL_PROJECT_SLUG`
- `INFISICAL_URL`
- `GITHUB_TOKEN` (keep — used by `gh` CLI in CI)

**Ona project secrets** — remove all secrets except:
- `INFISICAL_TOKEN`
- `INFISICAL_PROJECT_ID`
- `GITHUB_TOKEN`

**Railway service Variables** — remove all manually-set vars (Infisical sync replaces them). Do not remove Railway-managed vars like `PORT`, `RAILWAY_*` internal vars.

---

## Troubleshooting

**`infisical run` fails with auth error**
- Verify `INFISICAL_TOKEN` is valid and not expired
- Check the machine identity has access to the project in Infisical

**Railway deploy fails after migration**
- Confirm `RAILWAY_TOKEN` exists in Infisical under the correct environment (`staging` or `production`)
- Check the Infisical → Railway sync is active and not erroring

**Secrets not injected in Ona**
- Restart the environment — env var secrets require a restart to propagate
- Verify `INFISICAL_TOKEN` and `INFISICAL_PROJECT_ID` are set as Ona project secrets

# Ona Secrets Inventory

After the Infisical migration, only three secrets are managed in Ona project settings.
All other secrets live in Infisical and are injected at runtime via `infisical run --`.

See `ctf/docs/infisical-migration-guide.md` for full migration instructions and the
complete list of secrets that must exist in Infisical.

---

## Ona Project Secrets (post-migration)

Add at: Ona dashboard → Project → Settings → Secrets → New Secret → Environment Variable

| Secret name | Description |
|---|---|
| `INFISICAL_TOKEN` | Machine identity token — authenticates `infisical run --` in all tasks |
| `INFISICAL_PROJECT_ID` | Infisical project ID — used by `infisical run --` to scope secret fetch |
| `GITHUB_TOKEN` | GitHub PAT (`repo` + `workflow` scopes) — used for git push operations |

All other secrets previously listed here are now managed in Infisical.

---

## How secrets reach the environment

Tasks use `infisical run --` to inject secrets at command execution time:

```bash
infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=production -- \
  railway status
```

Infisical injects all project secrets as env vars before the command runs.

---

## Verification

```bash
echo $INFISICAL_TOKEN   # should be set
infisical --version     # should print CLI version
infisical run --token="$INFISICAL_TOKEN" --projectId="$INFISICAL_PROJECT_ID" --env=production -- \
  env | grep RAILWAY    # should show RAILWAY_TOKEN, RAILWAY_API_TOKEN
```

---

## Railway token reference

| Infisical secret name | Type | Used for |
|---|---|---|
| `RAILWAY_API_TOKEN` | Account-level | `railway status`, `railway logs` |
| `RAILWAY_TOKEN` | Project/environment | `railway up --ci` deploys |

---

## Pre-migration inventory (archived)

The sections below are preserved for reference during migration.
Once all secrets are in Infisical and verified, this content can be removed.

---

## Scope: Project Secrets

Add these at: Ona dashboard → Project → Settings → Secrets → New Secret → Environment Variable

All secrets below are shared across every environment started from this project.

### Universal (all environments)

| Secret name | Description | Source |
|---|---|---|
| `DATABASE_URL` | Production Neon DB connection string | Railway dashboard / Neon |
| `DATABASE_URL_STAGING` | Staging Neon DB connection string | Railway dashboard / Neon |
| `STREAM_API_KEY` | GetStream chat API key | GetStream dashboard |
| `STREAM_API_SECRET` | GetStream chat API secret | GetStream dashboard |
| `STREAM_VIDEO_API_KEY` | GetStream video API key | GetStream dashboard |
| `STREAM_VIDEO_API_SECRET` | GetStream video API secret | GetStream dashboard |
| `STREAM_FEEDS_API_KEY` | GetStream feeds API key | GetStream dashboard |
| `STREAM_FEEDS_API_SECRET` | GetStream feeds API secret | GetStream dashboard |
| `OBSERVABILITY_PROVIDER` | Observability provider name (e.g. `sentry`) | Config value |
| `CLERK_ENCRYPTION_KEY` | Shared encryption key across all Clerk instances | Clerk dashboard |
| `WORKFORCE_SYNC_TOKEN` | Auth token for workforce incremental sync endpoint | Generated secret |
| `CRON_SECRET` | Auth token for Sentry Cron Jobs (`Authorization: Bearer`) | Generated secret |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (document storage) | Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon key | Supabase dashboard |

### Auth (universal — provider-agnostic names)

| Secret name | Description |
|---|---|
| `NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY` | Public auth publishable key |
| `AUTH_SECRET_KEY` | Auth secret key |
| `AUTH_SIGN_IN_URL` | Auth sign-in URL |
| `AUTH_AFTER_SIGN_OUT_URL` | Redirect URL after sign-out |

### Railway — all Railway deployments

| Secret name | Description |
|---|---|
| `RAILWAY_TOKEN` | Project token — used by `railway up` for deploys. Scoped to staging or production environment. |
| `RAILWAY_API_TOKEN` | Account token — used by `railway status`, `railway logs`, and all CLI auth. Account-level scope. |
| `RAILWAY_NEXT_PUBLIC_APP_URL` | Public app URL on Railway |
| `RAILWAY_SENTRY_DSN` | Sentry DSN for Railway environments |

### Railway — Staging environment

| Secret name | Description |
|---|---|
| `RAILWAY_STAGING_NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY` | Staging auth publishable key |
| `RAILWAY_STAGING_AUTH_SECRET_KEY` | Staging auth secret key |
| `RAILWAY_STAGING_AUTH_SIGN_IN_URL` | Staging auth sign-in URL |
| `RAILWAY_STAGING_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Legacy Clerk compat — staging |
| `RAILWAY_STAGING_CLERK_SECRET_KEY` | Legacy Clerk compat — staging |
| `RAILWAY_STAGING_CLERK_SIGN_IN_URL` | Legacy Clerk compat — staging |

### Railway — Production environment

| Secret name | Description |
|---|---|
| `RAILWAY_PROD_NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY` | Production auth publishable key |
| `RAILWAY_PROD_AUTH_SECRET_KEY` | Production auth secret key |
| `RAILWAY_PROD_AUTH_SIGN_IN_URL` | Production auth sign-in URL |
| `RAILWAY_PROD_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Legacy Clerk compat — production |
| `RAILWAY_PROD_CLERK_SECRET_KEY` | Legacy Clerk compat — production |
| `RAILWAY_PROD_CLERK_SIGN_IN_URL` | Legacy Clerk compat — production |

### Formance (ledger / service credits)

| Secret name | Description |
|---|---|
| `FORMANCE_API_URL` | Formance API URL (Railway internal: `http://ledger.railway.internal:8080`) |
| `FORMANCE_LEDGER` | Formance ledger name |
| `FORMANCE_API_TOKEN` | Formance API token |
| `FORMANCE_ASSET` | Formance asset identifier (optional) |
| `SERVICE_CREDITS_REQUIRE_FORMANCE` | Feature flag — set `true` in Railway/prod |
| `SERVICE_CREDITS_INTERNAL_TOKEN` | Auth token for internal deletion reclaim endpoint |

### Mobile (Expo)

| Secret name | Description |
|---|---|
| `EXPO_MOBILE_PROJECT_ID` | Expo project ID |
| `EXPO_MOBILE_UPDATES_URL` | Expo OTA updates URL |
| `EXPO_SENTRY_DSN` | Sentry DSN for mobile |

### CI / GitHub Actions (also needed in Ona for agent tasks)

| Secret name | Description | Where to add |
|---|---|---|
| `GH_ACTIONS_BILLING_TOKEN` | GitHub token for Actions budget monitor | Ona project secret |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk key used in CI validation step | Ona project secret |
| `CLERK_SECRET_KEY` | Clerk secret used in CI validation step | Ona project secret |
| `CLERK_SIGN_IN_URL` | Clerk sign-in URL used in CI validation | Ona project secret |
| `RAILWAY_NEXT_PUBLIC_APP_URL` | App URL used in CI Clerk validation | Ona project secret |

---

## Scope: User Secrets

Add these at: Ona dashboard → Settings → My Account → Secrets

These are personal tokens that should not be shared across team members.

| Secret name | Description |
|---|---|
| `GITHUB_TOKEN` | Personal GitHub token for `gh` CLI operations in agent tasks |

---

## Creating Railway Tokens

Railway uses two distinct token types. You need both.

### 1. Account token (`RAILWAY_API_TOKEN`) — for CLI auth, logs, status

1. Go to [railway.app](https://railway.app) → click your **profile avatar** → **Account Settings** → **Tokens**
2. Click **New Token**, name it `ona-agent-account`
3. Copy the value (it will be a UUID)
4. Add it as `RAILWAY_API_TOKEN` in Ona project secrets

This token authenticates the Railway CLI for commands like `railway status` and `railway logs`.

### 2. Project token (`RAILWAY_TOKEN`) — for deploys

1. Go to [railway.app](https://railway.app) → open your project → **Settings** → **Tokens**
2. Click **New Token**, select environment scope: **Production** or **Staging**
3. Name it `ona-agent-deploy`
4. Copy the value
5. Add it as `RAILWAY_TOKEN` in Ona project secrets
6. Also add it to GitHub Actions secrets: repo Settings → Secrets and variables → Actions → `RAILWAY_TOKEN`

This token is used by `railway up --ci` for deployments. Create one per environment if needed.

> Both tokens must exist in Ona project secrets. `RAILWAY_TOKEN` must also exist in GitHub Actions secrets for CI deploys. These are separate secret stores.

---

## Verification

After adding secrets to Ona, start an environment and run:

```bash
echo $RAILWAY_TOKEN      # should print the token value
echo $DATABASE_URL       # should print the connection string
railway status           # should connect to Railway without prompting for login
```

---

## LevelUp defaults (config values, not secrets)

These have default values in `.env.local.example` and do not need to be secrets:

| Variable | Default |
|---|---|
| `LEVELUP_STARTER_CREDITS` | `500` |
| `LEVELUP_ENROLL_RATE_LIMIT_WINDOW_MS` | `60000` |
| `LEVELUP_ENROLL_RATE_LIMIT_MAX` | `6` |
| `LEVELUP_MILESTONE_RATE_LIMIT_WINDOW_MS` | `60000` |
| `LEVELUP_MILESTONE_RATE_LIMIT_MAX` | `20` |

Set these as Ona project secrets only if you need to override the defaults.

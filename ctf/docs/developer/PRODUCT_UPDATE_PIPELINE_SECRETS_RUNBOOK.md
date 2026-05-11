# Product Update Pipeline — Secrets Runbook

Date: 2026-05-11
Owner: platform/infra

Documents every secret required by `.github/workflows/generate-product-update.yml`
and `ctf/packages/web/app/api/internal/product-update/route.ts`.

---

## Secret tiers

The pipeline uses a two-tier model:

| Tier | Where stored | Why |
|---|---|---|
| **Infisical** | Infisical (synced at workflow runtime) | Source of truth for all app secrets |
| **GitHub-direct** | GitHub org secrets only | Cannot come from Infisical due to bootstrapping constraints |

---

## Infisical secrets

Add these to Infisical under the **production** environment.
The workflow reads them automatically via `Infisical/secrets-action@v1.0.16`.

| Key | Value | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key | Generate at console.anthropic.com → API Keys |
| `APP_URL` | `https://<your-railway-domain>` | The Railway production URL for the deployed web app. No trailing slash. |
| `INTERNAL_SERVICE_SECRET` | Random 32-byte hex string | See generation command below. Must also be set in Railway env vars so the Next.js app can verify the header. |

Generate `INTERNAL_SERVICE_SECRET`:
```bash
openssl rand -hex 32
```

---

## GitHub-direct secrets

Set these at: **github.com → chargingthefuture org → Settings → Secrets and variables → Actions → New organization secret**

These four already exist for other workflows. Verify they are present:

| Key | Why GitHub-only |
|---|---|
| `INFISICAL_CLIENT_ID` | Authenticates to Infisical — cannot itself come from Infisical |
| `INFISICAL_CLIENT_SECRET` | Same bootstrapping reason |
| `INFISICAL_PROJECT_SLUG` | Same |
| `INFISICAL_URL` | Same |
| `GH_PAT` | GitHub Personal Access Token — a GitHub credential that cannot bootstrap from Infisical |

---

## Generating GH_PAT

`GH_PAT` grants the workflow write access to the wiki-site repo and the
main repo's GitHub wiki (used to push product update pages).

### Step 1 — Open token creation

In a browser, sign in as the account that should own the token (personal or
a dedicated machine account), then navigate to:

```
Personal avatar → Settings → Developer Settings
  → Personal access tokens → Fine-grained tokens → Generate new token
```

### Step 2 — Configure the token

| Field | Value |
|---|---|
| Token name | `CTF CI Product Update` |
| Expiration | 1 year (set a calendar reminder to rotate) |
| Resource owner | `chargingthefuture` (the org, not your personal account) |
| Repository access | **Only select repositories** → `chargingthefuture/wiki-site` and `chargingthefuture/chargingthefuture` |

Under **Permissions → Repository permissions**:

| Permission | Level |
|---|---|
| Contents | Read and write |

All other permissions: No access.

### Step 3 — Copy the token

GitHub shows the token value **once** immediately after generation.
Copy it before navigating away.

### Step 4 — Store it as a GitHub org secret

Navigate to:
```
github.com → chargingthefuture → Settings → Secrets and variables
  → Actions → New organization secret
```

| Field | Value |
|---|---|
| Name | `GH_PAT` |
| Value | Paste the token copied in Step 3 |
| Repository access | All repositories (or restrict to this repo if preferred) |

---

## Rotating GH_PAT

1. Generate a new fine-grained token following Step 1–3 above.
2. Update the `GH_PAT` org secret value with the new token.
3. Delete the old token at **Settings → Developer Settings → Fine-grained tokens**.
4. Update the expiration reminder in your calendar.

---

## Verifying the pipeline end-to-end

After all secrets are in place, push a commit to `main` with a message
prefixed `feat:` or `fix:`. The workflow should:

1. Detect the meaningful commit in the `check-changes` job.
2. Call Claude Haiku and generate content.
3. Post a published announcement to the in-app feed.
4. Prepend an entry to `wiki-blog/content-index.yaml` in the `wiki-site` repo.
5. Push a new `.md` page to `chargingthefuture/chargingthefuture.wiki`.
6. Open a GitHub issue titled `Quora Draft: YYYY-MM-DD — <title>` with label `quora-draft`.
7. Push an `update/YYYY-MM-DD-HHMM` tag to `main`.

If step 3 fails with 401, `INTERNAL_SERVICE_SECRET` does not match between
GitHub/Infisical and Railway. If step 4 fails with 404, verify `GH_PAT`
has Contents write access on `chargingthefuture/wiki-site`.

# Ona Automation: Render Deployment Recovery

> **Note:** This document is for reference only. Render infrastructure supersedes Railway.
> Current secrets are managed via Infisical. See `AGENTS.md` for details.

Step-by-step guide to create autonomous Render debug and fix Automation in the Ona dashboard (if needed).

## Prerequisites

Before creating this Automation:

1. Ona project secrets include `INFISICAL_TOKEN`, `INFISICAL_PROJECT_ID`, and `GITHUB_TOKEN` (configured per AGENTS.md)
2. Render tasks exist in `.ona/automations.yaml` (currently railway-debug and railway-redeploy; can be adapted for Render)
3. The `render-failure` or similar GitHub issue label exists in the repo (optional)

---

## Create the Automation

### 1. Open Automations

In the Ona dashboard, click **Automations** in the left sidebar → **New**.

### 2. Choose trigger

Select **Manual** trigger.

- **Runs on:** Select your project (`chargingthefuture`)

Click **Save trigger**.

### 3. Add Step 1 — Fetch Render logs (Command)

Click **+ Add Step** → **Command**

**Name:** `Fetch Render logs`

**Command:**
```bash
# Example: Use Render API via infisical secrets to fetch recent logs
# For details, see AGENTS.md § "Railway CLI" (adapted for Render API)
echo "Render deployment monitoring configured via GitHub Actions CI/CD"
```

> Deploy logs are available via Render dashboard or GitHub Actions workflow runs.

### 4. Add Step 2 — Diagnose failure (Prompt)

Click **+ Add Step** → **Prompt**

**Prompt:**
```
Review the deployment failure from GitHub Actions logs or Render dashboard.

Identify the root cause and classify it as exactly one of:
- build_error: compilation, bundling, or dependency failure
- missing_env_var: a required environment variable is absent or empty (add to Infisical)
- runtime_crash: the app started but crashed after launch
- schema_drift: database schema mismatch detected
- unknown: cannot determine from logs alone

Output your classification and a one-paragraph explanation of the specific error.

If classification is missing_env_var: list the exact variable names that are missing, then STOP.
```

### 5. Add Step 3 — Gate on missing env var (Command)

Click **+ Add Step** → **Command**

**Name:** `Check for missing env var`

**Command:**
```bash
# This step is a human checkpoint.
# If the previous prompt classified the failure as missing_env_var,
# the agent will have reported the variable names. Stop here and add
# the missing secret to Infisical (AGENTS.md has details), then re-run.
echo "If classification was missing_env_var, add to Infisical and re-run."
```

### 6. Add Step 4 — Apply code fix (Prompt)

Click **+ Add Step** → **Prompt**

**Prompt:**
```
Based on your diagnosis, apply a targeted fix to the failing code.

Rules:
- Fix only what the logs identify as broken. Do not refactor unrelated code.
- If the failure is missing_env_var, do NOT proceed — report the variable names and stop.
- If the failure is schema_drift, run: cd /workspaces/chargingthefuture/ctf && pnpm run schema:report-live-drift
- For build_error or runtime_crash, locate the failing file from the stack trace and fix it.

After applying the fix:
1. Create a new branch: git checkout -b fix/render-auto-$(date +%Y%m%d-%H%M%S)
2. Stage and commit the fix: git add -A && git commit -m "fix: auto-fix Render deployment failure"
3. Confirm the branch name in your output.
```

### 7. Add Step 5 — Push branch (Command)

Click **+ Add Step** → **Command**

**Name:** `Push fix branch`

**Command:**
```bash
set -euo pipefail
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" == fix/render-auto-* ]]; then
  git push origin "$BRANCH"
  echo "Pushed branch: $BRANCH"
else
  echo "ERROR: Not on a fix branch. Expected fix/render-auto-*. Got: $BRANCH"
  exit 1
fi
```

### 8. Add Step 6 — Open draft PR (Pull Request)

Click **+ Add Step** → **Pull Request**

**Title:** `fix: auto-fix Railway deployment failure`

**Body template:**
```
## Railway Failure Auto-Fix

**Diagnosis:** (agent fills this in from Step 2 output)

**Fix applied:** (agent fills this in from Step 4 output)

**Railway log excerpt:**
See the `railway-failure` issue for the full log link.

---
Pushing this branch triggers `deploy-backend-railway.yml` automatically.
Review and merge if the CI pipeline passes.
```

**Draft:** Yes (check "Open as draft")

---

## Running the Automation

When a Railway deploy fails:

1. A GitHub issue labeled `railway-failure` is automatically opened by CI with the job URL
2. Go to Ona → **Automations** → find **Railway Failure Recovery**
3. Click **Run**
4. Monitor the execution steps in the Ona dashboard
5. If the agent opens a PR, review it — merging triggers a fresh Railway deploy via CI

---

## What the agent cannot fix automatically

The agent will halt and report (not guess) for:

- **Missing env vars** — add the secret to Ona project secrets and Railway dashboard, then re-run
- **Schema drift requiring migration** — review the drift report and run migrations manually via `pnpm run schema:report-live-drift`
- **Unknown failures** — the agent will describe what it found; escalate manually

---

## Guardrails to set

In the Automation trigger configuration:

- **Max concurrent actions:** 1 (prevent parallel fix attempts on the same repo)
- **Max total actions:** 5 per run (safety limit)

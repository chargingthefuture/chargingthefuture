# Ona Automation: Railway Failure Recovery

Step-by-step guide to create the autonomous Railway debug and fix Automation in the Ona dashboard.

## Prerequisites

Before creating this Automation:

1. `RAILWAY_TOKEN` is added to Ona project secrets (see `ona-secrets-inventory.md`)
2. `railway-debug` and `railway-redeploy` tasks exist in `.ona/automations.yaml` (already done)
3. The `railway-failure` GitHub issue label exists in the repo (create at: repo → Issues → Labels → New label, name: `railway-failure`, color: `#d73a4a`)

---

## Create the Automation

### 1. Open Automations

In the Ona dashboard, click **Automations** in the left sidebar → **New**.

### 2. Choose trigger

Select **Manual** trigger.

- **Runs on:** Select your project (`chargingthefuture`)

Click **Save trigger**.

### 3. Add Step 1 — Fetch Railway logs (Command)

Click **+ Add Step** → **Command**

**Name:** `Fetch Railway logs`

**Command:**
```bash
gitpod automations task start railway-debug
```

> This runs the `railway-debug` task defined in `.ona/automations.yaml`, which writes logs to `/tmp/railway-debug.log`.

### 4. Add Step 2 — Diagnose failure (Prompt)

Click **+ Add Step** → **Prompt**

**Prompt:**
```
Read the Railway deployment failure log at /tmp/railway-debug.log.

Identify the root cause and classify it as exactly one of:
- build_error: compilation, bundling, or dependency failure
- missing_env_var: a required environment variable is absent or empty
- runtime_crash: the app started but crashed after launch
- schema_drift: database schema mismatch detected
- unknown: cannot determine from logs alone

Output your classification and a one-paragraph explanation of the specific error.

If classification is missing_env_var: list the exact variable names that are missing.
```

### 5. Add Step 3 — Gate on missing env var (Command)

Click **+ Add Step** → **Command**

**Name:** `Check for missing env var`

**Command:**
```bash
# This step is a human checkpoint.
# If the previous prompt classified the failure as missing_env_var,
# the agent will have reported the variable names. Stop here and add
# the missing secret to Ona project secrets and Railway dashboard,
# then re-run the Automation.
echo "If classification was missing_env_var, stop and add the secret before continuing."
```

> In practice, the agent will halt and explain what's needed if it classified the failure as `missing_env_var`. The command step is a documentation anchor — the prompt in Step 2 instructs the agent to stop.

### 6. Add Step 4 — Apply code fix (Prompt)

Click **+ Add Step** → **Prompt**

**Prompt:**
```
Based on your diagnosis from the Railway logs, apply a targeted fix to the failing code.

Rules:
- Fix only what the logs identify as broken. Do not refactor unrelated code.
- If the failure is missing_env_var, do NOT proceed — report the variable names and stop.
- If the failure is schema_drift, run: cd /workspaces/chargingthefuture/ctf && pnpm run schema:report-live-drift
- For build_error or runtime_crash, locate the failing file from the stack trace and fix it.

After applying the fix:
1. Create a new branch: git checkout -b fix/railway-auto-$(date +%Y%m%d-%H%M%S)
2. Stage and commit the fix: git add -A && git commit -m "fix: auto-fix Railway deployment failure"
3. Confirm the branch name in your output.
```

### 7. Add Step 5 — Push branch (Command)

Click **+ Add Step** → **Command**

**Name:** `Push fix branch`

**Command:**
```bash
set -euo pipefail
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" == fix/railway-auto-* ]]; then
  git push origin "$BRANCH"
  echo "Pushed branch: $BRANCH"
else
  echo "ERROR: Not on a fix branch. Expected fix/railway-auto-*. Got: $BRANCH"
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

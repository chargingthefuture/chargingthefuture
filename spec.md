# Spec: Unified Secrets + Autonomous Railway Debug Loop

## Problem Statement

Development and deployment are fragmented across three systems with no shared context:

- **Secrets** live in two places: GitHub Actions encrypted secrets and Railway dashboard. Ona environments have none of them, so agents operating in Ona cannot authenticate to any external service, validate environment contracts, or reproduce deployment failures locally.
- **Railway failures** are invisible to agents. When a deploy fails, the debug loop is manual: read GitHub Actions logs in the browser, read Railway dashboard logs separately, copy error text into an agent prompt, apply a fix, push, wait for CI, repeat.
- **No autonomous recovery path exists.** There is no mechanism for an agent to detect a Railway failure, diagnose it, fix the code, and redeploy without human copy-paste at each step.

The goal is to eliminate this context-switching loop by: (1) making all secrets available inside Ona environments, and (2) building an Ona Automation that triggers on Railway deployment failures, diagnoses the cause using the Railway CLI, fixes the code, and pushes a branch that triggers the existing GitHub Actions → Railway pipeline.

---

## Current State

| Component | Current location | Agent visibility |
|---|---|---|
| `RAILWAY_TOKEN` | GitHub Actions secrets | ❌ None |
| `DATABASE_URL` (staging + prod) | GitHub Actions secrets | ❌ None |
| Auth keys (`AUTH_*`, `CLERK_*`) | GitHub Actions secrets | ❌ None |
| Stream, Sentry, Formance keys | GitHub Actions secrets | ❌ None |
| Railway service env vars | Railway dashboard | ❌ None |
| Railway CLI | Installed in Ona via `setup` task | ✅ Available but unauthenticated |
| Deploy pipeline | `deploy-backend-railway.yml` (GH Actions) | ✅ Triggered by push |

---

## Requirements

### R1 — Secret Inventory and Documentation

Produce a complete, authoritative list of every secret that must exist in Ona project secrets, derived from:
- `ctf/packages/web/.env.local.example` (the canonical env contract)
- `deploy-backend-railway.yml` (secrets consumed by CI)
- `railway.toml` (build/start commands that depend on env vars)

The list must cover all three deployment environments: staging Railway, staging Vercel, production Railway.

### R2 — Ona Project Secrets Setup Guide

Produce a step-by-step guide for adding all secrets to the Ona project (Settings → Project → Secrets). The guide must:
- Group secrets by scope (project-level vs. user-level)
- Specify exact secret names matching `.env.local.example` — no renaming
- Note which secrets are shared across environments vs. environment-specific
- Include instructions for creating a Railway API token (scoped to the project)

### R3 — Railway Debug Task in `automations.yaml`

Add a new on-demand task `railway-debug` to `.ona/automations.yaml` that:
- Requires `RAILWAY_TOKEN` to be set (fails fast with a clear message if not)
- Fetches the last 200 lines of Railway logs for the failing service
- Writes logs to a file the agent can read (`/tmp/railway-debug.log`)
- Prints a structured summary: exit code, last error line, service name, environment

### R4 — Railway Deploy Task in `automations.yaml`

Add a new on-demand task `railway-redeploy` to `.ona/automations.yaml` that:
- Validates `RAILWAY_TOKEN` is set
- Runs `railway up --ci` from the `ctf/` directory
- Captures exit code and surfaces pass/fail clearly

### R5 — Ona Automation: Autonomous Railway Failure Recovery

Create an Ona Automation (configured via the Ona UI, documented in the spec) that:

**Trigger:** Manual — run on demand when a Railway deployment fails. (Ona webhooks only accept SCM pull request events, not arbitrary HTTP POSTs from GitHub Actions. The trigger is therefore manual, not automated via CI.)

**Steps (in order):**
1. **Command**: Run `railway-debug` task — fetch logs from the failing deployment
2. **Prompt**: Agent reads the logs and identifies the root cause. Classifies failure as one of: build error, missing env var, runtime crash, schema drift, or unknown.
3. **Command**: If classification is `missing env var` → halt and report (cannot fix without human adding the secret). Otherwise continue.
4. **Prompt**: Agent applies a targeted code fix to the identified failure. Commits to a new branch `fix/railway-auto-<timestamp>`.
5. **Command**: Push branch to GitHub.
6. **Pull Request**: Open a draft PR with the fix summary and Railway log excerpt. The push triggers the existing `deploy-backend-railway.yml` pipeline automatically.

### R6 — GitHub Actions Failure Notification Step

Add a failure-notification step to `deploy-backend-railway.yml` in the `railway-deploy` job that:
- Fires only when the job fails (`if: failure()`)
- Uses `gh` CLI (already available via the `github-cli` devcontainer feature) to create a GitHub issue titled `Railway deploy failed: <branch> @ <sha>` with the job URL and failure context
- Labels the issue `railway-failure` so it's filterable
- This gives the agent a persistent, searchable record of failures to act on when the Automation is run manually

### R7 — AGENTS.md at Repo Root

Create `AGENTS.md` at the repository root that gives agents the minimum context needed to operate in this repo without reading all 40+ instruction files. Must cover:
- Monorepo layout (what lives where)
- The three deployment environments and their secret prefixes
- How to run Railway CLI commands (token required, `cd ctf/` first)
- Where the canonical env contract lives (`.env.local.example`)
- Pointer to `.github/instructions/` for detailed rules

---

## Acceptance Criteria

- [ ] A complete secret inventory document exists listing every secret name, its scope, and which environment it belongs to
- [ ] `RAILWAY_TOKEN` exists as an Ona project secret (verified by running `echo $RAILWAY_TOKEN` in an Ona environment)
- [ ] `railway status` runs successfully inside an Ona environment without manual token input
- [ ] `railway-debug` task in `automations.yaml` runs and produces a readable log file
- [ ] `railway-redeploy` task in `automations.yaml` runs and deploys to Railway staging
- [ ] Ona Automation exists with manual trigger, 5-step recovery workflow
- [ ] `deploy-backend-railway.yml` has an `if: failure()` step that opens a `railway-failure` GitHub issue on `railway-deploy` job failure
- [ ] `AGENTS.md` exists at repo root and covers all 5 required topics
- [ ] No secret values are committed to the repository

---

## Implementation Approach

Steps are ordered by dependency. Steps 1–3 are manual (require human action in external dashboards). Steps 4–8 are code changes made by the agent.

### Step 1 — Create Railway API Token (manual)
In the Railway dashboard: Account Settings → Tokens → New Token. Scope to the `chargingthefuture` project. Copy the token value.

### Step 2 — Add Secrets to Ona Project (manual)
Using the secret inventory produced in Step 4, add each secret to: Ona dashboard → Project → Settings → Secrets. Add `RAILWAY_TOKEN` first to unblock agent tasks.

### Step 3 — Create `railway-failure` Issue Label in GitHub (manual)
In the GitHub repository: Issues → Labels → New label. Name: `railway-failure`, color: red. This label is used by the failure notification step added in Step 6.

### Step 4 — Produce Secret Inventory Document
Agent generates `docs/ona-secrets-inventory.md` inside `ctf/` listing every secret name, environment scope, and source file reference. This is the reference document for Step 2.

### Step 5 — Add `railway-debug` and `railway-redeploy` Tasks
Agent edits `.ona/automations.yaml` to add both tasks with proper token validation, log capture, and clear output.

### Step 6 — Add Failure Notification Step to `deploy-backend-railway.yml`
Agent edits the `railway-deploy` job to add an `if: failure()` step that uses `gh issue create` to open a `railway-failure`-labeled issue with branch, SHA, and job URL.

### Step 7 — Create Ona Automation (manual, documented)
Agent produces `docs/ona-automation-setup.md` with exact UI steps to create the webhook-triggered automation in the Ona dashboard, including the 5-step workflow configuration.

### Step 8 — Create `AGENTS.md`
Agent creates `AGENTS.md` at the repository root covering the 5 required topics.

---

## Files Changed

| File | Action |
|---|---|
| `.ona/automations.yaml` | Add `railway-debug` and `railway-redeploy` tasks |
| `.github/workflows/deploy-backend-railway.yml` | Add failure webhook notification step |
| `ctf/docs/ona-secrets-inventory.md` | New — complete secret inventory |
| `ctf/docs/ona-automation-setup.md` | New — Ona Automation UI setup guide |
| `AGENTS.md` | New — agent context for repo root |

---

## Constraints

- Secret values must never be committed. Only secret names and scopes go in documentation.
- Secret names must match `.env.local.example` exactly — no renaming (per rule `123-environment-configuration-rules.mdc`).
- Railway CLI commands must be run from `ctf/` directory (per `railway.toml` location).
- The autonomous fix path must halt and report (not guess) when the failure is a missing env var — those require human action.
- The existing GitHub Actions → Railway pipeline is not replaced. The Ona Automation feeds back into it via PR push.

# GitHub Actions — what each workflow does

A plain-language index of every workflow in this folder, so you don't have to open each
file to remember what it does. One row per `.yml` file, sorted by filename. When you add,
remove, or rename a workflow, update this table in the same change.

**Naming convention:** a workflow's display `name:` reads `<Service or category> — <What it does>`
— service/category first, then a spaced em dash, then a short Title Case description (e.g.
`Expo — Android Release`, `Neon — Create Branch`). Leading with the service groups related
workflows together in the Actions tab. Full rule:
[`119-github-actions-ci-rules.mdc`](../instructions/119-github-actions-ci-rules.mdc).

## "Render — Deploy Re-fresh" vs "Render — Build and push Docker images" — are they the same?

No — they are **two separate workflows**, but they work together:

- **`build-images.yml`** ("Render — Build and push Docker images") builds the container images
  (`ctf-web`, `ctf-formance-ledger`, `ctf-route-weather`) and pushes them to the GitHub
  Container Registry. Right after pushing each image it runs a "Trigger Render deploy" step
  (`.github/scripts/render-deploy.sh`) that tells Render to roll out the image it just built.
  This runs automatically on a push to `main` (and can be run by hand).
- **`render-deploy.yml`** ("Render — Deploy Re-fresh") is a **manual-only** redeploy. It does **not**
  rebuild anything — it tells Render to re-pull the existing `…:latest` image already in the
  registry (and pick up any new environment variables). Use it when you want to redeploy
  without a code change.

So the normal path is: push to `main` → `build-images.yml` builds + pushes the image → it
automatically triggers a Render deploy. `render-deploy.yml` is the separate "just redeploy
the current image" button for when there's nothing new to build.

There is also **`render-deploy-watch.yml`** ("Render — Watch Deploy"), which only *watches* a
deploy's status (live or failed) — it does not build or deploy anything itself.

## Every workflow

| File | Name (shown in the Actions tab) | When it runs | What it does |
|---|---|---|---|
| `backup-formance.yml` | Formance — Nightly Backup to Private Repo | Daily 3:00 AM UTC; manual | Backs up the Formance Postgres database with `pg_dump` and uploads the dump as a Release asset on a private backup repo. |
| `bug-reports-build.yml` | Bug Reports — Open PR for Approved Fix | Manual | Uses Claude to build an owner-approved bug fix from the private triage repo, runs typecheck, and opens a PR. |
| `bug-reports-create-issues.yml` | Bug Reports — Create Github Issues | Every 15 min; manual | Moves clean, user-filed bug reports from the app database into the private triage repo as issues (text redacted). |
| `bug-reports-triage.yml` | Bug Reports — Triage | Every 30 min; manual | Looks at open `needs-triage` issues and posts a proposed fix plan — no code, no PR. |
| `build-images.yml` | Render — Build and push Docker images | Push to `main` (code paths); manual | Builds the `ctf-web`, `ctf-formance-ledger`, `ctf-route-weather` images, pushes them to the registry, then triggers a Render deploy for each. |
| `ci.yml` | CI | Push to `main`; all PRs to `main` | The main pull-request gate: rules checks, plugin contracts, end-of-file formatting, modularity limits, secret-leak guard, schema-drift gate, parity status, lint, typecheck, and the web/Android builds. |
| `cleanup-artifacts.yml` | Cleanup — Old Artifacts and Close CI Budget Issues | Daily 2:00 AM UTC; manual | Deletes build artifacts older than a day and closes any open CI-budget issues. |
| `cleanup-workflow-runs.yml` | Cleanup — Deprecated Workflow Runs | Manual | One-off cleanup that deletes Actions runs belonging to workflow files that no longer exist, to tidy the Actions sidebar. |
| `code-review-implement.yml` | Code Review — Open PR for Actionable Finding | After the sweep finishes (workflow_run); manual | Uses Claude to implement one `code-review:actionable` finding, runs typecheck, opens a PR labelled `code-review:auto-pr`, and enables auto-merge. Opens at most one auto PR at a time (skips while one is still open). The "actionable finding → PR" half of the incremental review pipeline. |
| `code-review-pr-babysitter.yml` | Code Review — Keep the Auto PR Moving | About every 20 min; manual | Tends the single open `code-review:auto-pr`: updates its branch when behind main, and dispatches Claude to resolve a real merge conflict — so an auto-merge PR can't sit stuck. No-op when no auto PR is open. |
| `code-review-sweep.yml` | Code Review — Sweep and File Issues | Daily 06:23 UTC; manual | Reviews one plugin (all its layers together) or one standalone module per run and files `code-review` issues for the findings, rotating through the codebase via a ledger. Files issues only — never writes code. |
| `create-neon-branch.yml` | Neon — Create Branch | Manual | Creates a fresh Postgres branch in Neon (e.g. a clean clone of production) for migration testing, without printing connection strings. |
| `deploy-blog-gh-pages.yml` | Github Pages — Deploy Blog | Manual; or signalled by the product-update workflow | Builds the external blog/wiki site and publishes it to GitHub Pages. |
| `expo-android-release.yml` | Expo — Android Release | On `mobile-v*` tags; manual | Builds a signed production Android APK with Expo EAS and attaches it to a GitHub Release. |
| `expo-android-scheduled-build.yml` | Expo — Scheduled Android Test Build | Mon/Wed/Fri 08:41 UTC; manual | Hands-free `preview` Android test build. Checks the free-tier quota first (skips when this month's automated budget is used) so the 15-builds/month allotment is never overspent; if the build fails, a Claude agent opens a fix branch and PR. |
| `expo-preview.yml` | Expo — Preview APK | Mobile PRs labelled `build-apk`; manual | Builds a preview Android APK for a mobile PR (opt-in via label to save free-tier builds) and posts an install link. |
| `expo-update.yml` | Expo — OTA Update | Push to `main` touching mobile code | Publishes a JavaScript/asset-only over-the-air update via EAS Update — no native rebuild; installed apps pick it up on next launch. |
| `generate-community-stats.yml` | Generate — Community Stats Draft | Mondays 14:00 UTC; manual | Reads privacy-safe whole-community counts (open SocketRelay posts, Directory profiles and skills), drafts a Quora post with Claude, and files it as an issue for review. |
| `generate-product-update.yml` | Generate — Product Update | Weekly (Thursdays 00:33 UTC); manual | Turns recent feat/fix/perf commits into a product update: publishes to the wiki, the blog registry, and the in-app feed, files a Quora draft issue, and tags the update. |
| `github-actions-billing-token-reminder.yml` | GitHub Actions — Billing Token Rotation Reminder | Mondays 12:00 UTC; manual | Files a reminder issue every ~45 days to rotate the Actions billing token, with a runbook checklist. |
| `github-actions-budget-monitor.yml` | GitHub Actions — Budget Monitor | Every 6 hours; manual | Checks Actions usage (minutes, artifact storage, cache) against budgets, posts a report issue, and closes the rotation reminder when usage is healthy. |
| `inspect-schema-drift.yml` | Inspect — Schema Drift (read-only) | Manual | Read-only report of tables and foreign keys whose types differ from the v3 canonical schema, plus Directory health counts — used for migration planning. |
| `pr-title-semantic.yml` | PR Title Semantic | On PRs (open/edit) | Checks that the PR title starts with a Conventional Commit prefix (`feat:`, `fix:`, `chore:`, …). |
| `provision-demo-schema.yml` | Neon — Provision Demo Schema | Manual | Regenerates `schema.demo.sql` from `schema.sql` and loads it into the Neon demo database. |
| `render-debug-agent.yml` | Render — Debug Agent | Manual | Pulls logs from a Render service, diagnoses errors, and opens a PR with proposed fixes. |
| `render-deploy-watch.yml` | Render — Watch Deploy | Push to `main`; manual | Watches the Render API for the current commit's deploy and polls until it is live or failed. Does not build or deploy. |
| `render-deploy.yml` | Render — Deploy Re-fresh (not an image rebuild) | Manual (pick a service) | Redeploys a Render service **without rebuilding** — re-pulls the existing `…:latest` image and picks up new environment variables. |
| `restore-formance.yml` | Formance — Restore from Private Repo | Manual (optional release tag / asset filename) | Restores a Formance `pg_dump` backup (a Release asset on the private backup repo) into a target database for disaster recovery or a fresh environment. |
| `route-weather-briefing.yml` | Route Weather Briefing | Daily 10:00 UTC; manual | Builds a plain-text weather report for a set route and sends it to a phone via `ntfy.sh`. |
| `security-compliance.yml` | Security and Compliance | Push/PRs to `main` (code paths); Mondays 4:30 AM UTC; manual | Runs dependency review on PRs, `gitleaks` secret scanning, and collects compliance-rule artifacts. |
| `security-findings-triage.yml` | Security — Findings Triage | Mondays 13:00 UTC; manual | Reads the repo's open Dependabot (malware + vulnerabilities), code scanning (CodeQL), and secret-scanning alerts and writes one always-current triage issue in the private triage repo (never prints secret values). |
| `seed-demo.yml` | Demo — Seed Schema | Manual (demo owner id) | Regenerates the demo schema, brings the demo database up to date, and runs the demo seed script for a given user. |
| `skills-proposal-issues.yml` | Skills Hunt — Propose Skill Promotions | Every 6 hours at :17; manual | Turns free-text "proposed" skills from accepted Skills Hunt nominations into GitHub issues proposing they join the canonical taxonomy, with an AI-suggested sector + occupation. Only files issues — never writes the taxonomy. |
| `unlock-reward-reconciliation.yml` | Unlock — Reward Reconciliation | Hourly at :17; manual | Self-heals missed Unlock approval rewards by minting any pending ServiceCredits rewards (safe to repeat). |
| `update-neon-db.yml` | Neon — Update DB (Migrations + schema.sql) | Push to `main` touching schema/migrations; manual | Applies pre-schema migrations, the canonical `schema.sql`, then post-schema migrations to the Neon database in order (all safe to repeat). |
| `workflow-health-check.yml` | Github Actions — Workflow Health Check | Every 8 hours; manual | Checks each active workflow's most recent run on `main`, collects failures into one always-current triage issue, and closes it when everything is green. |

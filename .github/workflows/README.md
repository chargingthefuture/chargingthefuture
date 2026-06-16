# GitHub Actions — what each workflow does

A plain-language index of every workflow in this folder, so you don't have to open each
file to remember what it does. One row per `.yml` file, sorted by filename. When you add,
remove, or rename a workflow, update this table in the same change.

## "Render deploy" vs "Build and push Docker images" — are they the same?

No — they are **two separate workflows**, but they work together:

- **`build-images.yml`** ("Build and push Docker images") builds the container images
  (`ctf-web`, `ctf-formance-ledger`, `ctf-route-weather`) and pushes them to the GitHub
  Container Registry. Right after pushing each image it runs a "Trigger Render deploy" step
  (`.github/scripts/render-deploy.sh`) that tells Render to roll out the image it just built.
  This runs automatically on a push to `main` (and can be run by hand).
- **`render-deploy.yml`** ("Render deploy") is a **manual-only** redeploy. It does **not**
  rebuild anything — it tells Render to re-pull the existing `…:latest` image already in the
  registry (and pick up any new environment variables). Use it when you want to redeploy
  without a code change.

So the normal path is: push to `main` → `build-images.yml` builds + pushes the image → it
automatically triggers a Render deploy. `render-deploy.yml` is the separate "just redeploy
the current image" button for when there's nothing new to build.

There is also **`render-deploy-watch.yml`** ("Render Deploy Watch"), which only *watches* a
deploy's status (live or failed) — it does not build or deploy anything itself.

## Every workflow

| File | Name (shown in the Actions tab) | When it runs | What it does |
|---|---|---|---|
| `backup-formance-supabase.yml` | Backup Formance to Supabase | Daily 3:00 AM UTC; manual | Backs up the Formance Postgres database to Supabase storage with `pg_dump`. |
| `bug-reports-build.yml` | Bug Reports — Build Approved Fix | Manual | Uses Claude to build an owner-approved bug fix from the private triage repo, runs typecheck, and opens a PR. |
| `bug-reports-create-issues.yml` | Bug Reports — Create Triage Issues | Every 15 min; manual | Moves clean, user-filed bug reports from the app database into the private triage repo as issues (text redacted). |
| `bug-reports-triage.yml` | Bug Reports — Triage | Every 30 min; manual | Looks at open `needs-triage` issues and posts a proposed fix plan — no code, no PR. |
| `build-images.yml` | Build and push Docker images | Push to `main` (code paths); manual | Builds the `ctf-web`, `ctf-formance-ledger`, `ctf-route-weather` images, pushes them to the registry, then triggers a Render deploy for each. |
| `ci.yml` | CI | Push to `main`; all PRs to `main` | The main pull-request gate: rules checks, plugin contracts, end-of-file formatting, modularity limits, secret-leak guard, schema-drift gate, parity status, lint, typecheck, and the web/Android builds. |
| `cleanup-artifacts.yml` | Cleanup Old Artifacts and Close CI Budget Issues | Daily 2:00 AM UTC; manual | Deletes build artifacts older than a day and closes any open CI-budget issues. |
| `cleanup-workflow-runs.yml` | Cleanup deprecated workflow runs | Manual | One-off cleanup that deletes Actions runs belonging to workflow files that no longer exist, to tidy the Actions sidebar. |
| `coderabbit-review.yml` | CodeRabbit Review | PRs to `main` (not drafts) | Runs the CodeRabbit AI reviewer on non-draft PRs. |
| `create-neon-branch.yml` | Create Neon branch | Manual | Creates a fresh Postgres branch in Neon (e.g. a clean clone of production) for migration testing, without printing connection strings. |
| `deploy-blog-gh-pages.yml` | Deploy Blog to GitHub Pages | Manual; or signalled by the product-update workflow | Builds the external blog/wiki site and publishes it to GitHub Pages. |
| `expo-android-release.yml` | Expo Android Release | On `mobile-v*` tags; manual | Builds a signed production Android APK with Expo EAS and attaches it to a GitHub Release. |
| `expo-preview.yml` | Expo Preview APK | Mobile PRs labelled `build-apk`; manual | Builds a preview Android APK for a mobile PR (opt-in via label to save free-tier builds) and posts an install link. |
| `expo-update.yml` | Expo Update (OTA) | Push to `main` touching mobile code | Publishes a JavaScript/asset-only over-the-air update via EAS Update — no native rebuild; installed apps pick it up on next launch. |
| `generate-community-stats.yml` | Generate Community Stats Draft | Mondays 14:00 UTC; manual | Reads privacy-safe whole-community counts (open SocketRelay posts, Directory profiles and skills), drafts a Quora post with Claude, and files it as an issue for review. |
| `generate-product-update.yml` | Generate Product Update | Every 8 hours; manual | Turns recent feat/fix/perf commits into a product update: publishes to the wiki, the blog registry, and the in-app feed, files a Quora draft issue, and tags the update. |
| `github-actions-billing-token-reminder.yml` | GitHub Actions Billing Token Rotation Reminder | Mondays 12:00 UTC; manual | Files a reminder issue every ~45 days to rotate the Actions billing token, with a runbook checklist. |
| `github-actions-budget-monitor.yml` | GitHub Actions Budget Monitor | Every 6 hours; manual | Checks Actions usage (minutes, artifact storage, cache) against budgets, posts a report issue, and closes the rotation reminder when usage is healthy. |
| `inspect-schema-drift.yml` | Inspect schema drift (read-only) | Manual | Read-only report of tables and foreign keys whose types differ from the v3 canonical schema, plus Directory health counts — used for migration planning. |
| `pace-coderabbit-reviews.yml` | Pace CodeRabbit reviews | Hourly at :17; manual | Promotes the single oldest `coderabbit`-labelled draft PR to ready-for-review once an hour (if its checks are green), to stay within CodeRabbit's free-tier limit. |
| `pr-title-semantic.yml` | PR Title Semantic | On PRs (open/edit) | Checks that the PR title starts with a Conventional Commit prefix (`feat:`, `fix:`, `chore:`, …). |
| `provision-demo-schema.yml` | Provision demo schema in Neon | Manual | Regenerates `schema.demo.sql` from `schema.sql` and loads it into the Neon demo database. |
| `render-debug-agent.yml` | Render Debug Agent | Manual | Pulls logs from a Render service, diagnoses errors, and opens a PR with proposed fixes. |
| `render-deploy-watch.yml` | Render Deploy Watch | Push to `main`; manual | Watches the Render API for the current commit's deploy and polls until it is live or failed. Does not build or deploy. |
| `render-deploy.yml` | Render deploy | Manual (pick a service) | Redeploys a Render service **without rebuilding** — re-pulls the existing `…:latest` image and picks up new environment variables. |
| `restore-formance-supabase.yml` | Restore Formance from Supabase | Manual (optional backup filename) | Restores a Formance `pg_dump` backup into a target database for disaster recovery or a fresh environment. |
| `route-weather-briefing.yml` | Route weather briefing | Daily 10:00 UTC; manual | Builds a plain-text weather report for a set route and sends it to a phone via `ntfy.sh`. |
| `security-compliance.yml` | Security and Compliance | Push/PRs to `main` (code paths); Mondays 4:30 AM UTC; manual | Runs dependency review on PRs, `gitleaks` secret scanning, and collects compliance-rule artifacts. |
| `seed-demo.yml` | Seed demo schema | Manual (demo owner id) | Regenerates the demo schema, brings the demo database up to date, and runs the demo seed script for a given user. |
| `unlock-reward-reconciliation.yml` | Unlock reward reconciliation | Hourly at :17; manual | Self-heals missed Unlock approval rewards by minting any pending ServiceCredits rewards (safe to repeat). |
| `update-neon-db.yml` | Update Neon DB (migrations + schema.sql) | Push to `main` touching schema/migrations; manual | Applies pre-schema migrations, the canonical `schema.sql`, then post-schema migrations to the Neon database in order (all safe to repeat). |
| `workflow-health-check.yml` | Workflow Health Check | Every 8 hours; manual | Checks each active workflow's most recent run on `main`, collects failures into one always-current triage issue, and closes it when everything is green. |

## Names worth making clearer (optional, future)

A few names don't say what the workflow produces. If you rename them, update the `name:` field,
this table, and any branch-protection rule that references the check name:

- `pace-coderabbit-reviews.yml` — "Pace CodeRabbit reviews" → e.g. "Promote oldest CodeRabbit draft (hourly)".
- `render-debug-agent.yml` — "Render Debug Agent" → e.g. "Render error diagnosis + fix PR".
- `route-weather-briefing.yml` — "Route weather briefing" → e.g. "Daily route weather phone alert".
- `generate-product-update.yml` — "Generate Product Update" → e.g. "Publish product update (wiki + blog + feed + Quora draft)".

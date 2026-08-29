# GitHub Actions — what each workflow does

A plain-language index of every workflow in this folder, so you don't have to open each
file to remember what it does. One row per `.yml` file, sorted by filename. When you add,
remove, or rename a workflow, update this table in the same change.

**Naming convention:** a workflow's display `name:` reads `<Service or category> — <What it does>`
— service/category first, then a spaced em dash, then a short Title Case description (e.g.
`Expo — Android Release`, `Neon — Create Branch`). Leading with the service groups related
workflows together in the Actions tab. Full rule:
[`119-github-actions-ci-rules.mdc`](../instructions/119-github-actions-ci-rules.mdc).

## The triage issue carries each failure's actual error

`workflow-health-check.yml` collects failing workflows into one triage issue. Each entry names the job
and step that failed and includes an excerpt of what that run actually printed, in a collapsed
"What it said" block — so an agent session picking the issue up can tell whether an entry is worth
working or dismissing without opening the logs first.

The excerpt is pulled from the failing job's log and anchored on the first `##[error]` line that says
something (`Process completed with exit code 1` is the runner's boilerplate, not a reason), keeping the
lines around it — which is where a script prints why it gave up. Post-job cleanup output is dropped,
lines and totals are capped so one noisy failure cannot bury the rest, and the text is scrubbed for
credential shapes before it goes into what is a public issue. If a log cannot be read (they expire) the
entry still lists, just without the excerpt.

**What this asks of a workflow: print the reason before you exit.** A script should say which step
failed and why (rule 137 covers this and CI enforces it for app code); a shell step should `echo` a
reason before `exit 1`. A failure whose log says only "exit code 1" produces an entry nobody can
triage without opening it, which is the situation this replaced.

## When a red run is not a defect: `CTF_RUN_BLOCKED_EXTERNAL`

Some workflows call a paid API. This project funds its APIs some months and not others, so those
workflows are red for long stretches by design — nothing is broken, there is just no credit to spend.

That matters because of `workflow-health-check.yml`, which sweeps every workflow every 8 hours and
collects the failing ones into a single triage issue. Left alone, one unfunded workflow keeps that
issue open for as long as the account stays unfunded, and every agent that picks the issue up goes
hunting for a bug in a pipeline that is working exactly as written.

So a run can say for itself that its failure is not a defect. Print a GitHub Actions error annotation
whose text contains `CTF_RUN_BLOCKED_EXTERNAL:<reason>`:

```js
console.log(`::error title=Skill proposals paused — the account is out of credit (not a code failure).::… [CTF_RUN_BLOCKED_EXTERNAL:no_credit]`);
```

The health check reads the annotations of every run it finds failing. A run carrying the marker is
listed under "Paused, not broken — no ticket, no fix" and does **not** open or hold open the triage
issue. The run itself stays red — that is still the signal that the workflow is not doing its job.

Rules for claiming it:

- **Only for a state outside this repo**: no funds on a paid API, a revoked or missing key, the vendor
  erroring or rate-limiting. Nothing that a code change would fix.
- **Never for a failure you cannot explain.** An unrecognized error is a defect until proven otherwise
  — leave the marker off so it stays on the triage list. Claiming it wrongly is worse than not
  claiming it at all: it hides a real break, and it teaches the next reader to distrust the label.
- **Say the reason in plain words too**, in the same annotation, for whoever reads the run page.

Worked example: `ctf/scripts/proposeSkillPromotions.mjs` — it maps the vendor's own machine-readable
error type to a named state and only marks the states that are genuinely outside the repo.

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
| `check-stream-env.yml` | Check — Stream Credentials | Manual | Diagnostic: verifies each Stream (GetStream) API key/secret pair actually authenticates (production and staging), for when a Stream-backed feature fails even though keys look present in Infisical. |
| `ci.yml` | CI | Push to `main`; all PRs to `main` | The main pull-request gate: rules checks, plugin contracts, end-of-file formatting, modularity limits, secret-leak guard, schema-drift gate, parity status, lint, typecheck, and the web/Android builds. |
| `cleanup-artifacts.yml` | Cleanup — Old Artifacts and Close CI Budget Issues | Daily 2:00 AM UTC; manual | Deletes build artifacts older than a day and closes any open CI-budget issues. |
| `cleanup-workflow-runs.yml` | Cleanup — Deprecated Workflow Runs | Manual | One-off cleanup that deletes Actions runs belonging to workflow files that no longer exist, to tidy the Actions sidebar. |
| `code-review-implement.yml` | Code Review — Open PR for Actionable Finding | After the sweep finishes (workflow_run); manual | Uses Claude to implement one `code-review:actionable` finding, runs typecheck, opens a PR labeled `code-review:auto-pr`, and enables auto-merge. Opens at most one auto PR at a time (skips while one is still open). The "actionable finding → PR" half of the incremental review pipeline. |
| `code-review-pr-babysitter.yml` | Code Review — Keep the Auto PR Moving | About every 20 min; manual | Tends the single open `code-review:auto-pr`: updates its branch when behind main, and dispatches Claude to resolve a real merge conflict — so an auto-merge PR can't sit stuck. No-op when no auto PR is open. |
| `code-review-sweep.yml` | Code Review — Sweep and File Issues | Daily 06:23 UTC; manual | Reviews one plugin (all its layers together) or one standalone module per run and files `code-review` issues for the findings, rotating through the codebase via a ledger. Files issues only — never writes code. |
| `contributor-access-recompute.yml` | Contributor Access — Eligibility Recompute | Mondays 06:30 UTC; manual | Recomputes Contributor Access eligibility via the app's internal recompute route. Additive only: admits newly-qualified members, never revokes on signal decay. |
| `create-neon-branch.yml` | Neon — Create Branch | Manual | Creates a fresh Postgres branch in Neon (e.g. a clean clone of production) for migration testing, without printing connection strings. |
| `dependency-audit.yml` | Dependency Audit | Daily; dependency-change PRs; manual | Compares the locked production dependency tree against published security advisories via the burn-down allowlist; red on any new advisory. |
| `delete-account.yml` | Delete Account (manual) | Manual (Clerk user id, typed twice) | Deletes one user's account and all their app data (deletion-registry driven), by default including the Clerk identity — for clearing duplicate accounts. Irreversible; wallets/ledgers are settled by the ServiceCredits reclaim flow. |
| `deploy-blog-gh-pages.yml` | Github Pages — Deploy Blog | Manual; or signalled by the product-update workflow | Builds the external blog/wiki site and publishes it to GitHub Pages. |
| `expo-android-release.yml` | Expo — Android Release | On `mobile-v*` tags; manual | Builds a signed production Android APK with Expo EAS and attaches it to a GitHub Release. |
| `expo-android-scheduled-build.yml` | Expo — Scheduled Android Test Build | Mon/Wed/Fri 08:41 UTC; manual | Hands-free `preview` Android test build. Checks the free-tier quota first (skips when this month's automated budget is used) so the 15-builds/month allotment is never overspent; if the build fails, a Claude agent opens a fix branch and PR. |
| `expo-preview.yml` | Expo — Preview APK | Mobile PRs labeled `build-apk`; manual | Builds a preview Android APK for a mobile PR (opt-in via label to save free-tier builds) and posts an install link. |
| `expo-update.yml` | Expo — OTA Update | Push to `main` touching mobile code | Publishes a JavaScript/asset-only over-the-air update via EAS Update — no native rebuild; installed apps pick it up on next launch. |
| `generate-community-stats.yml` | Generate — Community Stats Draft | Mondays 14:00 UTC; manual | Reads privacy-safe whole-community counts (open SocketRelay posts, Directory profiles and skills, ServiceCredits aggregates, and the real + projected Community Value Index figures), drafts a Quora post with Claude, and files it as an issue for review. |
| `generate-product-update.yml` | Generate — Product Update | Weekly (Thursdays 00:33 UTC); manual | Turns recent feat/fix/perf commits into a product update: publishes to the wiki, the blog registry, and the in-app feed, files a Quora draft issue, and tags the update. |
| `generate-user-guide.yml` | User Guide — Regenerate | Mondays 06:00 UTC; manual | Regenerates the public user guide (`/guide` + `docs/USER_GUIDE.md`) from each plugin's inventory Intent and Outcome statement and User Features section, plus its test-script Core smoke steps, via `ctf/scripts/generate-user-guide.mjs`. |
| `github-actions-billing-token-reminder.yml` | GitHub Actions — Billing Token Rotation Reminder | Mondays 12:00 UTC; manual | Files a reminder issue every ~45 days to rotate the Actions billing token, with a runbook checklist. |
| `github-actions-budget-monitor.yml` | GitHub Actions — Budget Monitor | Every 6 hours; manual | Checks Actions usage (minutes, artifact storage, cache) against budgets, posts a report issue, and closes the rotation reminder when usage is healthy. |
| `import-comic-knowledge-2.yml` | Comic Knowledge — One-Time Seed Import 2 (production) | Manual | One-time, idempotent load of the second Quora-account export (`comic-knowledge-seed-2.jsonl`) into the `comic_knowledge_entries` table in production. |
| `inspect-schema-drift.yml` | Schema — Check for Drift (read-only) | Manual | Read-only report of tables and foreign keys whose types differ from the v3 canonical schema, plus Directory health counts — used for migration planning. |
| `skill-up-auto-cohorts.yml` | SkillUp — Auto Cohorts from Workforce Gaps | Daily 05:23 UTC; manual | Closes expired SkillUp auto cohorts and periodically refreshes the ranked cohort-proposal queue from Workforce talent gaps. Proposes only — an admin approves a proposal to open a cohort. |
| `manual-test-script.yml` | Manual Test Script — Generate on Demand | Manual (one plugin, a diff base, or all) | Regenerates manual test scripts via `ctf/scripts/generateManualTestScript.mjs` and opens a low-risk auto-merging PR with the result. |
| `monthly-backup-restore-test-reminder.yml` | Monthly — Backup & Restore Test Reminder | 1st of each month 09:00 UTC; manual | Opens an issue reminding the owner to manually test every backup system's backup and restore paths (list: `ctf/ops/backup-systems.json`). |
| `peer-programming-weekly-assignment.yml` | Peer Programming — Weekly Cohort Assignment | Mondays 06:07 UTC; manual | Runs the weekly Peer Programming cohort assignment on production so cohorts form without an admin clicking the button. Idempotent per (week, label). |
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
| `seed-skills-taxonomy.yml` | Skills Taxonomy — Apply Changes (production) | Manual | Applies the append-only taxonomy change list to the live production taxonomy via `ctf/scripts/seedSkillsTaxonomy.mjs` — the only path that writes the taxonomy from the repo. Idempotent; no hard deletes. |
| `service-credits-reclaim-sweep.yml` | ServiceCredits — Account-Deletion Reclaim Sweep | Daily 04:20 UTC; manual | Drains queued post-deletion ServiceCredits reclaims to treasury once each account's 7-day grace window elapses. Idempotent. |
| `skills-proposal-issues.yml` | Skills Hunt — Propose Skill Promotions | Every 6 hours at :17; manual | Turns free-text "proposed" skills from accepted Skills Hunt nominations into GitHub issues proposing they join the canonical taxonomy, with an AI-suggested sector + occupation. Only files issues — never writes the taxonomy. |
| `stream-gated-channel-type-setup.yml` | Stream — Gated Channel Type Setup | Manual (production or staging) | One-time (re-runnable) setup of the `ctf-gated` Stream channel type used by the gated contributor channel; run once per Stream app. Never prints a secret. |
| `unit-tests.yml` | Unit Tests (non-blocking) | Push to `main` (scoped paths); daily 07:41 UTC; manual | Runs the scoped unit-test suites (ServiceCredits amounts, economic-models, trust evidence) and files a `test-failure` issue on failure. Deliberately not a PR check — it never blocks a merge. |
| `unlock-reward-reconciliation.yml` | Unlock — Reward Reconciliation | Hourly at :17; manual | Self-heals missed Unlock approval rewards by minting any pending ServiceCredits rewards (safe to repeat). |
| `update-neon-db.yml` | Neon — Update DB (Migrations + schema.sql) | Push to `main` touching schema/migrations; manual | Applies pre-schema migrations, the canonical `schema.sql`, then post-schema migrations to the Neon database in order (all safe to repeat). |
| `weekly-performance-goal-snapshot.yml` | Weekly Performance — Goal Snapshot Capture | Daily 05:35 UTC; manual | Records the Weekly Performance goal readings into `weekly_performance_goal_snapshots` via the app's internal capture route; the last capture of the week wins. |
| `workflow-health-check.yml` | Github Workflows — Health Check | Every 8 hours; manual | Checks each active workflow's most recent run on `main`, collects failures into one always-current triage issue, and closes it when everything is green. Each entry names the failing job and step and quotes what the run printed, so it can be triaged without opening the logs. A run that marks itself blocked by an outside state (`CTF_RUN_BLOCKED_EXTERNAL`, see above) is listed as paused rather than failing, and never opens or holds open the issue. |

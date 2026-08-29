# Skills Economy Monorepo (ctf)

This folder contains the rewrite monorepo scaffold for:

- Next.js web application (`packages/web`)
- React Native mobile application (`packages/mobile`)
- Shared platform-agnostic logic (`packages/shared`)

## Quick Start

1. Install dependencies
   - `pnpm install`
2. Run web app
   - `pnpm run dev:web`
3. Run mobile app (cloud-first Expo workflow)
   - `pnpm run dev:mobile`

## Codespaces Workspace

- For consistent editor behavior across fresh Codespaces, open the repository workspace file at `chargingthefuture.code-workspace` (repo root).
- This ensures the shared tab/preview settings are applied from one place for the whole repo.

## Mobile Cloud Workflow

- Preview Android builds: GitHub Actions workflow `Expo Preview Build`
- Production APK release: GitHub Actions workflow `Expo Android Release`
- JavaScript-only updates: EAS Update channels (`preview`, `staging`, `production`)

## Observability Provider Selection

- One shared key selects the provider for both surfaces: set `OBSERVABILITY_PROVIDER` to `sentry`,
  `signoz`, or `noop`.
- The DSNs are `SENTRY_DSN` (web — server, edge, and browser) and `EXPO_SENTRY_DSN` (mobile). Both
  already exist in Infisical; do not add `NEXT_PUBLIC_` or mobile-specific copies of them.
- Reporting starts when a DSN is present. Unknown or missing provider values fall back to the
  documented default for that surface.

## Structure

- `packages/shared`: API wrappers, domain models, and reusable logic
- `packages/web`: Next.js web application
- `packages/mobile`: Expo + React Native Android application

## Design Mockups Sync

- Runbook: `ctf/docs/developer/MOCKUPS_SUBMODULE_SYNC_RUNBOOK.md`
- Most common update command: `git submodule update --remote --merge`

## Invite-Only Access Flow (Rewrite)

- Users sign in through the active auth provider on the web app root page.
- First-time users must submit a Quora profile URL.
- Access stays pending until an admin approves them.
- Admins (existing `users.is_admin = true`) can review and approve users at `/admin/users`.

## Auth Foundation Baseline (BF-01)

- Auth foundation implementation notes: `ctf/docs/developer/AUTH_ARCHITECTURE.md`
- Plugin deny taxonomy baseline: `ctf/docs/contracts/PLUGIN_AUTH_DENY_TAXONOMY_BASELINE.md`
- Legacy Clerk username rollout reference: `ctf/docs/developer/CLERK_USERNAME_ROLLOUT_PLAN.md`

## Deploy Baseline

- The web app deploys on Render (`render.yaml` at the repo root is the service definition); Railway
  hosts only the supporting services (Infisical, Unleash, Formance). The old `ctf/railway.toml` web
  deploy entry point was removed 2026-08-03 — the web app has not deployed from Railway since the
  Render migration.
- Keep package manager alignment pinned to `pnpm@9.12.0` for deterministic builds.

## Schema Drift Full Report

- To list all live DB schema issues at once (missing tables/columns) against `ctf/schema.sql`:
  - `DATABASE_URL=... pnpm run schema:report-live-drift`
- This command exits non-zero when drift exists, so it can be used as a pre-deploy gate.

## Foundation Phase-1 Baseline

- Provider discovery reads Directory projections only (`directory_profiles`) and does not mutate Directory.
- User APIs:
  - `GET /api/foundation/providers/search`
  - `POST /api/foundation/connections/threads`
  - `POST /api/foundation/connections/threads/:threadId/messages`
  - `POST /api/foundation/connections/threads/:threadId/calls`
  - `GET /api/foundation/connections/history`
  - `POST /api/foundation/quotes`
  - `POST /api/foundation/quotes/:quoteRequestId/state`
  - `GET /api/foundation/quotes/history`
  - `GET /api/foundation/notifications`
  - `PUT /api/foundation/notifications/preferences`
  - `POST /api/foundation/notifications/:notificationEventId/ack`
- Admin APIs:
  - `GET/PUT /api/foundation/admin/capacity-policy`
  - `POST /api/foundation/admin/rate-limits/evaluate`
  - `GET /api/foundation/admin/audit-events`

## Lighthouse Phase-2 Baseline

- User APIs:
  - `GET/PUT/DELETE /api/lighthouse/profile`
  - `GET/POST /api/lighthouse/properties`
  - `GET/PATCH/DELETE /api/lighthouse/properties/:propertyId`
  - `GET /api/lighthouse/my-properties`
  - `GET/POST /api/lighthouse/matches`
  - `PATCH /api/lighthouse/matches/:matchId`
  - `GET /api/lighthouse/announcements`
  - `GET/POST /api/lighthouse/blocks`
  - `DELETE /api/lighthouse/blocks/:blockedUserId`
  - `GET /api/lighthouse/blocks/check?blockedUserId=<id>`
- Admin APIs:
  - `GET /api/lighthouse/admin/stats`
  - `GET /api/lighthouse/admin/profiles`
  - `GET /api/lighthouse/admin/seekers`
  - `GET /api/lighthouse/admin/hosts`
  - `GET /api/lighthouse/admin/properties`
  - `PATCH/DELETE /api/lighthouse/admin/properties/:propertyId`
  - `GET /api/lighthouse/admin/matches`
  - `PATCH /api/lighthouse/admin/matches/:matchId`
  - `GET/POST /api/lighthouse/admin/announcements`
  - `PATCH/DELETE /api/lighthouse/admin/announcements/:announcementId`
  - `GET /api/lighthouse/admin/audit-events`

## SocketRelay Phase-2 Baseline

- User APIs:
  - `GET/POST/PUT/DELETE /api/socket-relay/profile`
  - `GET/POST /api/socket-relay/requests`
  - `GET/PUT /api/socket-relay/requests/:id`
  - `POST /api/socket-relay/requests/:id/repost`
  - `POST /api/socket-relay/requests/:id/fulfill`
  - `GET /api/socket-relay/my-requests`
  - `GET /api/socket-relay/fulfillments/:id`
  - `POST /api/socket-relay/fulfillments/:id/close`
  - `GET/POST /api/socket-relay/fulfillments/:id/messages`
  - `GET /api/socket-relay/my-fulfillments`
  - `GET /api/socket-relay/announcements`
- Public APIs:
  - `GET /api/socket-relay/public`
  - `GET /api/socket-relay/public/:id`
- Admin APIs:
  - `GET /api/socket-relay/admin/requests`
  - `DELETE /api/socket-relay/admin/requests/:id`
  - `GET /api/socket-relay/admin/fulfillments`
  - `GET/POST /api/socket-relay/admin/announcements`
  - `PUT/DELETE /api/socket-relay/admin/announcements/:id`

## TrustTransport Phase-2 Baseline

- User APIs:
  - `GET /api/trust-transport/modes`
  - `GET/POST /api/trust-transport/requests`
  - `GET /api/trust-transport/requests/:requestId`
  - `GET /api/trust-transport/requests/:requestId/offers`
  - `POST /api/trust-transport/offers/:offerId/accept`
  - `POST /api/trust-transport/trips/:tripId/status`
  - `POST /api/trust-transport/trips/:tripId/proof`
  - `POST /api/trust-transport/trips/:tripId/emergency-stop`
  - `POST /api/trust-transport/orders/:orderId/cancel`
  - `POST /api/trust-transport/orders/:orderId/rating`
  - `POST /api/trust-transport/payouts/requests`
  - `GET /api/trust-transport/payouts`
- Admin APIs:
  - `GET /api/trust-transport/admin/incidents`
  - `POST /api/trust-transport/admin/incidents/:incidentId/resolve`
  - `POST /api/trust-transport/admin/accounts/:userId/restrict`
  - `POST /api/trust-transport/admin/accounts/:userId/restore`
  - `GET/PUT /api/trust-transport/admin/market-config`
  - `GET /api/trust-transport/admin/audit-events`

## ServiceCredits Formance Ledger Requirement

- ServiceCredits value-moving transfer flows require Formance ledger posting.
- Full reference (runtime contract, bootstrap, backup/restore): `ctf/docs/developer/FORMANCE.md`
- Deployment is defined in code: `ctf/ops/formance/Dockerfile.ledger` and the `ctf-formance-ledger` service in `render.yaml`.
- Required env vars: `FORMANCE_API_URL` (Render internal URL of `ctf-formance-ledger`), `FORMANCE_LEDGER`, `FORMANCE_API_TOKEN`. Never route Formance ↔ CTF traffic through a public domain.
- When Formance is not configured or unavailable, `POST /api/service-credits/transfers` returns a deterministic 503 deny code.

## SkillUp Plugin (Phase 3)

- Plugin shell route: `/apps/skill-up`
- Admin route: `/admin/skill-up`
- Primary migration: `ctf/migrations/2026-03-24-skill-up-core-phase3.sql`
- Deterministic seed script: `pnpm run seed:skill-up`

### SkillUp environment variables

- `SKILL_UP_STARTER_CREDITS` default: `500`
- `SKILL_UP_ENROLL_RATE_LIMIT_WINDOW_MS` default: `60000`
- `SKILL_UP_ENROLL_RATE_LIMIT_MAX` default: `6`
- `SKILL_UP_MILESTONE_RATE_LIMIT_WINDOW_MS` default: `60000`
- `SKILL_UP_MILESTONE_RATE_LIMIT_MAX` default: `20`

### MVP testing posture

- Automated test suites are deferred for MVP per Rule 118.
- SkillUp release readiness currently relies on migration/application validation, seed validation, audit/contract checks, and parity tracking artifacts.

## Prompt Leak Protection

- This repository includes git hooks that block committing/pushing AI prompt text patterns.
- One-time setup (run from repository root): `git config core.hooksPath .githooks`
- Store temporary prompt drafts in `.ai/` (already ignored by git).

## GitHub Actions Budget Monitoring

- Monitor workflow: `.github/workflows/github-actions-budget-monitor.yml`
- Token reminder workflow: `.github/workflows/github-actions-billing-token-reminder.yml`
- Evaluator script: `ctf/scripts/githubActionsBudgetMonitor.mjs`
- Token setup + rotation runbook: `ctf/docs/developer/GITHUB_ACTIONS_BILLING_TOKEN_RUNBOOK.md`
- Budget thresholds (GitHub Free):
  - Warning: 60%
  - Critical: 80%
  - Blocked: 90% (deploy workflows are blocked)
- Alert channel: GitHub issue titled `GitHub Actions Budget Monitor` (label: `ci-budget-monitor`)
- Secrets:
  - Required for org-scope monitoring: `GH_ACTIONS_BILLING_TOKEN`
  - Fallback token: default `GITHUB_TOKEN` (repo-level estimates, potentially degraded)

## Metric Definition and Confirmation (MDC)

- Canonical metric source is `ctf/config/canonical_metrics.yaml` (override with `CANONICAL_METRICS_PATH`).
- Before any metric-related changes (alerts, ETL/transforms, schema, dashboards, docs), call `check_metric_defined` / `checkMetricDefined`.
- If a metric is undefined or ambiguous, implementation is blocked and you must open a definition request using `ctf/docs/templates/canonical-metric-template.md`.
- The definition request must include these exact questions:
  - a. Confirm exact metric name and any aliases.
  - b. Give a precise human-readable description.
  - c. Specify data_type and unit.
  - d. Provide calculation logic (SQL, formula, or pseudocode) and required inputs.
  - e. Provide example inputs with expected output.
  - f. Specify owner/contact and acceptable thresholds/alerts.
  - g. Indicate update cadence and retention.
- Each metric check writes structured JSON audit logs with `timestamp`, `caller`, `metric_identifier`, `result`, and `canonical_id` (when found).

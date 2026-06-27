# LevelUp Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy reference excluded from implementation: `platform/`
- Plugin name: `LevelUp`
- Plugin slug: `level-up`

## Implemented User Features

1. Cohort listing with filters for `track`, `status`, and `startDate`.
2. Cohort detail view with curriculum, milestones, and enrollment affordance.
3. Enrollment flow with optional deposit policy and escrow split per milestone.
4. User dashboard with wallet balance, LevelUp escrow totals, active enrollments, and recent transactions.
5. Dispute open flow with comments and attachment metadata support.
6. Trainers directory (read-only browse): survivor-advocate trainer profiles with headline, bio, tracks, and active-cohort count.
7. Achievements (grant-only badges): badge definitions with the signed-in user's earned status. Badges are awarded, never bought or spent.
8. Credits Wallet (grant-only view): the signed-in user's ServiceCredits balance, total earned through LevelUp, escrow held, and a read-only history of credits earned/granted. Exposes no spend or transfer action.

## Implemented Trainer Features

1. Milestone validation endpoint for trainer/admin.
2. Milestone release endpoint that settles learner escrow and trainer payout split.
3. Trainer dashboard with cohorts, pending validations, trainees, and payout ledger summary.

## Implemented Admin Features

1. Admin credit grant endpoint (`mint`/`adjustment` path), wired to a real admin UI on both web and Android. Owner decision (2026-06-06): the admin UI is grant-only — it only ever grants ServiceCredits to a member ("earn or earn nothing") and exposes no remove/negative path; the amount input accepts positive values only and submit is disabled client-side for non-positive amounts. (The backend endpoint still technically accepts a signed amount so a mistaken grant can be corrected later, but the UI never sends a negative.) Every grant requires a member user ID, an amount greater than zero, a reason, and a governance ticket ID, and goes behind an explicit in-screen confirm step that restates exactly what will change ("add N credits to member X") before submit. The mutation carries the `x-ctf-csrf: '1'` header and is written to the audit log.
2. Dispute resolution endpoint with optional adjustment transfer.
3. Admin panel with operational KPIs (enrollments, completions, avg days to first trainer payout) plus a read-only cohort overview (title, track, status, seats open, required deposit, trainer split, completion bonus) from `GET /api/level-up/cohorts`.

## API Surface and Route Map

- `GET /api/level-up/cohorts`
- `POST /api/level-up/cohorts` — create a cohort; admin or trainer role (per `cohort.create` contract).
- `POST /api/level-up/enroll` — member or admin only; trainer-only accounts are blocked (per `enrollment.create` contract).
- `POST /api/level-up/milestones/[milestoneId]/validate`
- `POST /api/level-up/milestones/[milestoneId]/release`
- `POST /api/level-up/transfers` — self-transfer (recipient equals actor) is rejected with 400.
- `POST /api/level-up/disputes`
- `POST /api/level-up/disputes/[disputeId]/resolve` — admin, or the trainer assigned to the dispute's cohort (per `dispute.resolve` `trainerAssignmentOrAdmin`).
- `POST /api/level-up/admin/adjust-credits` — audit event records `targetContext` (`targetUserId`, `governanceTicketId`) per the `admin.adjust_credits` audit contract.
- `GET /api/level-up/trainers` — list trainer directory (read-only), optional `track` filter.
- `GET /api/level-up/achievements` — list grant-only badges with the signed-in user's earned status.
- `GET /api/level-up/wallet` — signed-in user's balance + grant-only earned/granted history (no spend path).

## Data Model and Storage Contracts

Primary migration: `ctf/migrations/2026-03-24-level-up-core-phase3.sql`

Core tables:

1. `level_up_cohorts`
2. `level_up_curriculum_items`
3. `level_up_milestones`
4. `level_up_enrollments`
5. `level_up_enrollment_milestone_escrows`
6. `level_up_milestone_validations`
7. `level_up_disbursements`
8. `level_up_stipend_schedules`
9. `level_up_disputes`
10. `level_up_dispute_comments`
11. `level_up_rate_limit_counters`
12. `level_up_command_idempotency`
13. `level_up_audit_events`
14. `level_up_policy_config`
15. `level_up_trainers` — trainer directory profile. Columns: `id` (PK), `user_id` (unique), `display_name`, `headline`, `bio`, `tracks` (jsonb array), `status`, `created_at`, `updated_at`. Read-only browse surface.
16. `level_up_achievements` — grant-only badge definitions. Columns: `id` (PK), `slug` (unique), `name`, `description`, `track`, `icon`, `credit_reward` (display-only grant amount), `sequence_no`, `status`, `created_at`, `updated_at`.
17. `level_up_user_achievements` — per-user earned badge rows (grant-only: a row means earned). Columns: `id` (PK), `user_id`, `achievement_id`, `earned_at`, `granted_credits`, `source_reference`, `created_at`; unique on `(user_id, achievement_id)`.

Multi-currency (issue #120): `level_up_cohorts` carries `stipend_currency` and `microgrant_currency`
(FK → `currencies.code`), naming the currency of `stipend_amount_per_payout` and `microgrant_amount`.
Both default to ServiceCredits (code `SC`) — these are internal token payouts. No surface renders a
ServiceCredits amount at a fiat equivalent (the no-fiat-parity rule from issue #120).

External value movement dependencies:

- `service_credits_wallets`
- `service_credits_transfers`
- `service_credits_escrow_holds`
- `service_credits_governance_events`
- `service_credits_dispute_adjustments`

## Security and Compliance Controls

1. Server-side role and access checks (`admin`, `trainer`, `user`) via plugin access gate.
2. CSRF checks enforced on mutation endpoints.
3. Input validation via `zod` on all LevelUp routes.
4. Command idempotency persistence for mutation replay safety.
5. Audit events for all implemented LevelUp commands.
6. Enrollment and milestone validate rate-limit counters persisted in DB.

## Seed Coverage Status

Deterministic seed script added:

- `ctf/scripts/seedLevelUp.mjs`

Seed content:

1. 5 users by deterministic IDs (1 admin, 1 trainer, 3 trainees).
2. Trainees set to 500 ServiceCredits each.
3. Open cohort with required credits 300, milestones (30/70), and baseline payout/refund policy JSON.
4. 1 trainer directory profile (`level_up_trainers`) for the seed trainer, with headline, bio, and tracks (`Tech`, `Finance`).
5. 3 achievement definitions (`level_up_achievements`): First Milestone, Cohort Graduate, Peer Mentor — deterministic UUIDs.
6. 1 earned badge row (`level_up_user_achievements`): trainee 1 has earned First Milestone.

## Web and Android Delivery Status

Parity status: **web+android complete** (pixel pass delivered). Web pixel pass complete: the web shell
(`components/level-up/level-up-shell.tsx` + `lu-*` sub-components) is aligned to the design mockup and
decomposed within rule-116 limits. Android pixel pass complete (2026-05-31): `LevelUp.tsx` rewritten to
the design mockup (`MobileLevelUp.tsx` / `MobileLevelUpEmpty.tsx` / `MobileLevelUpLoading.tsx` /
`MobileLevelUpPublic.tsx`), covering loading / empty / main states. Real-data-only: binds
`GET /api/level-up/cohorts` and `GET /api/service-credits/wallet`; `MockLevelUp.tsx` retired.
Unbacked mockup elements omitted: `trainerName`, `tags`, `milestoneCount` (not returned by cohorts
list endpoint); active-enrollment banner (no user-enrollment GET endpoint yet).

Trainers / Achievements / Credits Wallet (2026-06-07): the three former "coming soon" sidebar sections
are now real, backed surfaces on web and Android. Web: `lu-trainers.tsx`, `lu-achievements.tsx`,
`lu-wallet.tsx` rendered from the shell (`level-up-shell.tsx`), each lazy-loaded on first tab open and
each with its own empty state; the desktop sidebar and the phone-width tab bar both reach all three.
Android: `LevelUpTrainers.tsx`, `LevelUpAchievements.tsx`, `LevelUpWallet.tsx` reached via a new tab bar
in `LevelUp.tsx`. Real-data-only: bind `GET /api/level-up/trainers`, `GET /api/level-up/achievements`,
`GET /api/level-up/wallet`. Grant-only: the Wallet shows balance + earned/granted history with no spend or
transfer action; Achievements are grant-only badges.

Design refresh (2026-06-08, design submodule `b3742f7`): the three screens were brought up to the new
`LevelUpTrainers` / `LevelUpAchievements` / `LevelUpCreditsWallet` mockups (and their `Mobile*` variants).
Web Trainers now shows a stats row (trainers, tracks covered, active cohorts) and richer avatar cards;
Achievements splits badges into honest Earned / Locked buckets with a stats row and icon tiles (the real
`icon` name mapped to a glyph); the Wallet shows balance overview cards plus All / Earned / Escrow filter
tabs over a transaction table. Real-data-only deviations from the mockups, recorded so the design team can
decide whether to back them: trainer rating / handle / per-cohort name+status / learners / milestones
validated / SC released / recent-activity feed (none in the trainers endpoint); achievement emoji / rarity /
an "In Progress" bucket with a progress fraction (the endpoint exposes only an earned boolean); wallet
"Total Spent", a per-row running balance, a "Spent" filter, a per-cohort escrow breakdown, and the
"earn more" suggestion list (grant-only model has no spend path, and the wallet endpoint returns only an
aggregate escrow figure). The shell's mobile root was switched from `100vh` to `100dvh` so there is no
bottom gap on mobile browsers.

Admin surface (2026-06-06): the `/admin/level-up` web page is now a real, mobile-responsive admin UI
(`components/level-up/lu-admin-shell.tsx` + `lu-admin-shared.ts`, `useIsMobile()` responsive, admin-gated
via `evaluatePluginAccess` at the route) showing KPI cards, the cohort overview, and the ServiceCredits
adjustment action with an explicit confirm step. The Android admin screen
(`ctf/packages/mobile/src/features/level-up/AdminLevelUp.tsx` + `admin-api.ts`, registered in `App.tsx` as
`level-up-admin`) mirrors the same cohort overview and adjustment action. The mockup
`MobileLevelUpAdmin.tsx` shows a track/badge editor; no track or badge admin endpoints exist, so that
layout is not implemented — the admin screens bind only the cohort list and the adjust-credits endpoint
that exist today.

## Gaps and Known Technical Debt

1. Dispute attachment storage uses URL metadata only (no secure file storage backend). This is a known limitation; full storage integration is a future optimization.
2. No admin KPI read endpoint exists; the web admin page renders KPIs from server-side `getAdminPanelData()` and the Android admin screen has no KPI cards (no GET route to call). Add a `GET /api/level-up/admin/kpis` route to give the mobile screen the same KPI cards as web.
3. No admin-gated GET route exists for the LevelUp admin screens, so the mobile admin screen cannot pre-gate by role before render; it relies on the server-side admin gate on `POST /adjust-credits` to deny non-admins. The cohort list (`GET /api/level-up/cohorts`) is read-access for any approved user. A dedicated admin-gated read route would let the mobile screen show the admin-only notice without attempting a mutation.
4. The design mockup `MobileLevelUpAdmin.tsx` (track/badge management) has no backing endpoints; tracks are a free-text field on cohorts and there is no badge model. Building that surface would require new schema, routes, and contracts.

## Change Log

- 2026-06-27: Resolved code-review sweep findings for level-up. Access-policy alignment: `POST /api/level-up/cohorts` now allows admin or trainer (was admin-only) per `cohort.create`; `POST /api/level-up/disputes/[disputeId]/resolve` now allows the trainer assigned to the dispute's cohort in addition to admin (added `getDisputeCohortId` repository helper to map dispute → enrollment → cohort and reuse `isTrainerForCohort`) per `dispute.resolve` `trainerAssignmentOrAdmin`; `POST /api/level-up/enroll` now blocks trainer-only accounts (member or admin only) per `enrollment.create`. Money safety: `POST /api/level-up/transfers` rejects a self-transfer (recipient equals actor) with 400. Audit compliance: `admin.adjust_credits` audit event now writes a structured `targetContext` (`targetUserId`, `governanceTicketId`) inside metadata per the audit contract. Web shell bug fixes: `handleEnroll` now sends the `x-ctf-csrf: '1'` header (enrollment from the shell was failing CSRF); `handleValidate` now sends the required `enrollmentId`, `cohortId`, and `idempotencyKey` (the trainer Approve button posted an empty body that always failed validation) — `PendingValidation` extended to carry `enrollmentId` and `cohortId`. No schema table or column changes.
- 2026-06-26: Hyphenation/cleanup rename of the LevelUp plugin as a hard cutover with no backward-compatible aliases — `levelup` → `level-up` everywhere. `/api/levelup/*` no longer exists; the app shell (`/apps/level-up`), admin surface (`/admin/level-up`), web components, and the mobile API client all repoint to `/api/level-up/*`. Plugin slug in the registry/catalog/concierge/parity contract is now `level-up`; command names are `level-up.*`; constant family moved `LEVELUP_*` → `LEVEL_UP_*` (including the client-facing error-code string values `level_up_*`). Every database table renamed to the matching snake_case prefix: each `levelup_*` table becomes `level_up_*` (15 tables: enrollments, cohorts, curriculum_items, milestones, command_idempotency, audit_events, rate_limit_counters, enrollment_milestone_escrows, milestone_validations, disputes, dispute_comments, disbursements, trainers, achievements, user_achievements). `schema.sql` runs `ALTER TABLE ... RENAME TO` first so an existing database keeps its data; `schema.demo.sql` regenerated. Contract files renamed `LEVELUP_*` → `LEVEL_UP_*` (pluginId, dataAccess tables, scopes updated). Cross-plugin refs updated: Trust signal type `engagement-level-up-cohorts`, Trust `level_up_enrollments` read + `levelUpCohortsCompleted` metric; GDP recognition `pluginSlug: 'level-up'` and `level_up_*` table refs (the `levelUpTrainerPayoutSource` identifier kept). Deliberately UNCHANGED (stored ServiceCredits ledger/governance values matched against existing production rows; renaming them would orphan data and break the GDP recognizer): the mint-grant `reason` values `levelup_trainer_split` / `levelup_completion_bonus`, the `releasePolicy`/`releaseReason` value `levelup_milestone_validated`, the `refundReason` `levelup_enrollment_setup_failed`, the `reasonCode` `levelup_transfer`, and the `governanceTicketId` prefix `levelup:`. No `levelup → level-up` slug alias was added (hard cutover). Web + mobile typecheck/lint clean.
- 2026-06-17: Restyled the `/admin/level-up` surface (`lu-admin-shell`) to the shared dark admin design system (icon header with `ADMIN` badge, dark tokens, stat blocks, dark form inputs) per rule 131. Visual only — the grant-only confirmation flow, amount validation, governance ticket, idempotency key, and endpoints are unchanged. The mockup's track/badge management has no backing endpoints (see Gaps), so the real KPIs, cohort list, and credit-grant form are kept rather than the mockup's tabs/counts. Web typecheck + eslint clean.
- 2026-06-12: Android API clients (`api.ts`, `admin-api.ts`) now call the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded localhost URLs. The admin functions no longer take a token argument (the wrapper supplies the live token); `AdminLevelUp.tsx` call sites updated. No backend, schema, or contract change.
- 2026-06-08: Design refresh of the Trainers, Achievements, and Credits Wallet screens to the new design mockups (design submodule advanced to `b3742f7`). Web: rewrote `lu-trainers.tsx` (stats row + avatar cards), `lu-achievements.tsx` (Earned / Locked buckets, stats row, `icon`-name-to-glyph mapping), and `lu-wallet.tsx` (balance overview cards + All / Earned / Escrow filter tabs over a transaction table). Android: rewrote `LevelUpTrainers.tsx`, `LevelUpAchievements.tsx`, `LevelUpWallet.tsx` to match the `Mobile*` mockups. Switched the shell's mobile root from `100vh` to `100dvh`. No backend, schema, route, or contract change — all three screens stay bound to the existing `GET /api/level-up/trainers`, `GET /api/level-up/achievements`, and `GET /api/level-up/wallet`. Real-data-only: the mockups' rating / handle / cohort-status / learners / SC-released fields, achievement emoji / rarity / in-progress progress bars, and wallet total-spent / running-balance / per-cohort escrow / earn-more list were not invented — only real fields are rendered, with honest empty states for sections that have no data.
- 2026-06-07: Built the three former "coming soon" sections — Trainers, Achievements, Credits Wallet — into real surfaces on web and Android. Added three tables adjacent to the existing LevelUp tables in `schema.sql`: `level_up_trainers` (trainer directory profiles), `level_up_achievements` (grant-only badge definitions), and `level_up_user_achievements` (per-user earned badge rows, unique on user+achievement). Added three read-only API routes: `GET /api/level-up/trainers`, `GET /api/level-up/achievements`, `GET /api/level-up/wallet` — plus matching `trainer.list` / `achievement.list` / `wallet.view` command and access-policy contract entries. Web: `lu-trainers.tsx`, `lu-achievements.tsx`, `lu-wallet.tsx` wired into `level-up-shell.tsx` (lazy-loaded per tab; reachable from the desktop sidebar and the phone-width tab bar). Android: `LevelUpTrainers.tsx`, `LevelUpAchievements.tsx`, `LevelUpWallet.tsx` reached via a new tab bar in `LevelUp.tsx`. Extended `scripts/seedLevelUp.mjs` with 1 trainer profile, 3 achievement definitions, and 1 earned badge. Owner rule applied throughout: LevelUp is grant-only ("earn or earn nothing") — the Wallet reads balance + earned/granted history only and exposes no spend or transfer action; Achievements are grant-only badges. Regenerated `schema.demo.sql`.
- 2026-06-06: Owner decision — LevelUp admin UI is grant-only. An admin can never remove a member's ServiceCredits from the UI ("earn or earn nothing"). The web shell (`lu-admin-shell.tsx`) and the Android screen (`AdminLevelUp.tsx`) now accept positive amounts only: the amount input is labelled "Amount to grant (greater than zero)", the action is labelled "Grant"/"Review grant", the confirm copy reads "add N credits to member X" (no "remove"), and submit is disabled client-side for non-positive amounts. The backend `POST /api/level-up/admin/adjust-credits` endpoint is unchanged (it still technically accepts a signed amount so a mistaken grant can be corrected later); only the UI no longer exposes a negative path. Member id, reason, governance ticket id, idempotency key, and the two-step confirm are all kept. Copy-only/validation-only UI change; no schema/route/contract changes.
- 2026-06-06: Admin UI — turned the `/admin/level-up` web page from a KPI-only stub into a real, mobile-responsive admin UI (`components/level-up/lu-admin-shell.tsx` + `lu-admin-shared.ts`): KPI cards (server-fetched), a read-only cohort overview from `GET /api/level-up/cohorts`, and a ServiceCredits adjustment form wired to `POST /api/level-up/admin/adjust-credits` (CSRF header, idempotency key) behind an explicit confirm step that restates the member, direction (add/remove), and amount before submit. Added an Android admin screen (`ctf/packages/mobile/src/features/level-up/AdminLevelUp.tsx` + `admin-api.ts`, registered in `App.tsx` as `level-up-admin`) mirroring the cohort overview and the same confirm-gated adjustment action. No new amounts are fabricated and no ServiceCredits→fiat equivalence is rendered. The mockup's track/badge editor was not built (no backing endpoints). No schema/route/contract changes. Documented endpoint gaps (no admin KPI GET, no admin-gated read route) in Gaps.
- 2026-06-01: Multi-currency (issue #120): added `stipend_currency` and `microgrant_currency` (FK → `currencies.code`, default ServiceCredits) to `level_up_cohorts`. Documented the no-fiat-parity rule. Schema + inventory only; the currency UI is design-gated.
- 2026-05-31: Android pixel pass — rewrote `ctf/packages/mobile/src/features/level-up/LevelUp.tsx` to the design mockup (loading/empty/main states). Created real `api.ts` bound to `GET /api/level-up/cohorts` and `GET /api/service-credits/wallet`. Retired `MockLevelUp.tsx`. Omitted unbacked fields: trainerName, tags, milestoneCount (not in cohorts list endpoint), active-enrollment banner (no user enrollment GET route). EOF, parity, and tsc gates all green.
- 2026-05-30: Web pixel pass — rebuilt the web shell to the design mockup and decomposed the 520-line `level-up-shell.tsx` monolith into modular sub-components (`lu-shared.ts`, `lu-loading.tsx`, `lu-sidebar.tsx`, `lu-cohort-card.tsx`, `lu-browse.tsx`, `lu-progress.tsx`, `lu-right-panel.tsx`, thin shell) within rule-116 limits. Removed 6 dead unreferenced components (AdminPanel, CohortDetail, CohortList, EnrollModal, TrainerDashboard, UserDashboard). Shell binds real routes (cohorts, service-credits wallet, enroll, milestone validate); unbacked mockup figures omitted. No schema/route/contract changes.
- 2026-05-17: Updated inventory to enforce Rule 105 parity baseline and Rule 120 living-snapshot model. Removed Android parity deferral language; confirmed web+android complete delivery status. Clarified technical debt (attachment storage) as genuine limitation, not unimplemented feature.
- 2026-03-24: Initial LevelUp phase-3 implementation inventory created (schema, repository, API routes, shell components, seed script, contracts).


## Build Checklist


### Scope and Boundary

- [x] Confirm implementation scope is `ctf/` only.
- [x] Confirm plugin slug and route namespace (`level-up`).
- [x] Confirm no Prisma usage; SQL migration + repository pattern only.

### Schema and Registry

- [x] Add core migration for LevelUp domain tables.
- [x] Add plugin registry availability entry for `level-up`.
- [x] Add baseline policy config (`starter_credits`, split defaults).

### Repository and Business Rules

- [x] Implement cohort creation/list/detail repository methods.
- [x] Implement enrollment and escrow allocation logic with idempotency.
- [x] Implement milestone validation and release settlement.
- [x] Implement dispute open/resolve and admin adjust credit flows.
- [x] Implement persisted DB rate-limit counters for enroll/validate.

### API Surface

- [x] Implement route helpers for authz, CSRF, and error mapping.
- [x] Add zod validation to LevelUp mutation/query handlers.
- [x] Add routes for cohorts, enrollments, milestones, transfers, disputes, admin adjustment.

### Web UI Shell

- [x] Add `LevelUpShell` under plugin app route.
- [x] Add `CohortList`, `CohortDetail`, `EnrollModal` components.
- [x] Add `UserDashboard`, `TrainerDashboard`, `AdminPanel` components.
- [x] Add `/admin/level-up` page.

### Contracts and Inventory

- [x] Add command contracts file.
- [x] Add access policy contracts file.
- [x] Add audit contracts file.
- [x] Add plugin feature inventory file.
- [x] Add rewrite checklist file.

### Seed and Release Readiness

- [x] Add deterministic seed script for sample users/cohort/milestones.
- [x] Android parity pixel pass delivered (2026-05-31). `LevelUp.tsx` aligned to design mockup; real API bindings only; `MockLevelUp.tsx` retired.
- [x] Observability KPI finalization for non-placeholder admin metrics.

### MVP Testing Note

- [x] Automated test suites deferred for MVP per Rule 118.

### Change Log

- 2026-03-24: Initial checklist created and baseline implementation items marked.

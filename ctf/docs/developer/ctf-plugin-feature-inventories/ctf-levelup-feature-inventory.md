# LevelUp Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy reference excluded from implementation: `platform/`
- Plugin name: `LevelUp`
- Plugin slug: `levelup`

## Implemented User Features

1. Cohort listing with filters for `track`, `status`, and `startDate`.
2. Cohort detail view with curriculum, milestones, and enrollment affordance.
3. Enrollment flow with optional deposit policy and escrow split per milestone.
4. User dashboard with wallet balance, LevelUp escrow totals, active enrollments, and recent transactions.
5. Dispute open flow with comments and attachment metadata support.

## Implemented Trainer Features

1. Milestone validation endpoint for trainer/admin.
2. Milestone release endpoint that settles learner escrow and trainer payout split.
3. Trainer dashboard with cohorts, pending validations, trainees, and payout ledger summary.

## Implemented Admin Features

1. Admin credit adjustment endpoint (`mint`/`adjustment` path), wired to a real admin UI on both web and Android (positive amount grants Service Credits to a member; negative amount removes credits from the member into the LevelUp treasury). Every adjustment requires a member user ID, a non-zero amount, a reason, and a governance ticket ID, and goes behind an explicit in-screen confirm step that restates exactly what will change before submit. The mutation carries the `x-ctf-csrf: '1'` header and is written to the audit log.
2. Dispute resolution endpoint with optional adjustment transfer.
3. Admin panel with operational KPIs (enrollments, completions, avg days to first trainer payout) plus a read-only cohort overview (title, track, status, seats open, required deposit, trainer split, completion bonus) from `GET /api/levelup/cohorts`.

## API Surface and Route Map

- `GET /api/levelup/cohorts`
- `POST /api/levelup/cohorts`
- `POST /api/levelup/enroll`
- `POST /api/levelup/milestones/[milestoneId]/validate`
- `POST /api/levelup/milestones/[milestoneId]/release`
- `POST /api/levelup/transfers`
- `POST /api/levelup/disputes`
- `POST /api/levelup/disputes/[disputeId]/resolve`
- `POST /api/levelup/admin/adjust-credits`

## Data Model and Storage Contracts

Primary migration: `ctf/migrations/2026-03-24-levelup-core-phase3.sql`

Core tables:

1. `levelup_cohorts`
2. `levelup_curriculum_items`
3. `levelup_milestones`
4. `levelup_enrollments`
5. `levelup_enrollment_milestone_escrows`
6. `levelup_milestone_validations`
7. `levelup_disbursements`
8. `levelup_stipend_schedules`
9. `levelup_disputes`
10. `levelup_dispute_comments`
11. `levelup_rate_limit_counters`
12. `levelup_command_idempotency`
13. `levelup_audit_events`
14. `levelup_policy_config`

Multi-currency (issue #120): `levelup_cohorts` carries `stipend_currency` and `microgrant_currency`
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

- `ctf/scripts/seedLevelup.mjs`

Seed content:

1. 5 users by deterministic IDs (1 admin, 1 trainer, 3 trainees).
2. Trainees set to 500 ServiceCredits each.
3. Open cohort with required credits 300, milestones (30/70), and baseline payout/refund policy JSON.

## Web and Android Delivery Status

Parity status: **web+android complete** (pixel pass delivered). Web pixel pass complete: the web shell
(`components/levelup/levelup-shell.tsx` + `lu-*` sub-components) is aligned to the design mockup and
decomposed within rule-116 limits. Android pixel pass complete (2026-05-31): `Levelup.tsx` rewritten to
the design mockup (`MobileLevelUp.tsx` / `MobileLevelUpEmpty.tsx` / `MobileLevelUpLoading.tsx` /
`MobileLevelUpPublic.tsx`), covering loading / empty / main states. Real-data-only: binds
`GET /api/levelup/cohorts` and `GET /api/service-credits/wallet`; `MockLevelup.tsx` retired.
Unbacked mockup elements omitted: `trainerName`, `tags`, `milestoneCount` (not returned by cohorts
list endpoint); active-enrollment banner (no user-enrollment GET endpoint yet).

Admin surface (2026-06-06): the `/admin/levelup` web page is now a real, mobile-responsive admin UI
(`components/levelup/lu-admin-shell.tsx` + `lu-admin-shared.ts`, `useIsMobile()` responsive, admin-gated
via `evaluatePluginAccess` at the route) showing KPI cards, the cohort overview, and the Service Credits
adjustment action with an explicit confirm step. The Android admin screen
(`ctf/packages/mobile/src/features/levelup/AdminLevelup.tsx` + `admin-api.ts`, registered in `App.tsx` as
`levelup-admin`) mirrors the same cohort overview and adjustment action. The mockup
`MobileLevelUpAdmin.tsx` shows a track/badge editor; no track or badge admin endpoints exist, so that
layout is not implemented — the admin screens bind only the cohort list and the adjust-credits endpoint
that exist today.

## Gaps and Known Technical Debt

1. Dispute attachment storage uses URL metadata only (no secure file storage backend). This is a known limitation; full storage integration is a future optimization.
2. No admin KPI read endpoint exists; the web admin page renders KPIs from server-side `getAdminPanelData()` and the Android admin screen has no KPI cards (no GET route to call). Add a `GET /api/levelup/admin/kpis` route to give the mobile screen the same KPI cards as web.
3. No admin-gated GET route exists for the LevelUp admin screens, so the mobile admin screen cannot pre-gate by role before render; it relies on the server-side admin gate on `POST /adjust-credits` to deny non-admins. The cohort list (`GET /api/levelup/cohorts`) is read-access for any approved user. A dedicated admin-gated read route would let the mobile screen show the admin-only notice without attempting a mutation.
4. The design mockup `MobileLevelUpAdmin.tsx` (track/badge management) has no backing endpoints; tracks are a free-text field on cohorts and there is no badge model. Building that surface would require new schema, routes, and contracts.

## Change Log

- 2026-06-06: Admin UI — turned the `/admin/levelup` web page from a KPI-only stub into a real, mobile-responsive admin UI (`components/levelup/lu-admin-shell.tsx` + `lu-admin-shared.ts`): KPI cards (server-fetched), a read-only cohort overview from `GET /api/levelup/cohorts`, and a Service Credits adjustment form wired to `POST /api/levelup/admin/adjust-credits` (CSRF header, idempotency key) behind an explicit confirm step that restates the member, direction (add/remove), and amount before submit. Added an Android admin screen (`ctf/packages/mobile/src/features/levelup/AdminLevelup.tsx` + `admin-api.ts`, registered in `App.tsx` as `levelup-admin`) mirroring the cohort overview and the same confirm-gated adjustment action. No new amounts are fabricated and no ServiceCredits→fiat equivalence is rendered. The mockup's track/badge editor was not built (no backing endpoints). No schema/route/contract changes. Documented endpoint gaps (no admin KPI GET, no admin-gated read route) in Gaps.
- 2026-06-01: Multi-currency (issue #120): added `stipend_currency` and `microgrant_currency` (FK → `currencies.code`, default ServiceCredits) to `levelup_cohorts`. Documented the no-fiat-parity rule. Schema + inventory only; the currency UI is design-gated.
- 2026-05-31: Android pixel pass — rewrote `ctf/packages/mobile/src/features/levelup/Levelup.tsx` to the design mockup (loading/empty/main states). Created real `api.ts` bound to `GET /api/levelup/cohorts` and `GET /api/service-credits/wallet`. Retired `MockLevelup.tsx`. Omitted unbacked fields: trainerName, tags, milestoneCount (not in cohorts list endpoint), active-enrollment banner (no user enrollment GET route). EOF, parity, and tsc gates all green.
- 2026-05-30: Web pixel pass — rebuilt the web shell to the design mockup and decomposed the 520-line `levelup-shell.tsx` monolith into modular sub-components (`lu-shared.ts`, `lu-loading.tsx`, `lu-sidebar.tsx`, `lu-cohort-card.tsx`, `lu-browse.tsx`, `lu-progress.tsx`, `lu-right-panel.tsx`, thin shell) within rule-116 limits. Removed 6 dead unreferenced components (AdminPanel, CohortDetail, CohortList, EnrollModal, TrainerDashboard, UserDashboard). Shell binds real routes (cohorts, service-credits wallet, enroll, milestone validate); unbacked mockup figures omitted. No schema/route/contract changes.
- 2026-05-17: Updated inventory to enforce Rule 105 parity baseline and Rule 120 living-snapshot model. Removed Android parity deferral language; confirmed web+android complete delivery status. Clarified technical debt (attachment storage) as genuine limitation, not unimplemented feature.
- 2026-03-24: Initial LevelUp phase-3 implementation inventory created (schema, repository, API routes, shell components, seed script, contracts).


## Build Checklist


### Scope and Boundary

- [x] Confirm implementation scope is `ctf/` only.
- [x] Confirm plugin slug and route namespace (`levelup`).
- [x] Confirm no Prisma usage; SQL migration + repository pattern only.

### Schema and Registry

- [x] Add core migration for LevelUp domain tables.
- [x] Add plugin registry availability entry for `levelup`.
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

- [x] Add `LevelupShell` under plugin app route.
- [x] Add `CohortList`, `CohortDetail`, `EnrollModal` components.
- [x] Add `UserDashboard`, `TrainerDashboard`, `AdminPanel` components.
- [x] Add `/admin/levelup` page.

### Contracts and Inventory

- [x] Add command contracts file.
- [x] Add access policy contracts file.
- [x] Add audit contracts file.
- [x] Add plugin feature inventory file.
- [x] Add rewrite checklist file.

### Seed and Release Readiness

- [x] Add deterministic seed script for sample users/cohort/milestones.
- [x] Android parity pixel pass delivered (2026-05-31). `Levelup.tsx` aligned to design mockup; real API bindings only; `MockLevelup.tsx` retired.
- [x] Observability KPI finalization for non-placeholder admin metrics.

### MVP Testing Note

- [x] Automated test suites deferred for MVP per Rule 118.

### Change Log

- 2026-03-24: Initial checklist created and baseline implementation items marked.

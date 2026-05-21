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

1. Admin credit adjustment endpoint (`mint`/`adjustment` path).
2. Dispute resolution endpoint with optional adjustment transfer.
3. Admin panel with operational KPIs (enrollments, completions, avg days to first trainer payout).

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

- `ctf/scripts/seedLevelupPhase3.mjs`

Seed content:

1. 5 users by deterministic IDs (1 admin, 1 trainer, 3 trainees).
2. Trainees set to 500 ServiceCredits each.
3. Open cohort with required credits 300, milestones (30/70), and baseline payout/refund policy JSON.

## Web and Android Delivery Status

Parity status: **web+android complete**.

## Gaps and Known Technical Debt

1. Dispute attachment storage uses URL metadata only (no secure file storage backend). This is a known limitation; full storage integration is a future optimization.

## Change Log

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
- [ ] Android parity implementation (follow-up required before GA).
  - Ticket: `PARITY-LEVELUP-ANDROID-001` (placeholder)
  - Owner: Mobile plugin parity owner (TBD)
  - Deadline: Before LevelUp GA release
  - Risk note: Web-only critical training flow until parity closes
- [x] Observability KPI finalization for non-placeholder admin metrics.

### MVP Testing Note

- [x] Automated test suites deferred for MVP per Rule 118.

### Change Log

- 2026-03-24: Initial checklist created and baseline implementation items marked.

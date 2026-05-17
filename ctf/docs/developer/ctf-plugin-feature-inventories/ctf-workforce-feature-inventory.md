# Workforce Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Unified plugin scope slug: `workforce`
- This document is a planning inventory (not implementation evidence yet).
- V1 scope is full legacy parity plus approved rewrite enhancements.
- Legacy accidental event artifacts from Workforce Recruiter are explicitly out of scope and must not be carried into rewrite design.

Legacy reference preservation:

- Keep `ctf/docs/developer/workforce-recruiter-feature-inventory.md` intact as reference.
- Keep `ctf/docs/developer/workforce-recruiter-rewrite-checklist.md` intact as reference.
- This document is the authoritative merged rewrite source for implementation.

## Intent and Outcome

Workforce in CTF is planned as a deterministic workforce planning and reporting plugin with canonical metrics, auditable admin operations, migration-safe contracts, and full parity with legacy Workforce Recruiter capabilities.

Planning constraints applied:

1. Inventory/checklist lifecycle follows `.github/instructions/120-plugin-feature-inventory-lifecycle-rules.mdc`.
2. Metric definitions and rewrite planning align to `.github/instructions/121-canonical-metric-registry-rules.mdc`.
3. Schema and contract planning align to `.github/instructions/122-schema-drift-predeployment-rules.mdc`.
4. Plugin command/access/audit planning aligns to `.github/instructions/200-plugin-command-contract-templates.mdc` and templates `201`/`202`/`203`.

---

## 1) User Features

### 1.1 Workforce Dashboard and Drilldowns

1. Workforce dashboard with current-state counts and distribution views.
2. Drilldowns by sector, skill level, and geography where authorized.
3. Deterministic loading/empty/error states for core report screens.

### 1.2 Workforce Directory-Coupled Profile Experience

1. User-visible workforce profile view based on canonical Directory-linked data.
2. Controlled profile update flows where rewrite policy permits user edits.
3. Read-only indicators where fields are system-derived.

### 1.3 Workforce Reporting and Export

1. Current-state report views for active workforce metrics.
2. Historical trend views using canonical weekly buckets.
3. Async export job workflow for approved report datasets and metadata.

### 1.4 Workforce Occupations Experience (Parity)

1. Occupations browse route with filter + pagination controls.
2. Occupation detail route with deterministic error/empty handling.
3. Role-aware behaviors where admin-only mutation controls are hidden from non-admin users.

### 1.5 Workforce Announcements Experience (Parity)

1. User-visible announcements route for active notices.
2. Deterministic active/inactive rendering behavior.
3. Consistent parity behavior across web and mobile clients.

## 2) Admin Features

### 2.1 Workforce Admin Operations

1. Admin route(s) for workforce config, assumptions, report controls, and parity management surfaces.
2. Role-gated create/update/deactivate operations for workforce admin objects.
3. Operator-visible audit and change-history views.

### 2.2 Workforce Admin Occupations (Parity)

1. Admin occupations create/update/delete operations.
2. Server-enforced role + policy checks for every mutation.
3. Mutation outcomes emitted to standardized workforce admin audit events.

### 2.3 Workforce Admin Announcements (Parity)

1. Admin announcements list/create/update/deactivate operations.
2. Active-state lifecycle controls for time-bound or manually deactivated announcements.
3. Mutation outcomes emitted to standardized workforce admin audit events.

### 2.4 Workforce Configuration Governance

1. Controlled mutation of planning assumptions and policy flags.
2. Validation and safe defaults on all state-changing admin operations.
3. Feature flags/kill switches for risky behavior changes.

### 2.5 Data Stewardship Controls

1. Admin tools for reconciliation diagnostics against canonical Directory state.
2. Operational tools for backfill/recompute with auditability.
3. Explicit exclusion checks for accidental legacy event artifact reintroduction.

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface

All command contracts must conform to:

- `.github/instructions/201-plugin-command-schema-template.mdc`
- `.github/instructions/202-plugin-access-policy-schema-template.mdc`
- `.github/instructions/203-plugin-audit-schema-template.mdc`

Planned command groups:

1. `workforce.dashboard.fetch`
2. `workforce.profile.fetch`
3. `workforce.profile.create`
4. `workforce.profile.update`
5. `workforce.profile.delete`
6. `workforce.occupations.list`
7. `workforce.occupations.detail.fetch`
8. `workforce.occupations.admin.create`
9. `workforce.occupations.admin.update`
10. `workforce.occupations.admin.delete`
11. `workforce.announcements.list`
12. `workforce.announcements.admin.list`
13. `workforce.announcements.admin.create`
14. `workforce.announcements.admin.update`
15. `workforce.announcements.admin.deactivate`
16. `workforce.report.summary.fetch`
17. `workforce.report.skillLevel.fetch`
18. `workforce.report.sector.fetch`
19. `workforce.export.job.create`
20. `workforce.export.job.status.fetch`
21. `workforce.export.job.result.fetch`
22. `workforce.admin.config.fetch`
23. `workforce.admin.config.update`
24. `workforce.admin.recompute.enqueue`
25. `workforce.admin.auditEvents.fetch`
26. `workforce.metric.recruited.derive`

### 3.2 HTTP Projection Routes

User routes:

- `GET /api/workforce/dashboard`
- `GET /api/workforce/profile`
- `POST /api/workforce/profile`
- `PUT /api/workforce/profile`
- `DELETE /api/workforce/profile`
- `GET /api/workforce/occupations`
- `GET /api/workforce/occupations/:id`
- `GET /api/workforce/announcements`
- `GET /api/workforce/reports/summary`
- `GET /api/workforce/reports/skill-level/:skillLevel`
- `GET /api/workforce/reports/sector/:sector`
- `POST /api/workforce/export/jobs`
- `GET /api/workforce/export/jobs/:jobId`
- `GET /api/workforce/export/jobs/:jobId/result`

Admin routes:

- `GET /api/workforce/admin/config`
- `PUT /api/workforce/admin/config`
- `POST /api/workforce/admin/occupations`
- `PUT /api/workforce/admin/occupations/:id`
- `DELETE /api/workforce/admin/occupations/:id`
- `GET /api/workforce/admin/announcements`
- `POST /api/workforce/admin/announcements`
- `PUT /api/workforce/admin/announcements/:id`
- `DELETE /api/workforce/admin/announcements/:id`
- `POST /api/workforce/admin/recompute`
- `GET /api/workforce/admin/audit-events`

## 4) Data Model and Storage Contracts

### 4.1 Canonical Identity and Extension Strategy

1. Reuse canonical profile identity model; no duplicate full profile table.
2. Workforce extension entities keyed by canonical `user_id`.
3. Directory writes are upstream source for recruited-state inference.

### 4.2 Planned Domain Entities

1. `workforce_profiles` (plugin extension shape only)
2. `workforce_config`
3. `workforce_report_snapshots`
4. `workforce_recruited_events` (append-only inferred events)
5. `workforce_admin_audit_trail`

### 4.3 Storage and Derivation Rules

1. Recruited inference is derived from Directory profile create/update writes.
2. Inference history is append-only for traceability of mapping changes.
3. Inference writes use deterministic dedupe key (`inference_dedupe_key`) and unique constraint semantics.
4. Replay/backfill duplicates are idempotent no-op outcomes.
5. Current-state dashboards read latest resolved state.
6. Historical dashboards read weekly trend buckets from inferred event history.
7. Weekly buckets use `America/New_York`, week start = Saturday, T+14 rolling correction then freeze.
8. No carry-over of legacy accidental event scaffolding or unrelated event models.

## 5) Canonical Metrics — Recruited Semantics

Metric planning must be locked in `ctf/config/canonical_metrics.yaml` before implementation starts.

Planned canonical definition notes for `recruited`:

1. **Primary metric:** current-state recruited count from latest resolved inferred state per user.
2. **Automatic derivation only:** event is inferred from Directory profile create/update writes.
3. **No manual trigger path:** no user/admin action directly emits recruited events.
4. **Append-only metric history:** inferred mapping changes are recorded as immutable historical events.
5. **Dual consumption model:**
   - Live dashboard uses current resolved state.
   - Historical dashboard uses weekly trend buckets computed from event history.
6. **Operational policy:** update cadence hourly; retention 60 months.

## 6) Security, Privacy, and Compliance Controls

1. Server-side authz on all user/admin commands and routes.
2. CSRF protection on every state-changing web endpoint.
3. Android bearer-token mutation flows enforce identical server-side authz decisions (no client bypass path).
4. Access-policy contracts enforce role, consent/legal basis, and deny conditions.
5. Deny taxonomy is standardized across web/mobile policy outcomes.
6. Admin audit endpoint is standardized as `/api/workforce/admin/audit-events`.
7. Audit contracts capture allow/deny + mutation outcome for workforce operations.
8. Data minimization and sensitive-field redaction in logs/diagnostics.
9. Plugin deletion/profile handling aligns to `ctf/docs/templates/PLUGIN_PROFILE_AND_DELETION_CONTRACT_TEMPLATE.md`.

## 7) Seed Coverage Status

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

## 8) Gaps, Ambiguities, and Known Debt (Planning)

1. Retention/legal-basis final confirmation for workforce recruited inference and exports still requires policy sign-off.
2. Export schema versioning and backward-compatibility policy need explicit contract version plan.
3. Migration and backfill strategy for first production cutover requires runbook detail.
4. Command-level role matrix for every admin mutation command needs implementation-time sign-off.

## 9) Change Log

- 2026-02-24: Created initial Workforce CTF rewrite planning inventory with unified `workforce` slug, canonical recruited metric semantics, contract-template alignment, and explicit exclusion of accidental legacy event artifacts.
- 2026-02-24: Merged legacy parity scope (profile, occupations, announcements, export, admin flows) with new Workforce rewrite capabilities; standardized audit-events route, explicit skill-level/sector report endpoints, async export job model, mobile admin v1 inclusion, and weekly ET Saturday bucket policy.
- 2026-03-03: Began phase-1 implementation under `ctf/packages/web` with migration-backed API/admin routes, deterministic recruited recompute sourced from Directory profiles, seed fixtures, and export workflow deferment.

# Workforce Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Unified plugin scope slug: `workforce`
- This document is the living snapshot of Workforce per Rule 120.
- V1 scope is full legacy parity plus approved rewrite enhancements.
- Legacy accidental event artifacts from Workforce Recruiter are explicitly out of scope and must not be carried into rewrite design.

Legacy reference preservation:

- Keep `ctf/docs/developer/workforce-recruiter-feature-inventory.md` intact as reference.
- Keep `ctf/docs/developer/workforce-recruiter-rewrite-checklist.md` intact as reference.
- This document is the authoritative merged rewrite source for implementation.

## Intent and Outcome

Workforce is a deterministic workforce planning and reporting plugin with canonical metrics, auditable admin operations, migration-safe contracts, and full parity with legacy Workforce Recruiter capabilities.

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

Command groups:

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
- `POST /api/workforce/admin/sync` — incremental recruited-state sync (backs the scheduled cron).
- `POST /api/workforce/internal/sync` — internal sync trigger for the recruited-state cursor.

## 4) Data Model and Storage Contracts

### 4.1 Canonical Identity and Extension Strategy

1. Reuse canonical profile identity model; no duplicate full profile table.
2. Workforce extension entities keyed by canonical `user_id`.
3. Directory writes are upstream source for recruited-state inference.

### 4.2 Domain Entities

Tables owned by the plugin and present in `ctf/schema.sql`:

1. `workforce_profiles` (plugin extension shape only)
2. `workforce_occupations`
3. `workforce_announcements`
4. `workforce_user_extension`
5. `workforce_recruited_events` (append-only inferred events; unique on `inference_dedupe_key`)
6. `workforce_config`
7. `workforce_recruited_sync_cursor`
8. `workforce_export_jobs`
9. `workforce_admin_audit_trail`

Note: `workforce_report_snapshots` was spec'd in an early draft of the `workforce.dashboard.fetch`
command contract but was **removed by owner decision (2026-05-21)** rather than built — the dashboard
derives all state live from `workforce_profiles` / `workforce_occupations` / `workforce_announcements`
in `getDashboard()`, so no snapshot table is needed and none exists.

### 4.3 Storage and Derivation Rules

1. Recruited inference is derived from Directory profile create/update writes.
2. Inference history is append-only for traceability of mapping changes.
3. Inference writes use deterministic dedupe key (`inference_dedupe_key`, `NOT NULL`), enforced by the unique index `uq_workforce_recruited_events_dedupe_key`; repository upserts and the seed rely on `ON CONFLICT (inference_dedupe_key)`. The column is `NOT NULL` because Postgres treats NULLs as distinct in a unique index, so a null key would silently bypass dedup.
4. Replay/backfill duplicates are idempotent no-op outcomes.
5. Current-state dashboards read latest resolved state.
6. Historical dashboards read weekly trend buckets from inferred event history.
7. Weekly buckets use `America/New_York`, week start = Saturday, T+14 rolling correction then freeze.
8. No carry-over of legacy accidental event scaffolding or unrelated event models.

## 5) Canonical Metrics — Recruited Semantics

Metric definitions are locked in `ctf/config/canonical_metrics.yaml`.

Canonical definition notes for `recruited`:

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

`ctf/scripts/seedWorkforce.mjs` seeds deterministic recruited-state fixtures and admin export inputs for dev validation.

## 7.5) Web and Android Delivery Status

| Platform | Status | Notes |
|---|---|---|
| Web | ✅ Delivered | Pixel pass complete 2026-05-31. Shell rewritten to match `design/artifacts/mockup-sandbox/src/components/mockups/survivor-hub/Workforce.tsx` canonical design. Bound to real dashboard, sector-report, skill-level-report, and profile API endpoints. Fabricated stats (Employed/In Training/Seeking Work breakdown, pathways, skill counts) omitted per real-data-only policy. Loading state, empty state, 4-card hero stats, skill-level distribution bars, sector gaps table, and profile right-rail all delivered. Chat tab from mockup omitted (no backing API route). |
| Android | ✅ Delivered | User dashboard pixel-pass 2026-05-31. Admin operations screen added 2026-06-06 (`AdminWorkforce.tsx`), mirroring the web admin page (`/admin/workforce`). |

Android admin present (2026-06-06): `AdminWorkforce.tsx` + `admin-api.ts` added under `packages/mobile/src/features/workforce`, registered as the `workforce-admin` screen in `App.tsx`. It mirrors the shipped web admin page (`/admin/workforce`): the four dashboard counts (workforce total, recruited total, occupations, active announcements), the current config (exports-enabled toggle, kill-switch toggle, report timezone, week-start day-of-week), and the two operational actions (run incremental sync, recompute recruited totals). It binds only existing endpoints — `GET /api/workforce/dashboard`, `GET /api/workforce/admin/config`, `PUT /api/workforce/admin/config`, `POST /api/workforce/admin/sync`, `POST /api/workforce/admin/recompute`. Admin access is enforced server-side; a 401/403 shows an "admins only" notice. All mutations send `x-ctf-csrf: '1'`; the kill-switch flip, sync, and recompute are each behind an explicit confirm gesture. The web admin page is already mobile-responsive (Tailwind `max-w-4xl` container with stacked text sections), so no web layout change was needed. Endpoint/contract gap: the design mockup shows a "flags" moderation queue (profile/skills-gap flags), but no workforce flags endpoint exists; that tab is omitted per rule 126 and the overview/config/operations surfaces (which do have endpoints) are shown instead. Occupations and announcements admin CRUD endpoints exist but were not surfaced on Android in this pass.

## 8) Gaps and Known Technical Debt

1. Retention and legal-basis wording for workforce recruited inference and exports has not been explicitly signed off; the plugin runs under platform defaults.
2. Export schema versioning has no documented backward-compatibility contract; exporters consume the current shape.
3. Migration and backfill strategy for first production cutover relies on the generic platform migration runbook; no plugin-specific runbook exists.
4. Export job execution/result is intentionally deferred (per phase-1 product decision): `POST /api/workforce/export/jobs` records the request and `GET /api/workforce/export/jobs/[jobId]/result` return `501 exportDeferred`. The job row + audit trail are written; actual artifact generation is post-MVP.

## 9) Web and Android Delivery Status

| Surface | Status | Notes |
|---|---|---|
| Web pixel-perfect | ⬜ Not started | Web shell exists; awaiting pixel-pass PR |
| Android pixel-pass | ✅ Delivered 2026-05-31 | `WorkforceDashboard`, `WorkforceLoading`, `WorkforceEmpty`, `WorkforcePublic`, `WorkforceStatCard`, `WorkforceProfileCard` — all bound to real API routes only |
| Android admin | ✅ Delivered 2026-06-06 | `AdminWorkforce.tsx` + `admin-api.ts`; mirrors `/admin/workforce` (counts, config toggles, sync, recompute) against existing endpoints only |

### Android Mobile Parity Summary (2026-05-31)

- **Real bindings:** `GET /api/workforce/dashboard` → `fetchWorkforceDashboard()`, `GET /api/workforce/profile` → `fetchWorkforceProfile()`.
- **Delivered states:** loading, empty (zero workforce total), error, and main authenticated dashboard.
- **Public/unauthenticated state:** `WorkforcePublic` component renders the pre-auth landing with a locked content region.
- **Omitted (no API backing):** Status Distribution percentage bars, Critical Skill Gaps data, Recommended Pathways match scores, "Add Skills" / "View Demand Map" CTAs. All have inline code comments explaining the omission.
- **Stats shown from real data:** Total Members (`workforceTotal`), Recruited (`recruitedTotal`), Occupations (`occupationsTotal`), Active Announcements (`activeAnnouncementsTotal`).
- **Profile section:** occupation name, skill level, region, recruited state — all from real `GET /api/workforce/profile` response.
- **Rule 116 compliance:** dashboard logic is split across `WorkforceDashboard` (orchestration/state), `WorkforceStatCard` (stat card sub-component), `WorkforceProfileCard` (profile sub-component), `WorkforceLoading`, `WorkforceEmpty`, `WorkforcePublic` — no function exceeds 200 lines.

## 10) Change Log

- 2026-06-13: Web admin design pass. Replaced the bare diagnostic `/admin/workforce` page with `components/workforce/workforce-admin-shell.tsx`, styled to the admin design system (header with icon + ADMIN badge, snapshot stat blocks, Config + Operations panels). Bound to the real backend — `getDashboard` counts and the editable `getWorkforceConfig` (exports enabled, kill switch, report week timezone, week-start day). Real actions on existing endpoints (with `x-ctf-csrf: '1'`): save config (`PUT /api/workforce/admin/config`), recompute (`POST /api/workforce/admin/recompute`), and sync (`POST /api/workforce/admin/sync`). Occupations and announcements admin CRUD remain available via their endpoints but are not surfaced in this slice. No new endpoint, schema, or contract.
- 2026-06-12: Android API clients (`api.ts`, `admin-api.ts`) now call the backend through the shared authenticated fetch wrapper (`authedFetch`): the signed-in member's Clerk bearer token is attached and the base URL comes from runtime config, replacing the plain dev-only fetch against hardcoded emulator/localhost URLs. The admin functions no longer take a token argument (the wrapper supplies the live token); `AdminWorkforce.tsx` call sites updated. No backend, schema, or contract change.
- 2026-06-06: Android admin parity. Added `AdminWorkforce.tsx` + `admin-api.ts` and registered the `workforce-admin` screen in `App.tsx`. Mirrors the web admin page (`/admin/workforce`) against existing endpoints only: `GET /dashboard` (counts), `GET/PUT /admin/config` (exports + kill-switch toggles), `POST /admin/sync`, `POST /admin/recompute`. No backend added. Kill-switch, sync, and recompute are confirm-gated; all mutations send `x-ctf-csrf: '1'`. Web admin page was already mobile-responsive (no layout change). The mockup's "flags" queue has no endpoint and is omitted per rule 126; occupations/announcements admin CRUD remain web-only for now.
- 2026-05-31: Android pixel-pass delivered (`feat/workforce-android-pixel-pass`). Rewrote `WorkforceDashboard.tsx` to bind real API routes (`/dashboard`, `/profile`). Added `WorkforceLoading`, `WorkforceEmpty`, `WorkforcePublic`, `WorkforceStatCard`, `WorkforceProfileCard` sub-components matching `MobileWorkforce*` design mockups. Retired mock data and `setTimeout` stubs. Flipped Android row ⬜ → ✅ in readiness plan. Added "Web and Android Delivery Status" section to this inventory.

- 2026-05-31: Web pixel pass delivered. Shell rewritten to match canonical `Workforce.tsx` design mockup: exact inline hex colors (`#B45309`, `#0F1117`, `#0D0F14`, `#090B0F`), Inter type scale, lucide-react icons, three-column layout (72px icon rail + 240px sidebar + main content + 280px right panel), 4-card hero stats, skill-level distribution chart (bar per bucket), sector gaps table (supply/demand dual progress bars), loading and empty states. Chat tab omitted (no backing API). Fabricated stats (Employed/In Training/Seeking Work distribution, pathways, skill count) omitted per real-data-only policy. Files created/updated: `workforce-shell.tsx`, `workforce-icon-rail.tsx`, `workforce-sidebar.tsx`, `workforce-hero-stats.tsx`, `workforce-sector-gaps.tsx`, `workforce-skill-distribution.tsx`, `workforce-profile-panel.tsx`. TypeCheck, build, ESLint, and EOF gates all pass.

- 2026-05-30: Backend marked complete (🟡 → ✅ in the readiness plan) after audit confirmed no code/schema/contract gaps remain: all 9 `workforce_*` tables exist, all 20 routes are implemented (export job execution intentionally deferred with `501 exportDeferred`), the repository/seed are complete, and the schema-drift gate passes. Reconciled the lagging docs: removed the stale `workforce_report_snapshots` "not yet implemented / decision needed" claims (the table was removed by owner decision on 2026-05-21; the dashboard derives state live) and documented the two sync routes (`/api/workforce/admin/sync`, `/api/workforce/internal/sync`) in the API Surface. Docs-only; no code/schema/route/contract/seed changes. (A `workforce_config` singleton seed is a deferred dev-hygiene nice-to-have — routes already fall back to coded defaults — and would ship in a seed PR paired with the schema-drift seed/schema policy.)

- 2026-05-21: Added the missing unique index `uq_workforce_recruited_events_dedupe_key` on `workforce_recruited_events(inference_dedupe_key)` — without it the `ON CONFLICT (inference_dedupe_key)` upserts in `repository.ts` and the seed fail at runtime. Reconciled Domain Entities (4.2) to the 9 tables actually in `ctf/schema.sql`; flagged the `workforce_report_snapshots` contract drift and undocumented sync routes in Gaps.
- 2026-05-18: Renamed "Gaps, Ambiguities, and Known Debt (Planning)" to canonical "Gaps and Known Technical Debt" per Rule 120. Updated seed coverage status to reference shipping seed script. Removed unimplemented-feature-as-debt entry for command-level role matrix sign-off.
- 2026-02-24: Created initial Workforce CTF rewrite inventory.
- 2026-02-24: Merged legacy parity scope (profile, occupations, announcements, export, admin flows) with new Workforce rewrite capabilities; standardized audit-events route, explicit skill-level/sector report endpoints, async export job model, mobile admin v1 inclusion, and weekly ET Saturday bucket policy.
- 2026-03-03: Began phase-1 implementation under `ctf/packages/web` with migration-backed API/admin routes, deterministic recruited recompute sourced from Directory profiles, seed fixtures, and export workflow deferment.


## Build Checklist


### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work is required in `platform/`.
- [ ] Confirm legacy reference files remain intact.
  - Acceptance criteria:
    - `ctf/docs/developer/workforce-recruiter-feature-inventory.md` is unchanged.
    - `ctf/docs/developer/workforce-recruiter-rewrite-checklist.md` is unchanged.
- [ ] Confirm unified plugin slug and naming.
  - Acceptance criteria:
    - New rewrite assets use `workforce` (not `workforce-recruiter`) unless explicitly documented as legacy reference.
- [ ] Confirm accidental legacy event artifacts are excluded.
  - Acceptance criteria:
    - No legacy scaffold/event code paths from old Workforce Recruiter are included in rewrite contracts, schema, or routes.
- [ ] Confirm v1 feature scope includes full parity plus approved enhancements.
  - Acceptance criteria:
    - Included parity features: profile, occupations, announcements, reports, export, and admin management flows.
    - Included enhancements: deterministic recruited inference, canonical metric lock, recompute controls, and standardized audit-events route.
- [ ] Confirm mobile admin is in v1 scope.
  - Acceptance criteria:
    - Admin capabilities included in web and mobile parity contract/validation scope.

### Legacy Review and Contract Lock

- [ ] Review and correct sections 8 and 9 from legacy Workforce inventory before implementation starts.
  - Acceptance criteria:
    - A reviewed/corrected planning note is committed and linked from implementation kickoff PR.
- [ ] Lock plugin command contract shape.
  - Acceptance criteria:
    - Workforce commands conform to `.github/instructions/201-plugin-command-schema-template.mdc`.
- [ ] Lock access policy contract shape.
  - Acceptance criteria:
    - Workforce access policies conform to `.github/instructions/202-plugin-access-policy-schema-template.mdc`.
- [ ] Lock audit contract shape.
  - Acceptance criteria:
    - Workforce audit events conform to `.github/instructions/203-plugin-audit-schema-template.mdc`.
- [ ] Confirm template bundle compliance.
  - Acceptance criteria:
    - Planning evidence references `.github/instructions/200-plugin-command-contract-templates.mdc` and all required template files.
- [ ] Lock route shape and naming decisions.
  - Acceptance criteria:
    - Drilldowns are explicit routes: `reports/skill-level/:skillLevel` and `reports/sector/:sector`.
    - Admin audit route is standardized: `GET /api/workforce/admin/audit-events`.
    - Export uses async jobs: create/status/result route family.
- [ ] Confirm contract-first-in-parallel execution mode.
  - Acceptance criteria:
    - Command/policy/audit contracts can be implemented in parallel with route handlers.

### Canonical Metric Definition Lock

- [ ] Define and lock `recruited` canonical metric in `ctf/config/canonical_metrics.yaml`.
  - Acceptance criteria:
    - Metric entry includes required fields from `.github/instructions/121-canonical-metric-registry-rules.mdc` (`id`, `name`, `description`, `owner`, `data_type`, `unit`, `calculation`, `inputs`, `example_values`, `last_updated`).
- [ ] Lock recruited derivation semantics.
  - Acceptance criteria:
    - Definition states automatic derivation from Directory profile create/update writes only.
    - Definition states no manual admin/user trigger exists.
    - Definition states append-only inferred history for mapping changes.
    - Definition states live dashboard uses current state and historical dashboard uses weekly trend buckets from event history.
- [ ] Lock historical bucket and correction policy.
  - Acceptance criteria:
    - Week start day is Saturday.
    - Timezone is `America/New_York`.
    - Late-arrival correction window is T+14 days then bucket freeze.
- [ ] Record metric check evidence.
  - Acceptance criteria:
    - PR includes metric registry check output and explicit canonical metric identifier mapping.

### Schema and Drift Readiness

- [ ] Define Workforce schema and migration plan in `ctf/migrations/`.
  - Acceptance criteria:
    - Migration replay and rollback strategy are documented.
- [ ] Add append-only inferred recruited event storage model.
  - Acceptance criteria:
    - Model supports immutable history and weekly historical bucketing inputs.
- [ ] Add deterministic inference idempotency model.
  - Acceptance criteria:
    - `inference_dedupe_key` is deterministic hash over canonical source/user/version fields.
    - Unique constraint prevents duplicate replay/backfill writes.
    - Duplicate replays produce idempotent no-op behavior.
- [ ] Run schema drift checks and capture evidence.
  - Acceptance criteria:
    - Drift validation aligns to `.github/instructions/122-schema-drift-predeployment-rules.mdc` and is attached in PR evidence.
- [ ] Enforce schema/contract version compatibility decision.
  - Acceptance criteria:
    - PR declares `Schema Drift: none`, `compatible`, or `versioned-breaking` with required details.

### API and Behavior Implementation Readiness

- [ ] Finalize Workforce API route map and command mapping.
  - Acceptance criteria:
    - Planned routes/commands are versioned and mapped to policy/audit contracts.
- [ ] Implement full parity API groups in Workforce namespace.
  - Acceptance criteria:
    - Profile/config/occupations/reports/announcements/export/admin routes exist under `workforce` slug.
    - No new API contract uses `workforce-recruiter` slug.
- [ ] Validate recruited inference trigger boundaries.
  - Acceptance criteria:
    - Only Directory create/update writes can produce recruited inference events.
- [ ] Add regression guard against manual recruited event mutation paths.
  - Acceptance criteria:
    - Validation gate fails if user/admin-triggered recruited event creation is introduced.

### Security and Compliance Gates

- [ ] Verify authz + CSRF coverage for all state-changing operations.
  - Acceptance criteria:
    - No state-changing endpoint bypasses CSRF or role policy checks.
- [ ] Lock unified web/mobile deny taxonomy.
  - Acceptance criteria:
    - Shared deny reasons are enforced for both web and mobile server-side policy outcomes.
    - At minimum include: `unauthenticated`, `insufficient_role`, `cross_workspace_access`, `missing_consent`, `region_not_permitted`, `csrf_missing`, `csrf_invalid`, `invalid_source_event`, `idempotency_replay`.
- [ ] Verify deletion/profile contract alignment.
  - Acceptance criteria:
    - Workforce behavior is documented against `ctf/docs/templates/PLUGIN_PROFILE_AND_DELETION_CONTRACT_TEMPLATE.md`.
- [ ] Verify audit parity for allow/deny outcomes.
  - Acceptance criteria:
    - Audit contract evidence includes both success and denied operation cases.

### Validation, Seeds, and Non-Regression Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] Command/policy/audit schema design documentation. [MANUAL TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Valid and invalid payload paths for all core commands are documented.
- [ ] Recruited derivation and dashboard semantics design documentation.
  - Acceptance criteria:
    - Live current-state and historical weekly-bucket behavior is documented.
- [ ] Parity user/admin flows design scope. [PARITY TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Profile, occupations, announcements, report drilldowns, and export job flows are documented for post-MVP testing.
- [ ] Deterministic seed fixtures for Directory-write-derived recruited history.
  - Acceptance criteria:
    - Seed outputs are deterministic and schema-compatible.
- [ ] Non-regression guard for legacy event artifacts.
  - Acceptance criteria:
    - Lint gate fails if legacy accidental event artifact patterns are reintroduced.

### PR Evidence and Release Readiness

- [ ] Include schema drift and migration evidence in PR.
  - Acceptance criteria:
    - PR includes drift check output, migration replay evidence, rollback notes, and compatibility decision.
- [ ] Implementation tracking. [EVIDENCE COLLECTION DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Implementation status is tracked; detailed evidence collection deferred to post-MVP.
- [ ] Confirm inventory + checklist lifecycle compliance.
  - Acceptance criteria:
    - `ctf-workforce-feature-inventory.md` and this checklist are updated in the same PR as behavior/contract changes.

### Change Log

- 2026-02-24: Created initial Workforce rewrite checklist with phase gates for legacy section review, canonical metric lock, schema drift evidence, and non-regression controls preventing accidental legacy event artifacts.
- 2026-03-03: Phase-1 implementation initiated with workforce migration, API/admin route baseline, canonical metric alignment update, and schema drift gate validation evidence.

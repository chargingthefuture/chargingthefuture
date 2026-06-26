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

1. Inventory/checklist lifecycle follows `.claude/rules/120-plugin-feature-inventory-lifecycle-rules.mdc`.
2. Metric definitions and rewrite planning align to `.claude/rules/121-canonical-metric-registry-rules.mdc`.
3. Schema and contract planning align to `.claude/rules/122-schema-drift-predeployment-rules.mdc`.
4. Plugin command/access/audit planning aligns to `.claude/rules/200-plugin-command-contract-templates.mdc` and templates `201`/`202`/`203`.

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

## 2) Admin Features

### 2.1 Workforce Admin Operations

1. Admin route(s) for workforce config, assumptions, report controls, and parity management surfaces.
2. Role-gated create/update/deactivate operations for workforce admin objects.
3. Operator-visible audit and change-history views.

### 2.2 Workforce Admin Occupations (Parity)

1. Admin occupations create/update/delete operations.
2. Server-enforced role + policy checks for every mutation.
3. Mutation outcomes emitted to standardized workforce admin audit events.

### 2.3 Workforce Configuration Governance

1. Controlled mutation of planning assumptions and policy flags.
2. Validation and safe defaults on all state-changing admin operations.
3. Feature flags for risky behavior changes.

### 2.4 Data Stewardship Controls

1. Admin tools for reconciliation diagnostics against canonical Directory state.
2. No admin backfill/recompute tool: Workforce is read-only and recruited state derives live from Directory (claimed profiles), so there is nothing to recompute. The previous recompute control and its `workforce.admin.recompute.enqueue` command were removed (read-only model, owner decision 2026-06-16).
3. Explicit exclusion checks for accidental legacy event artifact reintroduction.

## 3) API Surface and Route Map

### 3.1 Plugin Command Surface

All command contracts must conform to:

- `.claude/rules/201-plugin-command-schema-template.mdc`
- `.claude/rules/202-plugin-access-policy-schema-template.mdc`
- `.claude/rules/203-plugin-audit-schema-template.mdc`

Command groups:

1. `workforce.dashboard.fetch`
2. `workforce.profile.fetch` (the occupation/skill view is a live read-only Directory view; the read-only availability/work preferences and the deletion marker come from `workforce_user_extension`)
4. `workforce.profile.delete` (service-scoped compliance soft delete: set `service_deleted_at`, reset preference payloads, write `workforce_deletion_events`; `workforce_recruited_events` retained; CSRF + ownership). Note: `workforce.profile.update` is intentionally retired — the profile is read-only (owner decision 2026-06-16, reaffirmed).
6. `workforce.occupations.list`
7. `workforce.occupations.detail.fetch`
8. `workforce.occupations.admin.create`
9. `workforce.occupations.admin.update`
10. `workforce.occupations.admin.delete`
11. `workforce.report.summary.fetch`
12. `workforce.report.skillLevel.fetch`
13. `workforce.report.sector.fetch`
14. `workforce.export.job.create`
15. `workforce.export.job.status.fetch`
16. `workforce.export.job.result.fetch`
17. `workforce.admin.config.fetch`
18. `workforce.admin.config.update`
19. `workforce.admin.auditEvents.fetch`
20. `workforce.metric.recruited.derive`

### 3.2 HTTP Projection Routes

User routes:

- `GET /api/workforce/dashboard`
- `GET /api/workforce/profile` — the occupation/skill section is a live read-only view of the member's own claimed Directory profile (occupation = job title, skill level derived, recruited = claimed); the availability/work preferences and the `service_deleted_at` marker are read from `workforce_user_extension`. Emits a `workforce.profile.fetch` audit event. There is no profile update path — the profile is read-only (owner decision 2026-06-16, reaffirmed).
- `DELETE /api/workforce/profile` — service-scoped compliance soft delete (deletion contract sections 5/8/9): sets `service_deleted_at = NOW()` and resets `availability_preferences` / `work_preferences` to `{}` on `workforce_user_extension`, writes a `workforce_deletion_events` row, and retains `workforce_recruited_events`. Requires CSRF + ownership. Emits the `workforce.profile.delete` audit event(s).
- `GET /api/workforce/occupations`
- `GET /api/workforce/occupations/:id`
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
- `GET /api/workforce/admin/audit-events`

## 4) Data Model and Storage Contracts

### 4.1 Canonical Identity and Extension Strategy

1. Reuse canonical profile identity model; no duplicate full profile table.
2. Workforce extension entities keyed by canonical `user_id`.
3. Directory writes are upstream source for recruited-state inference.

### 4.2 Domain Entities

Tables owned by the plugin and present in `ctf/schema.sql`:

1. `workforce_profiles` (plugin extension shape only)
2. `workforce_occupations`
3. `workforce_user_extension`
4. `workforce_recruited_events` (append-only inferred events; unique on `inference_dedupe_key`)
5. `workforce_config`
6. `workforce_recruited_sync_cursor`
7. `workforce_export_jobs`
8. `workforce_admin_audit_trail`
9. `workforce_deletion_events` (service-scoped deletion event log written by `DELETE /api/workforce/profile`; columns `id`, `user_id`, `scope`, `plugin_id`, `requested_at`, `processed_at`, `result`, `request_id`, `trace_id`, `created_at` — deletion contract section 8)

Note: `workforce_report_snapshots` was spec'd in an early draft of the `workforce.dashboard.fetch`
command contract but was **removed by owner decision (2026-05-21)** rather than built — the dashboard
derives all state live from `workforce_profiles` / `workforce_occupations`
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

Android admin present (2026-06-06): `AdminWorkforce.tsx` + `admin-api.ts` added under `packages/mobile/src/features/workforce`, registered as the `workforce-admin` screen in `App.tsx`. It mirrors the shipped web admin page (`/admin/workforce`): the four dashboard counts (workforce total, recruited total, occupations, active announcements), the current config (exports-enabled toggle, report timezone, week-start day-of-week), and the two operational actions (run incremental sync, recompute recruited totals). It binds only existing endpoints — `GET /api/workforce/dashboard`, `GET /api/workforce/admin/config`, `PUT /api/workforce/admin/config`, `POST /api/workforce/admin/sync`, `POST /api/workforce/admin/recompute`. Admin access is enforced server-side; a 401/403 shows an "admins only" notice. All mutations send `x-ctf-csrf: '1'`; the sync and recompute are each behind an explicit confirm gesture. The web admin page is already mobile-responsive (Tailwind `max-w-4xl` container with stacked text sections), so no web layout change was needed. Endpoint/contract gap: the design mockup shows a "flags" moderation queue (profile/skills-gap flags), but no workforce flags endpoint exists; that tab is omitted per rule 126 and the overview/config/operations surfaces (which do have endpoints) are shown instead. Occupations and announcements admin CRUD endpoints exist but were not surfaced on Android in this pass.

Profile read + compliance-delete surface (2026-06-26): the profile is read-only (owner decision 2026-06-16, reaffirmed) — there is no `PUT`. `GET /api/workforce/profile` now emits a `workforce.profile.fetch` audit and reads the real extension preferences/marker; `DELETE /api/workforce/profile` is the only mutation — a service-scoped soft delete per the deletion contract. These are backend API routes; the web profile panel and the mobile `WorkforceProfileCard` remain display-only, so there is no new rendered surface and no web/mobile parity gap. A member-facing delete control can be added later against the DELETE route.

## 8) Gaps and Known Technical Debt

1. Retention and legal-basis wording for workforce recruited inference and exports has not been explicitly signed off; the plugin runs under platform defaults.
2. Export schema versioning has no documented backward-compatibility contract; exporters consume the current shape.
3. Migration and backfill strategy for first production cutover relies on the generic platform migration runbook; no plugin-specific runbook exists.
4. Export job execution/result is intentionally deferred (per phase-1 product decision): `POST /api/workforce/export/jobs` records the request and `GET /api/workforce/export/jobs/[jobId]/result` return `501 exportDeferred`. The job row + audit trail are written; actual artifact generation is post-MVP.

## 9) Web and Android Delivery Status

| Surface | Status | Notes |
|---|---|---|
| Web pixel-perfect | ⬜ Not started | Web shell exists; awaiting pixel-pass PR |
| Android pixel-pass | ✅ Delivered 2026-05-31 | `WorkforceDashboard`, `WorkforceLoading`, `WorkforceEmpty`, `WorkforcePublic`, `WorkforceStatCard`, `WorkforceProfileCard` — all bound to real API routes only. Standalone `WorkforceProfile` screen wired to real auth + real `GET /api/workforce/profile` on 2026-06-26 (was a stub). |
| Android admin | ✅ Delivered 2026-06-06 | `AdminWorkforce.tsx` + `admin-api.ts`; mirrors `/admin/workforce` (counts, config toggles, sync, recompute) against existing endpoints only |

### Android Mobile Parity Summary (2026-05-31)

- **Real bindings:** `GET /api/workforce/dashboard` → `fetchWorkforceDashboard()`, `GET /api/workforce/profile` → `fetchWorkforceProfile()`.
- **Delivered states:** loading, empty (zero workforce total), error, and main authenticated dashboard.
- **Public/unauthenticated state:** `WorkforcePublic` component renders the pre-auth landing with a locked content region.
- **Omitted (no API backing):** Status Distribution percentage bars, Critical Skill Gaps data, Recommended Pathways match scores, "Add Skills" / "View Demand Map" CTAs. All have inline code comments explaining the omission.
- **Stats shown from real data:** Total Members (`workforceTotal`), Recruited (`recruitedTotal`), Occupations (`occupationsTotal`).
- **Profile section:** occupation name, skill level, region, recruited state — all from real `GET /api/workforce/profile` response.
- **Rule 116 compliance:** dashboard logic is split across `WorkforceDashboard` (orchestration/state), `WorkforceStatCard` (stat card sub-component), `WorkforceProfileCard` (profile sub-component), `WorkforceLoading`, `WorkforceEmpty`, `WorkforcePublic` — no function exceeds 200 lines.

## 10) Change Log

- 2026-06-26: Removed the dead mobile admin sync/recompute buttons and the orphaned recompute command (code-review issues #823, #816 for sync; #841, #815 for recompute). The Android admin screen (`AdminWorkforce.tsx`) still POSTed to `/api/workforce/admin/sync` and `/api/workforce/admin/recompute`, but those routes were deliberately removed on 2026-06-16 when Workforce became read-only and recruited state began deriving live from Directory — so both buttons always returned 404. Owner decision: keep Workforce read-only; remove the dead client surface rather than recreate the routes. Deleted `runAdminSync` and `runAdminRecompute` from `admin-api.ts` (kept `fetchAdminOverview` and `updateAdminConfig`); removed the two buttons, the `runSync`/`runRecompute` handlers, the `'sync'`/`'recompute'` `busy` states, the now-unused styles, and the unused `Alert`/`Pressable` imports from `AdminWorkforce.tsx`; the config save flow is unchanged. Updated the admin subtitle to "Operational controls: config." Removed the orphaned `workforce.admin.recompute.enqueue` command from all three contract files (`WORKFORCE_PLUGIN_COMMAND_CONTRACTS.yaml`, `WORKFORCE_PLUGIN_ACCESS_POLICY_CONTRACTS.yaml`, `WORKFORCE_PLUGIN_AUDIT_CONTRACTS.yaml`); there was no `workforce.admin.sync.*` command to remove. No schema change; no utility-token (credits) behavior change.
- 2026-06-26: Workforce profile read path audit + compliance delete; profile update retired (code-review issues #839, #819, #842, #821, #814, #824, #812, #822, #843, #813). `GET /api/workforce/profile` now emits the `workforce.profile.fetch` audit and reads the real `availability_preferences` / `work_preferences` / `service_deleted_at` from `workforce_user_extension`. Added `DELETE /api/workforce/profile` — service-scoped compliance soft delete (sets `service_deleted_at`, resets the preference payloads, writes the new `workforce_deletion_events` table, retains `workforce_recruited_events`; CSRF + ownership) with `workforce.profile.delete` audit events. `workforce.profile.update` is intentionally retired (profile is read-only, owner decision 2026-06-16 reaffirmed): its command / access-policy / audit entries were removed from the three contract YAMLs rather than implemented.
- 2026-06-26: Wired the standalone Android `WorkforceProfile` screen to real auth and a real API call (resolves code-review issues #845 and #827, duplicates). The screen previously defined its own local `AuthContext` (never provided a real value, so `isAuthenticated` was always false) and loaded data with a `setTimeout(() => setProfile(null), 1000)` stub marked `TODO: Replace with real API call`, so it always showed the unauthenticated / no-profile state and never hit `GET /api/workforce/profile`. It now uses `usePluginAuth('clerk')` for auth (matching `WorkforceDashboard`/`AdminWorkforce`) and `fetchWorkforceProfile()` (existing function in `api.ts`, already calling `GET /api/workforce/profile` via the shared `authedFetch`). States covered: loading (while auth resolves or the fetch is in flight), unauthenticated (sign-in prompt), error, empty (no profile / 404 → `null`), and populated. The populated state reuses the shared `WorkforceProfileCard`, so it renders only the real fields the API returns (occupation name, skill level, region, recruited state) — the old fabricated `name`/`role`/`skills` fields are gone. No backend, schema, contract, or route change.
- 2026-06-26: Fixed export-job correctness and audit-evidence gaps (code-review issues #825, #844, #817). (1) `createDeferredExportJob` no longer sets `completed_at = NOW()` for a `deferred` job — `completed_at` is left NULL because a deferred job has not completed (`completed_at` dropped from the INSERT column/values list so it defaults NULL). (2) The export POST route (`POST /api/workforce/export/jobs`) now validates `exportType` against an explicit whitelist (`summary`, `skill-level`, `sector` — `WORKFORCE_EXPORT_TYPES` in `lib/workforce/constants.ts`, mirrored as an `enum` on the `workforce.export.job.create` `inputSchema` in `WORKFORCE_PLUGIN_COMMAND_CONTRACTS.yaml`) and rejects an unknown value with `WORKFORCE_INVALID_PAYLOAD` / 400 before any job row is written. (3) The route now emits the structured `logWorkforceAudit` event in addition to the existing `insertWorkforceAdminAudit` row, and both carry the full evidence object the audit contract (`WORKFORCE_PLUGIN_AUDIT_CONTRACTS.yaml`, `workforce.export.job.create`) requires — `roleCheck`, `exportScopeCheck`, `piiGuardCheck` (the command is `containsPHI=true`, so the PII-guard evidence is mandatory), and `defermentCheck` for the deferred variant. No schema, contract field, or route surface added; the command contract gained only the `exportType` enum to match the code.
- 2026-06-18: Removed per-plugin announcements from Workforce. Deleted the admin Announcements tab and its component (`workforce-admin-announcements.tsx`), the `activeAnnouncementsTotal` dashboard stat card (web hero stats + admin shell), the user/admin announcement routes (`/api/workforce/announcements`, `/api/workforce/admin/announcements` and its `:id` route), the repository announcement types/mappers/validators/functions (`listAnnouncements`, `createAnnouncement`, `updateAnnouncement`, `deactivateAnnouncement`, `mapAnnouncement`, `validateAnnouncementInput`, `WorkforceAnnouncementRow`) and the `activeAnnouncementsTotal` dashboard count, the `WorkforceAnnouncement`/`WorkforceAnnouncementInput` types and the `activeAnnouncementsTotal` field on `WorkforceDashboard`, the five `workforce.announcements.*` command contracts, and the announcements seed block. Unlike LightHouse/SocketRelay (which read the shared `announcements` table by targeting), Workforce had its own dedicated `workforce_announcements` table; that table is dropped from `schema.sql` and a guarded `DROP TABLE IF EXISTS workforce_announcements;` migration was added at `ctf/db/migrations/post/0007_drop_workforce_announcements.sql`. Announcements are now posted in one place — the Feed (`feed-announcements` plugin), which can target any plugin (including Workforce) — so the Feed is the single place to post announcements about Workforce. Sections 1.5, 2.3, the announcement command/route/data-model entries, and the announcement dashboard stat were removed above to match.
- 2026-06-17: Removed the Workforce kill switch (owner decision — unapproved agentic addition). Dropped `workforce_config.kill_switch_enabled` (`schema.sql` + `schema.demo.sql` add a guarded `DROP COLUMN IF EXISTS`), the `killSwitchEnabled` field on `WorkforceConfig`/`WorkforceConfigInput`, its validation, the `PUT /api/workforce/admin/config` parse/audit usage, the web admin toggle, and the Android admin toggle + confirm dialog. Part of a product-wide kill-switch removal (also feed and Foundation). Exports toggle and report-week settings are unchanged. (The earlier dated entries below still mention the kill switch as the historical record of when it existed.)
- 2026-06-13: Web admin CRUD. Added Occupations and Announcements tabs to the admin shell (the Config + Operations panels move under an Overview tab). Occupations (`components/workforce/workforce-admin-occupations.tsx`): add (`POST /api/workforce/admin/occupations`), hide/show (`PUT …/occupations/:id` with `isActive` flipped), and delete (`DELETE …/occupations/:id`). Announcements (`components/workforce/workforce-admin-announcements.tsx`): post (`POST /api/workforce/admin/announcements`) and delete (`DELETE …/announcements/:id`). All with `x-ctf-csrf: '1'`; split into their own components for the rule-116 size budget. No new endpoint, schema, or contract.
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
    - Workforce commands conform to `.claude/rules/201-plugin-command-schema-template.mdc`.
- [ ] Lock access policy contract shape.
  - Acceptance criteria:
    - Workforce access policies conform to `.claude/rules/202-plugin-access-policy-schema-template.mdc`.
- [ ] Lock audit contract shape.
  - Acceptance criteria:
    - Workforce audit events conform to `.claude/rules/203-plugin-audit-schema-template.mdc`.
- [ ] Confirm template bundle compliance.
  - Acceptance criteria:
    - Planning evidence references `.claude/rules/200-plugin-command-contract-templates.mdc` and all required template files.
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
    - Metric entry includes required fields from `.claude/rules/121-canonical-metric-registry-rules.mdc` (`id`, `name`, `description`, `owner`, `data_type`, `unit`, `calculation`, `inputs`, `example_values`, `last_updated`).
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
    - Drift validation aligns to `.claude/rules/122-schema-drift-predeployment-rules.mdc` and is attached in PR evidence.
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

- 2026-06-26: Workforce profile stays read-only; added the missing fetch audit and a compliance delete, and resolved the code-review drift (issues #812, #842, #821, #843, #813, #839, #819, #822, #814, #824). The profile is read-only per the owner decision (2026-06-16, reaffirmed), so `workforce.profile.update` and its `PUT /api/workforce/profile` are intentionally retired — the update-related issues are resolved by REMOVING the command, not implementing it. Removed from the contracts: the `workforce.profile.update` entry in the command, access-policy, and audit YAMLs. What the change keeps/adds: (1) `GET /api/workforce/profile` now emits a `workforce.profile.fetch` audit and reads the real `availability_preferences` / `work_preferences` / `service_deleted_at` from `workforce_user_extension` instead of hard-coding `{}`/`null` (`getOwnProfile` + new `getOwnExtension`); (2) `DELETE /api/workforce/profile` — the only mutation — soft-deletes per the deletion contract (set `service_deleted_at = NOW()`, reset both preference payloads to `{}`), writes a `workforce_deletion_events` row, retains `workforce_recruited_events`, and emits the `workforce.profile.delete` audit event(s) (`softDeleteOwnProfile`, `insertWorkforceDeletionEvent`). New table `workforce_deletion_events` added to `schema.sql` + `schema.demo.sql`. The profile route now exposes GET + DELETE only — no PUT. Backend only; the web profile panel and mobile `WorkforceProfileCard` stay display-only, so no UI/parity change.
- 2026-06-16: Read-only Workforce profile. `getOwnProfile` now derives the member's profile live from their own claimed Directory profile (occupation = Skills Taxonomy job title, skill level derived via `lib/workforce/skill-level.ts`, recruited = claimed), instead of reading `workforce_profiles`. Removed the profile editor path: `upsertOwnProfile` / `deleteOwnWorkforceProfile` and the `POST` / `PUT` / `DELETE /api/workforce/profile` handlers (the route is now `GET`-only), plus the now-orphaned `validateProfileInput` / `normalizeSkillLevel` / `ensureOccupationExists` / `mapWorkforceProfile` helpers. The web profile panel and the mobile `WorkforceProfileCard` were already display-only, so no UI change. `workforce_profiles` / `workforce_recruited_events` / `workforce_recruited_sync_cursor` are now written by nothing; they are still listed in the deletion registry (purged on deletion) and dropped from the schema in the immediate follow-up PR. The `workforce.profile.create/update/delete` commands are retired.
- 2026-06-16: Removed the dead recruited-state sync and recompute. Now that the dashboard/reports derive recruited live from Directory (claimed profiles), the sync that copied Directory into `workforce_profiles` served no read path — and it had no scheduled job, so it never ran. Deleted `runIncrementalRecruitedSync` and `enqueueRecruitedRecompute` from the repository, the routes `POST /api/workforce/admin/sync`, `POST /api/workforce/internal/sync`, and `POST /api/workforce/admin/recompute`, and the Recompute/Sync buttons from the admin shell (Save config stays). Step toward the owner-approved read-only Workforce model (2026-06-16). Still to do (next PR): make the user profile a read-only Directory-derived view (remove the editor + `upsertOwnProfile`/`deleteOwnWorkforceProfile`) and drop the now-unused `workforce_profiles` / `workforce_recruited_events` / `workforce_recruited_sync_cursor` tables via the schema process.
- 2026-06-16: Workforce reads now derive live from Directory (the single source of truth), not a synced `workforce_profiles` copy. `getDashboard`, `fetchSummaryReport`, and `fetchSectorReport` query `directory_profiles` directly — total = active profiles, recruited = claimed (`claimed_by_user_id IS NOT NULL`), sector grouping via `skills_taxonomy_sectors`. This fixes the dashboard showing 0 while ~62–67 directory profiles exist: the recruited-state sync (`runIncrementalRecruitedSync`) had no scheduled job and never populated the copy. The skill-level breakdown (`fetchSkillLevelReport`) keeps full V2 parity: V2 derived skill level algorithmically from the job-title name (case-insensitive keyword match → Foundational / Intermediate / Advanced), not from a stored field. That rule is ported verbatim to `lib/workforce/skill-level.ts` and applied live to each active directory profile's Skills Taxonomy job title — no stored column, no seed, no drift. Follow-up (separate PR): the now-vestigial `workforce_profiles` write path, the recruited sync routes, and the per-sector/per-skill detail report endpoints should be removed or likewise re-pointed at Directory (the skill-level drill-down should reuse `deriveWorkforceSkillLevel`). No schema or contract change in this PR; response shapes are unchanged.
- 2026-02-24: Created initial Workforce rewrite checklist with phase gates for legacy section review, canonical metric lock, schema drift evidence, and non-regression controls preventing accidental legacy event artifacts.
- 2026-03-03: Phase-1 implementation initiated with workforce migration, API/admin route baseline, canonical metric alignment update, and schema drift gate validation evidence.

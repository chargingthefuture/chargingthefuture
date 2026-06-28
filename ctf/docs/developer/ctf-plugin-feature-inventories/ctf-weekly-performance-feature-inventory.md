# Weekly Performance Plugin Feature Inventory (CTF Rewrite)

## Scope and Boundary

- Rewrite target only: `ctf/`
- Legacy `platform/` is reference-only and must not be modified.
- Plugin name: `Weekly Performance`
- Plugin slug / service key: `weekly-performance`
- This document defines plugin-owned rewrite scope for weekly performance review capabilities.

## Intent and Outcome

Weekly Performance is a plugin-owned analytics review surface for authorized operators.

This plugin must:

1. provide deterministic week-based performance reporting,
2. provide clear week-over-week comparison outputs,
3. enforce policy-safe admin access and action auditing,
4. provide stable read contracts for web and Android parity consumers.

---

## 1) User and Admin Feature Scope

### 1.1 User-Facing Scope

1. Weekly Performance is admin-only; there is no general user-facing dashboard.
2. Authorized non-admin read-only access is not currently exposed.

### 1.2 Admin Feature Scope

1. Saturday-based week selection (`yyyy-MM-dd`) with deterministic parsing and display range labels.
2. Previous/current/next week navigation with future-week guardrails.
3. Current-week live-state semantics with current-week-only polling and focus refetch behavior.
4. Weekly metrics card set for growth, user-state, and engagement outcomes (non-financial only).
5. Week-over-week comparison table with deterministic baseline fields for non-financial metrics.
6. Distinct loading, empty, missing-metrics, and error states for review safety.
7. Controlled export/report action surface if approved in contract lock.

## 2) API and Command Surface

### 2.1 Plugin Command Surface (Authoritative)

All command/access/audit contracts follow templates `201`/`202`/`203`.

Command groups:

1. `weekly-performance.week.list`
2. `weekly-performance.week.get`
3. `weekly-performance.metrics.get`
4. `weekly-performance.comparison.get`
5. `weekly-performance.report.export`

### 2.2 HTTP Projection Routes

The route set below is the **shipped** surface (the earlier draft above named a
different, never-built `/admin/weeks/:weekStart/...` shape; the routes that
actually exist are listed here).

Read routes (admin or approved user). Each writes a `weekly_performance_audit_trail` row on an allow decision:

- `GET /api/weekly-performance/weeks` — tracked weeks (most recent 52); audits `weekly-performance.week.list`.
- `GET /api/weekly-performance/weeks/[weekStart]` — canonical window metadata for an arbitrary week start date (`{weekStart, weekEnd, isCurrentWeek, status}`); this is the full `weekly-performance.week.get` surface (accepts any `weekStart`, validated as an ISO `YYYY-MM-DD` date), audits `weekly-performance.week.get`.
- `GET /api/weekly-performance/current-week` — convenience read of the **current** week plus active-user count (last 7 days); also audits `weekly-performance.week.get` (it is the current-week-only projection of that command, not the parameterized surface).
- `GET /api/weekly-performance/metrics?weekStartDate=...[&compareWeekStartDate=...]` — week metrics, or a week-over-week comparison when `compareWeekStartDate` is supplied; audits `weekly-performance.metrics.get` or `weekly-performance.comparison.get` per branch.

Admin-or-operations routes (`ensureWeeklyPerformanceAdmin` admits `isAdmin` or the `operations` role):

- `PUT /api/weekly-performance/admin/week-selection` — marks a week active (body `{ weekStartDate }`); requires the `x-ctf-csrf: '1'` header and writes a `weekly-performance.admin.week.select` audit row.
- `GET /api/weekly-performance/export?weekStartDate=...` — returns the week's metrics snapshot as a synchronous inline JSON download (`{ok, weekStartDate, metrics}`); additionally guarded by the `WEEKLY_PERFORMANCE_EXPORT_ENABLED` environment flag and writes a `weekly-performance.report.export` audit row. There is no asynchronous artifact pipeline (no `exportId`/`artifactUrl`/`weekly_performance_exports` record) — the command contract was reconciled to this shipped behavior (#1128).

## 3) Data Dependencies and Contracts

1. Aggregated users-domain metrics (new users, verification/approval totals).
2. Aggregated engagement-domain metrics (DAU/MAU and week comparison signals).
3. Aggregated plugin event metrics (approved non-financial weekly outcome signals).
4. Deterministic week-boundary contract (Saturday-start unless revised during lock).
5. Canonical metric definitions/versioning for all comparison fields.
6. Week payload contract includes explicit current-week and previous-week boundary metadata.

### 3.1 Owned storage tables

The aggregates above are persisted in two tables in `ctf/schema.sql`:

- `weekly_performance_metrics` — the per-week aggregate store. One row per metric: `id`, `week_start_date` (DATE), `metric_key`, `metric_value` (NUMERIC), `metric_unit`, `source_plugin`, `created_at`.
- `weekly_performance_audit_trail` — the admin allow/deny audit log. Columns: `id`, `actor_id`, `command`, `policy_status`, `reason`, `target_type`, `target_id`, `metadata` (jsonb), `created_at` — the audit coverage required by §4.4.

## 4) Security and Compliance Controls

1. Admin-only authorization for plugin admin read/report commands.
2. Server-side RBAC/ABAC checks and deny-by-default policy enforcement.
3. CSRF protection for mutation endpoints (including export/report actions).
4. Audit coverage for allow/deny decisions and report exports.
5. Privacy-safe field handling for sensitive operator metrics and exports.

## 5) Web and Android Delivery Status

`web+android complete`. Week-selector behavior, current-week polling policy, empty/error semantics, metric definitions, formatting, and deny reasons are consistent across web (`/apps/weekly-performance`) and Android (`packages/mobile/src/features/weekly-performance`).

Web pixel pass (design `c5d83c0`): the user-facing shell is rebuilt to `design/.../survivor-hub/WeeklyPerformance.tsx` and its Empty/Loading states — icon rail, week-history sidebar, metric cards, a this-week-vs-last-week comparison chart, and a week-summary right rail. Week selection drives `GET /api/weekly-performance/weeks`, `/current-week`, and `/metrics` (with `compareWeekStartDate` for per-metric deltas); admin export opens `GET /api/weekly-performance/export`. Real data only — the mockup's fabricated daily series became a real per-metric current-vs-compare chart scaled relative to the max value in view, metric labels are humanized from `metric_key` (no label column exists), and the unbacked "Top Apps" widget was omitted rather than faked. Decomposed into modular sub-components within the rule-116 limits.

Admin surface (2026-06-06): the admin page `app/admin/weekly-performance/page.tsx` was a thin server stub (it printed only the current week and the tracked-week count). It is now a real, mobile-responsive admin UI. The server page keeps the same admin gate as the other `app/admin/<plugin>/page.tsx` pages (`evaluatePluginAccess({ requireApprovedUserOrAdmin: true })`, then `redirect('/apps/weekly-performance')` when `!decision.isAdmin`) and renders a new client shell `components/weekly-performance/wp-admin-shell.tsx`. The shell uses `useIsMobile()` so the owner can run it on iOS: it lists tracked weeks and the current week, lets the admin pick a week and **set it active** (`PUT /api/weekly-performance/admin/week-selection` with `x-ctf-csrf: '1'`), shows that week's metrics, and offers the export action (`GET /api/weekly-performance/export`). Loading, empty, populated, and success/error feedback states are all handled. A matching Android admin screen (`packages/mobile/src/features/weekly-performance/AdminWeeklyPerformance.tsx`, design `MobileWeeklyPerformanceAdminView.tsx`) was added and registered in `App.tsx`; it is admin-gated client-side (`useAuth().user.isAdmin`), binds to the same routes via a new `selectActiveWeek` helper in `api.ts`, and keeps the Metrics and History tabs. The mockup's fabricated plugin-breakdown and daily bar chart are omitted (no backing API field), per real-data-only policy.

Android pixel pass (design `MobileWeeklyPerformance.tsx`, 2026-05-31): the mobile screen (`packages/mobile/src/features/weekly-performance/WeeklyPerformance.tsx`) is fully rewritten to align with the canonical mockup. A new `api.ts` is introduced, binding to the same three read routes used by web (`GET /api/weekly-performance/weeks`, `/current-week`, `/metrics`). Four states are implemented: Loading (brand phrases centered), Public/unauthenticated (blurred metric preview with lock overlay and sign-in CTA), Empty (week in progress with placeholder cards), and Populated (metrics grid + history tab). Metric cards are driven by known `metricKey` values (`member_count`, `signups`, `engagements`, `gdp_delta`); the mockup's "Daily Engagements" bar chart has no backing API field (metrics are weekly aggregates only) and is omitted per real-data-only policy. The admin Export action is not surfaced on mobile (admin-only server gate exists on web; mobile surfaces the admin badge and export hint in the history tab). All mock data retired. Export `WeeklyPerformance` preserved.

## 6) Seed Coverage Status

Weekly performance metrics are derived from upstream plugin tables (workforce, service-credits, etc.); no dedicated seed script is required. Local validation runs against fixtures produced by upstream plugin seed scripts.

## 7) Gaps and Known Technical Debt

1. Non-financial metric dictionary and formulas live in code; no canonical governance document captures the dictionary outside the implementation.
2. The `operations` role now passes the admin gate (week-selection and export) alongside `admin`, matching the access-policy contract `requiredRoles: [admin, operations]`. Read routes already admit any approved member.
3. Mood-related comparison fields are excluded from the current dictionary; whether to reintroduce them is an outstanding product question.
4. Contract gap: the shipped `PUT /api/weekly-performance/admin/week-selection` route (audit command `weekly-performance.admin.week.select`) is not represented in `docs/contracts/WEEKLY_PERFORMANCE_PLUGIN_COMMAND_CONTRACTS.yaml`, which lists only `week.list`, `week.get`, `metrics.get`, `comparison.get`, and `report.export`. The week-selection command should be added to the command/access/audit contracts.

## 8) Change Log

- 2026-06-27: **Closed the two deferred weekly-performance code-review findings (#1128, #1130).** (1) #1130 — added `GET /api/weekly-performance/weeks/[weekStart]`, the full `weekly-performance.week.get` surface: it accepts an arbitrary `weekStart` (validated as an ISO `YYYY-MM-DD` date) and returns `{weekStart, weekEnd, isCurrentWeek, status}` derived from the date (backed by a new `getWeekWindow` repository helper), 404 when the date resolves to no window, and writes a `weekly-performance.week.get` audit row. `/current-week` remains the current-week-only convenience projection of the same command. (2) #1128 — reconciled the `weekly-performance.report.export` command and access-policy contracts to the shipped behavior: the export is a synchronous inline JSON download (`{ok, weekStartDate, metrics}`), so the unbuilt `{exportId, status, artifactUrl, expiresAt}` output, the unbuilt `weekly_performance_exports` dataAccess entry, the never-read `format`/`includeComparison` inputs, the `exportFormatPolicy` attribute, and the `invalid_export_format` deny condition were removed; the route's real gate (`WEEKLY_PERFORMANCE_EXPORT_ENABLED`) is now reflected as the `export_disabled` deny condition. This is contract-to-reality alignment, not a feature removal — a real async artifact pipeline (with a `weekly_performance_exports` table) can be added later if wanted. No schema change.
- 2026-06-27: **Resolved the weekly-performance code-review sweep findings.** (1) Every read/export route now writes a `weekly_performance_audit_trail` row on an allow decision, so `week.list`, `week.get`, `metrics.get`, `comparison.get`, and `report.export` are all audited per the audit contract (was: only the admin week-selection mutation wrote an audit row). (2) The admin gate (`ensureWeeklyPerformanceAdmin`) now admits the `operations` role as well as `admin`, matching the access-policy contract `requiredRoles: [admin, operations]`. (3) The mobile regular screen now shows an "Access restricted" state for members without the admin/operations role instead of silent API failures; the mobile `AuthUser` now carries the normalized `role` claim. (4) The command and audit contract YAMLs were aligned to the shipped table names (`weekly_performance_week_windows` -> `weekly_performance_weeks`, `weekly_performance_metric_snapshots` -> `weekly_performance_metrics`, `weekly_performance_audit_log` -> `weekly_performance_audit_trail`) — documentation alignment only, no schema or table rename. (5) Web-shell fixes: `randomUUID` now uses the runtime-global `crypto.randomUUID()` (Edge-safe), the declining-metric card shows a downward-trend icon, and `ComparisonResponse.comparison` is typed optional/nullable to match the route. No schema change.
- 2026-06-25: **Documented the two owned storage tables** (inventory-debt burn-down — documentation catch-up, no code change). Added `weekly_performance_metrics` (per-week aggregate store) and `weekly_performance_audit_trail` (admin allow/deny audit log) to §3.1, each from its `schema.sql` definition. Removed these two tables from `ctf/scripts/inventory-drift-allowlist.json`.
- 2026-06-16: The active-member signal now has a writer. The current-week active-member count (`GET /current-week`) reads `login_events` via `countActiveUsersLastDays`, but nothing wrote that table, so the count was always 0. Added `recordLoginEvent` (`lib/engagement/login-activity.ts`), called from the shared access gate for every signed-in member (deduplicated to one row per member per UTC day), which now populates the table this review reads. No schema, route, or contract change here (the writer lives in shared engagement/auth code); the same fix unblocked PeerProgramming weekly cohort assignment, which reads the same table.
- 2026-06-16: The current week is now always shown, even before any metrics exist for it. Previously, when the `weekly_performance_weeks` table had no rows (the normal state in production until upstream metrics are recorded), `listWeeks()` returned an empty list and `getCurrentWeek()` returned `null`, so the admin surface rendered only a bare "No weeks are tracked yet" message. `lib/weekly-performance/repository.ts` now synthesizes the current week (open, derived from `DATE_TRUNC('week', NOW())`) at read time in both `listWeeks()` (via a `UNION` that adds the current week when absent) and `getCurrentWeek()` (via a `LEFT JOIN`), so the dashboard and admin shells render their normal structure with zero/empty values instead of a blank page. The synthesized week is persisted only when an admin sets it active: `selectWeek()` now inserts the row on first activation when no row exists yet (the table has no unique constraint on `week_start_date`, so an `UPDATE`-then-`INSERT` is used rather than an upsert). Web and Android both consume the same read routes, so this fixes parity for free. No schema or contract change.
- 2026-06-12: The Android Weekly Performance API client (`packages/mobile/src/features/weekly-performance/api.ts`) now uses the shared authenticated fetch helper, which attaches the signed-in user's Clerk bearer token and reads the server address from runtime config (`APP_URL`), replacing plain fetch calls against hardcoded development URLs. No schema, route, or contract change.
- 2026-06-06: Turned the Weekly Performance admin page from a thin stub into a real, mobile-responsive admin UI and added an Android admin screen. Web: `app/admin/weekly-performance/page.tsx` now renders the new client shell `components/weekly-performance/wp-admin-shell.tsx` (same admin gate as the other admin pages; `useIsMobile()` responsive); surfaces week selection (`PUT /api/weekly-performance/admin/week-selection`, CSRF header), the selected week's metrics (`GET /api/weekly-performance/metrics`), and export (`GET /api/weekly-performance/export`), with loading/empty/populated and success/error states. Android: added `AdminWeeklyPerformance.tsx` (design `MobileWeeklyPerformanceAdminView.tsx`), admin-gated and registered in `App.tsx`, with a `selectActiveWeek` helper added to `api.ts`. Fabricated plugin breakdown and daily bar chart from the mockup omitted (no backing API field). Noted the week-selection command/contract gap (section 7). No schema change.
- 2026-05-31: Android pixel pass (design `MobileWeeklyPerformance.tsx`). Rewrote `packages/mobile/src/features/weekly-performance/WeeklyPerformance.tsx` to align with canonical mockup; introduced `api.ts` binding to real routes (`/weeks`, `/current-week`, `/metrics`). Four states: Loading, Public, Empty, Populated. Metric cards keyed on real `metricKey` fields. Daily chart omitted (no backing API field). Mock data retired. No schema/API/contract change.
- 2026-05-29: Web UI circle-back (design `c5d83c0`; unblocked by the design re-pin). Rebuilt the user-facing weekly-performance shell from the baseline server summary to the full client dashboard in `WeeklyPerformance.tsx` (+ Empty/Loading), wired to the documented read routes and the admin export. Decomposed into modular sub-components (`wp-shared`, `wp-loading`, `wp-icon-rail`, `wp-sidebar`, `wp-metric-cards`, `wp-comparison-chart`, `wp-empty-main`, `wp-dashboard-main`, `wp-right-rail`, plus the shell). Real data only; the dummy daily chart became a real this-week-vs-last-week per-metric comparison and the unbacked "Top Apps" widget was omitted. No schema/API change.
- 2026-05-18: Replaced "Web and Android Parity Notes" with canonical "Web and Android Delivery Status" (`web+android complete`). Renamed "Open Decisions" to canonical "Gaps and Known Technical Debt" and removed Android-parity-milestone entry per Rule 105.
- 2026-02-25: Created initial Weekly Performance plugin inventory.
- 2026-02-25: Updated Weekly Performance plugin scope to remove financial/revenue metric reporting from dashboard parity.


## Build Checklist


### Scope and Boundary

- [ ] Confirm implementation scope is `ctf/` only.
  - Acceptance criteria:
    - No implementation work is required in `platform/`.
- [ ] Confirm plugin slug and namespace lock.
  - Acceptance criteria:
    - Stable plugin slug is `weekly-performance` across inventory, contracts, and routes.

### �� Contract Lock

- [ ] Define v1 plugin command contracts.
  - Acceptance criteria:
    - Command set conforms to `.claude/rules/201-plugin-command-schema-template.mdc`.
- [ ] Define v1 access policy contracts.
  - Acceptance criteria:
    - Each command includes role/attribute checks, legal basis metadata, and deny conditions under `.claude/rules/202-plugin-access-policy-schema-template.mdc`.
- [ ] Define v1 audit contracts.
  - Acceptance criteria:
    - Each command has allow/deny and result audit coverage under `.claude/rules/203-plugin-audit-schema-template.mdc`.
- [ ] Lock week-boundary and metric dictionary semantics.
  - Acceptance criteria:
    - Week start policy and non-financial metric formulas are documented and approved.

### �� Schema and Migrations

- [ ] Define weekly performance plugin tables/materializations in `ctf/migrations/`.
  - Acceptance criteria:
    - Week windows, metric snapshots, and comparison entities are represented.
- [ ] Define retention and rebuild strategy for aggregated metrics.
  - Acceptance criteria:
    - Retention class, recompute policy, and rollback/replay notes are documented.

### �� API and Policy Implementation

- [ ] Implement admin week list/get and metrics/comparison endpoints.
  - Acceptance criteria:
    - Required fields and deterministic ordering match command contracts.
    - `weekStart` parsing/validation and default-week behavior are deterministic and contract-documented.
- [ ] Implement current-week polling policy.
  - Acceptance criteria:
    - Polling and focus-refetch behavior are enabled only for current-week queries.
- [ ] Implement report export mutation path (if in locked scope).
  - Acceptance criteria:
    - Export action is policy-gated, replay-safe, and contract-tested.
- [ ] Enforce deny-by-default policy checks server-side.
  - Acceptance criteria:
    - Unauthorized role/scope access is denied with stable reason categories.

### �� Web and Mobile Parity

- [ ] Deliver web admin weekly review surface.
  - Acceptance criteria:
    - Week selector, metrics cards, and comparison table are functional and contract-aligned.
    - Previous/current/next controls enforce future-week guardrails.
    - Loading/empty/missing-metrics/error states are deterministic and testable.
- [ ] Deliver Android parity for approved operator read scope.
  - Acceptance criteria:
    - Android outputs equivalent metric values and week semantics for parity scope.
- [ ] Validate cross-platform consistency.
  - Acceptance criteria:
    - Error/deny semantics and metric formatting are equivalent across platforms.

### �� Security and Compliance

- [ ] Verify authz/authn controls for all plugin routes.
  - Acceptance criteria:
    - Admin-protected endpoints enforce server-side RBAC/ABAC and session requirements.
- [ ] Verify CSRF controls for mutation routes.
  - Acceptance criteria:
    - All state-changing endpoints reject missing/invalid CSRF tokens.
- [ ] Verify audit evidence coverage.
  - Acceptance criteria:
    - Allow/deny outcomes and report exports are captured with actor/action/outcome/timestamp correlation fields.

### �� Validation, Seeds, and Release Gates [MVP: VALIDATION DEFERRED — see Rule 118.]

- [ ] Command/access/audit parity design documentation.
  - Acceptance criteria:
    - Command names and required fields are documented across contract files.
- [ ] Week selection and comparison design documentation. [MANUAL TESTING DEFERRED FOR MVP — see Rule 118.]
  - Acceptance criteria:
    - Current/previous week calculation behavior is documented.
    - Current-week-only polling and focus-refetch behavior are documented.
- [ ] Deterministic seed fixtures for weekly metrics scenarios.
  - Acceptance criteria:
    - Seeded week datasets are reproducible via deterministic seed scripts/data.
- [ ] Release gate review.
  - Acceptance criteria:
    - Inventory + checklist are updated in the same PR as accepted scope changes.

### Open Decisions Tracker

- [ ] Final v1 export/report scope.
- [ ] Final Android operator parity breadth.
- [ ] Final non-financial metric set for v1 GA.
- [ ] Final mood-field inclusion decision for comparison outputs.

### Change Log

- 2026-02-25: Created initial Weekly Performance rewrite checklist with contract, schema, API/policy, parity, security/compliance, and validation/release phases.
- 2026-02-25: Updated checklist scope to enforce non-financial weekly metric parity for v1 dashboard reporting.

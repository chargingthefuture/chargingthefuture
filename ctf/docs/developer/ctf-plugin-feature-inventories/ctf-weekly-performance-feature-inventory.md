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

Admin routes:

- `GET /api/weekly-performance/admin/weeks`
- `GET /api/weekly-performance/admin/weeks/:weekStart`
- `GET /api/weekly-performance/admin/weeks/:weekStart/metrics`
- `GET /api/weekly-performance/admin/weeks/:weekStart/comparison`
- `POST /api/weekly-performance/admin/weeks/:weekStart/export`

## 3) Data Dependencies and Contracts

1. Aggregated users-domain metrics (new users, verification/approval totals).
2. Aggregated engagement-domain metrics (DAU/MAU and week comparison signals).
3. Aggregated plugin event metrics (approved non-financial weekly outcome signals).
4. Deterministic week-boundary contract (Saturday-start unless revised during lock).
5. Canonical metric definitions/versioning for all comparison fields.
6. Week payload contract includes explicit current-week and previous-week boundary metadata.

## 4) Security and Compliance Controls

1. Admin-only authorization for plugin admin read/report commands.
2. Server-side RBAC/ABAC checks and deny-by-default policy enforcement.
3. CSRF protection for mutation endpoints (including export/report actions).
4. Audit coverage for allow/deny decisions and report exports.
5. Privacy-safe field handling for sensitive operator metrics and exports.

## 5) Web and Android Delivery Status

`web+android complete`. Week-selector behavior, current-week polling policy, empty/error semantics, metric definitions, formatting, and deny reasons are consistent across web (`/apps/weekly-performance`) and Android (`packages/mobile/src/features/weekly-performance`).

Web pixel pass (design `c5d83c0`): the user-facing shell is rebuilt to `design/.../survivor-hub/WeeklyPerformance.tsx` and its Empty/Loading states — icon rail, week-history sidebar, metric cards, a this-week-vs-last-week comparison chart, and a week-summary right rail. Week selection drives `GET /api/weekly-performance/weeks`, `/current-week`, and `/metrics` (with `compareWeekStartDate` for per-metric deltas); admin export opens `GET /api/weekly-performance/export`. Real data only — the mockup's fabricated daily series became a real per-metric current-vs-compare chart scaled relative to the max value in view, metric labels are humanized from `metric_key` (no label column exists), and the unbacked "Top Apps" widget was omitted rather than faked. Decomposed into modular sub-components within the rule-116 limits.

Android pixel pass (design `MobileWeeklyPerformance.tsx`, 2026-05-31): the mobile screen (`packages/mobile/src/features/weekly-performance/WeeklyPerformance.tsx`) is fully rewritten to align with the canonical mockup. A new `api.ts` is introduced, binding to the same three read routes used by web (`GET /api/weekly-performance/weeks`, `/current-week`, `/metrics`). Four states are implemented: Loading (brand phrases centered), Public/unauthenticated (blurred metric preview with lock overlay and sign-in CTA), Empty (week in progress with placeholder cards), and Populated (metrics grid + history tab). Metric cards are driven by known `metricKey` values (`member_count`, `signups`, `engagements`, `gdp_delta`); the mockup's "Daily Engagements" bar chart has no backing API field (metrics are weekly aggregates only) and is omitted per real-data-only policy. The admin Export action is not surfaced on mobile (admin-only server gate exists on web; mobile surfaces the admin badge and export hint in the history tab). All mock data retired. Export `WeeklyPerformance` preserved.

## 6) Seed Coverage Status

Weekly performance metrics are derived from upstream plugin tables (workforce, service-credits, etc.); no dedicated seed script is required. Local validation runs against fixtures produced by upstream plugin seed scripts.

## 7) Gaps and Known Technical Debt

1. Non-financial metric dictionary and formulas live in code; no canonical governance document captures the dictionary outside the implementation.
2. Authorized non-admin read-only access is not surfaced; all read paths require admin role.
3. Mood-related comparison fields are excluded from the current dictionary; whether to reintroduce them is an outstanding product question.

## 8) Change Log

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
    - Command set conforms to `.github/instructions/201-plugin-command-schema-template.mdc`.
- [ ] Define v1 access policy contracts.
  - Acceptance criteria:
    - Each command includes role/attribute checks, legal basis metadata, and deny conditions under `.github/instructions/202-plugin-access-policy-schema-template.mdc`.
- [ ] Define v1 audit contracts.
  - Acceptance criteria:
    - Each command has allow/deny and result audit coverage under `.github/instructions/203-plugin-audit-schema-template.mdc`.
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

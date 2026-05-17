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

### 1.1 Planned User-Facing Scope

1. No general user-facing dashboard is planned for v1.
2. Optional read-only summary cards for authorized non-admin stakeholders remain an open decision.

### 1.2 Planned Admin Feature Scope

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

Planned command groups:

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

## 5) Web and Android Parity Notes

1. Web admin delivery is initial release baseline for week selection and metric comparison.
2. Android parity targets read-equivalent weekly summaries for authorized operators.
3. Week-selector behavior, current-week polling policy, and empty/error semantics must remain cross-platform consistent.
4. Metric definitions, formatting semantics, and deny reasons must remain cross-platform consistent.

## 6) Seed Coverage Status

Seed script requirement: Provide a deterministic plugin seed script with dummy development data for manual plugin validation in dev environments.

## 7) Open Decisions

1. Final non-financial metric dictionary and formula ownership/governance model.
2. Whether export/report commands ship in v1 or v1.1.
3. Authorized non-admin read-only access model, if any.
4. Android admin/operator parity release milestone.
5. Final keep/compute/remove decision for mood-related comparison fields.

## 8) Change Log

- 2026-02-25: Created initial Weekly Performance plugin inventory as plugin-owned CTF rewrite scope with planned command/API surface, data dependencies, security/compliance controls, parity notes, and open decisions.
- 2026-02-25: Updated Weekly Performance plugin scope to remove financial/revenue metric reporting from dashboard parity and keep rewrite authority in plugin-inventory documents.
